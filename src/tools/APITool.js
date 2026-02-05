/**
 * API Tool
 * Provides HTTP API call capabilities
 * @module APITool
 */

const axios = require('axios');
const EventEmitter = require('events');

class APITool extends EventEmitter {
  /**
     * Create API tool
     * @param {Object} config - Configuration
     */
  constructor(config = {}) {
    super();
        
    this.config = {
      timeout: config.timeout || 10000,
      maxRetries: config.maxRetries || 3,
      retryDelay: config.retryDelay || 1000,
      ...config
    };
        
    this.stats = {
      totalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0
    };
  }
    
  /**
     * Make API call
     * @param {string} url - API endpoint URL
     * @param {Object} options - Request options
     * @returns {Promise<any>} Response data
     */
  async call(url, options = {}) {
    this.stats.totalCalls++;
        
    const config = {
      url,
      method: options.method || 'GET',
      headers: options.headers || {},
      data: options.body || options.data,
      params: options.params || options.query,
      timeout: options.timeout || this.config.timeout,
      ...options
    };
        
    this.emit('calling', { url, method: config.method });
        
    try {
      const response = await this.callWithRetry(config);
            
      this.stats.successfulCalls++;
            
      this.emit('callCompleted', {
        url,
        status: response.status,
        dataSize: JSON.stringify(response.data).length
      });
            
      return {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        data: response.data
      };
    } catch (error) {
      this.stats.failedCalls++;
            
      this.emit('callFailed', {
        url,
        error: error.message
      });
            
      throw error;
    }
  }
    
  /**
     * Make API call with retry logic
     * @private
     */
  async callWithRetry(config, attempt = 1) {
    try {
      return await axios(config);
    } catch (error) {
      if (attempt < this.config.maxRetries && this.isRetryable(error)) {
        await this.sleep(this.config.retryDelay * attempt);
        return this.callWithRetry(config, attempt + 1);
      }
      throw error;
    }
  }
    
  /**
     * Check if error is retryable
     * @private
     */
  isRetryable(error) {
    if (error.code === 'ECONNABORTED') return true;
    if (error.code === 'ETIMEDOUT') return true;
    if (error.response) {
      const status = error.response.status;
      return status === 429 || status >= 500;
    }
    return false;
  }
    
  /**
     * Sleep helper
     * @private
     */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
    
  /**
     * Make GET request
     * @param {string} url - URL
     * @param {Object} options - Options
     * @returns {Promise<any>} Response
     */
  async get(url, options = {}) {
    return this.call(url, { ...options, method: 'GET' });
  }
    
  /**
     * Make POST request
     * @param {string} url - URL
     * @param {Object} data - Request body
     * @param {Object} options - Options
     * @returns {Promise<any>} Response
     */
  async post(url, data, options = {}) {
    return this.call(url, { ...options, method: 'POST', data });
  }
    
  /**
     * Make PUT request
     * @param {string} url - URL
     * @param {Object} data - Request body
     * @param {Object} options - Options
     * @returns {Promise<any>} Response
     */
  async put(url, data, options = {}) {
    return this.call(url, { ...options, method: 'PUT', data });
  }
    
  /**
     * Make DELETE request
     * @param {string} url - URL
     * @param {Object} options - Options
     * @returns {Promise<any>} Response
     */
  async delete(url, options = {}) {
    return this.call(url, { ...options, method: 'DELETE' });
  }
    
  /**
     * Get statistics
     * @returns {Object} Statistics
     */
  getStats() {
    return {
      ...this.stats,
      successRate: this.stats.totalCalls > 0
        ? (this.stats.successfulCalls / this.stats.totalCalls * 100).toFixed(2) + '%'
        : '0%'
    };
  }
}

module.exports = { APITool };