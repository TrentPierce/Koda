/**
 * Experience Replay Buffer
 * Stores and samples past experiences for improved learning
 */

class ExperienceReplay {
  constructor(config = {}) {
    this.config = {
      maxSize: config.maxSize || 10000,
      batchSize: config.batchSize || 32,
      priorityAlpha: config.priorityAlpha || 0.6,
      usePriority: config.usePriority || true,
      ...config
    };

    this.buffer = [];
    this.priorities = [];
    this.position = 0;
  }

  /**
     * Add experience to buffer
     */
  add(experience) {
    const {
      state,
      action,
      reward,
      nextState,
      done,
      timestamp = Date.now()
    } = experience;

    const exp = {
      state,
      action,
      reward,
      nextState,
      done,
      timestamp
    };

    // Calculate initial priority based on reward magnitude
    const priority = Math.abs(reward) + 0.01;

    if (this.buffer.length < this.config.maxSize) {
      this.buffer.push(exp);
      this.priorities.push(priority);
    } else {
      // Circular buffer - replace oldest
      this.buffer[this.position] = exp;
      this.priorities[this.position] = priority;
      this.position = (this.position + 1) % this.config.maxSize;
    }
  }

  /**
     * Sample batch of experiences
     */
  sample(batchSize = null) {
    const size = batchSize || this.config.batchSize;
        
    if (this.buffer.length === 0) {
      return [];
    }

    if (this.buffer.length <= size) {
      return [...this.buffer];
    }

    if (this.config.usePriority) {
      return this.prioritySample(size);
    } else {
      return this.uniformSample(size);
    }
  }

  /**
     * Uniform random sampling
     */
  uniformSample(size) {
    const samples = [];
    const indices = new Set();

    while (indices.size < size) {
      const idx = Math.floor(Math.random() * this.buffer.length);
      if (!indices.has(idx)) {
        indices.add(idx);
        samples.push(this.buffer[idx]);
      }
    }

    return samples;
  }

  /**
     * Priority-based sampling
     */
  prioritySample(size) {
    const samples = [];
    const totalPriority = this.priorities.reduce((a, b) => a + Math.pow(b, this.config.priorityAlpha), 0);

    for (let i = 0; i < size; i++) {
      let randValue = Math.random() * totalPriority;
      let cumulative = 0;

      for (let j = 0; j < this.buffer.length; j++) {
        cumulative += Math.pow(this.priorities[j], this.config.priorityAlpha);
        if (cumulative >= randValue) {
          samples.push(this.buffer[j]);
          break;
        }
      }
    }

    return samples;
  }

  /**
     * Update priority for experiences
     */
  updatePriorities(indices, priorities) {
    for (let i = 0; i < indices.length; i++) {
      if (indices[i] < this.priorities.length) {
        this.priorities[indices[i]] = priorities[i];
      }
    }
  }

  /**
     * Get experiences by reward range
     */
  getByRewardRange(minReward, maxReward) {
    return this.buffer.filter(exp => 
      exp.reward >= minReward && exp.reward <= maxReward
    );
  }

  /**
     * Get experiences by action type
     */
  getByAction(action) {
    return this.buffer.filter(exp => exp.action === action);
  }

  /**
     * Get recent experiences
     */
  getRecent(count) {
    if (this.buffer.length <= count) {
      return [...this.buffer];
    }

    const startIdx = this.buffer.length - count;
    return this.buffer.slice(startIdx);
  }

  /**
     * Get successful experiences
     */
  getSuccessful(minReward = 5.0) {
    return this.buffer.filter(exp => exp.reward >= minReward);
  }

  /**
     * Get failed experiences
     */
  getFailed(maxReward = -3.0) {
    return this.buffer.filter(exp => exp.reward <= maxReward);
  }

  /**
     * Get statistics
     */
  getStats() {
    if (this.buffer.length === 0) {
      return null;
    }

    const rewards = this.buffer.map(exp => exp.reward);
    const actions = this.buffer.reduce((acc, exp) => {
      acc[exp.action] = (acc[exp.action] || 0) + 1;
      return acc;
    }, {});

    return {
      size: this.buffer.length,
      maxSize: this.config.maxSize,
      utilization: (this.buffer.length / this.config.maxSize * 100).toFixed(2) + '%',
      totalReward: rewards.reduce((a, b) => a + b, 0),
      avgReward: rewards.reduce((a, b) => a + b, 0) / rewards.length,
      maxReward: Math.max(...rewards),
      minReward: Math.min(...rewards),
      actionDistribution: actions,
      successRate: this.buffer.filter(e => e.reward > 0).length / this.buffer.length
    };
  }

  /**
     * Clear buffer
     */
  clear() {
    this.buffer = [];
    this.priorities = [];
    this.position = 0;
  }

  /**
     * Get buffer size
     */
  size() {
    return this.buffer.length;
  }

  /**
     * Export buffer for persistence
     */
  export() {
    return {
      buffer: this.buffer,
      priorities: this.priorities,
      position: this.position,
      config: this.config,
      timestamp: Date.now()
    };
  }

  /**
     * Import buffer from persistence
     */
  import(data) {
    this.buffer = data.buffer || [];
    this.priorities = data.priorities || [];
    this.position = data.position || 0;
        
    if (data.config) {
      this.config = { ...this.config, ...data.config };
    }

    console.log(`[ExperienceReplay] Imported ${this.buffer.length} experiences`);
  }
}

module.exports = ExperienceReplay;
