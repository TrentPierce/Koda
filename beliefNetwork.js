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
const crypto = require('crypto');

/**
 * Evidence strength levels
 * @enum {string}
 */
const EvidenceStrength = {
    VERY_STRONG: 'very_strong',    // 0.9-1.0
    STRONG: 'strong',               // 0.7-0.9
    MODERATE: 'moderate',           // 0.5-0.7
    WEAK: 'weak',                   // 0.3-0.5
    VERY_WEAK: 'very_weak'          // 0.0-0.3
};

/**
 * Action types
 * @enum {string}
 */
const ActionType = {
    CLICK: 'click',
    TYPE: 'type',
    SCROLL: 'scroll',
    NAVIGATE: 'navigate',
    WAIT: 'wait',
    COMPLETE: 'complete'
};

/**
 * Evidence source types
 * @enum {string}
 */
const EvidenceSource = {
    DOM: 'dom',
    VISION: 'vision',
    PATTERN: 'pattern',
    HEURISTIC: 'heuristic',
    LEARNING: 'learning',
    TEMPORAL: 'temporal'
};

/**
 * Bayesian Belief Network for probabilistic reasoning
 * @class
 * @extends EventEmitter
 */
class BayesianBeliefNetwork extends EventEmitter {
    /**
     * Create a new BayesianBeliefNetwork instance
     * @param {Object} options - Configuration options
     * @param {number} [options.defaultPrior=0.16] - Default prior probability for actions
     * @param {number} [options.evidenceDecay=0.95] - Decay factor for older evidence
     * @param {number} [options.minConfidence=0.3] - Minimum confidence threshold
     * @param {boolean} [options.useConditionalDependencies=true] - Enable conditional dependencies
     */
    constructor(options = {}) {
        super();
        
        this.defaultPrior = options.defaultPrior || 0.16; // 1/6 actions
        this.evidenceDecay = options.evidenceDecay || 0.95;
        this.minConfidence = options.minConfidence || 0.3;
        this.useConditionalDependencies = options.useConditionalDependencies !== undefined 
            ? options.useConditionalDependencies 
            : true;
        
        // Prior probabilities for each action type
        this.priors = new Map();
        this.initializeDefaultPriors();
        
        // Evidence for each action from different sources
        this.evidence = new Map();
        
        // Source reliability weights
        this.sourceWeights = new Map();
        this.initializeDefaultWeights();
        
        // Conditional dependencies between sources
        this.dependencies = new Map();
        this.initializeDefaultDependencies();
        
        // Computed beliefs (posterior probabilities)
        this.beliefs = new Map();
        
        // Statistics
        this.stats = {
            totalEvidenceAdded: 0,
            totalBeliefComputations: 0,
            averageConfidence: 0,
            totalConfidence: 0,
            evidenceBySource: {},
            beliefHistory: []
        };
        
        console.log('[BayesianBeliefNetwork] Initialized');
    }
    
    /**
     * Initialize default prior probabilities
     * @private
     */
    initializeDefaultPriors() {
        // Equal priors for all actions initially
        const actions = Object.values(ActionType);
        const uniformPrior = 1.0 / actions.length;
        
        for (const action of actions) {
            this.priors.set(action, uniformPrior);
        }
    }
    
    /**
     * Initialize default source weights
     * @private
     */
    initializeDefaultWeights() {
        this.sourceWeights.set(EvidenceSource.DOM, 1.0);
        this.sourceWeights.set(EvidenceSource.VISION, 0.9);
        this.sourceWeights.set(EvidenceSource.PATTERN, 0.85);
        this.sourceWeights.set(EvidenceSource.HEURISTIC, 0.8);
        this.sourceWeights.set(EvidenceSource.LEARNING, 0.75);
        this.sourceWeights.set(EvidenceSource.TEMPORAL, 0.85);
    }
    
    /**
     * Initialize default conditional dependencies
     * @private
     */
    initializeDefaultDependencies() {
        // DOM and Vision are positively correlated
        this.setDependency(EvidenceSource.DOM, EvidenceSource.VISION, 0.7);
        
        // Pattern and Learning are correlated
        this.setDependency(EvidenceSource.PATTERN, EvidenceSource.LEARNING, 0.6);
        
        // Temporal and Heuristic have moderate correlation
        this.setDependency(EvidenceSource.TEMPORAL, EvidenceSource.HEURISTIC, 0.5);
    }
    
