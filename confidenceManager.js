/**
 * Koda - Intelligent Browser Automation Library
 * This project uses Koda by Trent Pierce
 * https://github.com/TrentPierce/Koda
 * Licensed under the Koda Non-Commercial License
 *
 * Copyright (c) 2026 Trent Pierce. All rights reserved.
 * See LICENSE file for full terms.
 */

const EventEmitter = require('events');

/**
 * Confidence levels
 * @enum {string}
 */
const ConfidenceLevel = {
    VERY_HIGH: 'very_high',    // 0.9+
    HIGH: 'high',              // 0.75-0.9
    MEDIUM: 'medium',          // 0.6-0.75
    LOW: 'low',                // 0.4-0.6
    VERY_LOW: 'very_low'       // <0.4
};

/**
 * Risk levels
 * @enum {string}
 */
const RiskLevel = {
    MINIMAL: 'minimal',
    LOW: 'low',
    MODERATE: 'moderate',
    HIGH: 'high',
    VERY_HIGH: 'very_high'
};

/**
 * Fallback strategy for different confidence levels
 * @typedef {Object} FallbackStrategy
 * @property {string} level - Confidence level
 * @property {number} threshold - Minimum confidence threshold
 * @property {string} action - Action to take
 * @property {number} maxRetries - Maximum retry attempts
 * @property {number} timeout - Action timeout
 */

/**
 * Confidence Threshold Manager for dynamic threshold management
 * @class
 * @extends EventEmitter
 */
class ConfidenceThresholdManager extends EventEmitter {
    /**
     * Create a new ConfidenceThresholdManager instance
     * @param {Object} options - Configuration options
     * @param {number} [options.defaultHighThreshold=0.75] - Default high confidence threshold
     * @param {number} [options.defaultMediumThreshold=0.6] - Default medium confidence threshold
     * @param {number} [options.defaultLowThreshold=0.4] - Default low confidence threshold
     * @param {number} [options.adjustmentRate=0.05] - Threshold adjustment rate
     * @param {number} [options.minPerformanceSamples=20] - Minimum samples for adjustment
     * @param {boolean} [options.enableDomainOptimization=true] - Enable domain-specific optimization
     */
    constructor(options = {}) {
        super();
        
        this.defaultHighThreshold = options.defaultHighThreshold || 0.75;
        this.defaultMediumThreshold = options.defaultMediumThreshold || 0.6;
        this.defaultLowThreshold = options.defaultLowThreshold || 0.4;
        this.adjustmentRate = options.adjustmentRate || 0.05;
        this.minPerformanceSamples = options.minPerformanceSamples || 20;
        this.enableDomainOptimization = options.enableDomainOptimization !== undefined 
            ? options.enableDomainOptimization 
            : true;
        
        // Domain-specific thresholds
        this.domainThresholds = new Map();
        
        // Fallback strategies
        this.fallbackStrategies = this.initializeFallbackStrategies();
        
        // Performance history for threshold adjustment
        this.performanceHistory = new Map();
        
        // Statistics
        this.stats = {
            totalSelections: 0,
            selectionsByLevel: {},
            thresholdAdjustments: 0,
            successByLevel: {},
            averageConfidence: 0,
            totalConfidence: 0,
            fallbacksUsed: 0
        };
        
        console.log('[ConfidenceThresholdManager] Initialized');
    }
    
    /**
     * Initialize default fallback strategies
     * @private
     * @returns {Map<string, FallbackStrategy>} Fallback strategies
     */
    initializeFallbackStrategies() {
        const strategies = new Map();
        
        strategies.set(ConfidenceLevel.VERY_HIGH, {
            level: ConfidenceLevel.VERY_HIGH,
            threshold: 0.9,
            action: 'execute',
            maxRetries: 1,
            timeout: 5000,
            riskTolerance: RiskLevel.MINIMAL
        });
        
        strategies.set(ConfidenceLevel.HIGH, {
            level: ConfidenceLevel.HIGH,
            threshold: 0.75,
            action: 'execute',
            maxRetries: 2,
            timeout: 8000,
            riskTolerance: RiskLevel.LOW
        });
        
        strategies.set(ConfidenceLevel.MEDIUM, {
            level: ConfidenceLevel.MEDIUM,
            threshold: 0.6,
            action: 'execute_with_caution',
            maxRetries: 3,
            timeout: 10000,
            riskTolerance: RiskLevel.MODERATE
        });
        
        strategies.set(ConfidenceLevel.LOW, {
            level: ConfidenceLevel.LOW,
            threshold: 0.4,
            action: 'fallback',
            maxRetries: 2,
            timeout: 5000,
            riskTolerance: RiskLevel.HIGH
        });
        
        strategies.set(ConfidenceLevel.VERY_LOW, {
            level: ConfidenceLevel.VERY_LOW,
            threshold: 0,
            action: 'reject',
            maxRetries: 0,
            timeout: 0,
            riskTolerance: RiskLevel.VERY_HIGH
        });
        
        return strategies;
    }
    
