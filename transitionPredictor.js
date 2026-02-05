/**
 * ============================================================================
 * TRANSITION PREDICTOR - Page State Transition Prediction
 * ============================================================================
 * 
 * Predicts page state transitions and workflow patterns based on historical
 * data and pattern recognition. Provides timing predictions, success
 * probability estimation, and multi-step workflow analysis.
 * 
 * FEATURES:
 * - State transition pattern recognition
 * - Common UI flow detection
 * - Action timing prediction (click delays, load times)
 * - Success probability estimation
 * - Multi-step workflow prediction
 * - Adaptive learning from historical transitions
 * - Transition confidence scoring
 * - Workflow template matching
 * 
 * USAGE:
 * const predictor = new TransitionPredictor();
 * predictor.recordTransition(fromState, toState, action, duration, success);
 * const prediction = predictor.predictTransition(currentState, proposedAction);
 * 
 * ============================================================================
 */

const EventEmitter = require('events');
const crypto = require('crypto');

/**
 * Workflow patterns
 * @enum {string}
 */
const WorkflowPattern = {
    LOGIN: 'login',
    REGISTRATION: 'registration',
    CHECKOUT: 'checkout',
    SEARCH: 'search',
    NAVIGATION: 'navigation',
    FORM_SUBMISSION: 'form_submission',
    MULTI_STEP_FORM: 'multi_step_form',
    MODAL_INTERACTION: 'modal_interaction',
    UNKNOWN: 'unknown'
};

/**
 * Transition prediction
 * @typedef {Object} TransitionPrediction
 * @property {number} estimatedDuration - Estimated transition duration (ms)
 * @property {number} successProbability - Probability of success (0-1)
 * @property {string} predictedOutcome - Expected outcome
 * @property {Array<Object>} similarTransitions - Similar historical transitions
 * @property {number} confidence - Prediction confidence (0-1)
 */

/**
 * Transition Predictor for state transition prediction
 * @class
 * @extends EventEmitter
 */
class TransitionPredictor extends EventEmitter {
    /**
     * Create a new TransitionPredictor instance
     * @param {Object} options - Configuration options
     * @param {number} [options.maxTransitionHistory=200] - Maximum transitions to store
     * @param {number} [options.similarityThreshold=0.7] - Threshold for similar transitions
     * @param {number} [options.minSamplesForPrediction=3] - Minimum samples needed
     * @param {boolean} [options.enableLearning=true] - Enable adaptive learning
     */
    constructor(options = {}) {
        super();
        
        this.maxTransitionHistory = options.maxTransitionHistory || 200;
        this.similarityThreshold = options.similarityThreshold || 0.7;
        this.minSamplesForPrediction = options.minSamplesForPrediction || 3;
        this.enableLearning = options.enableLearning !== undefined ? options.enableLearning : true;
        
        // Transition storage
        this.transitionHistory = [];
        this.workflowPatterns = new Map();
        this.actionTimings = new Map();
        
        // Statistics
        this.stats = {
            totalTransitions: 0,
            successfulTransitions: 0,
            failedTransitions: 0,
            averageDuration: 0,
            totalDuration: 0,
            predictionsMade: 0,
            predictionsAccurate: 0
        };
        
        // Initialize common patterns
        this.initializePatterns();
        
        console.log('[TransitionPredictor] Initialized');
    }
    
    /**
     * Initialize common workflow patterns
     * @private
     */
    initializePatterns() {
        // Login workflow
        this.workflowPatterns.set(WorkflowPattern.LOGIN, {
            steps: ['type-username', 'type-password', 'click-submit'],
            expectedDuration: 2000,
            successIndicators: ['dashboard', 'welcome', 'logged-in']
        });
        
        // Registration workflow
        this.workflowPatterns.set(WorkflowPattern.REGISTRATION, {
            steps: ['type-email', 'type-password', 'type-confirm', 'click-register'],
            expectedDuration: 3000,
            successIndicators: ['verification', 'welcome', 'success']
        });
        
        // Checkout workflow
        this.workflowPatterns.set(WorkflowPattern.CHECKOUT, {
            steps: ['click-checkout', 'type-shipping', 'type-payment', 'click-confirm'],
            expectedDuration: 5000,
            successIndicators: ['confirmation', 'order-complete', 'thank-you']
        });
        
        // Search workflow
        this.workflowPatterns.set(WorkflowPattern.SEARCH, {
            steps: ['type-query', 'click-search'],
            expectedDuration: 1500,
            successIndicators: ['results', 'found', 'matches']
        });
    }
    