    /**
     * Set prior probability for an action
     * @param {string} action - Action type
     * @param {number} probability - Prior probability (0-1)
     */
    setActionPrior(action, probability) {
        if (probability < 0 || probability > 1) {
            throw new Error('Prior probability must be between 0 and 1');
        }
        
        this.priors.set(action, probability);
        console.log(`[BayesianBeliefNetwork] Set prior for ${action}: ${probability.toFixed(3)}`);
        
        // Normalize priors to sum to 1
        this.normalizePriors();
    }
    
    /**
     * Normalize prior probabilities
     * @private
     */
    normalizePriors() {
        const total = Array.from(this.priors.values()).reduce((sum, p) => sum + p, 0);
        
        if (total > 0) {
            for (const [action, prior] of this.priors.entries()) {
                this.priors.set(action, prior / total);
            }
        }
    }
    
    /**
     * Set source reliability weight
     * @param {string} source - Evidence source
     * @param {number} weight - Reliability weight (0-1)
     */
    setSourceWeight(source, weight) {
        if (weight < 0 || weight > 1) {
            throw new Error('Source weight must be between 0 and 1');
        }
        
        this.sourceWeights.set(source, weight);
        console.log(`[BayesianBeliefNetwork] Set weight for ${source}: ${weight.toFixed(3)}`);
    }
    
    /**
     * Set conditional dependency between sources
     * @param {string} source1 - First evidence source
     * @param {string} source2 - Second evidence source
     * @param {number} correlation - Correlation coefficient (-1 to 1)
     */
    setDependency(source1, source2, correlation) {
        if (correlation < -1 || correlation > 1) {
            throw new Error('Correlation must be between -1 and 1');
        }
        
        const key = this.getDependencyKey(source1, source2);
        this.dependencies.set(key, correlation);
    }
    
    /**
     * Get dependency key
     * @private
     * @param {string} source1 - First source
     * @param {string} source2 - Second source
     * @returns {string} Dependency key
     */
    getDependencyKey(source1, source2) {
        return [source1, source2].sort().join('|');
    }
    
    /**
     * Get dependency between sources
     * @param {string} source1 - First source
     * @param {string} source2 - Second source
     * @returns {number} Correlation coefficient
     */
    getDependency(source1, source2) {
        const key = this.getDependencyKey(source1, source2);
        return this.dependencies.get(key) || 0;
    }
    
    /**
     * Add evidence for an action from a source
     * @param {string} source - Evidence source
     * @param {string} action - Action type
     * @param {number} likelihood - Likelihood of action given evidence (0-1)
     * @param {number} confidence - Confidence in the evidence (0-1)
     * @param {Object} [metadata] - Additional metadata
     * @returns {string} Evidence ID
     */
    addEvidence(source, action, likelihood, confidence, metadata = {}) {
        if (likelihood < 0 || likelihood > 1) {
            throw new Error('Likelihood must be between 0 and 1');
        }
        
        if (confidence < 0 || confidence > 1) {
            throw new Error('Confidence must be between 0 and 1');
        }
        
        const evidenceId = crypto.randomUUID();
        
        const evidence = {
            id: evidenceId,
            source: source,
            action: action,
            likelihood: likelihood,
            confidence: confidence,
            weight: this.sourceWeights.get(source) || 1.0,
            timestamp: Date.now(),
            metadata: metadata
        };
        
        // Store evidence by action
        if (!this.evidence.has(action)) {
            this.evidence.set(action, []);
        }
        this.evidence.get(action).push(evidence);
        
        // Update statistics
        this.stats.totalEvidenceAdded++;
        this.stats.evidenceBySource[source] = (this.stats.evidenceBySource[source] || 0) + 1;
        
        console.log(`[BayesianBeliefNetwork] Added evidence ${evidenceId}: ${source} -> ${action} (L:${likelihood.toFixed(2)}, C:${confidence.toFixed(2)})`);
        this.emit('evidence:added', { evidenceId, evidence });
        
        return evidenceId;
    }
    
