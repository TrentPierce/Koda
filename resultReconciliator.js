/**
 * ============================================================================
 * RESULT RECONCILIATION SYSTEM - Multi-Source Analysis Integration
 * ============================================================================
 * 
 * Combines and reconciles results from multiple parallel analysis sources
 * (DOM analysis, vision analysis, pattern matching, etc.) into a single
 * coherent action plan with confidence scoring.
 * 
 * FEATURES:
 * - Multi-source result merging
 * - Confidence-based scoring and weighting
 * - Conflict resolution strategies
 * - Consensus building algorithms
 * - Result validation and sanity checking
 * - Detailed reconciliation reporting
 * 
 * USAGE:
 * const reconciliator = new ResultReconciliator();
 * const result = await reconciliator.reconcile([
 *   { source: 'dom', action: 'click', confidence: 0.8, ... },
 *   { source: 'vision', action: 'click', confidence: 0.9, ... }
 * ]);
 * 
 * ============================================================================
 */

/**
 * Analysis source types
 * @enum {string}
 */
const AnalysisSource = {
    DOM: 'dom',
    VISION: 'vision',
    PATTERN: 'pattern',
    LEARNING: 'learning',
    HEURISTIC: 'heuristic'
};

/**
 * Conflict resolution strategies
 * @enum {string}
 */
const ConflictStrategy = {
    HIGHEST_CONFIDENCE: 'highest_confidence',
    WEIGHTED_AVERAGE: 'weighted_average',
    CONSENSUS: 'consensus',
    SOURCE_PRIORITY: 'source_priority'
};

/**
 * Source priority weights (higher = more trusted)
 * @private
 */
const SOURCE_WEIGHTS = {
    [AnalysisSource.DOM]: 1.0,
    [AnalysisSource.VISION]: 0.9,
    [AnalysisSource.PATTERN]: 0.8,
    [AnalysisSource.LEARNING]: 0.7,
    [AnalysisSource.HEURISTIC]: 0.6
};

/**
 * Result Reconciliation System
 * @class
 */
class ResultReconciliator {
    /**
     * Create a new ResultReconciliator instance
     * @param {Object} options - Configuration options
     * @param {string} [options.conflictStrategy='highest_confidence'] - Strategy for resolving conflicts
     * @param {number} [options.minConfidence=0.3] - Minimum confidence threshold
     * @param {number} [options.consensusThreshold=0.7] - Threshold for consensus agreement
     * @param {Object} [options.sourceWeights] - Custom source weights
     */
    constructor(options = {}) {
        this.conflictStrategy = options.conflictStrategy || ConflictStrategy.HIGHEST_CONFIDENCE;
        this.minConfidence = options.minConfidence !== undefined ? options.minConfidence : 0.3;
        this.consensusThreshold = options.consensusThreshold || 0.7;
        this.sourceWeights = options.sourceWeights || SOURCE_WEIGHTS;
        
        this.reconciliationHistory = [];
        
        console.log('[ResultReconciliator] Initialized with strategy:', this.conflictStrategy);
    }
    
    /**
     * Reconcile multiple analysis results into a single action plan
     * @param {Array<Object>} results - Array of analysis results
     * @param {Object} options - Reconciliation options
     * @param {string} [options.strategy] - Override default conflict strategy
     * @param {Object} [options.context] - Additional context for reconciliation
     * @returns {Object} Reconciled result with confidence score
     */
    async reconcile(results, options = {}) {
        if (!results || results.length === 0) {
            throw new Error('No results provided for reconciliation');
        }
        
        const strategy = options.strategy || this.conflictStrategy;
        const context = options.context || {};
        
        console.log(`[ResultReconciliator] Reconciling ${results.length} results using ${strategy} strategy`);
        
        // Validate and normalize results
        const normalizedResults = this.normalizeResults(results);
        
        // Filter results below minimum confidence
        const validResults = normalizedResults.filter(r => r.confidence >= this.minConfidence);
        
        if (validResults.length === 0) {
            console.warn('[ResultReconciliator] No results meet minimum confidence threshold');
            return this.createLowConfidenceResult(normalizedResults);
        }
        
        // Apply reconciliation strategy
        let reconciledResult;
        
        switch (strategy) {
            case ConflictStrategy.HIGHEST_CONFIDENCE:
                reconciledResult = this.reconcileByHighestConfidence(validResults);
                break;
                
            case ConflictStrategy.WEIGHTED_AVERAGE:
                reconciledResult = this.reconcileByWeightedAverage(validResults);
                break;
                
            case ConflictStrategy.CONSENSUS:
                reconciledResult = this.reconcileByConsensus(validResults);
                break;
                
            case ConflictStrategy.SOURCE_PRIORITY:
                reconciledResult = this.reconcileBySourcePriority(validResults);
                break;
                
            default:
                throw new Error(`Unknown conflict strategy: ${strategy}`);
        }
        
        // Add metadata
        reconciledResult.reconciliationMetadata = {
            strategy: strategy,
            inputCount: results.length,
            validCount: validResults.length,
            timestamp: Date.now(),
            context: context
        };
        
        // Validate reconciled result
        reconciledResult = this.validateResult(reconciledResult);
        
        // Store in history
        this.reconciliationHistory.push({
            timestamp: Date.now(),
            inputs: results,
            output: reconciledResult,
            strategy: strategy
        });
        
        // Limit history size
        if (this.reconciliationHistory.length > 100) {
            this.reconciliationHistory.shift();
        }
        
        console.log(`[ResultReconciliator] Reconciled to action: ${reconciledResult.action} with confidence ${reconciledResult.confidence.toFixed(3)}`);
        
        return reconciledResult;
    }
    