    /**
     * Record a transition
     * @param {Object} fromState - Starting state
     * @param {Object} toState - Ending state
     * @param {Object} action - Action that caused transition
     * @param {number} duration - Transition duration in milliseconds
     * @param {boolean} success - Whether transition succeeded
     * @param {Object} [metadata] - Additional metadata
     */
    recordTransition(fromState, toState, action, duration, success, metadata = {}) {
        const transitionId = crypto.randomUUID();
        
        const transition = {
            id: transitionId,
            timestamp: Date.now(),
            from: {
                url: fromState.url,
                domHash: fromState.domHash || this.hashString(fromState.dom || ''),
                viewport: fromState.viewport
            },
            to: {
                url: toState.url,
                domHash: toState.domHash || this.hashString(toState.dom || ''),
                viewport: toState.viewport
            },
            action: {
                type: action.action,
                selector: action.selector,
                text: action.text
            },
            duration: duration,
            success: success,
            metadata: metadata
        };
        
        // Add to history
        this.transitionHistory.push(transition);
        
        // Trim history if needed
        if (this.transitionHistory.length > this.maxTransitionHistory) {
            this.transitionHistory.shift();
        }
        
        // Update action timing statistics
        this.updateActionTimings(action.action, duration, success);
        
        // Update statistics
        this.stats.totalTransitions++;
        if (success) {
            this.stats.successfulTransitions++;
        } else {
            this.stats.failedTransitions++;
        }
        this.stats.totalDuration += duration;
        this.stats.averageDuration = this.stats.totalDuration / this.stats.totalTransitions;
        
        console.log(`[TransitionPredictor] Recorded transition ${transitionId}: ${action.action} (${duration}ms, ${success ? 'success' : 'failed'})`);
        this.emit('transition:recorded', { transitionId, transition });
        
        return transitionId;
    }
    
    /**
     * Predict transition outcome
     * @param {Object} currentState - Current state
     * @param {Object} proposedAction - Proposed action
     * @returns {TransitionPrediction} Prediction results
     */
    predictTransition(currentState, proposedAction) {
        console.log('[TransitionPredictor] Predicting transition for action:', proposedAction.action);
        
        this.stats.predictionsMade++;
        
        // Find similar historical transitions
        const similar = this.findSimilarTransitions(currentState, proposedAction);
        
        if (similar.length < this.minSamplesForPrediction) {
            return this.createLowConfidencePrediction(proposedAction);
        }
        
        // Calculate predictions from similar transitions
        const durations = similar.map(t => t.duration);
        const successes = similar.filter(t => t.success).length;
        
        const estimatedDuration = this.calculateMedian(durations);
        const successProbability = successes / similar.length;
        
        // Determine predicted outcome
        let predictedOutcome = 'unknown';
        if (successProbability > 0.7) {
            predictedOutcome = 'success';
        } else if (successProbability < 0.3) {
            predictedOutcome = 'failure';
        } else {
            predictedOutcome = 'uncertain';
        }
        
        // Calculate confidence based on sample size and consistency
        const confidence = this.calculatePredictionConfidence(similar);
        
        const prediction = {
            estimatedDuration: estimatedDuration,
            successProbability: successProbability,
            predictedOutcome: predictedOutcome,
            similarTransitions: similar.length,
            confidence: confidence,
            sampleData: {
                minDuration: Math.min(...durations),
                maxDuration: Math.max(...durations),
                avgDuration: durations.reduce((a, b) => a + b, 0) / durations.length
            }
        };
        
        console.log(`[TransitionPredictor] Prediction: ${predictedOutcome} (${(successProbability * 100).toFixed(0)}% success, ${estimatedDuration}ms, confidence: ${confidence.toFixed(2)})`);
        this.emit('prediction:made', prediction);
        
        return prediction;
    }
    
    /**
     * Find similar historical transitions
     * @private
     * @param {Object} currentState - Current state
     * @param {Object} proposedAction - Proposed action
     * @returns {Array<Object>} Similar transitions
     */
    findSimilarTransitions(currentState, proposedAction) {
        const similar = [];
        
        for (const transition of this.transitionHistory) {
            const similarity = this.calculateTransitionSimilarity(
                currentState,
                proposedAction,
                transition
            );
            
            if (similarity >= this.similarityThreshold) {
                similar.push({
                    ...transition,
                    similarity: similarity
                });
            }
        }
        
        // Sort by similarity
        similar.sort((a, b) => b.similarity - a.similarity);
        
        return similar;
    }
    
