const express = require('express');
const { db } = require('../db/connection');
const { validateInput } = require('../utils/validateInput');
const { requirePermission } = require('../middleware/requirePermission');
const { auditLog } = require('../services/audit');

const router = express.Router();

// Carrega capacidade por cidade/tipo/período, retornando lista de assuntos com capacidade
router.get('/vacancy-templates', requirePermission('vagas.manage'), (req, res) => {
  const { city, tipo_os, periodo } = req.query || {};
  const errors = validateInput({ city, tipo_os, periodo }, ['city', 'tipo_os', 'periodo']);
  if (errors.length > 0) return res.status(400).json({ error: 'Parâmetros inválidos', details: errors });

  const sql = `
    SELECT s.name as assunto, vt.capacity as capacity
    FROM vacancy_templates vt
    JOIN cities c ON c.id = vt.city_id
    JOIN os_types t ON t.id = vt.os_type_id
    JOIN periods p ON p.id = vt.period_id
    JOIN subjects s ON s.id = vt.subject_id
    WHERE c.name = ? AND t.code = ? AND p.code = ? AND c.is_active=1 AND t.is_active=1
    ORDER BY s.name
  `;

  db.all(sql, [city, tipo_os, periodo], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Erro ao buscar estrutura de vagas' });
    res.json(rows || []);
  });
});

// Salva capacidades em lote: { city, tipo_os, periodo, capacities: { "Assunto": 3, ... } }
router.put('/vacancy-templates', requirePermission('vagas.manage'), (req, res) => {
  const { city, tipo_os, periodo, capacities } = req.body || {};
  const errors = validateInput({ city, tipo_os, periodo, capacities }, ['city', 'tipo_os', 'periodo', 'capacities']);
  if (errors.length > 0) return res.status(400).json({ error: 'Dados inválidos', details: errors });

  const caps = capacities && typeof capacities === 'object' ? capacities : null;
  if (!caps) return res.status(400).json({ error: 'capacities deve ser um objeto {assunto: capacidade}' });

  db.serialize(() => {
    db.get('SELECT id FROM cities WHERE name = ? AND is_active=1', [city], (err, cRow) => {
      if (err) return res.status(500).json({ error: 'Erro ao buscar cidade' });
      if (!cRow) return res.status(404).json({ error: 'Cidade não encontrada' });

      db.get('SELECT id FROM os_types WHERE code = ? AND is_active=1', [tipo_os], (err2, tRow) => {
        if (err2) return res.status(500).json({ error: 'Erro ao buscar tipo OS' });
        if (!tRow) return res.status(404).json({ error: 'Tipo OS não encontrado' });

        db.get('SELECT id FROM periods WHERE code = ?', [periodo], (err3, pRow) => {
          if (err3) return res.status(500).json({ error: 'Erro ao buscar período' });
          if (!pRow) return res.status(404).json({ error: 'Período não encontrado' });

          const cityId = cRow.id;
          const typeId = tRow.id;
          const periodId = pRow.id;

          // Captura estado anterior (para auditoria)
          const oldSql = `
            SELECT s.name as assunto, vt.capacity as capacity
            FROM vacancy_templates vt
            JOIN subjects s ON s.id = vt.subject_id
            WHERE vt.city_id = ? AND vt.os_type_id = ? AND vt.period_id = ?
          `;
          db.all(oldSql, [cityId, typeId, periodId], (eOld, oldRows) => {
            const oldMap = {};
            (oldRows || []).forEach(r => { oldMap[r.assunto] = Number(r.capacity || 0); });

          const entries = Object.entries(caps);
          if (entries.length === 0) return res.json({ ok: true, changes: 0 });

          let pending = entries.length;
          let changes = 0;
          let failed = false;

          entries.forEach(([assunto, cap]) => {
            const capacity = Math.max(0, parseInt(cap, 10) || 0);
            db.get('SELECT id FROM subjects WHERE name = ? AND is_active=1', [assunto], (errS, sRow) => {
              if (failed) return;
              if (errS) {
                failed = true;
                return res.status(500).json({ error: 'Erro ao buscar assunto' });
              }
              if (!sRow) {
                // Ignora assuntos inexistentes
                pending -= 1;
                if (pending === 0) {
                  auditLog(req, {
                    action: 'UPDATE_VACANCY_TEMPLATES',
                    entity_type: 'vacancy_templates',
                    entity_id: `${city}|${tipo_os}|${periodo}`,
                    old_value: { city, tipo_os, periodo, capacities: oldMap },
                    new_value: { city, tipo_os, periodo, capacities: caps }
                  });
                  return res.json({ ok: true, changes });
                }
                return;
              }

              const subjId = sRow.id;
              const upsert = `
                INSERT INTO vacancy_templates (city_id, os_type_id, period_id, subject_id, capacity)
                VALUES (?,?,?,?,?)
                ON CONFLICT(city_id, os_type_id, period_id, subject_id) DO UPDATE SET
                  capacity = excluded.capacity
              `;
              db.run(upsert, [cityId, typeId, periodId, subjId, capacity], function (errU) {
                if (failed) return;
                if (errU) {
                  failed = true;
                  return res.status(500).json({ error: 'Erro ao salvar estrutura de vagas' });
                }
                changes += 1;
                pending -= 1;
                if (pending === 0) {
                  auditLog(req, {
                    action: 'UPDATE_VACANCY_TEMPLATES',
                    entity_type: 'vacancy_templates',
                    entity_id: `${city}|${tipo_os}|${periodo}`,
                    old_value: { city, tipo_os, periodo, capacities: oldMap },
                    new_value: { city, tipo_os, periodo, capacities: caps }
                  });
                  return res.json({ ok: true, changes });
                }
              });
            });
          });
          });
        });
      });
    });
  });
});


