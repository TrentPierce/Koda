/**
 * ============================================================================
 * API UNIFICATION - Unified High-Level Interface
 * ============================================================================
 * 
 * Provides a simplified, unified API interface that abstracts all 12 components
 * into easy-to-use high-level methods. Supports configuration presets, custom
 * pipelines, backward compatibility, and API versioning.
 * 
 * FEATURES:
 * - Unified interface for all 12 components
 * - High-level methods for common use cases
 * - Configuration presets (fast, balanced, thorough, production)
 * - Custom analysis pipeline builder
 * - Backward compatibility with existing code
 * - API versioning (v1, v2)
 * - Automatic optimization based on requirements
 * - Simplified error handling
 * 
 * USAGE:
 * const api = new KodaAPI();
 * const result = await api.analyze(pageData, { preset: 'production' });
 * 
 * ============================================================================
 */

const EventEmitter = require('events');
const { TaskOrchestrator } = require('./taskOrchestrator');
const { Priority } = require('./jobQueue');

/**
 * API version
 * @enum {string}
 */
const APIVersion = {
    V1: 'v1',
    V2: 'v2'
};

/**
 * Configuration presets
 * @enum {string}
 */
const ConfigPreset = {
    FAST: 'fast',           // Minimal analysis, fast results
    BALANCED: 'balanced',   // Good balance of speed and accuracy
    THOROUGH: 'thorough',   // Deep analysis, best accuracy
    PRODUCTION: 'production' // Optimized for production use
};

/**
 * Analysis mode
 * @enum {string}
 */
const AnalysisMode = {
    MINIMAL: 'minimal',     // DOM only
    VISUAL: 'visual',       // DOM + Visual
    TEMPORAL: 'temporal',   // DOM + Temporal
    INTELLIGENT: 'intelligent', // All with decision fusion
    CUSTOM: 'custom'        // User-defined pipeline
};

/**
 * Unified API for Koda enhancement system
 * @class
 * @extends EventEmitter
 */
class KodaAPI extends EventEmitter {
    /**
     * Create a new KodaAPI instance
     * @param {Object} options - Configuration options
     * @param {string} [options.version='v2'] - API version
     * @param {string} [options.preset='balanced'] - Configuration preset
     * @param {Object} [options.orchestratorOptions] - TaskOrchestrator options
     * @param {boolean} [options.autoOptimize=true] - Enable automatic optimization
     */
    constructor(options = {}) {
        super();
        
        this.version = options.version || APIVersion.V2;
        this.preset = options.preset || ConfigPreset.BALANCED;
        this.autoOptimize = options.autoOptimize !== undefined ? options.autoOptimize : true;
        
        // Initialize orchestrator with preset configuration
        const orchestratorConfig = this.getPresetConfiguration(this.preset);
        this.orchestrator = new TaskOrchestrator({
            ...orchestratorConfig,
            ...options.orchestratorOptions
        });
        
        // API state
        this.initialized = true;
        this.analysisCount = 0;
        
        // Statistics
        this.stats = {
            totalAnalyses: 0,
            successfulAnalyses: 0,
            failedAnalyses: 0,
            averageTime: 0,
            totalTime: 0,
            byMode: {},
            byPreset: {}
        };
        
        this.setupEventForwarding();
        
        console.log(`[KodaAPI] Initialized with version ${this.version}, preset: ${this.preset}`);
    }
    
    /**
     * Get preset configuration
     * @private
     * @param {string} preset - Configuration preset
     * @returns {Object} Orchestrator configuration
     */
    getPresetConfiguration(preset) {
        const presets = {
            [ConfigPreset.FAST]: {
                maxConcurrent: 2,
                taskTimeout: 15000,
                enableVisualAnalysis: false,
                enableTemporalAnalysis: false,
                enableDecisionFusion: false
            },
            [ConfigPreset.BALANCED]: {
                maxConcurrent: 3,
                taskTimeout: 25000,
                enableVisualAnalysis: true,
                enableTemporalAnalysis: false,
                enableDecisionFusion: true,
                confidenceOptions: {
                    defaultHighThreshold: 0.75
                }
            },
            [ConfigPreset.THOROUGH]: {
                maxConcurrent: 4,
                taskTimeout: 40000,
                enableVisualAnalysis: true,
                enableTemporalAnalysis: true,
                enableDecisionFusion: true,
                confidenceOptions: {
                    defaultHighThreshold: 0.8
                }
            },
            [ConfigPreset.PRODUCTION]: {
                maxConcurrent: 4,
                taskTimeout: 30000,
                enableVisualAnalysis: true,
                enableTemporalAnalysis: true,
                enableDecisionFusion: true,
                beliefNetworkOptions: {
                    defaultPrior: 0.16,
                    evidenceDecay: 0.95
                },
                feedbackOptions: {
                    learningRate: 0.1,
                    explorationRate: 0.05
                },
                confidenceOptions: {
                    defaultHighThreshold: 0.8,
                    enableDomainOptimization: true
                }
            }
        };
        
        return presets[preset] || presets[ConfigPreset.BALANCED];
    }
    