    /**
     * Get thresholds for a domain
     * @param {string} domain - Domain name
     * @returns {Object} Thresholds
     */
    getThresholds(domain) {
        if (!this.enableDomainOptimization || !this.domainThresholds.has(domain)) {
            return {
                high: this.defaultHighThreshold,
                medium: this.defaultMediumThreshold,
                low: this.defaultLowThreshold
            };
        }
        
        return this.domainThresholds.get(domain);
    }
    
    /**
     * Set thresholds for a domain
     * @param {string} domain - Domain name
     * @param {Object} thresholds - Threshold values
     */
    setThresholds(domain, thresholds) {
        this.domainThresholds.set(domain, {
            high: thresholds.high || this.defaultHighThreshold,
            medium: thresholds.medium || this.defaultMediumThreshold,
            low: thresholds.low || this.defaultLowThreshold
        });
        
        console.log(`[ConfidenceThresholdManager] Set thresholds for ${domain}`);
        this.emit('thresholds:set', { domain, thresholds });
    }
    
    /**
     * Classify confidence level
     * @param {number} confidence - Confidence value (0-1)
     * @param {string} [domain='default'] - Domain name
     * @returns {string} Confidence level
     */
    classifyConfidence(confidence, domain = 'default') {
        const thresholds = this.getThresholds(domain);
        
        if (confidence >= 0.9) return ConfidenceLevel.VERY_HIGH;
        if (confidence >= thresholds.high) return ConfidenceLevel.HIGH;
        if (confidence >= thresholds.medium) return ConfidenceLevel.MEDIUM;
        if (confidence >= thresholds.low) return ConfidenceLevel.LOW;
        return ConfidenceLevel.VERY_LOW;
    }
    
    /**
     * Select action from candidates based on confidence
     * @param {Array<Object>} candidates - Candidate actions
     * @param {string} [domain='default'] - Domain name
     * @param {Object} [options] - Selection options
     * @returns {Object} Selected action with metadata
     */
    selectAction(candidates, domain = 'default', options = {}) {
        if (!candidates || candidates.length === 0) {
            return {
                action: null,
                strategy: null,
                reason: 'no_candidates',
                confidence: 0
            };
        }
        
        // Sort by confidence
        const sorted = [...candidates].sort((a, b) => 
            (b.confidence || 0) - (a.confidence || 0)
        );
        
        const thresholds = this.getThresholds(domain);
        
        // Try to find action meeting high threshold first
        for (const candidate of sorted) {
            const confidence = candidate.confidence || 0;
            const level = this.classifyConfidence(confidence, domain);
            const strategy = this.fallbackStrategies.get(level);
            
            if (confidence >= thresholds.high) {
                // High confidence action found
                this.recordSelection(confidence, level, domain, true);
                
                return {
                    action: candidate,
                    strategy: strategy,
                    level: level,
                    confidence: confidence,
                    reason: 'high_confidence',
                    risk: this.assessRisk(confidence, candidate, domain)
                };
            }
        }
        
        // No high confidence action, try medium threshold
        for (const candidate of sorted) {
            const confidence = candidate.confidence || 0;
            const level = this.classifyConfidence(confidence, domain);
            
            if (confidence >= thresholds.medium) {
                const strategy = this.fallbackStrategies.get(level);
                this.recordSelection(confidence, level, domain, false);
                
                return {
                    action: candidate,
                    strategy: strategy,
                    level: level,
                    confidence: confidence,
                    reason: 'medium_confidence',
                    risk: this.assessRisk(confidence, candidate, domain),
                    alternatives: sorted.slice(0, 3)
                };
            }
        }
        
        // No medium confidence, use fallback strategy
        const bestCandidate = sorted[0];
        const confidence = bestCandidate.confidence || 0;
        const level = this.classifyConfidence(confidence, domain);
        const strategy = this.fallbackStrategies.get(level);
        
        this.recordSelection(confidence, level, domain, false);
        this.stats.fallbacksUsed++;
        
        if (confidence < thresholds.low) {
            // Very low confidence, recommend rejection or alternative
            return {
                action: bestCandidate,
                strategy: strategy,
                level: level,
                confidence: confidence,
                reason: 'low_confidence_fallback',
                risk: this.assessRisk(confidence, bestCandidate, domain),
                alternatives: sorted.slice(0, 5),
                recommendation: 'consider_alternatives'
            };
        }
        
        return {
            action: bestCandidate,
            strategy: strategy,
            level: level,
            confidence: confidence,
            reason: 'fallback',
            risk: this.assessRisk(confidence, bestCandidate, domain),
            alternatives: sorted.slice(0, 3)
        };
    }
    
