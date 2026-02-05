/**
 * Google Gemini Provider
 * Implements LLM provider interface for Google Gemini
 * @module GeminiProvider
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const EventEmitter = require('events');

class GeminiProvider extends EventEmitter {
  /**
     * Create Gemini provider
     * @param {string} apiKey - Gemini API key
     * @param {Object} config - Configuration
     */
  constructor(apiKey, config = {}) {
    super();
        
    this.apiKey = apiKey;
    this.config = {
      model: config.model || 'gemini-1.5-flash',
      temperature: config.temperature || 0.7,
      maxTokens: config.maxTokens || 8000,
      ...config
    };
        
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({ model: this.config.model });
        
    this.stats = {
      totalCalls: 0,
      totalTokens: 0,
      errors: 0
    };
  }
    
  /**
     * Generate action plan from page state
     * @param {Object} params - Parameters
     * @returns {Promise<Object>} Action plan
     */
  async generateAction(params) {
    this.stats.totalCalls++;
        
    try {
      const prompt = this.buildActionPrompt(params);
      const result = await this.model.generateContent(prompt);
      const response = result.response;
      const text = response.text();
            
      this.stats.totalTokens += response.usageMetadata?.totalTokenCount || 0;
            
      const actionPlan = this.parseActionResponse(text);
            
      this.emit('actionGenerated', { actionPlan });
            
      return actionPlan;
    } catch (error) {
      this.stats.errors++;
      this.emit('error', { type: 'generation', error: error.message });
      throw error;
    }
  }
    
  /**
     * Extract information from page
     * @param {Object} params - Parameters
     * @returns {Promise<any>} Extracted data
     */
  async extract(params) {
    this.stats.totalCalls++;
        
    try {
      const prompt = this.buildExtractionPrompt(params);
      const result = await this.model.generateContent(prompt);
      const response = result.response;
      const text = response.text();
            
      this.stats.totalTokens += response.usageMetadata?.totalTokenCount || 0;
            
      const extracted = this.parseExtractedData(text);
            
      this.emit('extracted', { data: extracted });
            
      return extracted;
    } catch (error) {
      this.stats.errors++;
      this.emit('error', { type: 'extraction', error: error.message });
      throw error;
    }
  }
    
  /**
     * Observe page state
     * @param {Object} params - Parameters
     * @returns {Promise<any>} Observation
     */
  async observe(params) {
    this.stats.totalCalls++;
        
    try {
      const prompt = this.buildObservationPrompt(params);
      const result = await this.model.generateContent(prompt);
      const response = result.response;
      const text = response.text();
            
      this.stats.totalTokens += response.usageMetadata?.totalTokenCount || 0;
            
      this.emit('observed', { observation: text });
            
      return text;
    } catch (error) {
      this.stats.errors++;
      this.emit('error', { type: 'observation', error: error.message });
      throw error;
    }
  }
    
  /**
     * Build action generation prompt
     * @private
     */
  buildActionPrompt(params) {
    return `You are a browser automation assistant. Analyze the page and suggest the next action.

Goal: ${params.goal}

Current URL: ${params.url}

Page DOM Summary:
${JSON.stringify(params.dom, null, 2).substring(0, 4000)}

Context:
${JSON.stringify(params.context, null, 2)}

Respond with JSON only:
{
  "action": "click|type|navigate|scroll|wait|complete",
  "selector": "CSS selector or null",
  "value": "value for type action or null",
  "url": "URL for navigate or null",
  "scrollY": "scroll position or null",
  "duration": "wait duration or null",
  "reasoning": "explanation",
  "confidence": 0.0-1.0
}`;
  }
    
  /**
     * Build extraction prompt
     * @private
     */
  buildExtractionPrompt(params) {
    return `Extract the following information from the page:

${params.instruction}

Page DOM:
${JSON.stringify(params.dom, null, 2).substring(0, 4000)}

Respond with the extracted data in JSON format.`;
  }
    
  /**
     * Build observation prompt
     * @private
     */
  buildObservationPrompt(params) {
    return `Observe the page and answer the following:

${params.instruction}

Current URL: ${params.url}

Page DOM:
${JSON.stringify(params.dom, null, 2).substring(0, 4000)}

Provide a clear, concise answer.`;
  }
    
  /**
     * Parse action response
     * @private
     */
  parseActionResponse(text) {
    try {
      // Extract JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      throw new Error('No JSON found in response');
    } catch (error) {
      // Fallback: create default action
      return {
        action: 'wait',
        duration: 1000,
        reasoning: 'Failed to parse LLM response',
        confidence: 0.3
      };
    }
  }
    
  /**
     * Parse extracted data
     * @private
     */
  parseExtractedData(text) {
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return { data: text };
    } catch (error) {
      return { data: text };
    }
  }
    
  /**
     * Get provider statistics
     * @returns {Object} Statistics
     */
  getStats() {
    return {
      ...this.stats,
      averageTokensPerCall: this.stats.totalCalls > 0
        ? Math.round(this.stats.totalTokens / this.stats.totalCalls)
        : 0,
      errorRate: this.stats.totalCalls > 0
        ? (this.stats.errors / this.stats.totalCalls * 100).toFixed(2) + '%'
        : '0%'
    };
  }
    
  /**
     * Validate configuration
     * @static
     */
  static validateConfig(config) {
    const validModels = ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-pro'];
    return !config.model || validModels.includes(config.model);
  }
}

module.exports = { GeminiProvider };