    /**
     * Set up event forwarding from orchestrator
     * @private
     */
    setupEventForwarding() {
        // Forward all orchestrator events
        this.orchestrator.on('analysis:completed', (data) => {
            this.emit('analysis:completed', data);
        });
        
        this.orchestrator.on('analysis:failed', (data) => {
            this.emit('analysis:failed', data);
        });
        
        this.orchestrator.on('decision:beliefsComputed', (data) => {
            this.emit('decision:computed', data);
        });
        
        this.orchestrator.on('temporal:stateChanged', (data) => {
            this.emit('state:changed', data);
        });
    }
    
    /**
     * Analyze page and make decision (main high-level method)
     * @param {Object} pageData - Page data to analyze
     * @param {string} pageData.dom - Simplified DOM
     * @param {string} [pageData.screenshot] - Base64 screenshot
     * @param {string} pageData.url - Current URL
     * @param {string} pageData.goal - User goal
     * @param {Object} [pageData.viewport] - Viewport metadata
     * @param {Array} [pageData.domNodes] - DOM nodes with positions
     * @param {Object} [options] - Analysis options
     * @param {string} [options.mode] - Analysis mode
     * @param {string} [options.preset] - Override preset for this analysis
     * @param {string} [options.priority] - Task priority
     * @param {boolean} [options.recordFeedback=true] - Record feedback for learning
     * @returns {Promise<Object>} Analysis result with action plan
     */
    async analyze(pageData, options = {}) {
        const startTime = Date.now();
        const mode = options.mode || this.determineOptimalMode(pageData);
        const preset = options.preset || this.preset;
        
        console.log(`[KodaAPI] Analyzing with mode: ${mode}, preset: ${preset}`);
        
        try {
            // Build analysis configuration
            const analysisConfig = this.buildAnalysisConfig(mode, preset);
            
            // Execute analysis
            const result = await this.orchestrator.executeParallelAnalysis(
                pageData,
                {
                    ...analysisConfig,
                    priority: options.priority || Priority.MEDIUM
                }
            );
            
            // Enhance result with API metadata
            const enhancedResult = this.enhanceResult(result, mode, preset);
            
            // Update statistics
            const duration = Date.now() - startTime;
            this.updateStats(duration, true, mode, preset);
            
            console.log(`[KodaAPI] Analysis completed in ${duration}ms`);
            
            return enhancedResult;
            
        } catch (error) {
            const duration = Date.now() - startTime;
            this.updateStats(duration, false, mode, preset);
            
            console.error(`[KodaAPI] Analysis failed:`, error.message);
            throw error;
        }
    }
    
    /**
     * Determine optimal analysis mode based on available data
     * @private
     * @param {Object} pageData - Page data
     * @returns {string} Optimal analysis mode
     */
    determineOptimalMode(pageData) {
        if (!this.autoOptimize) {
            return AnalysisMode.INTELLIGENT;
        }
        
        const hasScreenshot = !!pageData.screenshot;
        const hasViewport = !!pageData.viewport;
        const hasDomNodes = pageData.domNodes && pageData.domNodes.length > 0;
        
        // If we have all data, use intelligent mode
        if (hasScreenshot && hasViewport && hasDomNodes) {
            return AnalysisMode.INTELLIGENT;
        }
        
        // If we have visual data, use visual mode
        if (hasScreenshot && hasViewport) {
            return AnalysisMode.VISUAL;
        }
        
        // Otherwise use minimal mode
        return AnalysisMode.MINIMAL;
    }
    
    /**
     * Build analysis configuration for mode and preset
     * @private
     * @param {string} mode - Analysis mode
     * @param {string} preset - Configuration preset
     * @returns {Object} Analysis configuration
     */
    buildAnalysisConfig(mode, preset) {
        const config = {};
        
        switch (mode) {
            case AnalysisMode.MINIMAL:
                config.useVisualAnalysis = false;
                config.useTemporalAnalysis = false;
                config.useDecisionFusion = false;
                break;
            
            case AnalysisMode.VISUAL:
                config.useVisualAnalysis = true;
                config.useTemporalAnalysis = false;
                config.useDecisionFusion = preset !== ConfigPreset.FAST;
                break;
            
            case AnalysisMode.TEMPORAL:
                config.useVisualAnalysis = false;
                config.useTemporalAnalysis = true;
                config.useDecisionFusion = preset !== ConfigPreset.FAST;
                break;
            
            case AnalysisMode.INTELLIGENT:
                config.useVisualAnalysis = true;
                config.useTemporalAnalysis = true;
                config.useDecisionFusion = true;
                break;
            
            default:
                config.useVisualAnalysis = true;
                config.useTemporalAnalysis = true;
                config.useDecisionFusion = true;
        }
        
        return config;
    }
    