    /**
     * Assess risk for an action
     * @param {number} confidence - Confidence level
     * @param {Object} action - Action object
     * @param {string} domain - Domain name
     * @returns {Object} Risk assessment
     */
    assessRisk(confidence, action, domain) {
        // Base risk from confidence
        let riskScore = 1 - confidence;
        
        // Adjust for action type
        const actionType = action.action || action.type || 'unknown';
        const dangerousActions = ['navigate', 'submit', 'delete'];
        if (dangerousActions.includes(actionType)) {
            riskScore += 0.2;
        }
        
        // Adjust for domain history
        if (this.performanceHistory.has(domain)) {
            const history = this.performanceHistory.get(domain);
            const recentFailures = history.slice(-10).filter(h => !h.success).length;
            riskScore += recentFailures * 0.05;
        }
        
        // Normalize to 0-1
        riskScore = Math.min(1, riskScore);
        
        // Classify risk level
        let riskLevel = RiskLevel.MODERATE;
        if (riskScore < 0.2) riskLevel = RiskLevel.MINIMAL;
        else if (riskScore < 0.4) riskLevel = RiskLevel.LOW;
        else if (riskScore < 0.6) riskLevel = RiskLevel.MODERATE;
        else if (riskScore < 0.8) riskLevel = RiskLevel.HIGH;
        else riskLevel = RiskLevel.VERY_HIGH;
        
        return {
            score: riskScore,
            level: riskLevel,
            factors: {
                confidence: confidence,
                actionType: actionType,
                domain: domain
            }
        };
    }
    
    /**
     * Record action selection
     * @private
     * @param {number} confidence - Confidence value
     * @param {string} level - Confidence level
     * @param {string} domain - Domain name
     * @param {boolean} isHighConfidence - Is high confidence selection
     */
    recordSelection(confidence, level, domain, isHighConfidence) {
        this.stats.totalSelections++;
        this.stats.selectionsByLevel[level] = (this.stats.selectionsByLevel[level] || 0) + 1;
        this.stats.totalConfidence += confidence;
        this.stats.averageConfidence = this.stats.totalConfidence / this.stats.totalSelections;
    }
    
    /**
     * Update thresholds based on performance
     * @param {string} domain - Domain name
     * @param {Object} performance - Performance data
     */
    updateThresholds(domain, performance) {
        if (!this.enableDomainOptimization) return;
        
        // Store performance
        if (!this.performanceHistory.has(domain)) {
            this.performanceHistory.set(domain, []);
        }
        
        const history = this.performanceHistory.get(domain);
        history.push({
            timestamp: Date.now(),
            confidence: performance.confidence || 0,
            success: performance.success || false,
            level: performance.level || 'unknown'
        });
        
        // Trim history
        if (history.length > 100) {
            history.shift();
        }
        
        // Only adjust after sufficient data
        if (history.length < this.minPerformanceSamples) {
            return;
        }
        
        const thresholds = this.getThresholds(domain);
        const recentHistory = history.slice(-this.minPerformanceSamples);
        
        // Calculate success rates at different confidence levels
        const highConfidenceActions = recentHistory.filter(h => 
            h.confidence >= thresholds.high
        );
        const mediumConfidenceActions = recentHistory.filter(h => 
            h.confidence >= thresholds.medium && h.confidence < thresholds.high
        );
        
        const highSuccessRate = highConfidenceActions.length > 0
            ? highConfidenceActions.filter(h => h.success).length / highConfidenceActions.length
            : 0;
        
        const mediumSuccessRate = mediumConfidenceActions.length > 0
            ? mediumConfidenceActions.filter(h => h.success).length / mediumConfidenceActions.length
            : 0;
        
        let adjusted = false;
        
        // Adjust high threshold
        if (highSuccessRate < 0.8 && highConfidenceActions.length >= 10) {
            // Too many failures at high confidence, increase threshold
            thresholds.high = Math.min(0.95, thresholds.high + this.adjustmentRate);
            adjusted = true;
        } else if (highSuccessRate > 0.95 && highConfidenceActions.length >= 10) {
            // Very high success rate, can lower threshold slightly
            thresholds.high = Math.max(0.7, thresholds.high - this.adjustmentRate / 2);
            adjusted = true;
        }
        
        // Adjust medium threshold
        if (mediumSuccessRate < 0.7 && mediumConfidenceActions.length >= 10) {
            // Too many failures at medium confidence, increase threshold
            thresholds.medium = Math.min(thresholds.high - 0.05, thresholds.medium + this.adjustmentRate);
            adjusted = true;
        } else if (mediumSuccessRate > 0.9 && mediumConfidenceActions.length >= 10) {
            // Very high success rate, can lower threshold slightly
            thresholds.medium = Math.max(0.5, thresholds.medium - this.adjustmentRate / 2);
            adjusted = true;
        }
        
        if (adjusted) {
            this.setThresholds(domain, thresholds);
            this.stats.thresholdAdjustments++;
            
            console.log(`[ConfidenceThresholdManager] Adjusted thresholds for ${domain}:`, thresholds);
            this.emit('thresholds:adjusted', { domain, thresholds, performance });
        }
    }
    
