const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

class DatabaseManager {
  constructor(options = {}) {
    this.db = null;
    this.dbPath = options.dbPath || path.resolve(__dirname, '../private/mmr.db');
    this.sqlPath = options.sqlPath || path.resolve(__dirname, '../install.sql');
    this.verbose = options.verbose || false;
    this.preparedStatements = new Map();
  }
  
  getConnection() {
    if (this.db) return this.db;
    
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    this.db = new Database(this.dbPath, { verbose: this.verbose ? console.log : null });
    
    // Write-Ahead Logging: allows concurrent reads during writes
    this.db.pragma('journal_mode = WAL');
    
    // Enable foreign key constraints for data integrity
    this.db.pragma('foreign_keys = ON');
    
    // Balanced durability: faster writes, safe with WAL mode
    this.db.pragma('synchronous = NORMAL');
    
    // Busy timeout: wait up to 5 seconds if database is locked
    this.db.pragma('busy_timeout = 5000');
    
    // Initialize schema if needed
    this.checkAndInitialize();
    
    return this.db;
  }
  
  checkAndInitialize() {
    const tableExists = this.db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='users'"
    ).get();
    
    if (!tableExists) {
      this.initializeDatabase();
    }
  }
  
  initializeDatabase() {
    if (!fs.existsSync(this.sqlPath)) {
      throw new Error(`Critical: Schema file missing at ${this.sqlPath}`);
    }
    
    try {
      const sql = fs.readFileSync(this.sqlPath, 'utf8');
      this.db.exec(sql);
      console.log('Database schema initialized successfully');
    } catch (err) {
      console.error('Database initialization error:', err);
      throw err;
    }
  }
  
  // Cache prepared statements for reuse
  prepare(sql) {
    if (this.preparedStatements.has(sql)) {
      return this.preparedStatements.get(sql);
    }
    
    const stmt = this.getConnection().prepare(sql);
    this.preparedStatements.set(sql, stmt);
    return stmt;
  }
  
  transaction(callback) {
    return this.getConnection().transaction(callback);
  }
  
  exec(sql) {
    return this.getConnection().exec(sql);
  }
  
  // Health check method
  isHealthy() {
    try {
      this.getConnection().prepare('SELECT 1').get();
      return true;
    } catch (err) {
      console.error('Database health check failed:', err);
      return false;
    }
  }
  
  // Backup database
  backup(backupPath) {
    try {
      const backup = this.getConnection().backup(backupPath);
      backup.step(-1); // Copy all pages
      backup.finish();
      console.log(`Database backed up to ${backupPath}`);
      return true;
    } catch (err) {
      console.error('Backup failed:', err);
      return false;
    }
  }
  
  // Optimize database (vacuum and analyze)
  optimize() {
    try {
      this.getConnection().pragma('optimize');
      console.log('Database optimized');
    } catch (err) {
      console.error('Optimization failed:', err);
    }
  }
  
  close() {
    if (this.db) {
      try {
        // Clear prepared statements cache
        this.preparedStatements.clear();
        
        // Checkpoint WAL before closing
        this.db.pragma('wal_checkpoint(TRUNCATE)');
        
        this.db.close();
        console.log('Database connection closed');
      } catch (err) {
        console.error('Error closing database:', err);
      } finally {
        this.db = null;
      }
    }
  }
}

// Singleton instance
const dbManager = new DatabaseManager({
  verbose: process.env.DB_VERBOSE === 'true'
});

// Graceful shutdown handler
const shutdown = (signal) => {
  console.log(`\nReceived ${signal}, shutting down gracefully...`);
  dbManager.close();
  process.exit(0);
};

// Register signal handlers
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// Handle unexpected errors
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  dbManager.close();
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection at:', promise, 'reason:', reason);
  dbManager.close();
  process.exit(1);
});

// Periodic optimization (once per day)
if (process.env.NODE_ENV === 'production') {
  setInterval(() => {
    dbManager.optimize();
  }, 24 * 60 * 60 * 1000);
}

module.exports = dbManager;