    /**
     * Compute beliefs (posterior probabilities) for all actions
     * @returns {Map<string, Object>} Beliefs for each action
     */
    computeBeliefs() {
        console.log('[BayesianBeliefNetwork] Computing beliefs');
        
        this.beliefs.clear();
        
        // Get all actions with evidence
        const actions = new Set([...this.priors.keys(), ...this.evidence.keys()]);
        
        // Compute unnormalized posterior for each action
        const unnormalizedBeliefs = new Map();
        let totalBelief = 0;
        
        for (const action of actions) {
            const prior = this.priors.get(action) || this.defaultPrior;
            const evidenceList = this.evidence.get(action) || [];
            
            // Compute likelihood from all evidence
            const likelihood = this.computeLikelihood(action, evidenceList);
            
            // Compute posterior: P(action|evidence) ∝ P(evidence|action) * P(action)
            const unnormalized = likelihood * prior;
            unnormalizedBeliefs.set(action, unnormalized);
            totalBelief += unnormalized;
        }
        
        // Normalize to get probabilities
        for (const [action, unnormalized] of unnormalizedBeliefs.entries()) {
            const probability = totalBelief > 0 ? unnormalized / totalBelief : 0;
            
            // Calculate confidence interval
            const evidenceList = this.evidence.get(action) || [];
            const confidenceInterval = this.calculateConfidenceInterval(evidenceList, probability);
            
            // Calculate uncertainty
            const uncertainty = this.calculateUncertainty(evidenceList, probability);
            
            // Classify evidence strength
            const strength = this.classifyEvidenceStrength(evidenceList);
            
            this.beliefs.set(action, {
                action: action,
                probability: probability,
                prior: this.priors.get(action) || this.defaultPrior,
                evidenceCount: evidenceList.length,
                confidenceInterval: confidenceInterval,
                uncertainty: uncertainty,
                strength: strength
            });
        }
        
        // Update statistics
        this.stats.totalBeliefComputations++;
        
        // Calculate average confidence
        const beliefs = Array.from(this.beliefs.values());
        if (beliefs.length > 0) {
            const maxBelief = beliefs.reduce((max, b) => b.probability > max.probability ? b : max);
            this.stats.totalConfidence += maxBelief.probability;
            this.stats.averageConfidence = this.stats.totalConfidence / this.stats.totalBeliefComputations;
            
            // Store in history
            this.stats.beliefHistory.push({
                timestamp: Date.now(),
                beliefs: Array.from(this.beliefs.entries()).map(([action, belief]) => ({
                    action: action,
                    probability: belief.probability
                }))
            });
            
            // Limit history size
            if (this.stats.beliefHistory.length > 100) {
                this.stats.beliefHistory.shift();
            }
        }
        
        console.log(`[BayesianBeliefNetwork] Computed beliefs for ${this.beliefs.size} actions`);
        this.emit('beliefs:computed', { beliefs: this.beliefs });
        
        return this.beliefs;
    }
    
    /**
     * Compute likelihood from evidence list
     * @private
     * @param {string} action - Action type
     * @param {Array<Object>} evidenceList - List of evidence
     * @returns {number} Combined likelihood
     */
    computeLikelihood(action, evidenceList) {
        if (evidenceList.length === 0) {
            return 1.0; // No evidence, neutral likelihood
        }
        
        // Apply decay to older evidence
        const now = Date.now();
        const weightedEvidence = evidenceList.map(e => {
            const age = now - e.timestamp;
            const decay = Math.pow(this.evidenceDecay, age / 1000); // Decay per second
            return {
                ...e,
                effectiveLikelihood: e.likelihood,
                effectiveConfidence: e.confidence * e.weight * decay
            };
        });
        
        // Combine evidence using belief propagation
        if (this.useConditionalDependencies) {
            return this.computeLikelihoodWithDependencies(weightedEvidence);
        } else {
            return this.computeLikelihoodIndependent(weightedEvidence);
        }
    }
    
    /**
     * Compute likelihood assuming independent evidence
     * @private
     * @param {Array<Object>} evidenceList - Weighted evidence
     * @returns {number} Combined likelihood
     */
    computeLikelihoodIndependent(evidenceList) {
        // Use log odds to combine evidence
        let logOdds = 0;
        
        for (const evidence of evidenceList) {
            const likelihood = evidence.effectiveLikelihood;
            const confidence = evidence.effectiveConfidence;
            
            // Convert to odds
            const odds = likelihood / (1 - likelihood + 1e-10);
            
            // Weight by confidence
            logOdds += Math.log(odds + 1e-10) * confidence;
        }
        
        // Convert back to probability
        const odds = Math.exp(logOdds);
        const probability = odds / (1 + odds);
        
        return Math.min(1, Math.max(0, probability));
    }
    
