/**
 * Database Tool
 * Provides database query capabilities
 * @module DatabaseTool
 */

const EventEmitter = require('events');

class DatabaseTool extends EventEmitter {
    /**
     * Create database tool
     * @param {Object} config - Database configuration
     */
    constructor(config = {}) {
        super();
        
        this.config = {
            type: config.type || 'sqlite',
            connection: config.connection || {},
            ...config
        };
        
        this.db = null;
        this.initializeDatabase();
    }
    
    /**
     * Initialize database connection
     * @private
     */
    initializeDatabase() {
        switch (this.config.type) {
            case 'sqlite':
                this.initializeSQLite();
                break;
            
            case 'postgres':
            case 'mysql':
                console.warn('PostgreSQL/MySQL support requires additional packages');
                break;
            
            default:
                throw new Error(`Unsupported database type: ${this.config.type}`);
        }
    }
    
    /**
     * Initialize SQLite
     * @private
     */
    initializeSQLite() {
        try {
            const Database = require('better-sqlite3');
            const dbPath = this.config.connection.database || ':memory:';
            this.db = new Database(dbPath);
            this.emit('connected', { type: 'sqlite', database: dbPath });
        } catch (error) {
            console.warn('SQLite (better-sqlite3) not available');
        }
    }
    
    /**
     * Execute query
     * @param {string} sql - SQL query
     * @param {Array} params - Query parameters
     * @returns {Promise<any>} Query results
     */
    async query(sql, params = []) {
        if (!this.db) {
            throw new Error('Database not initialized');
        }
        
        this.emit('querying', { sql, params });
        
        try {
            const result = this.executeQuery(sql, params);
            
            this.emit('queryCompleted', {
                sql,
                rowsAffected: Array.isArray(result) ? result.length : result.changes
            });
            
            return result;
        } catch (error) {
            this.emit('queryFailed', { sql, error: error.message });
            throw error;
        }
    }
    
    /**
     * Execute query based on database type
     * @private
     */
    executeQuery(sql, params) {
        if (this.config.type === 'sqlite') {
            // Determine if it's a SELECT or modification query
            const isSelect = sql.trim().toLowerCase().startsWith('select');
            
            if (isSelect) {
                const stmt = this.db.prepare(sql);
                return stmt.all(...params);
            } else {
                const stmt = this.db.prepare(sql);
                return stmt.run(...params);
            }
        }
        
        throw new Error('Query execution not implemented for this database type');
    }
    
    /**
     * Execute transaction
     * @param {Function} callback - Transaction callback
     * @returns {Promise<any>} Transaction result
     */
    async transaction(callback) {
        if (!this.db) {
            throw new Error('Database not initialized');
        }
        
        if (this.config.type === 'sqlite') {
            const transaction = this.db.transaction(callback);
            return transaction();
        }
        
        throw new Error('Transactions not implemented for this database type');
    }
    
    /**
     * Close database connection
     */
    close() {
        if (this.db && this.config.type === 'sqlite') {
            this.db.close();
            this.emit('closed');
        }
    }
}

module.exports = { DatabaseTool };