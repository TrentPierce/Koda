/**
 * Koda - Intelligent Browser Automation Library
 * This project uses Koda by Trent Pierce
 * https://github.com/TrentPierce/Koda
 * Licensed under the Koda Non-Commercial License
 *
 * Copyright (c) 2026 Trent Pierce. All rights reserved.
 * See LICENSE file for full terms.
 */

class PolicyGradient {
  constructor(config = {}) {
    this.config = {
      learningRate: config.learningRate || 0.001,
      gamma: config.gamma || 0.99,
      entropyCoefficient: config.entropyCoefficient || 0.01,
      valueCoefficient: config.valueCoefficient || 0.5,
      maxGradNorm: config.maxGradNorm || 0.5,
      ...config
    };

    this.policy = new Map();
    this.valueFunction = new Map();
    this.episodeBuffer = [];
  }

  /**
     * Get state key for policy lookup
     */
  getStateKey(state) {
    const normalized = {
      screenType: state.screenType || 'unknown',
      hasModal: state.hasModal || false,
      elementTypes: this.normalizeElementTypes(state.elements || [])
    };
    return JSON.stringify(normalized);
  }

  /**
     * Normalize element types for state representation
     */
  normalizeElementTypes(elements) {
    const types = {};
    for (const el of elements) {
      const type = el.type || 'unknown';
      types[type] = (types[type] || 0) + 1;
    }
    return types;
  }

  /**
     * Get policy for state (action probabilities)
     */
  getPolicy(state) {
    const stateKey = this.getStateKey(state);
        
    if (!this.policy.has(stateKey)) {
      // Initialize with uniform distribution
      const actions = ['navigate', 'click', 'type', 'scroll', 'wait', 'swipe', 'tap'];
      const uniformProb = 1.0 / actions.length;
      const initialPolicy = {};
            
      for (const action of actions) {
        initialPolicy[action] = uniformProb;
      }
            
      this.policy.set(stateKey, initialPolicy);
    }
        
    return this.policy.get(stateKey);
  }

  /**
     * Sample action from policy
     */
  sampleAction(state, validActions = null) {
    const policy = this.getPolicy(state);
        
    // Filter to valid actions if specified
    let actionProbs = { ...policy };
    if (validActions) {
      const filteredProbs = {};
      let total = 0;
            
      for (const action of validActions) {
        if (actionProbs[action]) {
          filteredProbs[action] = actionProbs[action];
          total += actionProbs[action];
        }
      }
            
      // Normalize
      for (const action in filteredProbs) {
        filteredProbs[action] /= total;
      }
            
      actionProbs = filteredProbs;
    }
        
    // Sample based on probabilities
    const rand = Math.random();
    let cumulative = 0;
        
    for (const [action, prob] of Object.entries(actionProbs)) {
      cumulative += prob;
      if (rand <= cumulative) {
        return action;
      }
    }
        
    // Fallback
    return Object.keys(actionProbs)[0];
  }

  /**
     * Get value estimate for state
     */
  getValue(state) {
    const stateKey = this.getStateKey(state);
        
    if (!this.valueFunction.has(stateKey)) {
      this.valueFunction.set(stateKey, 0.0);
    }
        
    return this.valueFunction.get(stateKey);
  }

  /**
     * Store transition in episode buffer
     */
  storeTransition(state, action, reward, nextState, done) {
    this.episodeBuffer.push({
      state,
      action,
      reward,
      nextState,
      done,
      timestamp: Date.now()
    });
  }

  /**
     * Calculate returns (discounted cumulative rewards)
     */
  calculateReturns() {
    const returns = [];
    let G = 0;
        
    // Calculate returns in reverse
    for (let i = this.episodeBuffer.length - 1; i >= 0; i--) {
      G = this.episodeBuffer[i].reward + this.config.gamma * G;
      returns.unshift(G);
    }
        
    return returns;
  }

  /**
     * Calculate advantages using Generalized Advantage Estimation (GAE)
     */
  calculateAdvantages() {
    const advantages = [];
    let lastGae = 0;
        
    for (let i = this.episodeBuffer.length - 1; i >= 0; i--) {
      const transition = this.episodeBuffer[i];
      const value = this.getValue(transition.state);
      const nextValue = transition.done ? 0 : this.getValue(transition.nextState);
            
      const delta = transition.reward + this.config.gamma * nextValue - value;
      lastGae = delta + this.config.gamma * 0.95 * lastGae;
            
      advantages.unshift(lastGae);
    }
        
    return advantages;
  }