    /**
     * Record outcome for threshold learning
     * @param {string} domain - Domain name
     * @param {number} confidence - Confidence value
     * @param {boolean} success - Whether action succeeded
     * @param {string} level - Confidence level
     */
    recordOutcome(domain, confidence, success, level) {
        this.updateThresholds(domain, { confidence, success, level });
        
        // Update success statistics by level
        if (!this.stats.successByLevel[level]) {
            this.stats.successByLevel[level] = { total: 0, successes: 0 };
        }
        
        this.stats.successByLevel[level].total++;
        if (success) {
            this.stats.successByLevel[level].successes++;
        }
    }
    
    /**
     * Get fallback chain for confidence level
     * @param {string} level - Confidence level
     * @returns {Array<FallbackStrategy>} Fallback chain
     */
    getFallbackChain(level) {
        const chain = [];
        const levels = [
            ConfidenceLevel.VERY_HIGH,
            ConfidenceLevel.HIGH,
            ConfidenceLevel.MEDIUM,
            ConfidenceLevel.LOW,
            ConfidenceLevel.VERY_LOW
        ];
        
        const startIndex = levels.indexOf(level);
        if (startIndex === -1) return chain;
        
        for (let i = startIndex; i < levels.length; i++) {
            const strategy = this.fallbackStrategies.get(levels[i]);
            if (strategy) {
                chain.push(strategy);
            }
        }
        
        return chain;
    }
    
    /**
     * Get success rates by confidence level
     * @returns {Object} Success rates
     */
    getSuccessRates() {
        const rates = {};
        
        for (const [level, stats] of Object.entries(this.stats.successByLevel)) {
            rates[level] = stats.total > 0
                ? (stats.successes / stats.total * 100).toFixed(1) + '%'
                : '0%';
        }
        
        return rates;
    }
    
    /**
     * Get domain performance summary
     * @param {string} domain - Domain name
     * @returns {Object} Performance summary
     */
    getDomainPerformance(domain) {
        const history = this.performanceHistory.get(domain) || [];
        
        if (history.length === 0) {
            return {
                domain: domain,
                sampleSize: 0,
                successRate: 0,
                thresholds: this.getThresholds(domain)
            };
        }
        
        const successRate = history.filter(h => h.success).length / history.length;
        const avgConfidence = history.reduce((sum, h) => sum + h.confidence, 0) / history.length;
        
        return {
            domain: domain,
            sampleSize: history.length,
            successRate: (successRate * 100).toFixed(1) + '%',
            averageConfidence: avgConfidence.toFixed(3),
            thresholds: this.getThresholds(domain)
        };
    }
    
    /**
     * Get confidence threshold manager statistics
     * @returns {Object} Statistics
     */
    getStats() {
        return {
            ...this.stats,
            averageConfidence: this.stats.averageConfidence.toFixed(3),
            domainsTracked: this.domainThresholds.size,
            successRates: this.getSuccessRates()
        };
    }
    
    /**
     * Clear performance history
     * @param {string} [domain] - Specific domain to clear
     */
    clearHistory(domain = null) {
        if (domain) {
            this.performanceHistory.delete(domain);
            console.log(`[ConfidenceThresholdManager] Cleared history for ${domain}`);
        } else {
            this.performanceHistory.clear();
            console.log('[ConfidenceThresholdManager] Cleared all performance history');
        }
        
        this.emit('history:cleared', { domain });
    }
    
    /**
     * Reset confidence threshold manager
     */
    reset() {
        console.log('[ConfidenceThresholdManager] Resetting manager');
        
        this.domainThresholds.clear();
        this.performanceHistory.clear();
        this.fallbackStrategies = this.initializeFallbackStrategies();
        
        this.stats = {
            totalSelections: 0,
            selectionsByLevel: {},
            thresholdAdjustments: 0,
            successByLevel: {},
            averageConfidence: 0,
            totalConfidence: 0,
            fallbacksUsed: 0
        };
        
        this.emit('manager:reset');
    }
}

module.exports = { 
    ConfidenceThresholdManager, 
    ConfidenceLevel, 
    RiskLevel 
};