    /**
     * Enhance result with API metadata
     * @private
     * @param {Object} result - Analysis result
     * @param {string} mode - Analysis mode
     * @param {string} preset - Configuration preset
     * @returns {Object} Enhanced result
     */
    enhanceResult(result, mode, preset) {
        return {
            ...result,
            api: {
                version: this.version,
                mode: mode,
                preset: preset,
                timestamp: Date.now()
            }
        };
    }
    
    /**
     * Quick analyze with minimal configuration (v2 API)
     * @param {Object} pageData - Page data
     * @returns {Promise<Object>} Quick analysis result
     */
    async quickAnalyze(pageData) {
        return this.analyze(pageData, {
            mode: AnalysisMode.MINIMAL,
            preset: ConfigPreset.FAST
        });
    }
    
    /**
     * Deep analyze with thorough configuration (v2 API)
     * @param {Object} pageData - Page data
     * @returns {Promise<Object>} Deep analysis result
     */
    async deepAnalyze(pageData) {
        return this.analyze(pageData, {
            mode: AnalysisMode.INTELLIGENT,
            preset: ConfigPreset.THOROUGH
        });
    }
    
    /**
     * Analyze with visual understanding (v2 API)
     * @param {Object} pageData - Page data
     * @returns {Promise<Object>} Visual analysis result
     */
    async visualAnalyze(pageData) {
        return this.analyze(pageData, {
            mode: AnalysisMode.VISUAL,
            preset: ConfigPreset.BALANCED
        });
    }
    
    /**
     * Record action outcome for learning (v2 API)
     * @param {Object} actionPlan - Action plan that was executed
     * @param {Object} outcome - Outcome of the action
     * @param {boolean} outcome.success - Whether action succeeded
     * @param {number} [outcome.duration] - Action duration
     * @param {Object} [metadata] - Additional metadata
     */
    recordOutcome(actionPlan, outcome, metadata = {}) {
        if (this.orchestrator.enableDecisionFusion) {
            this.orchestrator.recordOutcome(actionPlan, outcome, metadata);
        }
    }
    
    /**
     * Get comprehensive statistics (v2 API)
     * @returns {Object} Complete system statistics
     */
    getStats() {
        return {
            api: {
                version: this.version,
                preset: this.preset,
                ...this.stats
            },
            orchestrator: this.orchestrator.getStats()
        };
    }
    
    /**
     * Get simplified statistics (v1 compatibility)
     * @returns {Object} Basic statistics
     */
    getBasicStats() {
        return {
            totalAnalyses: this.stats.totalAnalyses,
            successRate: this.stats.totalAnalyses > 0
                ? (this.stats.successfulAnalyses / this.stats.totalAnalyses * 100).toFixed(1) + '%'
                : '0%',
            averageTime: this.stats.averageTime.toFixed(0) + 'ms'
        };
    }
    
    /**
     * Change configuration preset
     * @param {string} preset - New preset
     */
    changePreset(preset) {
        if (!Object.values(ConfigPreset).includes(preset)) {
            throw new Error(`Invalid preset: ${preset}`);
        }
        
        console.log(`[KodaAPI] Changing preset from ${this.preset} to ${preset}`);
        this.preset = preset;
        
        // Reconfigure orchestrator (Note: This creates a new instance)
        const oldOrchestrator = this.orchestrator;
        const config = this.getPresetConfiguration(preset);
        this.orchestrator = new TaskOrchestrator(config);
        this.setupEventForwarding();
        
        // Clean up old orchestrator
        oldOrchestrator.destroy();
    }
    
