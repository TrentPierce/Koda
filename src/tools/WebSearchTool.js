/**
 * Koda - Intelligent Browser Automation Library
 * This project uses Koda by Trent Pierce
 * https://github.com/TrentPierce/Koda
 * Licensed under the Koda Non-Commercial License
 *
 * Copyright (c) 2026 Trent Pierce. All rights reserved.
 * See LICENSE file for full terms.
 */

const axios = require('axios');
const EventEmitter = require('events');

class WebSearchTool extends EventEmitter {
  /**
     * Create web search tool
     * @param {Object} config - Configuration
     */
  constructor(config = {}) {
    super();
        
    this.config = {
      provider: config.provider || 'duckduckgo',
      apiKey: config.apiKey || null,
      maxResults: config.maxResults || 10,
      ...config
    };
  }
    
  /**
     * Search the web
     * @param {string} query - Search query
     * @param {Object} options - Search options
     * @returns {Promise<Array>} Search results
     */
  async search(query, options = {}) {
    const provider = options.provider || this.config.provider;
        
    this.emit('searching', { query, provider });
        
    try {
      let results;
            
      switch (provider) {
        case 'duckduckgo':
          results = await this.searchDuckDuckGo(query, options);
          break;
                
        case 'google':
          results = await this.searchGoogle(query, options);
          break;
                
        case 'bing':
          results = await this.searchBing(query, options);
          break;
                
        default:
          throw new Error(`Unknown search provider: ${provider}`);
      }
            
      this.emit('searchCompleted', { query, results: results.length });
            
      return results;
    } catch (error) {
      this.emit('searchFailed', { query, error: error.message });
      throw error;
    }
  }
    
  /**
     * Search using DuckDuckGo
     * @private
     */
  async searchDuckDuckGo(query, options) {
    try {
      const response = await axios.get('https://api.duckduckgo.com/', {
        params: {
          q: query,
          format: 'json',
          no_html: 1
        },
        timeout: options.timeout || 5000
      });
            
      const results = [];
      const data = response.data;
            
      // Process instant answer
      if (data.AbstractText) {
        results.push({
          title: data.Heading || 'Instant Answer',
          url: data.AbstractURL,
          snippet: data.AbstractText,
          source: data.AbstractSource
        });
      }
            
      // Process related topics
      if (data.RelatedTopics) {
        for (const topic of data.RelatedTopics) {
          if (topic.FirstURL) {
            results.push({
              title: topic.Text,
              url: topic.FirstURL,
              snippet: topic.Text
            });
          }
        }
      }
            
      return results.slice(0, options.maxResults || this.config.maxResults);
    } catch (error) {
      throw new Error(`DuckDuckGo search failed: ${error.message}`);
    }
  }
    
  /**
     * Search using Google Custom Search
     * @private
     */
  async searchGoogle(query, options) {
    if (!this.config.apiKey) {
      throw new Error('Google API key required');
    }
        
    if (!this.config.searchEngineId) {
      throw new Error('Google Search Engine ID required');
    }
        
    try {
      const response = await axios.get('https://www.googleapis.com/customsearch/v1', {
        params: {
          key: this.config.apiKey,
          cx: this.config.searchEngineId,
          q: query,
          num: options.maxResults || this.config.maxResults
        },
        timeout: options.timeout || 5000
      });
            
      return (response.data.items || []).map(item => ({
        title: item.title,
        url: item.link,
        snippet: item.snippet,
        source: 'Google'
      }));
    } catch (error) {
      throw new Error(`Google search failed: ${error.message}`);
    }
  }
    
  /**
     * Search using Bing
     * @private
     */
  async searchBing(query, options) {
    if (!this.config.apiKey) {
      throw new Error('Bing API key required');
    }
        
    try {
      const response = await axios.get('https://api.bing.microsoft.com/v7.0/search', {
        params: {
          q: query,
          count: options.maxResults || this.config.maxResults
        },
        headers: {
          'Ocp-Apim-Subscription-Key': this.config.apiKey
        },
        timeout: options.timeout || 5000
      });
            
      return (response.data.webPages?.value || []).map(item => ({
        title: item.name,
        url: item.url,
        snippet: item.snippet,
        source: 'Bing'
      }));
    } catch (error) {
      throw new Error(`Bing search failed: ${error.message}`);
    }
  }
}

module.exports = { WebSearchTool };