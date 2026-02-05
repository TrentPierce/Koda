/**
 * Learning Database
 * Persistent storage for Q-tables, policies, and experiences
 */

// Handle optional dependency
let Database;
try {
  Database = require('better-sqlite3');
} catch (error) {
  // better-sqlite3 is an optional dependency
  Database = null;
}

const path = require('path');
const fs = require('fs');

class LearningDatabase {
  constructor(dbPath = null) {
    this.dbPath = dbPath || path.join(process.cwd(), 'learning_memory.db');
    this.db = null;
  }

  /**
     * Initialize database
     */
  async initialize() {
    if (!Database) {
      throw new Error('better-sqlite3 is required for persistent learning. Install with: npm install better-sqlite3');
    }

    try {
      this.db = new Database(this.dbPath);
      this.createTables();
      console.log('[LearningDatabase] Initialized at', this.dbPath);
    } catch (error) {
      console.error('[LearningDatabase] Initialization failed:', error.message);
      throw error;
    }
  }

  /**
     * Create database tables
     */
  createTables() {
    // Q-values table
    this.db.exec(`
            CREATE TABLE IF NOT EXISTS q_values (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                state_key TEXT NOT NULL,
                action TEXT NOT NULL,
                q_value REAL NOT NULL,
                update_count INTEGER DEFAULT 1,
                last_updated INTEGER NOT NULL,
                UNIQUE(state_key, action)
            )
        `);

    // Policy table
    this.db.exec(`
            CREATE TABLE IF NOT EXISTS policies (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                state_key TEXT NOT NULL,
                action TEXT NOT NULL,
                probability REAL NOT NULL,
                last_updated INTEGER NOT NULL,
                UNIQUE(state_key, action)
            )
        `);

    // Value function table
    this.db.exec(`
            CREATE TABLE IF NOT EXISTS value_function (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                state_key TEXT NOT NULL UNIQUE,
                value REAL NOT NULL,
                last_updated INTEGER NOT NULL
            )
        `);

    // Experiences table
    this.db.exec(`
            CREATE TABLE IF NOT EXISTS experiences (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                state TEXT NOT NULL,
                action TEXT NOT NULL,
                reward REAL NOT NULL,
                next_state TEXT NOT NULL,
                done INTEGER NOT NULL,
                priority REAL DEFAULT 1.0,
                timestamp INTEGER NOT NULL
            )
        `);

    // Learning sessions table
    this.db.exec(`
            CREATE TABLE IF NOT EXISTS learning_sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_type TEXT NOT NULL,
                platform TEXT,
                goal TEXT,
                total_steps INTEGER,
                total_reward REAL,
                success INTEGER,
                started_at INTEGER NOT NULL,
                ended_at INTEGER
            )
        `);

    // State representations table
    this.db.exec(`
            CREATE TABLE IF NOT EXISTS state_representations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                state_key TEXT NOT NULL UNIQUE,
                state_data TEXT NOT NULL,
                occurrence_count INTEGER DEFAULT 1,
                last_seen INTEGER NOT NULL
            )
        `);

    // Create indices for performance
    this.db.exec(`
            CREATE INDEX IF NOT EXISTS idx_q_values_state ON q_values(state_key);
            CREATE INDEX IF NOT EXISTS idx_policies_state ON policies(state_key);
            CREATE INDEX IF NOT EXISTS idx_experiences_timestamp ON experiences(timestamp);
            CREATE INDEX IF NOT EXISTS idx_experiences_reward ON experiences(reward);
        `);
  }

  /**
     * Save Q-value
     */
  saveQValue(stateKey, action, qValue) {
    const stmt = this.db.prepare(`
            INSERT INTO q_values (state_key, action, q_value, last_updated)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(state_key, action) DO UPDATE SET
                q_value = excluded.q_value,
                update_count = update_count + 1,
                last_updated = excluded.last_updated
        `);

    stmt.run(stateKey, action, qValue, Date.now());
  }