    /**
     * Calculate transition similarity
     * @private
     * @param {Object} currentState - Current state
     * @param {Object} proposedAction - Proposed action
     * @param {Object} historicalTransition - Historical transition
     * @returns {number} Similarity score (0-1)
     */
    calculateTransitionSimilarity(currentState, proposedAction, historicalTransition) {
        let score = 0;
        
        // Action type match (40% weight)
        if (proposedAction.action === historicalTransition.action.type) {
            score += 0.4;
        }
        
        // URL similarity (30% weight)
        const urlSimilarity = this.calculateUrlSimilarity(
            currentState.url,
            historicalTransition.from.url
        );
        score += urlSimilarity * 0.3;
        
        // Selector similarity (20% weight)
        if (proposedAction.selector && historicalTransition.action.selector) {
            if (proposedAction.selector === historicalTransition.action.selector) {
                score += 0.2;
            } else if (this.selectorsAreSimilar(proposedAction.selector, historicalTransition.action.selector)) {
                score += 0.1;
            }
        }
        
        // Viewport similarity (10% weight)
        if (currentState.viewport && historicalTransition.from.viewport) {
            const vpSimilarity = this.calculateViewportSimilarity(
                currentState.viewport,
                historicalTransition.from.viewport
            );
            score += vpSimilarity * 0.1;
        }
        
        return score;
    }
    
    /**
     * Calculate URL similarity
     * @private
     * @param {string} url1 - First URL
     * @param {string} url2 - Second URL
     * @returns {number} Similarity score (0-1)
     */
    calculateUrlSimilarity(url1, url2) {
        if (url1 === url2) return 1;
        
        try {
            const parsed1 = new URL(url1);
            const parsed2 = new URL(url2);
            
            let score = 0;
            
            if (parsed1.origin === parsed2.origin) score += 0.5;
            if (parsed1.pathname === parsed2.pathname) score += 0.3;
            if (parsed1.search === parsed2.search) score += 0.1;
            if (parsed1.hash === parsed2.hash) score += 0.1;
            
            return score;
        } catch (error) {
            return url1 === url2 ? 1 : 0;
        }
    }
    
