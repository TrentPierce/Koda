/**
 * Anthropic Claude Provider
 * Implements LLM provider interface for Anthropic Claude
 * @module AnthropicProvider
 */

const EventEmitter = require('events');

class AnthropicProvider extends EventEmitter {
    /**
     * Create Anthropic provider
     * @param {string} apiKey - Anthropic API key
     * @param {Object} config - Configuration
     */
    constructor(apiKey, config = {}) {
        super();
        
        this.apiKey = apiKey;
        this.config = {
            model: config.model || 'claude-3-sonnet-20240229',
            temperature: config.temperature || 0.7,
            maxTokens: config.maxTokens || 4000,
            ...config
        };
        
        this.client = null;
        this.initializeClient();
        
        this.stats = {
            totalCalls: 0,
            totalTokens: 0,
            inputTokens: 0,
            outputTokens: 0,
            errors: 0
        };
    }
    
    /**
     * Initialize Anthropic client
     * @private
     */
    async initializeClient() {
        try {
            const Anthropic = require('@anthropic-ai/sdk');
            this.client = new Anthropic({ apiKey: this.apiKey });
        } catch (error) {
            console.warn('Anthropic SDK not installed. Install with: npm install @anthropic-ai/sdk');
            throw new Error('Anthropic SDK required but not installed');
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
            const message = await this.client.messages.create({
                model: this.config.model,
                max_tokens: this.config.maxTokens,
                temperature: this.config.temperature,
                system: 'You are a browser automation assistant. Respond with valid JSON only.',
                messages: [
                    {
                        role: 'user',
                        content: this.buildActionPrompt(params)
                    }
                ]
            });
            
            const content = message.content[0].text;
            
            // Update token stats
            this.stats.inputTokens += message.usage.input_tokens;
            this.stats.outputTokens += message.usage.output_tokens;
            this.stats.totalTokens += message.usage.input_tokens + message.usage.output_tokens;
            
            const actionPlan = this.parseActionResponse(content);
            
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
            const message = await this.client.messages.create({
                model: this.config.model,
                max_tokens: this.config.maxTokens,
                temperature: 0.3,
                system: 'You are a data extraction assistant. Respond with valid JSON only.',
                messages: [
                    {
                        role: 'user',
                        content: this.buildExtractionPrompt(params)
                    }
                ]
            });
            
            const content = message.content[0].text;
            
            this.stats.inputTokens += message.usage.input_tokens;
            this.stats.outputTokens += message.usage.output_tokens;
            this.stats.totalTokens += message.usage.input_tokens + message.usage.output_tokens;
            
            const extracted = this.parseExtractedData(content);
            
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
            const message = await this.client.messages.create({
                model: this.config.model,
                max_tokens: this.config.maxTokens,
                temperature: 0.3,
                system: 'You are a web page observer. Provide clear, concise answers.',
                messages: [
                    {
                        role: 'user',
                        content: this.buildObservationPrompt(params)
                    }
                ]
            });
            
            const content = message.content[0].text;
            
            this.stats.inputTokens += message.usage.input_tokens;
            this.stats.outputTokens += message.usage.output_tokens;
            this.stats.totalTokens += message.usage.input_tokens + message.usage.output_tokens;
            
            this.emit('observed', { observation: content });
            
            return content;
        } catch (error) {
            this.stats.errors++;
            this.emit('error', { type: 'observation', error: error.message });
            throw error;
        }
    }
    
    /**
     * Build prompts
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
     * Parse responses
     * @private
     */
    parseActionResponse(text) {
        try {
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
            throw new Error('No JSON found in response');
        } catch (error) {
            return {
                action: 'wait',
                duration: 1000,
                reasoning: 'Failed to parse LLM response',
                confidence: 0.3
            };
        }
    }
    
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
        const validModels = [
            'claude-3-opus-20240229',
            'claude-3-sonnet-20240229',
            'claude-3-haiku-20240307'
        ];
        return !config.model || validModels.includes(config.model);
    }
}

module.exports = { AnthropicProvider };