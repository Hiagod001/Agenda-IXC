const express = require('express');
const bcrypt = require('bcrypt');
const path = require('path');
const session = require('express-session');
const sqlite3 = require('sqlite3').verbose();
const axios = require('axios');
const cors = require('cors');

require('dotenv').config();

const app = express();
const port = process.env.PORT || 3001;

// Configurações básicas
const cidades = ['PARACATU', 'PATROCINIO', 'PATOS DE MINAS', 'VARJÃO DE MINAS', 'LAGOA FORMOSA', 'PANTANO', 'CARMO DO PARANAIBA', 'CRUZEIRO DA FORTALEZA', 'SAO GONÇALO'];
const tecnicos = ['João Silva', 'Maria Souza', 'Carlos Rocha', 'A definir'];
const statusPossiveis = ['Aberta', 'Agendada', 'Em andamento', 'Concluída', 'Cancelada'];

// Estrutura de vagas por cidade
const ESTRUTURA_VAGAS = {
    "PATOS DE MINAS": {
        "MANHÃ": { "SEM CONEXÃO": 7, "CONEXÃO LENTA": 3, "AGENDAMENTO": 5 },
        "TARDE": { "SEM CONEXÃO": 7, "CONEXÃO LENTA": 3, "AGENDAMENTO": 5 }
    },
    "PATROCINIO": {
        "MANHÃ": { "SEM CONEXÃO": 4, "CONEXÃO LENTA": 2, "AGENDAMENTO": 2 },
        "TARDE": { "SEM CONEXÃO": 4, "CONEXÃO LENTA": 2, "AGENDAMENTO": 2 }
    },
    "PARACATU": {
        "MANHÃ": { "SEM CONEXÃO": 4, "CONEXÃO LENTA": 2, "AGENDAMENTO": 2 },
        "TARDE": { "SEM CONEXÃO": 4, "CONEXÃO LENTA": 2, "AGENDAMENTO": 2 }
    },
    "VARJÃO DE MINAS": {
        "MANHÃ": { "SEM CONEXÃO": 2, "CONEXÃO LENTA": 1, "AGENDAMENTO": 1 },
        "TARDE": { "SEM CONEXÃO": 2, "CONEXÃO LENTA": 1, "AGENDAMENTO": 1 }
    },
    "LAGOA FORMOSA": {
        "MANHÃ": { "SEM CONEXÃO": 3, "CONEXÃO LENTA": 1, "AGENDAMENTO": 2 },
        "TARDE": { "SEM CONEXÃO": 3, "CONEXÃO LENTA": 1, "AGENDAMENTO": 2 }
    },
    "PANTANO": {
        "MANHÃ": { "SEM CONEXÃO": 2, "CONEXÃO LENTA": 1, "AGENDAMENTO": 1 },
        "TARDE": { "SEM CONEXÃO": 2, "CONEXÃO LENTA": 1, "AGENDAMENTO": 1 }
    },
    "CARMO DO PARANAIBA": {
        "MANHÃ": { "SEM CONEXÃO": 3, "CONEXÃO LENTA": 2, "AGENDAMENTO": 2 },
        "TARDE": { "SEM CONEXÃO": 3, "CONEXÃO LENTA": 2, "AGENDAMENTO": 2 }
    },
    "CRUZEIRO DA FORTALEZA": {
        "MANHÃ": { "SEM CONEXÃO": 2, "CONEXÃO LENTA": 1, "AGENDAMENTO": 1 },
        "TARDE": { "SEM CONEXÃO": 2, "CONEXÃO LENTA": 1, "AGENDAMENTO": 1 }
    },
    "SAO GONÇALO": {
        "MANHÃ": { "SEM CONEXÃO": 2, "CONEXÃO LENTA": 1, "AGENDAMENTO": 1 },
        "TARDE": { "SEM CONEXÃO": 2, "CONEXÃO LENTA": 1, "AGENDAMENTO": 1 }
    }
};

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: process.env.SESSION_SECRET || 'uai-telecom-secret-key-2024',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: false, // Para desenvolvimento
        maxAge: 24 * 60 * 60 * 1000 // 24 horas
    }
}));

// Banco de dados
const db = new sqlite3.Database('./agenda.db');