    /**
     * Create custom analysis pipeline
     * @param {Object} pipelineConfig - Custom pipeline configuration
     * @param {boolean} [pipelineConfig.enableDOM=true] - Enable DOM analysis
     * @param {boolean} [pipelineConfig.enableVision=false] - Enable vision analysis
     * @param {boolean} [pipelineConfig.enableVisualSegmentation=false] - Enable segmentation
     * @param {boolean} [pipelineConfig.enableClassification=false] - Enable classification
     * @param {boolean} [pipelineConfig.enableMapping=false] - Enable visual mapping
     * @param {boolean} [pipelineConfig.enableStateTracking=false] - Enable state tracking
     * @param {boolean} [pipelineConfig.enableAnimations=false] - Enable animation detection
     * @param {boolean} [pipelineConfig.enablePrediction=false] - Enable transition prediction
     * @param {boolean} [pipelineConfig.enableDecisionFusion=false] - Enable decision fusion
     * @returns {Function} Custom analyze function
     */
    createCustomPipeline(pipelineConfig) {
        return async (pageData, options = {}) => {
            const taskTypes = [];
            
            if (pipelineConfig.enableDOM !== false) taskTypes.push('dom_analysis');
            if (pipelineConfig.enableVision) taskTypes.push('vision_analysis');
            if (pipelineConfig.enableVisualSegmentation) taskTypes.push('visual_segmentation');
            if (pipelineConfig.enableClassification) taskTypes.push('element_classification');
            if (pipelineConfig.enableMapping) taskTypes.push('visual_mapping');
            if (pipelineConfig.enableStateTracking) taskTypes.push('state_tracking');
            if (pipelineConfig.enableAnimations) taskTypes.push('animation_detection');
            if (pipelineConfig.enablePrediction) taskTypes.push('transition_prediction');
            
            return this.orchestrator.executeParallelAnalysis(pageData, {
                analysisTypes: taskTypes,
                useDecisionFusion: pipelineConfig.enableDecisionFusion || false,
                ...options
            });
        };
    }
    
    /**
     * Update statistics
     * @private
     * @param {number} duration - Analysis duration
     * @param {boolean} success - Whether analysis succeeded
     * @param {string} mode - Analysis mode
     * @param {string} preset - Configuration preset
     */
    updateStats(duration, success, mode, preset) {
        this.stats.totalAnalyses++;
        
        if (success) {
            this.stats.successfulAnalyses++;
        } else {
            this.stats.failedAnalyses++;
        }
        
        this.stats.totalTime += duration;
        this.stats.averageTime = this.stats.totalTime / this.stats.totalAnalyses;
        
        // Track by mode
        if (!this.stats.byMode[mode]) {
            this.stats.byMode[mode] = { count: 0, totalTime: 0 };
        }
        this.stats.byMode[mode].count++;
        this.stats.byMode[mode].totalTime += duration;
        
        // Track by preset
        if (!this.stats.byPreset[preset]) {
            this.stats.byPreset[preset] = { count: 0, totalTime: 0 };
        }
        this.stats.byPreset[preset].count++;
        this.stats.byPreset[preset].totalTime += duration;
    }
    
    /**
     * Cleanup and destroy API
     */
    destroy() {
        console.log('[KodaAPI] Destroying API');
        
        if (this.orchestrator) {
            this.orchestrator.destroy();
        }
        
        this.removeAllListeners();
        this.initialized = false;
    }
    
    // ========================================================================
    // V1 API COMPATIBILITY METHODS
    // ========================================================================
    
    /**
     * Analyze page (v1 compatibility)
     * @param {Object} pageData - Page data
     * @param {string} goal - User goal
     * @returns {Promise<Object>} Analysis result
     */
    async analyzePage(pageData, goal) {
        return this.analyze({
            ...pageData,
            goal: goal
        }, {
            preset: ConfigPreset.BALANCED
        });
    }
    
    /**
     * Get action recommendation (v1 compatibility)
     * @param {Object} pageData - Page data
     * @returns {Promise<Object>} Action recommendation
     */
    async getActionRecommendation(pageData) {
        const result = await this.quickAnalyze(pageData);
        
        return {
            action: result.action,
            selector: result.selector,
            confidence: result.confidence,
            reason: result.reason
        };
    }
    
    /**
     * Check if page is ready (v1 compatibility)
     * @param {Object} pageData - Page data
     * @returns {Promise<boolean>} Whether page is ready
     */
    async isPageReady(pageData) {
        if (!this.orchestrator.enableTemporalAnalysis) {
            return true; // Can't check without temporal analysis
        }
        
        const result = await this.analyze(pageData, {
            mode: AnalysisMode.TEMPORAL,
            preset: ConfigPreset.FAST
        });
        
        return result.action !== 'wait';
    }
}

/**
 * Create API instance with preset
 * @param {string} preset - Configuration preset
 * @returns {KodaAPI} API instance
 */
function createAPI(preset = ConfigPreset.BALANCED) {
    return new KodaAPI({ preset });
}

/**
 * Create production-ready API
 * @returns {KodaAPI} Production API instance
 */
function createProductionAPI() {
    return new KodaAPI({
        preset: ConfigPreset.PRODUCTION,
        version: APIVersion.V2
    });
}

/**
 * Create fast API for quick analysis
 * @returns {KodaAPI} Fast API instance
 */
function createFastAPI() {
    return new KodaAPI({
        preset: ConfigPreset.FAST,
        version: APIVersion.V2
    });
}

module.exports = {
    KodaAPI,
    APIVersion,
    ConfigPreset,
    AnalysisMode,
    createAPI,
    createProductionAPI,
    createFastAPI
};
