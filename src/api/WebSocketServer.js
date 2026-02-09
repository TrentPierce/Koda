/**
 * Koda - Intelligent Browser Automation Library
 * This project uses Koda by Trent Pierce
 * https://github.com/TrentPierce/Koda
 * Licensed under the Koda Non-Commercial License
 *
 * Copyright (c) 2026 Trent Pierce. All rights reserved.
 * See LICENSE file for full terms.
 */

const WebSocket = require('ws');
const EventEmitter = require('events');

class WebSocketServer extends EventEmitter {
  /**
     * Create WebSocket server
     * @param {Object} options - Configuration
     */
  constructor(options = {}) {
    super();
        
    this.options = {
      port: options.port || 3001,
      server: options.server || null,
      auth: options.auth || null,
      pingInterval: options.pingInterval || 30000,
      ...options
    };
        
    this.wss = null;
    this.clients = new Map();
    this.subscriptions = new Map();
        
    this.stats = {
      totalConnections: 0,
      activeConnections: 0,
      messagesSent: 0,
      messagesReceived: 0
    };
  }
    
  /**
     * Start WebSocket server
     * @returns {Promise<void>}
     */
  async start() {
    return new Promise((resolve, reject) => {
      try {
        this.wss = this.options.server
          ? new WebSocket.Server({ server: this.options.server })
          : new WebSocket.Server({ port: this.options.port });
                
        this.setupWebSocketServer();
        this.startPingInterval();
                
        this.emit('started', {
          port: this.options.port
        });
                
        resolve();
      } catch (error) {
        this.emit('error', error);
        reject(error);
      }
    });
  }
    
  /**
     * Setup WebSocket server
     * @private
     */
  setupWebSocketServer() {
    this.wss.on('connection', (ws, req) => {
      this.handleConnection(ws, req);
    });
        
    this.wss.on('error', (error) => {
      this.emit('error', error);
    });
  }
    
  /**
     * Handle new WebSocket connection
     * @private
     */
  handleConnection(ws, req) {
    const clientId = this.generateClientId();
        
    // Authentication if enabled
    if (this.options.auth) {
      const token = new URLSearchParams(req.url.split('?')[1]).get('token');
      if (!this.options.auth.validateToken(token)) {
        ws.close(1008, 'Unauthorized');
        return;
      }
    }
        
    this.clients.set(clientId, {
      id: clientId,
      ws,
      subscriptions: new Set(),
      isAlive: true,
      connectedAt: Date.now()
    });
        
    this.stats.totalConnections++;
    this.stats.activeConnections++;
        
    // Setup message handlers
    ws.on('message', (data) => {
      this.handleMessage(clientId, data);
    });
        
    ws.on('pong', () => {
      const client = this.clients.get(clientId);
      if (client) {
        client.isAlive = true;
      }
    });
        
    ws.on('close', () => {
      this.handleDisconnection(clientId);
    });
        
    ws.on('error', (error) => {
      this.emit('clientError', { clientId, error: error.message });
    });
        
    // Send welcome message
    this.sendToClient(clientId, {
      type: 'connected',
      clientId,
      timestamp: Date.now()
    });
        
    this.emit('clientConnected', { clientId });
  }
    
  /**
     * Handle client message
     * @private
     */
  handleMessage(clientId, data) {
    this.stats.messagesReceived++;
        
    try {
      const message = JSON.parse(data);
            
      switch (message.type) {
        case 'subscribe':
          this.subscribe(clientId, message.sessionId);
          break;
                
        case 'unsubscribe':
          this.unsubscribe(clientId, message.sessionId);
          break;
                
        case 'ping':
          this.sendToClient(clientId, { type: 'pong' });
          break;
                
        default:
          this.emit('message', { clientId, message });
      }
    } catch (error) {
      this.emit('messageError', {
        clientId,
        error: error.message
      });
    }
  }
    