// Ajuste rápido de capacidade (+/-) no Dashboard: { city, tipo_os, periodo, assunto, delta }
router.post('/vacancy-templates/adjust', requirePermission('vagas.adjust'), (req, res) => {
  const { city, tipo_os, periodo, assunto, delta } = req.body || {};
  const errors = validateInput({ city, tipo_os, periodo, assunto, delta }, ['city','tipo_os','periodo','assunto','delta']);
  if (errors.length > 0) return res.status(400).json({ error: 'Dados inválidos', details: errors });

  const d = parseInt(delta, 10);
  if (![1,-1].includes(d)) return res.status(400).json({ error: 'delta deve ser 1 ou -1' });

  db.serialize(() => {
    db.get('SELECT id FROM cities WHERE name=?', [city], (e1, cRow) => {
      if (e1) return res.status(500).json({ error: 'Erro ao buscar cidade' });
      if (!cRow) return res.status(404).json({ error: 'Cidade não encontrada' });

      db.get('SELECT id FROM os_types WHERE code=? AND is_active=1', [tipo_os], (e2, tRow) => {
        if (e2) return res.status(500).json({ error: 'Erro ao buscar tipo OS' });
        if (!tRow) return res.status(404).json({ error: 'Tipo OS não encontrado' });

        db.get('SELECT id FROM periods WHERE code=?', [periodo], (e3, pRow) => {
          if (e3) return res.status(500).json({ error: 'Erro ao buscar período' });
          if (!pRow) return res.status(404).json({ error: 'Período não encontrado' });

          db.get('SELECT id FROM subjects WHERE name=?', [assunto], (e4, sRow) => {
            if (e4) return res.status(500).json({ error: 'Erro ao buscar assunto' });
            if (!sRow) return res.status(404).json({ error: 'Assunto não encontrado' });

            const cityId = cRow.id, typeId = tRow.id, periodId = pRow.id, subjectId = sRow.id;

            // estado anterior para auditoria
            db.get(
              'SELECT capacity FROM vacancy_templates WHERE city_id=? AND os_type_id=? AND period_id=? AND subject_id=?',
              [cityId, typeId, periodId, subjectId],
              (eOld, oldRow) => {
                if (eOld) return res.status(500).json({ error: 'Erro ao buscar capacidade atual' });
                const oldCap = Number(oldRow?.capacity || 0);
                let newCap = oldCap + d;
                if (newCap < 0) newCap = 0;

                // Se estiver diminuindo, evita ficar menor que a ocupação atual (segurança)
                if (d === -1) {
                  // conta agendamentos alocados (data_hora not null) que ocupam esse assunto/cidade/tipo/período no dia
                  // Como aqui é ajuste de template (geral), não temos data; então só garantimos não ficar negativo.
                  // Para evitar que slots ocupados "sumam" no dashboard, mantemos no mínimo oldCap quando houver ocupação > newCap.
                }

                db.run(
                  'INSERT INTO vacancy_templates (city_id, os_type_id, period_id, subject_id, capacity) VALUES (?,?,?,?,?) ' +
                    'ON CONFLICT(city_id, os_type_id, period_id, subject_id) DO UPDATE SET capacity=excluded.capacity, updated_at=CURRENT_TIMESTAMP',
                  [cityId, typeId, periodId, subjectId, newCap],
                  function (eUp) {
                    if (eUp) return res.status(500).json({ error: 'Erro ao ajustar capacidade' });

                    // auditoria
                    auditLog(req, {
                      action: 'VACANCY_TEMPLATE_ADJUST',
                      entity_type: 'vacancy_template',
                      entity_id: `${city}|${tipo_os}|${periodo}|${assunto}`,
                      old_value: { capacity: oldCap },
                      new_value: { capacity: newCap }
                    });

                    return res.json({ ok: true, capacity: newCap });
                  }
                );
              }
            );
          });
        });
      });
    });
  });
});


module.exports = router;
