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

    this.migrateAssociations();
    this.migrateIdentity();
    this.migrateProfiles();
  }

  /*
    What /cert answers besides the cert and the profile pages show: the avatar and the last nickname each account had
    in its last reported match (any account type), and the Steam name and avatar the broker fetched, cached for a day.
    Idempotent.
  */
  migrateProfiles() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS avatars (
        account_id TEXT PRIMARY KEY,
        png BLOB NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS avatars_updated ON avatars (updated_at);

      CREATE TABLE IF NOT EXISTS last_nicknames (
        account_id TEXT PRIMARY KEY,
        nickname TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS steam_profiles (
        account_id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        avatar BLOB,
        fetched_at INTEGER NOT NULL
      );
    `);
  }

  /*
    The identity broker's bans, and the id a game server gives each match report, so that a report retried
    after a lost answer is not counted twice. Idempotent.
  */
  migrateIdentity() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS broker_bans (
        account TEXT PRIMARY KEY,
        reason TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS progress_moves (
        child_id TEXT NOT NULL,
        parent_id TEXT NOT NULL,
        table_name TEXT NOT NULL,
        matches_after_move INTEGER NOT NULL,
        PRIMARY KEY (child_id, table_name)
      );

      -- About each linked key, for its owner's /profile only: how it was linked (browser: the game's Link with Steam,
      -- steam: the Steam build by its ticket), the device the game last named, when it last got a cert
      CREATE TABLE IF NOT EXISTS key_links (
        child_id TEXT PRIMARY KEY,
        linked_via TEXT NOT NULL,
        device TEXT,
        last_cert_at INTEGER
      );

      -- The report ids of reverted matches: a server retrying such a report (it keeps them for days) is not counted again
      CREATE TABLE IF NOT EXISTS reverted_reports (
        report_id TEXT PRIMARY KEY
      );
    `);

    const columns = this.db.prepare("PRAGMA table_info(matches)").all().map(c => c.name);

    if (!columns.includes('report_id')) {
      this.db.exec('ALTER TABLE matches ADD COLUMN report_id TEXT');
    }

    this.db.exec('CREATE UNIQUE INDEX IF NOT EXISTS matches_report_id ON matches (report_id)');
  }

  // associations.parent_id used to be UNIQUE, allowing a Steam account just one linked account.
  // Rebuilds the table without it, keeping every row. Idempotent.
  migrateAssociations() {
    const indexes = this.db.prepare("PRAGMA index_list(associations)").all();

    const parentIsUnique = indexes.some(index => {
      if (!index.unique) return false;
      const columns = this.db.prepare(`PRAGMA index_info("${index.name}")`).all();
      return columns.length === 1 && columns[0].name === 'parent_id';
    });

    if (!parentIsUnique) return;

    this.db.transaction(() => {
      this.db.exec(`
        CREATE TABLE associations_new (child_id TEXT UNIQUE, parent_id TEXT);
        INSERT INTO associations_new (child_id, parent_id) SELECT child_id, parent_id FROM associations;
        DROP TABLE associations;
        ALTER TABLE associations_new RENAME TO associations;
        CREATE INDEX IF NOT EXISTS associations_parent ON associations (parent_id);
      `);
    })();

    console.log('Migrated associations: a Steam account can now have several linked accounts.');
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