// Configuração da API IXC
let ixcApi = null;
if (process.env.IXC_TOKEN && process.env.IXC_URL) {
    const basicAuthToken = Buffer.from(process.env.IXC_TOKEN).toString('base64');
    ixcApi = axios.create({
        baseURL: process.env.IXC_URL,
        headers: { 
            'Authorization': `Basic ${basicAuthToken}`, 
            'Content-Type': 'application/json' 
        },
        timeout: 20000
    });
}

// Função para validar entrada
function validateInput(data, requiredFields) {
    const errors = [];
    
    for (const field of requiredFields) {
        if (!data[field] || data[field].toString().trim() === '') {
            errors.push(`Campo '${field}' é obrigatório`);
        }
    }
    
    return errors;
}

// Função para hash de senha
async function hashPassword(password) {
    return await bcrypt.hash(password, 10);
}

// Função para verificar senha
async function verifyPassword(password, hash) {
    return await bcrypt.compare(password, hash);
}

// Inicialização do banco de dados
function initializeDatabase() {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            // Tabela de usuários
            db.run(`CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                role TEXT DEFAULT 'user',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                last_login DATETIME
            )`);

            // Tabela de agendamentos
            db.run(`CREATE TABLE IF NOT EXISTS agendamentos (
                id INTEGER PRIMARY KEY,
                cliente TEXT NOT NULL,
                assunto TEXT NOT NULL,
                cidade TEXT NOT NULL,
                data_hora TEXT NOT NULL,
                observacao TEXT,
                tecnico TEXT,
                status TEXT DEFAULT 'Aberta',
                created_by TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);

            // Tabela de logs
            db.run(`CREATE TABLE IF NOT EXISTS logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                user TEXT,
                action TEXT,
                details TEXT,
                ip_address TEXT
            )`);

            // Inserir usuários padrão se não existirem
            const defaultUsers = [
                { username: 'hiago', password: 'hiago123', role: 'admin' },
                { username: 'suporte', password: 'suporte123', role: 'user' },
                { username: 'agendamento', password: 'agenda123', role: 'user' }
            ];

            defaultUsers.forEach(async (user) => {
                const hashedPassword = await hashPassword(user.password);
                db.run(`INSERT OR IGNORE INTO users (username, password_hash, role) VALUES (?, ?, ?)`, 
                    [user.username, hashedPassword, user.role]);
            });

            resolve();
        });
    });
}

// Middleware de autenticação
const authMiddleware = (req, res, next) => {
    if (req.session && req.session.user) {
        return next();
    }
    
    console.log(`[LOG] Acesso bloqueado para rota não autenticada: ${req.method} ${req.path}`);
    
    if (req.path.startsWith('/api/')) {
        return res.status(401).json({ error: 'Sessão não autorizada.' });
    }
    
    return res.redirect('/login.html');
};

// Middleware de log
const logMiddleware = (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - IP: ${ip}`);
    next();
};

app.use(logMiddleware);

// Arquivos estáticos
app.use(express.static(path.join(__dirname, 'public')));

// Rotas públicas
app.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        const errors = validateInput(req.body, ['username', 'password']);
        if (errors.length > 0) {
            return res.status(400).json({ message: 'Dados inválidos', errors });
        }

        db.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
            if (err) {
                console.error('Erro no banco de dados:', err);
                return res.status(500).json({ message: 'Erro interno do servidor' });
            }

            if (user && await verifyPassword(password, user.password_hash)) {
                req.session.user = { 
                    id: user.id,
                    username: user.username, 
                    role: user.role 
                };
                
                // Atualizar último login
                db.run('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);
                
                // Log de login
                const ip = req.ip || req.connection.remoteAddress;
                db.run('INSERT INTO logs (user, action, details, ip_address) VALUES (?, ?, ?, ?)', 
                    [username, 'LOGIN', 'Login realizado com sucesso', ip]);
                
                console.log(`[LOG] Usuário '${username}' fez LOGIN com sucesso.`);
                return res.status(200).json({ message: 'Login bem-sucedido', user: req.session.user });
            } else {
                console.log(`[LOG] Falha no login para o usuário: '${username}'.`);
                return res.status(401).json({ message: 'Usuário ou senha inválidos' });
            }
        });
    } catch (error) {
        console.error('Erro no login:', error);
        res.status(500).json({ message: 'Erro interno do servidor' });
    }
});

