/**
 * OpenAI Provider
 * Implements LLM provider interface for OpenAI GPT models
 * @module OpenAIProvider
 */

const EventEmitter = require('events');

class OpenAIProvider extends EventEmitter {
    /**
     * Create OpenAI provider
     * @param {string} apiKey - OpenAI API key
     * @param {Object} config - Configuration
     */
    constructor(apiKey, config = {}) {
        super();
        
        this.apiKey = apiKey;
        this.config = {
            model: config.model || 'gpt-4-turbo-preview',
            temperature: config.temperature || 0.7,
            maxTokens: config.maxTokens || 4000,
            ...config
        };
        
        this.client = null;
        this.initializeClient();
        
        this.stats = {
            totalCalls: 0,
            totalTokens: 0,
            promptTokens: 0,
            completionTokens: 0,
            errors: 0
        };
    }
    
    /**
     * Initialize OpenAI client
     * @private
     */
    async initializeClient() {
        try {
            const OpenAI = require('openai');
            this.client = new OpenAI({ apiKey: this.apiKey });
        } catch (error) {
            console.warn('OpenAI SDK not installed. Install with: npm install openai');
            throw new Error('OpenAI SDK required but not installed');
        }
    }
    
    /**
     * Generate action plan from page state
     * @param {Object} params - Parameters
     * @returns {Promise<Object>} Action plan
     */
    async generateAction(params) {
        if (!this.client) await this.initializeClient();
        
        this.stats.totalCalls++;
        
        try {
            const messages = [
                {
                    role: 'system',
                    content: 'You are a browser automation assistant. Respond with valid JSON only.'
                },
                {
                    role: 'user',
                    content: this.buildActionPrompt(params)
                }
            ];
            
            const response = await this.client.chat.completions.create({
                model: this.config.model,
                messages,
                temperature: this.config.temperature,
                max_tokens: this.config.maxTokens,
                response_format: { type: 'json_object' }
            });
            
            const content = response.choices[0].message.content;
            
            // Update token stats
            this.stats.totalTokens += response.usage.total_tokens;
            this.stats.promptTokens += response.usage.prompt_tokens;
            this.stats.completionTokens += response.usage.completion_tokens;
            
            const actionPlan = JSON.parse(content);
            
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
        if (!this.client) await this.initializeClient();
        
        this.stats.totalCalls++;
        
        try {
            const messages = [
                {
                    role: 'system',
                    content: 'You are a data extraction assistant. Respond with valid JSON only.'
                },
                {
                    role: 'user',
                    content: this.buildExtractionPrompt(params)
                }
            ];
            
            const response = await this.client.chat.completions.create({
                model: this.config.model,
                messages,
                temperature: 0.3,
                max_tokens: this.config.maxTokens,
                response_format: { type: 'json_object' }
            });
            
            const content = response.choices[0].message.content;
            
            this.stats.totalTokens += response.usage.total_tokens;
            this.stats.promptTokens += response.usage.prompt_tokens;
            this.stats.completionTokens += response.usage.completion_tokens;
            
            const extracted = JSON.parse(content);
            
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
        if (!this.client) await this.initializeClient();
        
        this.stats.totalCalls++;
        
        try {
            const messages = [
                {
                    role: 'system',
                    content: 'You are a web page observer. Provide clear, concise answers.'
                },
                {
                    role: 'user',
                    content: this.buildObservationPrompt(params)
                }
            ];
            
            const response = await this.client.chat.completions.create({
                model: this.config.model,
                messages,
                temperature: 0.3,
                max_tokens: this.config.maxTokens
            });
            
            const content = response.choices[0].message.content;
            
            this.stats.totalTokens += response.usage.total_tokens;
            this.stats.promptTokens += response.usage.prompt_tokens;
            this.stats.completionTokens += response.usage.completion_tokens;
            
            this.emit('observed', { observation: content });
            
            return content;
        } catch (error) {
            this.stats.errors++;
            this.emit('error', { type: 'observation', error: error.message });
            throw error;
        }
    }
    
    /**
     * Build prompts (same as Gemini for consistency)
     * @private
     */
    buildActionPrompt(params) {
        return `Analyze the page and suggest the next action to achieve the goal.

Goal: ${params.goal}

Current URL: ${params.url}

Page DOM Summary:
${JSON.stringify(params.dom, null, 2).substring(0, 4000)}

Context:
${JSON.stringify(params.context, null, 2)}

Respond with JSON:
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
    
    buildExtractionPrompt(params) {
        return `Extract the following information from the page:

${params.instruction}

Page DOM:
${JSON.stringify(params.dom, null, 2).substring(0, 4000)}

Respond with the extracted data in JSON format.`;
    }
    
    buildObservationPrompt(params) {
        return `Observe the page and answer:

${params.instruction}

Current URL: ${params.url}

Page DOM:
${JSON.stringify(params.dom, null, 2).substring(0, 4000)}

Provide a clear, concise answer.`;
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
        const validModels = ['gpt-4-turbo-preview', 'gpt-4', 'gpt-3.5-turbo'];
        return !config.model || validModels.includes(config.model);
    }
}

module.exports = { OpenAIProvider };