  /**
     * Handle client disconnection
     * @private
     */
  handleDisconnection(clientId) {
    const client = this.clients.get(clientId);
    if (!client) return;
        
    // Clean up subscriptions
    for (const sessionId of client.subscriptions) {
      this.unsubscribe(clientId, sessionId);
    }
        
    this.clients.delete(clientId);
    this.stats.activeConnections--;
        
    this.emit('clientDisconnected', { clientId });
  }
    
  /**
     * Subscribe client to session updates
     * @param {string} clientId - Client ID
     * @param {string} sessionId - Session ID
     */
  subscribe(clientId, sessionId) {
    const client = this.clients.get(clientId);
    if (!client) return;
        
    client.subscriptions.add(sessionId);
        
    if (!this.subscriptions.has(sessionId)) {
      this.subscriptions.set(sessionId, new Set());
    }
        
    this.subscriptions.get(sessionId).add(clientId);
        
    this.sendToClient(clientId, {
      type: 'subscribed',
      sessionId,
      timestamp: Date.now()
    });
        
    this.emit('subscribed', { clientId, sessionId });
  }
    
  /**
     * Unsubscribe client from session updates
     * @param {string} clientId - Client ID
     * @param {string} sessionId - Session ID
     */
  unsubscribe(clientId, sessionId) {
    const client = this.clients.get(clientId);
    if (client) {
      client.subscriptions.delete(sessionId);
    }
        
    const subscribers = this.subscriptions.get(sessionId);
    if (subscribers) {
      subscribers.delete(clientId);
      if (subscribers.size === 0) {
        this.subscriptions.delete(sessionId);
      }
    }
        
    this.sendToClient(clientId, {
      type: 'unsubscribed',
      sessionId,
      timestamp: Date.now()
    });
        
    this.emit('unsubscribed', { clientId, sessionId });
  }
    
  /**
     * Broadcast update to session subscribers
     * @param {string} sessionId - Session ID
     * @param {Object} update - Update data
     */
  broadcastToSession(sessionId, update) {
    const subscribers = this.subscriptions.get(sessionId);
    if (!subscribers) return;
        
    const message = {
      type: 'sessionUpdate',
      sessionId,
      update,
      timestamp: Date.now()
    };
        
    for (const clientId of subscribers) {
      this.sendToClient(clientId, message);
    }
  }
    
  /**
     * Send message to specific client
     * @param {string} clientId - Client ID
     * @param {Object} message - Message object
     */
  sendToClient(clientId, message) {
    const client = this.clients.get(clientId);
    if (!client || client.ws.readyState !== WebSocket.OPEN) {
      return;
    }
        
    try {
      client.ws.send(JSON.stringify(message));
      this.stats.messagesSent++;
    } catch (error) {
      this.emit('sendError', { clientId, error: error.message });
    }
  }
    
  /**
     * Broadcast message to all clients
     * @param {Object} message - Message object
     */
  broadcast(message) {
    for (const [clientId] of this.clients) {
      this.sendToClient(clientId, message);
    }
  }
    
  /**
     * Start ping interval to keep connections alive
     * @private
     */
  startPingInterval() {
    this.pingTimer = setInterval(() => {
      for (const [clientId, client] of this.clients) {
        if (!client.isAlive) {
          client.ws.terminate();
          this.handleDisconnection(clientId);
        } else {
          client.isAlive = false;
          client.ws.ping();
        }
      }
    }, this.options.pingInterval);
  }
    
  /**
     * Generate unique client ID
     * @private
     */
  generateClientId() {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
    
  /**
     * Stop WebSocket server
     * @returns {Promise<void>}
     */
  async stop() {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
    }
        
    // Close all client connections
    for (const [clientId, client] of this.clients) {
      client.ws.close(1000, 'Server shutting down');
    }
        
    this.clients.clear();
    this.subscriptions.clear();
        
    if (this.wss) {
      return new Promise((resolve) => {
        this.wss.close(() => {
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
      activeConnections: this.clients.size,
      activeSubscriptions: Array.from(this.subscriptions.values())
        .reduce((sum, subs) => sum + subs.size, 0)
    };
  }
}

module.exports = { WebSocketServer };