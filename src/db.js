const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

class DatabaseManager {
  constructor() {
    this.db = null;
    this.dbPath = path.resolve(__dirname, '../private/mmr.db');
    this.sqlPath = path.resolve(__dirname, '../install.sql');
  }
  
  getConnection() {
    if (this.db) return this.db;
    
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    
    this.db = new Database(this.dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    
    // Check if the users table actually exists in the database
    const tableExists = this.db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='users'"
    ).get();
    
    if (!tableExists) {
      this.initializeDatabase();
    }
    
    return this.db;
  }
  
  initializeDatabase() {
    if (!fs.existsSync(this.sqlPath)) {
      throw new Error(`Critical: Schema file missing at ${this.sqlPath}`);
    }
    
    try {
      const sql = fs.readFileSync(this.sqlPath, 'utf8');
      this.db.exec(sql);
      console.log('Database schema verified/installed.');
    } catch (err) {
      console.error('Migration Error:', err);
      throw err;
    }
  }
  
  prepare(sql) {
    return this.getConnection().prepare(sql);
  }
  
  transaction(callback) {
    return this.getConnection().transaction(callback);
  }
  
  exec(sql) {
    return this.getConnection().exec(sql);
  }
  
  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

const dbManager = new DatabaseManager();

// Clean shutdown
const shutdown = () => {
  dbManager.close();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

module.exports = dbManager;