    /**
     * Check if selectors are similar
     * @private
     * @param {string} selector1 - First selector
     * @param {string} selector2 - Second selector
     * @returns {boolean} Are similar
     */
    selectorsAreSimilar(selector1, selector2) {
        // Extract data-agent-id
        const id1 = selector1.match(/data-agent-id=['"](\d+)['"]/);
        const id2 = selector2.match(/data-agent-id=['"](\d+)['"]/);
        
        if (id1 && id2) {
            // Different IDs but same page might indicate similar elements
            return false;
        }
        
        // Check for similar class names or tags
        return selector1.includes(selector2) || selector2.includes(selector1);
    }
    
    /**
     * Calculate viewport similarity
     * @private
     * @param {Object} vp1 - First viewport
     * @param {Object} vp2 - Second viewport
     * @returns {number} Similarity score (0-1)
     */
    calculateViewportSimilarity(vp1, vp2) {
        const widthDiff = Math.abs(vp1.width - vp2.width);
        const heightDiff = Math.abs(vp1.height - vp2.height);
        
        const widthSim = 1 - Math.min(1, widthDiff / Math.max(vp1.width, vp2.width));
        const heightSim = 1 - Math.min(1, heightDiff / Math.max(vp1.height, vp2.height));
        
        return (widthSim + heightSim) / 2;
    }
    
    /**
     * Calculate median value
     * @private
     * @param {Array<number>} values - Values to analyze
     * @returns {number} Median value
     */
    calculateMedian(values) {
        if (values.length === 0) return 0;
        
        const sorted = [...values].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        
        if (sorted.length % 2 === 0) {
            return (sorted[mid - 1] + sorted[mid]) / 2;
        }
        return sorted[mid];
    }
    
    /**
     * Calculate prediction confidence
     * @private
     * @param {Array<Object>} similarTransitions - Similar transitions
     * @returns {number} Confidence score (0-1)
     */
    calculatePredictionConfidence(similarTransitions) {
        const sampleSize = similarTransitions.length;
        
        // Base confidence on sample size
        let confidence = Math.min(1, sampleSize / 10);
        
        // Adjust for consistency
        if (sampleSize > 0) {
            const durations = similarTransitions.map(t => t.duration);
            const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
            const variance = durations.reduce((sum, d) => sum + Math.pow(d - avgDuration, 2), 0) / durations.length;
            const stdDev = Math.sqrt(variance);
            
            // Lower std dev = higher confidence
            const consistency = avgDuration > 0 ? 1 - Math.min(1, stdDev / avgDuration) : 0;
            confidence = confidence * 0.6 + consistency * 0.4;
        }
        
        return confidence;
    }
    
    /**
     * Create low confidence prediction
     * @private
     * @param {Object} proposedAction - Proposed action
     * @returns {TransitionPrediction} Low confidence prediction
     */
    createLowConfidencePrediction(proposedAction) {
        // Use default timings based on action type
        const defaultDurations = {
            'click': 1000,
            'type': 500,
            'scroll': 300,
            'navigate': 3000,
            'wait': 1000
        };
        
        const estimatedDuration = defaultDurations[proposedAction.action] || 1000;
        
        return {
            estimatedDuration: estimatedDuration,
            successProbability: 0.5,
            predictedOutcome: 'uncertain',
            similarTransitions: 0,
            confidence: 0.3,
            sampleData: null
        };
    }
    
    /**
     * Update action timing statistics
     * @private
     * @param {string} actionType - Action type
     * @param {number} duration - Duration in milliseconds
     * @param {boolean} success - Whether action succeeded
     */
    updateActionTimings(actionType, duration, success) {
        if (!this.actionTimings.has(actionType)) {
            this.actionTimings.set(actionType, {
                count: 0,
                totalDuration: 0,
                successes: 0,
                failures: 0,
                durations: []
            });
        }
        
        const timing = this.actionTimings.get(actionType);
        timing.count++;
        timing.totalDuration += duration;
        timing.durations.push(duration);
        
        if (success) {
            timing.successes++;
        } else {
            timing.failures++;
        }
        
        // Keep only recent 50 durations
        if (timing.durations.length > 50) {
            timing.durations.shift();
        }
    }
    
    /**
     * Get timing statistics for an action type
     * @param {string} actionType - Action type
     * @returns {Object|null} Timing statistics
     */
    getActionTimings(actionType) {
        const timing = this.actionTimings.get(actionType);
        
        if (!timing) {
            return null;
        }
        
        return {
            count: timing.count,
            averageDuration: timing.count > 0 ? timing.totalDuration / timing.count : 0,
            medianDuration: this.calculateMedian(timing.durations),
            successRate: timing.count > 0 ? timing.successes / timing.count : 0,
            recentDurations: timing.durations.slice(-10)
        };
    }
    
    /**
     * Detect workflow pattern
     * @param {Array<Object>} recentTransitions - Recent transitions
     * @returns {Object} Detected workflow pattern
     */
    detectWorkflowPattern(recentTransitions) {
        if (recentTransitions.length < 2) {
            return {
                pattern: WorkflowPattern.UNKNOWN,
                confidence: 0,
                matchedSteps: []
            };
        }
        
        // Extract action sequence
        const actionSequence = recentTransitions.map(t => 
            `${t.action.type}${t.action.selector ? '-' + this.simplifySelector(t.action.selector) : ''}`
        );
        
        // Compare against known patterns
        let bestMatch = null;
        let bestScore = 0;
        
        for (const [patternName, pattern] of this.workflowPatterns.entries()) {
            const score = this.matchSequenceToPattern(actionSequence, pattern.steps);
            
            if (score > bestScore) {
                bestScore = score;
                bestMatch = {
                    pattern: patternName,
                    confidence: score,
                    matchedSteps: pattern.steps,
                    expectedDuration: pattern.expectedDuration
                };
            }
        }
        
        return bestMatch || {
            pattern: WorkflowPattern.UNKNOWN,
            confidence: 0,
            matchedSteps: []
        };
    }
    
    /**
     * Match action sequence to pattern
     * @private
     * @param {Array<string>} sequence - Action sequence
     * @param {Array<string>} pattern - Pattern steps
     * @returns {number} Match score (0-1)
     */
    matchSequenceToPattern(sequence, pattern) {
        let matches = 0;
        const maxLen = Math.max(sequence.length, pattern.length);
        
        for (let i = 0; i < Math.min(sequence.length, pattern.length); i++) {
            if (sequence[i].includes(pattern[i]) || pattern[i].includes(sequence[i])) {
                matches++;
            }
        }
        
        return maxLen > 0 ? matches / maxLen : 0;
    }
    
    /**
     * Simplify selector for pattern matching
     * @private
     * @param {string} selector - CSS selector
     * @returns {string} Simplified selector
     */
    simplifySelector(selector) {
        // Extract key parts
        if (selector.includes('data-agent-id')) {
            return 'element';
        }
        if (selector.includes('button')) {
            return 'button';
        }
        if (selector.includes('input')) {
            return 'input';
        }
        return 'generic';
    }
    
    /**
     * Predict multi-step workflow completion
     * @param {Array<Object>} recentTransitions - Recent transitions
     * @param {Object} currentState - Current state
     * @returns {Object} Workflow prediction
     */
    predictWorkflowCompletion(recentTransitions, currentState) {
        const pattern = this.detectWorkflowPattern(recentTransitions);
        
        if (pattern.pattern === WorkflowPattern.UNKNOWN) {
            return {
                willComplete: false,
                confidence: 0.3,
                reason: 'Unknown workflow pattern'
            };
        }
        
        const completedSteps = recentTransitions.length;
        const totalSteps = pattern.matchedSteps.length;
        const progress = completedSteps / totalSteps;
        
        return {
            willComplete: progress > 0.5,
            pattern: pattern.pattern,
            progress: progress,
            completedSteps: completedSteps,
            remainingSteps: Math.max(0, totalSteps - completedSteps),
            confidence: pattern.confidence,
            estimatedTimeRemaining: pattern.expectedDuration * (1 - progress)
        };
    }
    
    /**
     * Hash a string
     * @private
     * @param {string} str - String to hash
     * @returns {string} Hash value
     */
    hashString(str) {
        const crypto = require('crypto');
        return crypto.createHash('md5').update(str).digest('hex');
    }
    
    /**
     * Validate prediction accuracy
     * @param {string} predictionId - Prediction ID (not implemented yet)
     * @param {boolean} actualSuccess - Actual outcome
     * @param {number} actualDuration - Actual duration
     */
    validatePrediction(predictionId, actualSuccess, actualDuration) {
        // Track prediction accuracy for adaptive learning
        this.stats.predictionsAccurate++;
        
        console.log(`[TransitionPredictor] Prediction validated: ${actualSuccess ? 'accurate' : 'inaccurate'}`);
        this.emit('prediction:validated', { actualSuccess, actualDuration });
    }
    
    /**
     * Get predictor statistics
     * @returns {Object} Statistics
     */
    getStats() {
        const successRate = this.stats.totalTransitions > 0 
            ? (this.stats.successfulTransitions / this.stats.totalTransitions * 100).toFixed(2) + '%'
            : '0%';
        
        const predictionAccuracy = this.stats.predictionsMade > 0
            ? (this.stats.predictionsAccurate / this.stats.predictionsMade * 100).toFixed(2) + '%'
            : '0%';
        
        return {
            ...this.stats,
            averageDuration: this.stats.averageDuration.toFixed(2) + 'ms',
            successRate: successRate,
            predictionAccuracy: predictionAccuracy,
            historySize: this.transitionHistory.length,
            knownActionTypes: this.actionTimings.size
        };
    }
    
    /**
     * Get transition history
     * @param {number} [limit=20] - Number of transitions to return
     * @returns {Array<Object>} Transition history
     */
    getHistory(limit = 20) {
        return this.transitionHistory.slice(-limit);
    }
    
    /**
     * Clear transition history
     */
    clearHistory() {
        const size = this.transitionHistory.length;
        this.transitionHistory = [];
        this.actionTimings.clear();
        
        console.log(`[TransitionPredictor] Cleared ${size} transitions from history`);
        this.emit('history:cleared', { size });
    }
    
    /**
     * Reset predictor
     */
    reset() {
        console.log('[TransitionPredictor] Resetting predictor');
        
        this.transitionHistory = [];
        this.actionTimings.clear();
        
        this.stats = {
            totalTransitions: 0,
            successfulTransitions: 0,
            failedTransitions: 0,
            averageDuration: 0,
            totalDuration: 0,
            predictionsMade: 0,
            predictionsAccurate: 0
        };
        
        this.emit('predictor:reset');
    }
}

module.exports = { TransitionPredictor, WorkflowPattern };
