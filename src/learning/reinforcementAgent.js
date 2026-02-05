/**
 * Reinforcement Learning Agent
 * Combines Q-learning, policy gradient, and experience replay
 */

const QLearning = require('./qLearning');
const RewardSystem = require('./rewardSystem');
const ExperienceReplay = require('./experienceReplay');
const PolicyGradient = require('./policyGradient');
const LearningDatabase = require('./learningDatabase');
const StateRepresentation = require('./stateRepresentation');

class ReinforcementAgent {
  constructor(config = {}) {
    this.config = {
      algorithm: config.algorithm || 'qlearning',
      batchSize: config.batchSize || 32,
      updateFrequency: config.updateFrequency || 10,
      saveFrequency: config.saveFrequency || 100,
      platform: config.platform || 'web',
      ...config
    };

    // Initialize components
    this.qLearning = new QLearning(config.qLearningConfig);
    this.rewardSystem = new RewardSystem(config.rewardConfig);
    this.experienceReplay = new ExperienceReplay(config.replayConfig);
    this.policyGradient = new PolicyGradient(config.policyConfig);
    this.stateRepresentation = new StateRepresentation(this.config.platform);
        
    // Database for persistence
    this.database = null;
    this.dbEnabled = config.enableDatabase !== false;
        
    // Tracking
    this.currentState = null;
    this.episodeRewards = [];
    this.stepCount = 0;
    this.episodeCount = 0;
    this.lastSaveStep = 0;
  }

  /**
     * Initialize agent
     */
  async initialize() {
    if (this.dbEnabled) {
      this.database = new LearningDatabase(this.config.dbPath);
      await this.database.initialize();
      await this.loadFromDatabase();
    }
        
    console.log('[ReinforcementAgent] Initialized with', this.config.algorithm);
  }

  /**
     * Choose action for current state
     */
  chooseAction(state, validActions = null) {
    if (this.config.algorithm === 'qlearning') {
      return this.qLearning.chooseAction(state, validActions);
    } else if (this.config.algorithm === 'policy') {
      return this.policyGradient.sampleAction(state, validActions);
    } else if (this.config.algorithm === 'hybrid') {
      // Use Q-learning for exploration, policy for exploitation
      if (Math.random() < 0.3) {
        return this.qLearning.chooseAction(state, validActions);
      } else {
        return this.policyGradient.sampleAction(state, validActions);
      }
    }
        
    return this.qLearning.chooseAction(state, validActions);
  }

  /**
     * Store experience and learn
     */
  async learn(state, action, reward, nextState, done = false) {
    // Create experience
    const experience = {
      state,
      action,
      reward,
      nextState,
      done,
      timestamp: Date.now()
    };

    // Store in replay buffer
    this.experienceReplay.add(experience);
        
    // Store in policy gradient episode buffer
    if (this.config.algorithm === 'policy' || this.config.algorithm === 'hybrid') {
      this.policyGradient.storeTransition(state, action, reward, nextState, done);
    }

    // Immediate Q-learning update
    if (this.config.algorithm === 'qlearning' || this.config.algorithm === 'hybrid') {
      this.qLearning.update(state, action, reward, nextState, done);
    }

    // Track progress
    this.stepCount++;
    this.episodeRewards.push(reward);

    // Batch learning from replay buffer
    if (this.stepCount % this.config.updateFrequency === 0) {
      await this.batchLearn();
    }

    // End of episode updates
    if (done) {
      await this.endEpisode();
    }

    // Periodic saves
    if (this.stepCount - this.lastSaveStep >= this.config.saveFrequency) {
      await this.saveToDatabase();
      this.lastSaveStep = this.stepCount;
    }

    // Update current state
    this.currentState = nextState;
  }

  /**
     * Batch learning from experience replay
     */
  async batchLearn() {
    const batch = this.experienceReplay.sample(this.config.batchSize);
        
    if (batch.length === 0) {
      return;
    }

    // Update Q-values from batch
    if (this.config.algorithm === 'qlearning' || this.config.algorithm === 'hybrid') {
      this.qLearning.batchUpdate(batch);
    }
  }

  /**
     * End of episode processing
     */
  async endEpisode() {
    this.episodeCount++;

    // Policy gradient update
    if (this.config.algorithm === 'policy') {
      this.policyGradient.updateReinforce();
    } else if (this.config.algorithm === 'hybrid') {
      this.policyGradient.updateActorCritic();
    }

    // Log episode statistics
    const totalReward = this.episodeRewards.reduce((a, b) => a + b, 0);
    console.log(`[RL] Episode ${this.episodeCount} complete: Reward=${totalReward.toFixed(2)}, Steps=${this.episodeRewards.length}`);

    // Reset episode tracking
    this.episodeRewards = [];
  }