app.get('/logout', (req, res) => {
    const username = req.session.user?.username || 'Desconhecido';
    console.log(`[LOG] Usuário '${username}' fez LOGOUT.`);
    
    // Log de logout
    const ip = req.ip || req.connection.remoteAddress;
    db.run('INSERT INTO logs (user, action, details, ip_address) VALUES (?, ?, ?, ?)', 
        [username, 'LOGOUT', 'Logout realizado', ip]);
    
    req.session.destroy(() => res.redirect('/login.html'));
});

// Aplicar middleware de autenticação para rotas protegidas
app.use(['/', '/index.html', '/api'], authMiddleware);

// Rotas protegidas
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API Endpoints
app.get('/api/user', (req, res) => {
    console.log(`[LOG] Usuário '${req.session.user.username}' verificou a sessão.`);
    res.json(req.session.user);
});

app.get('/api/cliente/:id', async (req, res) => {
    try {
        const id = req.params.id;
        
        if (!ixcApi) {
            return res.status(503).json({ erro: "API IXC não configurada." });
        }
        
        console.log(`[LOG] Usuário '${req.session.user.username}' consultou o cliente IXC com ID: ${id}`);
        
        const payload = { qtype: "cliente.id", query: id, oper: "=", rp: "1" };
        const response = await ixcApi.get('/cliente', {
            headers: { 'ixcsoft': 'listar' },
            data: payload
        });
        
        const registros = response.data.registros;
        if (!registros || registros.length === 0) {
            console.log(`[LOG] Consulta IXC para ID ${id} não retornou resultados.`);
            return res.status(404).json({ erro: "Cliente não encontrado." });
        }
        
        const clienteData = registros[0];
        console.log(`[LOG] Consulta IXC para ID ${id} retornou o cliente: ${clienteData.razao}`);
        res.json({ cliente: clienteData.razao, cidade: clienteData.cidade });
        
    } catch (error) {
        console.error('Erro ao consultar IXC:', error.response?.data || error.message);
        res.status(500).json({ erro: "Erro ao consultar API IXC." });
    }
});

app.get('/api/agendamentos', (req, res) => {
    console.log(`[LOG] Usuário '${req.session.user.username}' carregou a lista de agendamentos.`);
    
    const { page = 1, limit = 50, status, cidade, tecnico } = req.query;
    const offset = (page - 1) * limit;
    
    let sql = "SELECT * FROM agendamentos WHERE 1=1";
    let params = [];
    
    if (status) {
        sql += " AND status = ?";
        params.push(status);
    }
    
    if (cidade) {
        sql += " AND cidade = ?";
        params.push(cidade);
    }
    
    if (tecnico) {
        sql += " AND tecnico = ?";
        params.push(tecnico);
    }
    
    sql += " ORDER BY id DESC LIMIT ? OFFSET ?";
    params.push(parseInt(limit), parseInt(offset));
    
    db.all(sql, params, (err, rows) => {
        if (err) {
            console.error('Erro ao buscar agendamentos:', err);
            return res.status(500).json({ error: "Erro interno do servidor" });
        }
        res.json(rows);
    });
});

app.post('/api/agendamentos', (req, res) => {
    try {
        const { id, cliente, assunto, cidade, data_hora, observacao, tecnico, status } = req.body;
        
        const errors = validateInput(req.body, ['id', 'cliente', 'assunto', 'cidade', 'data_hora']);
        if (errors.length > 0) {
            return res.status(400).json({ error: 'Dados inválidos', details: errors });
        }
        
        console.log(`[LOG] Usuário '${req.session.user.username}' está ADICIONANDO a OS para o cliente '${cliente}' com assunto '${assunto}'.`);
        
        const sql = `INSERT INTO agendamentos (id, cliente, assunto, cidade, data_hora, observacao, tecnico, status, created_by) 
                     VALUES (?,?,?,?,?,?,?,?,?)`;
        
        db.run(sql, [id, cliente, assunto, cidade, data_hora, observacao || '', tecnico || 'A definir', status || 'Aberta', req.session.user.username], function(err) {
            if (err) {
                console.error('Erro ao criar agendamento:', err);
                return res.status(400).json({ error: "Erro ao criar agendamento" });
            }
            
            const details = `OS para '${cliente}' criada com ID ${id}`;
            const ip = req.ip || req.connection.remoteAddress;
            db.run(`INSERT INTO logs (user, action, details, ip_address) VALUES (?, ?, ?, ?)`, 
                [req.session.user.username, 'CREATE', details, ip]);
            
            res.json({ message: "Agendamento criado com sucesso", id: this.lastID });
        });
    } catch (error) {
        console.error('Erro ao processar agendamento:', error);
        res.status(500).json({ error: "Erro interno do servidor" });
    }
});