  /**
     * Update policy using REINFORCE algorithm
     */
  updateReinforce() {
    if (this.episodeBuffer.length === 0) {
      return;
    }

    const returns = this.calculateReturns();
        
    // Normalize returns
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const std = Math.sqrt(
      returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / returns.length
    );
        
    const normalizedReturns = returns.map(r => (r - mean) / (std + 1e-8));
        
    // Update policy for each state-action pair
    for (let i = 0; i < this.episodeBuffer.length; i++) {
      const { state, action } = this.episodeBuffer[i];
      const G = normalizedReturns[i];
            
      const stateKey = this.getStateKey(state);
      const policy = this.getPolicy(state);
            
      // Policy gradient update
      const oldProb = policy[action];
      const newProb = Math.min(1.0, Math.max(0.01, 
        oldProb + this.config.learningRate * G
      ));
            
      policy[action] = newProb;
            
      // Normalize policy
      const total = Object.values(policy).reduce((a, b) => a + b, 0);
      for (const act in policy) {
        policy[act] /= total;
      }
            
      this.policy.set(stateKey, policy);
    }
        
    // Clear episode buffer
    this.episodeBuffer = [];
  }

  /**
     * Update using Actor-Critic method
     */
  updateActorCritic() {
    if (this.episodeBuffer.length === 0) {
      return;
    }

    const advantages = this.calculateAdvantages();
    const returns = this.calculateReturns();
        
    // Update both policy (actor) and value function (critic)
    for (let i = 0; i < this.episodeBuffer.length; i++) {
      const { state, action } = this.episodeBuffer[i];
      const advantage = advantages[i];
      const G = returns[i];
            
      // Update policy (actor)
      const stateKey = this.getStateKey(state);
      const policy = this.getPolicy(state);
            
      const oldProb = policy[action];
      const newProb = Math.min(1.0, Math.max(0.01, 
        oldProb + this.config.learningRate * advantage
      ));
            
      policy[action] = newProb;
            
      // Normalize policy
      const total = Object.values(policy).reduce((a, b) => a + b, 0);
      for (const act in policy) {
        policy[act] /= total;
      }
            
      this.policy.set(stateKey, policy);
            
      // Update value function (critic)
      const oldValue = this.getValue(state);
      const newValue = oldValue + this.config.learningRate * this.config.valueCoefficient * (G - oldValue);
      this.valueFunction.set(stateKey, newValue);
    }
        
    // Clear episode buffer
    this.episodeBuffer = [];
  }

  /**
     * Calculate policy entropy (for exploration)
     */
  calculateEntropy(state) {
    const policy = this.getPolicy(state);
    let entropy = 0;
        
    for (const prob of Object.values(policy)) {
      if (prob > 0) {
        entropy -= prob * Math.log(prob);
      }
    }
        
    return entropy;
  }

  /**
     * Get policy statistics
     */
  getPolicyStats(state) {
    const policy = this.getPolicy(state);
    const entropy = this.calculateEntropy(state);
    const value = this.getValue(state);
        
    // Sort actions by probability
    const sortedActions = Object.entries(policy)
      .sort((a, b) => b[1] - a[1])
      .map(([action, prob]) => ({ action, probability: prob }));
        
    return {
      actions: sortedActions,
      entropy,
      value,
      bestAction: sortedActions[0]?.action
    };
  }

  /**
     * Export policy for persistence
     */
  export() {
    const policyData = {};
    const valueData = {};
        
    for (const [stateKey, policy] of this.policy.entries()) {
      policyData[stateKey] = policy;
    }
        
    for (const [stateKey, value] of this.valueFunction.entries()) {
      valueData[stateKey] = value;
    }
        
    return {
      policy: policyData,
      valueFunction: valueData,
      config: this.config,
      timestamp: Date.now()
    };
  }

  /**
     * Import policy from persistence
     */
  import(data) {
    this.policy.clear();
    this.valueFunction.clear();
        
    for (const [stateKey, policy] of Object.entries(data.policy)) {
      this.policy.set(stateKey, policy);
    }
        
    for (const [stateKey, value] of Object.entries(data.valueFunction)) {
      this.valueFunction.set(stateKey, value);
    }
        
    if (data.config) {
      this.config = { ...this.config, ...data.config };
    }
        
    console.log(`[PolicyGradient] Imported ${this.policy.size} policies`);
  }

  /**
     * Reset policy and value function
     */
  reset() {
    this.policy.clear();
    this.valueFunction.clear();
    this.episodeBuffer = [];
  }
}

module.exports = PolicyGradient;