    /**
     * Compute likelihood considering conditional dependencies
     * @private
     * @param {Array<Object>} evidenceList - Weighted evidence
     * @returns {number} Combined likelihood
     */
    computeLikelihoodWithDependencies(evidenceList) {
        if (evidenceList.length === 0) return 1.0;
        if (evidenceList.length === 1) {
            return evidenceList[0].effectiveLikelihood;
        }
        
        // Group evidence by source
        const evidenceBySource = new Map();
        for (const evidence of evidenceList) {
            if (!evidenceBySource.has(evidence.source)) {
                evidenceBySource.set(evidence.source, []);
            }
            evidenceBySource.get(evidence.source).push(evidence);
        }
        
        // Compute combined likelihood for each source
        const sourceLikelihoods = new Map();
        for (const [source, evidences] of evidenceBySource.entries()) {
            const avgLikelihood = evidences.reduce((sum, e) => sum + e.effectiveLikelihood * e.effectiveConfidence, 0) 
                / evidences.reduce((sum, e) => sum + e.effectiveConfidence, 0);
            sourceLikelihoods.set(source, avgLikelihood);
        }
        
        // Apply belief propagation considering dependencies
        const sources = Array.from(sourceLikelihoods.keys());
        let combinedLikelihood = 0;
        let totalWeight = 0;
        
        for (let i = 0; i < sources.length; i++) {
            const source = sources[i];
            const likelihood = sourceLikelihoods.get(source);
            
            // Calculate weight based on dependencies with other sources
            let weight = 1.0;
            
            for (let j = 0; j < sources.length; j++) {
                if (i !== j) {
                    const otherSource = sources[j];
                    const dependency = this.getDependency(source, otherSource);
                    
                    // Reduce weight if highly correlated (to avoid double-counting)
                    weight *= (1 - Math.abs(dependency) * 0.3);
                }
            }
            
            combinedLikelihood += likelihood * weight;
            totalWeight += weight;
        }
        
        return totalWeight > 0 ? combinedLikelihood / totalWeight : 0;
    }
    
    /**
     * Calculate confidence interval for belief
     * @private
     * @param {Array<Object>} evidenceList - Evidence list
     * @param {number} probability - Posterior probability
     * @returns {Object} Confidence interval
     */
    calculateConfidenceInterval(evidenceList, probability) {
        if (evidenceList.length === 0) {
            return {
                lower: 0,
                upper: 1,
                width: 1
            };
        }
        
        // Use Wilson score interval
        const n = evidenceList.length;
        const z = 1.96; // 95% confidence
        
        const avgConfidence = evidenceList.reduce((sum, e) => sum + e.confidence, 0) / n;
        
        // Adjust interval based on confidence
        const adjustment = z * Math.sqrt(probability * (1 - probability) / n) * (1 - avgConfidence + 0.5);
        
        const lower = Math.max(0, probability - adjustment);
        const upper = Math.min(1, probability + adjustment);
        
        return {
            lower: lower,
            upper: upper,
            width: upper - lower
        };
    }
    
    /**
     * Calculate uncertainty in belief
     * @private
     * @param {Array<Object>} evidenceList - Evidence list
     * @param {number} probability - Posterior probability
     * @returns {number} Uncertainty (0-1)
     */
    calculateUncertainty(evidenceList, probability) {
        if (evidenceList.length === 0) {
            return 1.0; // Maximum uncertainty with no evidence
        }
        
        // Combine multiple uncertainty factors
        
        // 1. Entropy-based uncertainty (how spread out the probability is)
        const entropy = -probability * Math.log2(probability + 1e-10) 
                       - (1 - probability) * Math.log2(1 - probability + 1e-10);
        const normalizedEntropy = entropy; // Max entropy is 1 for binary
        
        // 2. Evidence agreement (variance in likelihoods)
        const likelihoods = evidenceList.map(e => e.likelihood);
        const avgLikelihood = likelihoods.reduce((sum, l) => sum + l, 0) / likelihoods.length;
        const variance = likelihoods.reduce((sum, l) => sum + Math.pow(l - avgLikelihood, 2), 0) / likelihoods.length;
        const disagreement = Math.sqrt(variance);
        
        // 3. Confidence in evidence
        const avgConfidence = evidenceList.reduce((sum, e) => sum + e.confidence, 0) / evidenceList.length;
        const confidenceUncertainty = 1 - avgConfidence;
        
        // 4. Sample size uncertainty
        const sampleUncertainty = Math.exp(-evidenceList.length / 5); // Decreases with more evidence
        
        // Combine uncertainties
        const totalUncertainty = (normalizedEntropy * 0.3 + 
                                 disagreement * 0.3 + 
                                 confidenceUncertainty * 0.2 + 
                                 sampleUncertainty * 0.2);
        
        return Math.min(1, totalUncertainty);
    }
    