app.put('/api/agendamentos/:id', (req, res) => {
    try {
        const { cliente, assunto, cidade, data_hora, observacao, tecnico, status } = req.body;
        
        const errors = validateInput(req.body, ['cliente', 'assunto', 'cidade', 'data_hora']);
        if (errors.length > 0) {
            return res.status(400).json({ error: 'Dados inválidos', details: errors });
        }
        
        console.log(`[LOG] Usuário '${req.session.user.username}' está ATUALIZANDO a OS ID ${req.params.id} do cliente '${cliente}'.`);
        
        const sql = `UPDATE agendamentos SET cliente = ?, assunto = ?, cidade = ?, data_hora = ?, 
                     observacao = ?, tecnico = ?, status = ?, updated_at = CURRENT_TIMESTAMP 
                     WHERE id = ?`;
        
        db.run(sql, [cliente, assunto, cidade, data_hora, observacao || '', tecnico || 'A definir', status || 'Aberta', req.params.id], function(err) {
            if (err) {
                console.error('Erro ao atualizar agendamento:', err);
                return res.status(400).json({ error: "Erro ao atualizar agendamento" });
            }
            
            if (this.changes === 0) {
                return res.status(404).json({ error: "Agendamento não encontrado" });
            }
            
            const details = `OS ID ${req.params.id} ('${cliente}') atualizada`;
            const ip = req.ip || req.connection.remoteAddress;
            db.run(`INSERT INTO logs (user, action, details, ip_address) VALUES (?, ?, ?, ?)`, 
                [req.session.user.username, 'UPDATE', details, ip]);
            
            res.json({ message: "Agendamento atualizado com sucesso", changes: this.changes });
        });
    } catch (error) {
        console.error('Erro ao atualizar agendamento:', error);
        res.status(500).json({ error: "Erro interno do servidor" });
    }
});

app.delete('/api/agendamentos/:id', (req, res) => {
    try {
        console.log(`[LOG] Usuário '${req.session.user.username}' está DELETANDO a OS ID ${req.params.id}.`);
        
        const sql = `DELETE FROM agendamentos WHERE id = ?`;
        
        db.run(sql, [req.params.id], function(err) {
            if (err) {
                console.error('Erro ao deletar agendamento:', err);
                return res.status(400).json({ error: "Erro ao deletar agendamento" });
            }
            
            if (this.changes === 0) {
                return res.status(404).json({ error: "Agendamento não encontrado" });
            }
            
            const details = `OS ID ${req.params.id} deletada`;
            const ip = req.ip || req.connection.remoteAddress;
            db.run(`INSERT INTO logs (user, action, details, ip_address) VALUES (?, ?, ?, ?)`, 
                [req.session.user.username, 'DELETE', details, ip]);
            
            res.json({ message: "Agendamento deletado com sucesso", changes: this.changes });
        });
    } catch (error) {
        console.error('Erro ao deletar agendamento:', error);
        res.status(500).json({ error: "Erro interno do servidor" });
    }
});

app.get('/api/config', (req, res) => {
    res.json({
        cidades: cidades,
        tecnicos: tecnicos,
        statusPossiveis: statusPossiveis
    });
});