    /**
     * Normalize results to standard format
     * @private
     * @param {Array<Object>} results - Raw results
     * @returns {Array<Object>} Normalized results
     */
    normalizeResults(results) {
        return results.map(result => {
            // Ensure required fields
            if (!result.action) {
                throw new Error('Result missing required field: action');
            }
            
            // Normalize confidence to 0-1 range
            let confidence = result.confidence !== undefined ? result.confidence : 0.5;
            if (confidence > 1) confidence = confidence / 100;
            confidence = Math.max(0, Math.min(1, confidence));
            
            // Apply source weight
            const source = result.source || AnalysisSource.HEURISTIC;
            const sourceWeight = this.sourceWeights[source] || 1.0;
            const weightedConfidence = confidence * sourceWeight;
            
            return {
                action: result.action,
                source: source,
                confidence: confidence,
                weightedConfidence: weightedConfidence,
                selector: result.selector || null,
                text: result.text || null,
                url: result.url || null,
                question: result.question || null,
                reason: result.reason || '',
                metadata: result.metadata || {},
                rawConfidence: confidence
            };
        });
    }
    
    /**
     * Reconcile by selecting highest confidence result
     * @private
     * @param {Array<Object>} results - Normalized results
     * @returns {Object} Reconciled result
     */
    reconcileByHighestConfidence(results) {
        // Sort by weighted confidence
        const sorted = [...results].sort((a, b) => b.weightedConfidence - a.weightedConfidence);
        const best = sorted[0];
        
        // Check for ties
        const ties = sorted.filter(r => 
            Math.abs(r.weightedConfidence - best.weightedConfidence) < 0.01 &&
            r.action === best.action
        );
        
        return {
            action: best.action,
            selector: best.selector,
            text: best.text,
            url: best.url,
            question: best.question,
            reason: best.reason,
            confidence: best.weightedConfidence,
            sources: ties.map(r => r.source),
            alternatives: sorted.slice(1, 3).map(r => ({
                action: r.action,
                confidence: r.weightedConfidence,
                source: r.source
            }))
        };
    }
    
    /**
     * Reconcile by weighted average of similar actions
     * @private
     * @param {Array<Object>} results - Normalized results
     * @returns {Object} Reconciled result
     */
    reconcileByWeightedAverage(results) {
        // Group by action type
        const actionGroups = {};
        
        for (const result of results) {
            if (!actionGroups[result.action]) {
                actionGroups[result.action] = [];
            }
            actionGroups[result.action].push(result);
        }
        
        // Calculate weighted scores for each action
        const actionScores = {};
        
        for (const [action, group] of Object.entries(actionGroups)) {
            const totalWeight = group.reduce((sum, r) => sum + r.weightedConfidence, 0);
            const avgConfidence = totalWeight / group.length;
            const consensusBonus = group.length > 1 ? 0.1 * (group.length - 1) : 0;
            
            actionScores[action] = {
                score: avgConfidence + consensusBonus,
                confidence: avgConfidence,
                count: group.length,
                results: group
            };
        }
        
        // Select best action
        const bestAction = Object.keys(actionScores).reduce((best, action) => {
            return actionScores[action].score > actionScores[best].score ? action : best;
        });
        
        const bestGroup = actionScores[bestAction];
        const primaryResult = bestGroup.results[0];
        
        // Merge selectors and data from group
        const mergedSelector = this.mergeSelectors(bestGroup.results);
        const mergedText = this.mergeText(bestGroup.results);
        
        return {
            action: bestAction,
            selector: mergedSelector,
            text: mergedText,
            url: primaryResult.url,
            question: primaryResult.question,
            reason: this.mergeReasons(bestGroup.results),
            confidence: Math.min(1.0, bestGroup.confidence),
            sources: bestGroup.results.map(r => r.source),
            consensusCount: bestGroup.count,
            alternatives: Object.entries(actionScores)
                .filter(([action]) => action !== bestAction)
                .map(([action, data]) => ({
                    action: action,
                    confidence: data.confidence,
                    count: data.count
                }))
        };
    }
    
