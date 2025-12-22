const Database = require('better-sqlite3');

class DatabaseManager {
  constructor() {
    this.db = null;
    this.dbPath = './private/mmr.db';
  }
  
  getConnection() {
    if (!this.db) {
      this.db = new Database(this.dbPath);
      console.log('Database connection established');
    }
    return this.db;
  }
  
  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
      console.log('Database connection closed');
    }
  }
  
  prepare(sql) {
    return this.getConnection().prepare(sql);
  }
  
  transaction(callback) {
    return this.getConnection().transaction(callback);
  }
}

const dbManager = new DatabaseManager();

// Graceful shutdown
process.on('SIGINT', () => {
  dbManager.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  dbManager.close();
  process.exit(0);
});

module.exports = dbManager;