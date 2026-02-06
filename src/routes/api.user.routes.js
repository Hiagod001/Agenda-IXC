const express = require("express");
const { db } = require("../db/connection");
const { getEffectivePermissions } = require("../middleware/requirePermission");

const router = express.Router();

/**
 * Sessão atual + permissões efetivas (para o front montar menu/visibilidade).
 */
router.get('/user', async (req, res) => {
  try {
    console.log(`[LOG] Usuário '${req.session.user.username}' verificou a sessão.`);

    const user = req.session.user;

    // garante permissões carregadas
    const perms = await getEffectivePermissions(user);
    req.session.user.permissions = perms;

    res.json({ ...user, permissions: perms });
  } catch (err) {
    console.error('Erro ao retornar /api/user:', err);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

/**
 * Preferências do usuário (ex.: tema).
 * - GET /api/me/preferences  -> { theme: 'dark'|'light'|null }
 * - PUT /api/me/preferences  -> { key, value }  (ou { theme: 'dark' })
 */
router.get('/me/preferences', (req, res) => {
  const userId = req.session.user.id;
  db.all("SELECT key, value FROM user_preferences WHERE user_id = ?", [userId], (err, rows) => {
    if (err) return res.status(500).json({ error: "Erro interno do servidor" });
    const prefs = {};
    (rows || []).forEach(r => { prefs[r.key] = r.value; });
    res.json(prefs);
  });
});

router.put('/me/preferences', (req, res) => {
  const userId = req.session.user.id;
  const body = req.body || {};
  // aceita formato { key, value } ou objeto direto (ex: { theme: 'dark' })
  const entries = body.key ? [[body.key, body.value]] : Object.entries(body);

  if (!entries.length) return res.status(400).json({ error: "Nada para salvar" });

  const stmt = db.prepare("INSERT OR REPLACE INTO user_preferences (user_id, key, value, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)");
  entries.forEach(([k, v]) => stmt.run([userId, String(k), v == null ? null : String(v)]));
  stmt.finalize((err) => {
    if (err) return res.status(500).json({ error: "Erro interno do servidor" });
    res.json({ ok: true });
  });
});

module.exports = router;