    /**
     * Reconcile by consensus (requires agreement threshold)
     * @private
     * @param {Array<Object>} results - Normalized results
     * @returns {Object} Reconciled result
     */
    reconcileByConsensus(results) {
        // Group by action
        const actionGroups = {};
        
        for (const result of results) {
            if (!actionGroups[result.action]) {
                actionGroups[result.action] = [];
            }
            actionGroups[result.action].push(result);
        }
        
        // Calculate consensus score
        const totalResults = results.length;
        const consensusScores = {};
        
        for (const [action, group] of Object.entries(actionGroups)) {
            const agreementRatio = group.length / totalResults;
            const avgConfidence = group.reduce((sum, r) => sum + r.weightedConfidence, 0) / group.length;
            
            consensusScores[action] = {
                score: agreementRatio * avgConfidence,
                agreementRatio: agreementRatio,
                confidence: avgConfidence,
                group: group
            };
        }
        
        // Find best consensus
        const bestAction = Object.keys(consensusScores).reduce((best, action) => {
            return consensusScores[action].score > consensusScores[best].score ? action : best;
        });
        
        const consensus = consensusScores[bestAction];
        
        // Check if consensus meets threshold
        if (consensus.agreementRatio < this.consensusThreshold) {
            console.warn(`[ResultReconciliator] Weak consensus: ${(consensus.agreementRatio * 100).toFixed(0)}% agreement (threshold: ${(this.consensusThreshold * 100).toFixed(0)}%)`);
        }
        
        const primaryResult = consensus.group[0];
        
        return {
            action: bestAction,
            selector: this.mergeSelectors(consensus.group),
            text: this.mergeText(consensus.group),
            url: primaryResult.url,
            question: primaryResult.question,
            reason: this.mergeReasons(consensus.group),
            confidence: consensus.confidence,
            consensusStrength: consensus.agreementRatio,
            sources: consensus.group.map(r => r.source),
            alternatives: Object.entries(consensusScores)
                .filter(([action]) => action !== bestAction)
                .map(([action, data]) => ({
                    action: action,
                    confidence: data.confidence,
                    agreement: data.agreementRatio
                }))
        };
    }
    
    /**
     * Reconcile by source priority
     * @private
     * @param {Array<Object>} results - Normalized results
     * @returns {Object} Reconciled result
     */
    reconcileBySourcePriority(results) {
        // Sort by source weight then confidence
        const sorted = [...results].sort((a, b) => {
            const weightDiff = (this.sourceWeights[b.source] || 0) - (this.sourceWeights[a.source] || 0);
            if (Math.abs(weightDiff) > 0.01) return weightDiff;
            return b.confidence - a.confidence;
        });
        
        const best = sorted[0];
        
        return {
            action: best.action,
            selector: best.selector,
            text: best.text,
            url: best.url,
            question: best.question,
            reason: best.reason,
            confidence: best.weightedConfidence,
            primarySource: best.source,
            sources: [best.source],
            alternatives: sorted.slice(1, 3).map(r => ({
                action: r.action,
                confidence: r.weightedConfidence,
                source: r.source
            }))
        };
    }
    
    /**
     * Merge selectors from multiple results
     * @private
     * @param {Array<Object>} results - Results with selectors
     * @returns {string|null} Merged selector
     */
    mergeSelectors(results) {
        const selectors = results
            .map(r => r.selector)
            .filter(s => s !== null && s !== undefined);
        
        if (selectors.length === 0) return null;
        
        // Use most common selector
        const selectorCounts = {};
        for (const selector of selectors) {
            selectorCounts[selector] = (selectorCounts[selector] || 0) + 1;
        }
        
        return Object.keys(selectorCounts).reduce((best, selector) => {
            return selectorCounts[selector] > selectorCounts[best] ? selector : best;
        });
    }
    
    /**
     * Merge text from multiple results
     * @private
     * @param {Array<Object>} results - Results with text
     * @returns {string|null} Merged text
     */
    mergeText(results) {
        const texts = results
            .map(r => r.text)
            .filter(t => t !== null && t !== undefined && t.trim().length > 0);
        
        if (texts.length === 0) return null;
        
        // Use longest text (usually most complete)
        return texts.reduce((longest, text) => {
            return text.length > longest.length ? text : longest;
        });
    }
    
