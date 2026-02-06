const sqlite3 = require("sqlite3").verbose();
const path = require("path");

// Mantém o mesmo comportamento do projeto original: arquivo agenda.db na raiz do projeto
const dbPath = process.env.DB_PATH || path.join(process.cwd(), "agenda.db");
const db = new sqlite3.Database(dbPath);

module.exports = { db, dbPath };