  /**
     * Calculate reward for action outcome
     */
  calculateReward(outcome) {
    return this.rewardSystem.calculateReward(outcome);
  }

  /**
     * Get best action for state (exploitation)
     */
  getBestAction(state) {
    if (this.config.algorithm === 'qlearning') {
      return this.qLearning.getBestAction(state);
    } else if (this.config.algorithm === 'policy' || this.config.algorithm === 'hybrid') {
      const stats = this.policyGradient.getPolicyStats(state);
      return stats.bestAction;
    }
        
    return null;
  }

  /**
     * Get Q-value for state-action pair
     */
  getQValue(state, action) {
    return this.qLearning.getQValue(state, action);
  }

  /**
     * Get policy for state
     */
  getPolicy(state) {
    return this.policyGradient.getPolicy(state);
  }

  /**
     * Get statistics
     */
  getStats() {
    return {
      algorithm: this.config.algorithm,
      totalSteps: this.stepCount,
      episodes: this.episodeCount,
      qTableSize: this.qLearning.getSize(),
      experienceBufferSize: this.experienceReplay.size(),
      rewardStats: this.rewardSystem.getStats(),
      experienceStats: this.experienceReplay.getStats(),
      explorationRate: this.qLearning.config.explorationRate
    };
  }

  /**
     * Load learning data from database
     */
  async loadFromDatabase() {
    if (!this.database) {
      return;
    }

    try {
      // Load Q-table
      if (this.config.algorithm === 'qlearning' || this.config.algorithm === 'hybrid') {
        const qTable = this.database.loadQTable();
        if (qTable.size > 0) {
          this.qLearning.qTable = qTable;
          console.log(`[RL] Loaded ${qTable.size} Q-states`);
        }
      }

      // Load policy
      if (this.config.algorithm === 'policy' || this.config.algorithm === 'hybrid') {
        const policyMap = this.database.loadPolicyMap();
        if (policyMap.size > 0) {
          this.policyGradient.policy = policyMap;
          console.log(`[RL] Loaded ${policyMap.size} policy states`);
        }
      }

      // Load recent successful experiences
      const experiences = this.database.loadSuccessfulExperiences(5.0, 500);
      for (const exp of experiences) {
        this.experienceReplay.add(exp);
      }
      console.log(`[RL] Loaded ${experiences.length} experiences`);

    } catch (error) {
      console.error('[RL] Failed to load from database:', error.message);
    }
  }

  /**
     * Save learning data to database
     */
  async saveToDatabase() {
    if (!this.database) {
      return;
    }

    try {
      // Save Q-table
      if (this.config.algorithm === 'qlearning' || this.config.algorithm === 'hybrid') {
        this.database.saveQTable(this.qLearning.qTable);
      }

      // Save policy
      if (this.config.algorithm === 'policy' || this.config.algorithm === 'hybrid') {
        this.database.savePolicyMap(this.policyGradient.policy);
      }

      // Save recent experiences
      const recentExperiences = this.experienceReplay.getRecent(100);
      for (const exp of recentExperiences) {
        this.database.saveExperience(exp);
      }

      console.log('[RL] Saved learning data to database');
    } catch (error) {
      console.error('[RL] Failed to save to database:', error.message);
    }
  }

  /**
     * Export all learning data
     */
  export() {
    return {
      qLearning: this.qLearning.export(),
      policy: this.policyGradient.export(),
      experiences: this.experienceReplay.export(),
      stats: this.getStats(),
      timestamp: Date.now()
    };
  }

  /**
     * Import learning data
     */
  import(data) {
    if (data.qLearning) {
      this.qLearning.import(data.qLearning);
    }
    if (data.policy) {
      this.policyGradient.import(data.policy);
    }
    if (data.experiences) {
      this.experienceReplay.import(data.experiences);
    }
        
    console.log('[RL] Imported learning data');
  }

  /**
     * Reset all learning
     */
  reset() {
    this.qLearning.reset();
    this.policyGradient.reset();
    this.experienceReplay.clear();
    this.rewardSystem.reset();
    this.episodeRewards = [];
    this.stepCount = 0;
    this.episodeCount = 0;
  }

  /**
     * Close agent
     */
  async close() {
    await this.saveToDatabase();
        
    if (this.database) {
      this.database.close();
    }
  }
}

module.exports = ReinforcementAgent;