    /**
     * Merge reasons from multiple results
     * @private
     * @param {Array<Object>} results - Results with reasons
     * @returns {string} Merged reason
     */
    mergeReasons(results) {
        const reasons = results
            .map(r => r.reason)
            .filter(r => r && r.trim().length > 0);
        
        if (reasons.length === 0) return 'Reconciled from multiple analyses';
        
        // If all reasons are similar, use the first
        if (reasons.length === 1) return reasons[0];
        
        // Otherwise, create a combined reason
        const uniqueReasons = [...new Set(reasons)];
        if (uniqueReasons.length === 1) return uniqueReasons[0];
        
        return `Multiple analyses suggest: ${uniqueReasons.slice(0, 2).join('; ')}`;
    }
    
    /**
     * Create a low confidence result when no valid results exist
     * @private
     * @param {Array<Object>} results - Original results
     * @returns {Object} Low confidence fallback result
     */
    createLowConfidenceResult(results) {
        console.warn('[ResultReconciliator] Creating low confidence fallback result');
        
        // Try to find the best of the low confidence results
        const sorted = [...results].sort((a, b) => b.confidence - a.confidence);
        const best = sorted[0];
        
        return {
            action: best?.action || 'wait',
            selector: best?.selector || null,
            text: best?.text || null,
            url: best?.url || null,
            question: best?.question || null,
            reason: 'Low confidence - all analyses below threshold',
            confidence: best?.confidence || 0,
            sources: results.map(r => r.source),
            lowConfidence: true,
            alternatives: sorted.slice(1, 3).map(r => ({
                action: r.action,
                confidence: r.confidence,
                source: r.source
            }))
        };
    }
    
    /**
     * Validate reconciled result
     * @private
     * @param {Object} result - Reconciled result
     * @returns {Object} Validated result
     */
    validateResult(result) {
        // Ensure required fields
        if (!result.action) {
            throw new Error('Reconciled result missing action');
        }
        
        // Validate action-specific requirements
        if (result.action === 'click' && !result.selector) {
            console.warn('[ResultReconciliator] Click action missing selector');
            result.action = 'wait';
            result.reason = 'Invalid click action - missing selector';
        }
        
        if (result.action === 'type' && (!result.selector || !result.text)) {
            console.warn('[ResultReconciliator] Type action missing selector or text');
            result.action = 'wait';
            result.reason = 'Invalid type action - missing required fields';
        }
        
        if (result.action === 'navigate' && !result.url) {
            console.warn('[ResultReconciliator] Navigate action missing URL');
            result.action = 'wait';
            result.reason = 'Invalid navigate action - missing URL';
        }
        
        // Ensure confidence is in valid range
        result.confidence = Math.max(0, Math.min(1, result.confidence || 0));
        
        return result;
    }
    
    /**
     * Calculate agreement between two results
     * @param {Object} result1 - First result
     * @param {Object} result2 - Second result
     * @returns {number} Agreement score (0-1)
     */
    calculateAgreement(result1, result2) {
        let score = 0;
        
        // Action match
        if (result1.action === result2.action) {
            score += 0.5;
            
            // Selector match
            if (result1.selector && result2.selector && result1.selector === result2.selector) {
                score += 0.3;
            }
            
            // Text match
            if (result1.text && result2.text && result1.text === result2.text) {
                score += 0.1;
            }
            
            // URL match
            if (result1.url && result2.url && result1.url === result2.url) {
                score += 0.1;
            }
        }
        
        return score;
    }
    
    /**
     * Get reconciliation statistics
     * @returns {Object} Statistics
     */
    getStats() {
        if (this.reconciliationHistory.length === 0) {
            return {
                totalReconciliations: 0,
                averageInputCount: 0,
                averageConfidence: 0,
                strategyUsage: {}
            };
        }
        
        const totalReconciliations = this.reconciliationHistory.length;
        const averageInputCount = this.reconciliationHistory.reduce((sum, r) => sum + r.inputs.length, 0) / totalReconciliations;
        const averageConfidence = this.reconciliationHistory.reduce((sum, r) => sum + r.output.confidence, 0) / totalReconciliations;
        
        const strategyUsage = {};
        for (const record of this.reconciliationHistory) {
            strategyUsage[record.strategy] = (strategyUsage[record.strategy] || 0) + 1;
        }
        
        return {
            totalReconciliations,
            averageInputCount: averageInputCount.toFixed(2),
            averageConfidence: averageConfidence.toFixed(3),
            strategyUsage,
            historySize: this.reconciliationHistory.length
        };
    }
    
    /**
     * Get recent reconciliation history
     * @param {number} [limit=10] - Number of records to return
     * @returns {Array<Object>} Recent reconciliation records
     */
    getHistory(limit = 10) {
        return this.reconciliationHistory.slice(-limit);
    }
    
    /**
     * Clear reconciliation history
     */
    clearHistory() {
        const count = this.reconciliationHistory.length;
        this.reconciliationHistory = [];
        console.log(`[ResultReconciliator] Cleared ${count} history records`);
    }
}

module.exports = { 
    ResultReconciliator, 
    AnalysisSource, 
    ConflictStrategy 
};
