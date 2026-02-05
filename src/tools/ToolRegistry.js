/**
 * Tool Registry
 * Manages external tools and integrations
 * @module ToolRegistry
 */

const EventEmitter = require('events');

class ToolRegistry extends EventEmitter {
  /**
     * Create tool registry
     */
  constructor() {
    super();
        
    this.tools = new Map();
    this.categories = new Map();
        
    this.stats = {
      totalTools: 0,
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0
    };
        
    this.registerBuiltInTools();
  }
    
  /**
     * Register a tool
     * @param {string} name - Tool name
     * @param {Function} handler - Tool handler function
     * @param {Object} schema - Tool schema
     */
  registerTool(name, handler, schema = {}) {
    if (this.tools.has(name)) {
      throw new Error(`Tool '${name}' is already registered`);
    }
        
    const tool = {
      name,
      handler,
      schema: {
        description: schema.description || '',
        parameters: schema.parameters || {},
        returns: schema.returns || 'any',
        category: schema.category || 'custom',
        ...schema
      },
      stats: {
        executions: 0,
        successes: 0,
        failures: 0,
        averageTime: 0,
        totalTime: 0
      }
    };
        
    this.tools.set(name, tool);
    this.stats.totalTools++;
        
    // Add to category
    const category = tool.schema.category;
    if (!this.categories.has(category)) {
      this.categories.set(category, new Set());
    }
    this.categories.get(category).add(name);
        
    this.emit('toolRegistered', { name, schema: tool.schema });
  }
    
  /**
     * Unregister a tool
     * @param {string} name - Tool name
     */
  unregisterTool(name) {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`Tool '${name}' not found`);
    }
        
    const category = tool.schema.category;
    if (this.categories.has(category)) {
      this.categories.get(category).delete(name);
      if (this.categories.get(category).size === 0) {
        this.categories.delete(category);
      }
    }
        
    this.tools.delete(name);
    this.stats.totalTools--;
        
    this.emit('toolUnregistered', { name });
  }
    
  /**
     * Execute a tool
     * @param {string} name - Tool name
     * @param {Object} params - Tool parameters
     * @returns {Promise<any>} Tool result
     */
  async executeTool(name, params = {}) {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`Tool '${name}' not found`);
    }
        
    const startTime = Date.now();
    tool.stats.executions++;
    this.stats.totalExecutions++;
        
    try {
      // Validate parameters
      this.validateParameters(tool, params);
            
      // Execute tool
      const result = await tool.handler(params);
            
      // Update stats
      const duration = Date.now() - startTime;
      tool.stats.successes++;
      tool.stats.totalTime += duration;
      tool.stats.averageTime = tool.stats.totalTime / tool.stats.executions;
      this.stats.successfulExecutions++;
            
      this.emit('toolExecuted', {
        name,
        params,
        result,
        duration
      });
            
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      tool.stats.failures++;
      this.stats.failedExecutions++;
            
      this.emit('toolFailed', {
        name,
        params,
        error: error.message,
        duration
      });
            
      throw error;
    }
  }
    
  /**
     * Validate tool parameters
     * @private
     */
  validateParameters(tool, params) {
    const schema = tool.schema.parameters;
        
    // Check required parameters
    if (schema.required) {
      for (const param of schema.required) {
        if (!(param in params)) {
          throw new Error(`Required parameter '${param}' missing for tool '${tool.name}'`);
        }
      }
    }
        
    // Type validation could be added here
  }
    
  /**
     * Get tool information
     * @param {string} name - Tool name
     * @returns {Object} Tool info
     */
  getToolInfo(name) {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`Tool '${name}' not found`);
    }
        
    return {
      name: tool.name,
      schema: tool.schema,
      stats: tool.stats
    };
  }
    
  /**
     * List all tools
     * @param {string} category - Optional category filter
     * @returns {Array} List of tool names
     */
  listTools(category = null) {
    if (category) {
      const tools = this.categories.get(category);
      return tools ? Array.from(tools) : [];
    }
        
    return Array.from(this.tools.keys());
  }
    
  /**
     * List all categories
     * @returns {Array} List of categories
     */
  listCategories() {
    return Array.from(this.categories.keys());
  }
    
  /**
     * Get tools by category
     * @returns {Object} Category map
     */
  getToolsByCategory() {
    const result = {};
    for (const [category, tools] of this.categories) {
      result[category] = Array.from(tools);
    }
    return result;
  }
    
  /**
     * Get registry statistics
     * @returns {Object} Statistics
     */
  getStats() {
    return {
      ...this.stats,
      successRate: this.stats.totalExecutions > 0
        ? (this.stats.successfulExecutions / this.stats.totalExecutions * 100).toFixed(2) + '%'
        : '0%',
      categories: this.categories.size
    };
  }
    
  /**
     * Register built-in tools
     * @private
     */
  registerBuiltInTools() {
    // Web search tool
    this.registerTool('webSearch', async (params) => {
      const { WebSearchTool } = require('./WebSearchTool');
      const tool = new WebSearchTool();
      return tool.search(params.query, params.options);
    }, {
      description: 'Search the web for information',
      category: 'web',
      parameters: {
        required: ['query'],
        properties: {
          query: { type: 'string', description: 'Search query' },
          options: { type: 'object', description: 'Search options' }
        }
      }
    });
        
    // Database query tool
    this.registerTool('databaseQuery', async (params) => {
      const { DatabaseTool } = require('./DatabaseTool');
      const tool = new DatabaseTool(params.config);
      return tool.query(params.sql, params.params);
    }, {
      description: 'Execute database queries',
      category: 'database',
      parameters: {
        required: ['sql'],
        properties: {
          sql: { type: 'string', description: 'SQL query' },
          params: { type: 'array', description: 'Query parameters' },
          config: { type: 'object', description: 'Database config' }
        }
      }
    });
        
    // HTTP API call tool
    this.registerTool('apiCall', async (params) => {
      const { APITool } = require('./APITool');
      const tool = new APITool();
      return tool.call(params.url, params.options);
    }, {
      description: 'Make HTTP API calls',
      category: 'api',
      parameters: {
        required: ['url'],
        properties: {
          url: { type: 'string', description: 'API endpoint URL' },
          options: { type: 'object', description: 'Request options (method, headers, body, etc.)' }
        }
      }
    });
        
    // File operations tool
    this.registerTool('fileOperation', async (params) => {
      const { FileTool } = require('./FileTool');
      const tool = new FileTool();
      return tool.execute(params.operation, params.options);
    }, {
      description: 'Perform file operations (read, write, delete)',
      category: 'filesystem',
      parameters: {
        required: ['operation'],
        properties: {
          operation: { type: 'string', description: 'Operation type: read, write, delete, list' },
          options: { type: 'object', description: 'Operation options' }
        }
      }
    });
        
    // Screenshot tool
    this.registerTool('screenshot', async (params) => {
      const { ScreenshotTool } = require('./ScreenshotTool');
      const tool = new ScreenshotTool();
      return tool.capture(params.options);
    }, {
      description: 'Capture screenshots',
      category: 'browser',
      parameters: {
        properties: {
          options: { type: 'object', description: 'Screenshot options' }
        }
      }
    });
  }
}

module.exports = { ToolRegistry };