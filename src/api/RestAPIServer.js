/**
 * REST API Server
 * Provides HTTP API for Koda cloud deployment
 * @module RestAPIServer
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const EventEmitter = require('events');

class RestAPIServer extends EventEmitter {
  /**
     * Create REST API server
     * @param {Object} options - Configuration
     */
  constructor(options = {}) {
    super();
        
    this.options = {
      port: options.port || 3000,
      host: options.host || '0.0.0.0',
      cors: options.cors !== false,
      auth: options.auth || null,
      rateLimit: options.rateLimit || { windowMs: 60000, max: 100 },
      ...options
    };
        
    this.app = express();
    this.server = null;
    this.agents = new Map();
    this.sessions = new Map();
        
    this.setupMiddleware();
    this.setupRoutes();
        
    this.stats = {
      requestsHandled: 0,
      activeAgents: 0,
      activeSessions: 0,
      totalSessions: 0
    };
  }
    
  /**
     * Setup Express middleware
     * @private
     */
  setupMiddleware() {
    // Security
    this.app.use(helmet());
        
    // CORS
    if (this.options.cors) {
      this.app.use(cors());
    }
        
    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));
        
    // Request logging
    this.app.use((req, res, next) => {
      this.stats.requestsHandled++;
      this.emit('request', {
        method: req.method,
        path: req.path,
        timestamp: Date.now()
      });
      next();
    });
        
    // Authentication middleware if enabled
    if (this.options.auth) {
      this.app.use((req, res, next) => {
        const token = req.headers.authorization?.split(' ')[1];
        if (this.options.auth.validateToken(token)) {
          next();
        } else {
          res.status(401).json({ error: 'Unauthorized' });
        }
      });
    }
  }
    
  /**
     * Setup API routes
     * @private
     */
  setupRoutes() {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        uptime: process.uptime(),
        stats: this.getStats()
      });
    });
        
    // Create session
    this.app.post('/api/sessions', async (req, res) => {
      try {
        const { provider, apiKey, config } = req.body;
                
        if (!provider || !apiKey) {
          return res.status(400).json({
            error: 'provider and apiKey are required'
          });
        }
                
        const sessionId = this.generateSessionId();
        const agent = await this.createAgent(sessionId, {
          provider,
          apiKey,
          ...config
        });
                
        this.sessions.set(sessionId, {
          id: sessionId,
          agent,
          createdAt: Date.now(),
          lastActivity: Date.now()
        });
                
        this.stats.totalSessions++;
        this.stats.activeSessions++;
                
        res.json({
          sessionId,
          message: 'Session created successfully'
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
        
    // Navigate
    this.app.post('/api/sessions/:sessionId/navigate', async (req, res) => {
      try {
        const { sessionId } = req.params;
        const { url } = req.body;
                
        const session = this.sessions.get(sessionId);
        if (!session) {
          return res.status(404).json({ error: 'Session not found' });
        }
                
        await session.agent.goto(url);
        session.lastActivity = Date.now();
                
        res.json({ message: 'Navigation successful' });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
        
    // Execute action
    this.app.post('/api/sessions/:sessionId/act', async (req, res) => {
      try {
        const { sessionId } = req.params;
        const { action, options } = req.body;
                
        const session = this.sessions.get(sessionId);
        if (!session) {
          return res.status(404).json({ error: 'Session not found' });
        }
                
        const result = await session.agent.act(action, options);
        session.lastActivity = Date.now();
                
        res.json({ result });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
        
    // Extract information
    this.app.post('/api/sessions/:sessionId/extract', async (req, res) => {
      try {
        const { sessionId } = req.params;
        const { instruction, options } = req.body;
                
        const session = this.sessions.get(sessionId);
        if (!session) {
          return res.status(404).json({ error: 'Session not found' });
        }
                
        const data = await session.agent.extract(instruction, options);
        session.lastActivity = Date.now();
                
        res.json({ data });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
        
    // Observe state
    this.app.post('/api/sessions/:sessionId/observe', async (req, res) => {
      try {
        const { sessionId } = req.params;
        const { instruction } = req.body;
                
        const session = this.sessions.get(sessionId);
        if (!session) {
          return res.status(404).json({ error: 'Session not found' });
        }
                
        const observation = await session.agent.observe(instruction);
        session.lastActivity = Date.now();
                
        res.json({ observation });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
        
    // Get session info
    this.app.get('/api/sessions/:sessionId', (req, res) => {
      try {
        const { sessionId } = req.params;
                
        const session = this.sessions.get(sessionId);
        if (!session) {
          return res.status(404).json({ error: 'Session not found' });
        }
                
        res.json({
          id: session.id,
          createdAt: session.createdAt,
          lastActivity: session.lastActivity,
          stats: session.agent.getStats()
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
        
    // Close session
    this.app.delete('/api/sessions/:sessionId', async (req, res) => {
      try {
        const { sessionId } = req.params;
                
        const session = this.sessions.get(sessionId);
        if (!session) {
          return res.status(404).json({ error: 'Session not found' });
        }
                
        await session.agent.close();
        this.sessions.delete(sessionId);
        this.stats.activeSessions--;
                
        res.json({ message: 'Session closed' });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
        
    // List active sessions
    this.app.get('/api/sessions', (req, res) => {
      const sessions = Array.from(this.sessions.values()).map(s => ({
        id: s.id,
        createdAt: s.createdAt,
        lastActivity: s.lastActivity
      }));
            
      res.json({ sessions });
    });
        
    // Get statistics
    this.app.get('/api/stats', (req, res) => {
      res.json(this.getStats());
    });
  }
    
  /**
     * Create agent instance
     * @private
     */
  async createAgent(sessionId, options) {
    const { Koda } = require('../index');
    const agent = new Koda(options);
    await agent.init();
        
    this.agents.set(sessionId, agent);
    this.stats.activeAgents++;
        
    return agent;
  }
    
  /**
     * Generate unique session ID
     * @private
     */
  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
    
  /**
     * Start server
     * @returns {Promise<void>}
     */
  async start() {
    return new Promise((resolve, reject) => {
      this.server = this.app.listen(
        this.options.port,
        this.options.host,
        () => {
          this.emit('started', {
            port: this.options.port,
            host: this.options.host
          });
          resolve();
        }
      );
            
      this.server.on('error', (error) => {
        this.emit('error', error);
        reject(error);
      });
    });
  }
    
  /**
     * Stop server
     * @returns {Promise<void>}
     */
  async stop() {
    // Close all active sessions
    for (const [sessionId, session] of this.sessions) {
      try {
        await session.agent.close();
      } catch (error) {
        console.error(`Error closing session ${sessionId}:`, error);
      }
    }
        
    this.sessions.clear();
    this.agents.clear();
        
    // Close server
    if (this.server) {
      return new Promise((resolve) => {
        this.server.close(() => {
          this.emit('stopped');
          resolve();
        });
      });
    }
  }
    
  /**
     * Get server statistics
     * @returns {Object} Statistics
     */
  getStats() {
    return {
      ...this.stats,
      activeAgents: this.agents.size,
      activeSessions: this.sessions.size
    };
  }
}

module.exports = { RestAPIServer };