    /**
     * Classify evidence strength
     * @private
     * @param {Array<Object>} evidenceList - Evidence list
     * @returns {string} Evidence strength classification
     */
    classifyEvidenceStrength(evidenceList) {
        if (evidenceList.length === 0) {
            return EvidenceStrength.VERY_WEAK;
        }
        
        // Calculate overall strength from evidence
        const avgLikelihood = evidenceList.reduce((sum, e) => sum + e.likelihood, 0) / evidenceList.length;
        const avgConfidence = evidenceList.reduce((sum, e) => sum + e.confidence, 0) / evidenceList.length;
        
        const strength = avgLikelihood * avgConfidence;
        
        if (strength >= 0.9) return EvidenceStrength.VERY_STRONG;
        if (strength >= 0.7) return EvidenceStrength.STRONG;
        if (strength >= 0.5) return EvidenceStrength.MODERATE;
        if (strength >= 0.3) return EvidenceStrength.WEAK;
        return EvidenceStrength.VERY_WEAK;
    }
    
    /**
     * Get belief for a specific action
     * @param {string} action - Action type
     * @returns {Object|null} Belief information
     */
    getBelief(action) {
        return this.beliefs.get(action) || null;
    }
    
    /**
     * Get most likely action
     * @returns {Object|null} Most likely action with belief
     */
    getMostLikelyAction() {
        if (this.beliefs.size === 0) {
            return null;
        }
        
        let maxBelief = null;
        let maxProbability = -1;
        
        for (const [action, belief] of this.beliefs.entries()) {
            if (belief.probability > maxProbability) {
                maxProbability = belief.probability;
                maxBelief = { action, ...belief };
            }
        }
        
        return maxBelief;
    }
    
    /**
     * Get ranked actions by belief
     * @param {number} [minProbability] - Minimum probability threshold
     * @returns {Array<Object>} Ranked actions
     */
    getRankedActions(minProbability = 0) {
        const ranked = Array.from(this.beliefs.entries())
            .map(([action, belief]) => ({ action, ...belief }))
            .filter(b => b.probability >= minProbability)
            .sort((a, b) => b.probability - a.probability);
        
        return ranked;
    }
    
    /**
     * Clear all evidence
     */
    clearEvidence() {
        const evidenceCount = Array.from(this.evidence.values())
            .reduce((sum, list) => sum + list.length, 0);
        
        this.evidence.clear();
        
        console.log(`[BayesianBeliefNetwork] Cleared ${evidenceCount} evidence items`);
        this.emit('evidence:cleared', { count: evidenceCount });
    }
    
    /**
     * Clear beliefs
     */
    clearBeliefs() {
        const beliefCount = this.beliefs.size;
        this.beliefs.clear();
        
        console.log(`[BayesianBeliefNetwork] Cleared ${beliefCount} beliefs`);
        this.emit('beliefs:cleared', { count: beliefCount });
    }
    
    /**
     * Reset network to initial state
     */
    reset() {
        console.log('[BayesianBeliefNetwork] Resetting network');
        
        this.clearEvidence();
        this.clearBeliefs();
        this.initializeDefaultPriors();
        this.initializeDefaultWeights();
        this.initializeDefaultDependencies();
        
        this.emit('network:reset');
    }
    
    /**
     * Get network statistics
     * @returns {Object} Statistics
     */
    getStats() {
        return {
            ...this.stats,
            currentBeliefs: this.beliefs.size,
            totalEvidence: Array.from(this.evidence.values())
                .reduce((sum, list) => sum + list.length, 0),
            averageConfidence: this.stats.averageConfidence.toFixed(3),
            priorActions: this.priors.size,
            evidenceSources: Object.keys(this.stats.evidenceBySource).length
        };
    }
    
    /**
     * Export network state
     * @returns {Object} Network state
     */
    exportState() {
        return {
            priors: Array.from(this.priors.entries()),
            sourceWeights: Array.from(this.sourceWeights.entries()),
            dependencies: Array.from(this.dependencies.entries()),
            evidence: Array.from(this.evidence.entries()),
            beliefs: Array.from(this.beliefs.entries()),
            stats: this.stats
        };
    }
    
    /**
     * Import network state
     * @param {Object} state - Network state
     */
    importState(state) {
        console.log('[BayesianBeliefNetwork] Importing network state');
        
        this.priors = new Map(state.priors);
        this.sourceWeights = new Map(state.sourceWeights);
        this.dependencies = new Map(state.dependencies);
        this.evidence = new Map(state.evidence);
        this.beliefs = new Map(state.beliefs);
        this.stats = state.stats;
        
        this.emit('state:imported');
    }
}

module.exports = { 
    BayesianBeliefNetwork, 
    EvidenceStrength, 
    ActionType, 
    EvidenceSource 
};