  /**
     * Load Q-value
     */
  loadQValue(stateKey, action) {
    const stmt = this.db.prepare(`
            SELECT q_value FROM q_values
            WHERE state_key = ? AND action = ?
        `);

    const result = stmt.get(stateKey, action);
    return result ? result.q_value : null;
  }

  /**
     * Load all Q-values for state
     */
  loadStateQValues(stateKey) {
    const stmt = this.db.prepare(`
            SELECT action, q_value FROM q_values
            WHERE state_key = ?
        `);

    const results = stmt.all(stateKey);
    const qValues = {};
        
    for (const row of results) {
      qValues[row.action] = row.q_value;
    }
        
    return qValues;
  }

  /**
     * Save entire Q-table
     */
  saveQTable(qTable) {
    const stmt = this.db.prepare(`
            INSERT INTO q_values (state_key, action, q_value, last_updated)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(state_key, action) DO UPDATE SET
                q_value = excluded.q_value,
                update_count = update_count + 1,
                last_updated = excluded.last_updated
        `);

    const saveMany = this.db.transaction((entries) => {
      for (const entry of entries) {
        stmt.run(entry.stateKey, entry.action, entry.qValue, Date.now());
      }
    });

    const entries = [];
    for (const [stateKey, actions] of qTable.entries()) {
      for (const [action, qValue] of actions.entries()) {
        entries.push({ stateKey, action, qValue });
      }
    }

    saveMany(entries);
    console.log(`[LearningDatabase] Saved ${entries.length} Q-values`);
  }

  /**
     * Load entire Q-table
     */
  loadQTable() {
    const stmt = this.db.prepare(`
            SELECT state_key, action, q_value FROM q_values
        `);

    const results = stmt.all();
    const qTable = new Map();

    for (const row of results) {
      if (!qTable.has(row.state_key)) {
        qTable.set(row.state_key, new Map());
      }
      qTable.get(row.state_key).set(row.action, row.q_value);
    }

    console.log(`[LearningDatabase] Loaded ${qTable.size} states`);
    return qTable;
  }

  /**
     * Save policy
     */
  savePolicy(stateKey, action, probability) {
    const stmt = this.db.prepare(`
            INSERT INTO policies (state_key, action, probability, last_updated)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(state_key, action) DO UPDATE SET
                probability = excluded.probability,
                last_updated = excluded.last_updated
        `);

    stmt.run(stateKey, action, probability, Date.now());
  }

  /**
     * Load policy for state
     */
  loadPolicy(stateKey) {
    const stmt = this.db.prepare(`
            SELECT action, probability FROM policies
            WHERE state_key = ?
        `);

    const results = stmt.all(stateKey);
    const policy = {};
        
    for (const row of results) {
      policy[row.action] = row.probability;
    }
        
    return policy;
  }

  /**
     * Save entire policy map
     */
  savePolicyMap(policyMap) {
    const stmt = this.db.prepare(`
            INSERT INTO policies (state_key, action, probability, last_updated)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(state_key, action) DO UPDATE SET
                probability = excluded.probability,
                last_updated = excluded.last_updated
        `);

    const saveMany = this.db.transaction((entries) => {
      for (const entry of entries) {
        stmt.run(entry.stateKey, entry.action, entry.probability, Date.now());
      }
    });

    const entries = [];
    for (const [stateKey, policy] of policyMap.entries()) {
      for (const [action, probability] of Object.entries(policy)) {
        entries.push({ stateKey, action, probability });
      }
    }

    saveMany(entries);
    console.log(`[LearningDatabase] Saved ${entries.length} policy entries`);
  }

  /**
     * Load entire policy map
     */
  loadPolicyMap() {
    const stmt = this.db.prepare(`
            SELECT state_key, action, probability FROM policies
        `);

    const results = stmt.all();
    const policyMap = new Map();

    for (const row of results) {
      if (!policyMap.has(row.state_key)) {
        policyMap.set(row.state_key, {});
      }
      policyMap.get(row.state_key)[row.action] = row.probability;
    }

    return policyMap;
  }