app.get('/api/vagas/:cidade/:data', (req, res) => {
    try {
        const { cidade, data } = req.params;
        console.log(`[LOG] Usuário '${req.session.user.username}' está consultando vagas para a cidade '${cidade}' na data '${data}'.`);
        
        const templateVagas = ESTRUTURA_VAGAS[cidade.toUpperCase()];
        
        if (!templateVagas) {
            return res.status(404).json({ error: "Estrutura de vagas não encontrada para esta cidade." });
        }
        
        const sql = `SELECT assunto, tecnico FROM agendamentos WHERE cidade = ? AND data_hora LIKE ? 
                     AND (assunto = 'SEM CONEXÃO' OR assunto = 'CONEXÃO LENTA' OR assunto = 'AGENDAMENTO')`;
        
        db.all(sql, [cidade, `${data}%`], (err, agendamentosDoDia) => {
            if (err) {
                console.error('Erro ao buscar vagas:', err);
                return res.status(500).json({ error: "Erro interno do servidor" });
            }
            
            res.json({
                template: templateVagas,
                ocupadas: agendamentosDoDia
            });
        });
    } catch (error) {
        console.error('Erro ao processar vagas:', error);
        res.status(500).json({ error: "Erro interno do servidor" });
    }
});

// Endpoint para buscar agendamentos não alocados (aguardando agendamento)
app.get('/api/agendamentos/nao-alocados', (req, res) => {
    try {
        console.log(`[LOG] Usuário '${req.session.user.username}' carregou agendamentos não alocados.`);
        
        const sql = `SELECT * FROM agendamentos WHERE status = 'Aberta' ORDER BY created_at ASC`;
        
        db.all(sql, [], (err, rows) => {
            if (err) {
                console.error('Erro ao buscar agendamentos não alocados:', err);
                return res.status(500).json({ error: "Erro interno do servidor" });
            }
            res.json(rows);
        });
        
    } catch (error) {
        console.error('Erro ao processar agendamentos não alocados:', error);
        res.status(500).json({ error: "Erro interno do servidor" });
    }
});

// Endpoint para alocar agendamento em uma vaga (drag-and-drop)
app.put('/api/agendamentos/:id/alocar', (req, res) => {
    try {
        const { id } = req.params;
        const { data_hora, periodo, vaga_assunto } = req.body;
        
        const errors = validateInput(req.body, ['data_hora', 'periodo', 'vaga_assunto']);
        if (errors.length > 0) {
            return res.status(400).json({ error: 'Dados inválidos', details: errors });
        }
        
        console.log(`[LOG] Usuário '${req.session.user.username}' está ALOCANDO a OS ID ${id} para ${data_hora} (${periodo}).`);
        
        // Verificar se a vaga está disponível
        const checkSql = `SELECT COUNT(*) as count FROM agendamentos 
                         WHERE DATE(data_hora) = DATE(?) 
                         AND assunto = ? 
                         AND status != 'Cancelada'
                         AND ((strftime('%H', data_hora) < '12' AND ? = 'MANHÃ') 
                              OR (strftime('%H', data_hora) >= '12' AND ? = 'TARDE'))`;
        
        db.get(checkSql, [data_hora, vaga_assunto, periodo, periodo], (err, result) => {
            if (err) {
                console.error('Erro ao verificar disponibilidade:', err);
                return res.status(500).json({ error: "Erro interno do servidor" });
            }
            
            // Buscar cidade do agendamento para verificar limite de vagas
            db.get('SELECT cidade FROM agendamentos WHERE id = ?', [id], (err, agendamento) => {
                if (err || !agendamento) {
                    return res.status(404).json({ error: "Agendamento não encontrado" });
                }
                
                const cidade = agendamento.cidade;
                const limiteVagas = ESTRUTURA_VAGAS[cidade]?.[periodo]?.[vaga_assunto] || 0;
                
                if (result.count >= limiteVagas) {
                    return res.status(400).json({ 
                        error: `Vaga indisponível. Limite de ${limiteVagas} agendamentos para ${vaga_assunto} no período ${periodo}.` 
                    });
                }
                
                // Alocar o agendamento
                const updateSql = `UPDATE agendamentos 
                                  SET data_hora = ?, status = 'Agendada', updated_at = CURRENT_TIMESTAMP 
                                  WHERE id = ?`;
                
                db.run(updateSql, [data_hora, id], function(err) {
                    if (err) {
                        console.error('Erro ao alocar agendamento:', err);
                        return res.status(500).json({ error: "Erro ao alocar agendamento" });
                    }
                    
                    if (this.changes === 0) {
                        return res.status(404).json({ error: "Agendamento não encontrado" });
                    }
                    
                    const details = `OS ID ${id} alocada para ${data_hora} (${periodo})`;
                    const ip = req.ip || req.connection.remoteAddress;
                    db.run(`INSERT INTO logs (user, action, details, ip_address) VALUES (?, ?, ?, ?)`, 
                        [req.session.user.username, 'ALLOCATE', details, ip]);
                    
                    res.json({ message: "Agendamento alocado com sucesso", changes: this.changes });
                });
            });
        });
        
    } catch (error) {
        console.error('Erro ao alocar agendamento:', error);
        res.status(500).json({ error: "Erro interno do servidor" });
    }
});