  /**
     * Save experience
     */
  saveExperience(experience) {
    const stmt = this.db.prepare(`
            INSERT INTO experiences (state, action, reward, next_state, done, priority, timestamp)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);

    stmt.run(
      JSON.stringify(experience.state),
      experience.action,
      experience.reward,
      JSON.stringify(experience.nextState),
      experience.done ? 1 : 0,
      experience.priority || 1.0,
      experience.timestamp || Date.now()
    );
  }

  /**
     * Load recent experiences
     */
  loadRecentExperiences(limit = 1000) {
    const stmt = this.db.prepare(`
            SELECT * FROM experiences
            ORDER BY timestamp DESC
            LIMIT ?
        `);

    const results = stmt.all(limit);
    return results.map(row => ({
      state: JSON.parse(row.state),
      action: row.action,
      reward: row.reward,
      nextState: JSON.parse(row.next_state),
      done: row.done === 1,
      priority: row.priority,
      timestamp: row.timestamp
    }));
  }

  /**
     * Load successful experiences
     */
  loadSuccessfulExperiences(minReward = 5.0, limit = 500) {
    const stmt = this.db.prepare(`
            SELECT * FROM experiences
            WHERE reward >= ?
            ORDER BY reward DESC
            LIMIT ?
        `);

    const results = stmt.all(minReward, limit);
    return results.map(row => ({
      state: JSON.parse(row.state),
      action: row.action,
      reward: row.reward,
      nextState: JSON.parse(row.next_state),
      done: row.done === 1,
      timestamp: row.timestamp
    }));
  }

  /**
     * Start learning session
     */
  startSession(sessionType, platform, goal) {
    const stmt = this.db.prepare(`
            INSERT INTO learning_sessions (session_type, platform, goal, started_at)
            VALUES (?, ?, ?, ?)
        `);

    const result = stmt.run(sessionType, platform, goal, Date.now());
    return result.lastInsertRowid;
  }

  /**
     * End learning session
     */
  endSession(sessionId, totalSteps, totalReward, success) {
    const stmt = this.db.prepare(`
            UPDATE learning_sessions
            SET total_steps = ?, total_reward = ?, success = ?, ended_at = ?
            WHERE id = ?
        `);

    stmt.run(totalSteps, totalReward, success ? 1 : 0, Date.now(), sessionId);
  }

  /**
     * Get learning statistics
     */
  getStatistics() {
    const stats = {};

    // Q-values stats
    const qStats = this.db.prepare(`
            SELECT COUNT(*) as total, AVG(update_count) as avg_updates
            FROM q_values
        `).get();
    stats.qValues = qStats;

    // Experiences stats
    const expStats = this.db.prepare(`
            SELECT COUNT(*) as total, AVG(reward) as avg_reward,
                   MAX(reward) as max_reward, MIN(reward) as min_reward
            FROM experiences
        `).get();
    stats.experiences = expStats;

    // Sessions stats
    const sessStats = this.db.prepare(`
            SELECT COUNT(*) as total, AVG(total_reward) as avg_reward,
                   SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful
            FROM learning_sessions
            WHERE ended_at IS NOT NULL
        `).get();
    stats.sessions = sessStats;

    return stats;
  }

  /**
     * Clean old experiences
     */
  cleanOldExperiences(daysOld = 30) {
    const cutoffTime = Date.now() - (daysOld * 24 * 60 * 60 * 1000);
        
    const stmt = this.db.prepare(`
            DELETE FROM experiences
            WHERE timestamp < ? AND reward < 0
        `);

    const result = stmt.run(cutoffTime);
    console.log(`[LearningDatabase] Cleaned ${result.changes} old experiences`);
  }

  /**
     * Export all learning data
     */
  exportAll() {
    return {
      qTable: this.loadQTable(),
      policies: this.loadPolicyMap(),
      experiences: this.loadRecentExperiences(5000),
      statistics: this.getStatistics(),
      timestamp: Date.now()
    };
  }

  /**
     * Close database connection
     */
  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

module.exports = LearningDatabase;