// Endpoint melhorado para consulta de vagas com agendamentos organizados
app.get('/api/vagas-detalhadas/:cidade/:data', (req, res) => {
    try {
        const { cidade, data } = req.params;
        
        if (!ESTRUTURA_VAGAS[cidade]) {
            return res.status(400).json({ error: "Cidade não encontrada" });
        }
        
        console.log(`[LOG] Usuário '${req.session.user.username}' consultou vagas detalhadas para ${cidade} em ${data}.`);
        
        // Buscar agendamentos ocupados para a data
        const sql = `SELECT id, cliente, assunto, data_hora, tecnico, observacao FROM agendamentos 
                    WHERE cidade = ? AND DATE(data_hora) = ? AND status != 'Cancelada'
                    ORDER BY data_hora ASC`;
        
        db.all(sql, [cidade, data], (err, rows) => {
            if (err) {
                console.error('Erro ao consultar vagas:', err);
                return res.status(500).json({ error: "Erro interno do servidor" });
            }
            
            const template = ESTRUTURA_VAGAS[cidade];
            
            // Organizar agendamentos por período e assunto
            const agendamentosOrganizados = {
                'MANHÃ': {},
                'TARDE': {}
            };
            
            // Inicializar estrutura
            Object.keys(template).forEach(periodo => {
                agendamentosOrganizados[periodo] = {};
                Object.keys(template[periodo]).forEach(assunto => {
                    agendamentosOrganizados[periodo][assunto] = [];
                });
            });
            
            // Organizar agendamentos
            rows.forEach(agendamento => {
                const hora = new Date(agendamento.data_hora).getHours();
                const periodo = hora < 12 ? 'MANHÃ' : 'TARDE';
                const assunto = agendamento.assunto;
                
                if (agendamentosOrganizados[periodo] && agendamentosOrganizados[periodo][assunto]) {
                    agendamentosOrganizados[periodo][assunto].push({
                        id: agendamento.id,
                        cliente: agendamento.cliente,
                        hora: new Date(agendamento.data_hora).toLocaleTimeString('pt-BR', { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                        }),
                        tecnico: agendamento.tecnico,
                        observacao: agendamento.observacao
                    });
                }
            });
            
            res.json({ 
                template, 
                agendamentos: agendamentosOrganizados,
                cidade,
                data 
            });
        });
        
    } catch (error) {
        console.error('Erro ao processar consulta de vagas:', error);
        res.status(500).json({ error: "Erro interno do servidor" });
    }
});

app.get('/api/logs', (req, res) => {
    if (req.session.user.role !== 'admin') {
        return res.status(403).json({ error: "Acesso negado" });
    }
    
    const { page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;
    
    const sql = "SELECT * FROM logs ORDER BY timestamp DESC LIMIT ? OFFSET ?";
    
    db.all(sql, [parseInt(limit), parseInt(offset)], (err, rows) => {
        if (err) {
            console.error('Erro ao buscar logs:', err);
            return res.status(500).json({ error: "Erro interno do servidor" });
        }
        res.json(rows);
    });
});

// Tratamento de erros global
app.use((err, req, res, next) => {
    console.error('Erro não tratado:', err);
    res.status(500).json({ error: "Erro interno do servidor" });
});

// Inicializar servidor
async function startServer() {
    try {
        await initializeDatabase();
        
        app.listen(port, '0.0.0.0', () => {
            console.log(`Servidor Uai Telecom Agenda rodando em http://localhost:${port}`);
            console.log(`Ambiente: ${process.env.NODE_ENV || 'development'}`);
        });
    } catch (error) {
        console.error('Erro ao inicializar servidor:', error);
        process.exit(1);
    }
}

startServer();

