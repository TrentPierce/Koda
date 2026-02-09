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

class LoadBalancer extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      maxConcurrentRequests: config.maxConcurrentRequests || 100,
      requestsPerSecond: config.requestsPerSecond || 50,
      enableRateLimiting: config.enableRateLimiting !== false,
      enableCircuitBreaker: config.enableCircuitBreaker !== false,
      circuitBreakerThreshold: config.circuitBreakerThreshold || 0.5,
      circuitBreakerTimeout: config.circuitBreakerTimeout || 60000,
      retryStrategy: config.retryStrategy || 'exponential',
      maxRetries: config.maxRetries || 3,
      ...config
    };
    
    this.activeRequests = new Map();
    this.requestQueue = [];
    this.rateLimiter = {
      tokens: this.config.requestsPerSecond,
      lastRefill: Date.now()
    };
    
    this.circuitBreakers = new Map();
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      rejectedRequests: 0,
      averageResponseTime: 0,
      requestsPerSecond: 0
    };
    
    this.startMetricsTracking();
  }

  /**
   * Process incoming request with load balancing
   */
  async processRequest(request, handler) {
    this.metrics.totalRequests++;
    
    // Check circuit breaker
    if (this.config.enableCircuitBreaker) {
      const breaker = this.getCircuitBreaker(request.target || 'default');
      if (breaker.state === 'open') {
        this.metrics.rejectedRequests++;
        throw new Error('Circuit breaker is open');
      }
    }
    
    // Check rate limit
    if (this.config.enableRateLimiting) {
      await this.waitForRateLimit();
    }
    
    // Check concurrent request limit
    if (this.activeRequests.size >= this.config.maxConcurrentRequests) {
      // Queue request
      return new Promise((resolve, reject) => {
        this.requestQueue.push({ request, handler, resolve, reject });
        this.emit('request-queued', { queueSize: this.requestQueue.length });
      });
    }
    
    // Execute request
    return await this.executeRequest(request, handler);
  }

  /**
   * Execute request with monitoring
   */
  async executeRequest(request, handler, retryCount = 0) {
    const requestId = this.generateRequestId();
    const startTime = Date.now();
    
    this.activeRequests.set(requestId, {
      request,
      startTime,
      retryCount
    });
    
    try {
      const result = await handler(request);
      
      const responseTime = Date.now() - startTime;
      this.updateMetrics(true, responseTime);
      
      // Update circuit breaker
      if (this.config.enableCircuitBreaker) {
        this.recordSuccess(request.target || 'default');
      }
      
      this.activeRequests.delete(requestId);
      this.processQueue();
      
      return result;
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.updateMetrics(false, responseTime);
      
      // Update circuit breaker
      if (this.config.enableCircuitBreaker) {
        this.recordFailure(request.target || 'default');
      }
      
      // Retry logic
      if (retryCount < this.config.maxRetries) {
        const delay = this.calculateRetryDelay(retryCount);
        await this.sleep(delay);
        
        this.activeRequests.delete(requestId);
        return await this.executeRequest(request, handler, retryCount + 1);
      }
      
      this.activeRequests.delete(requestId);
      this.processQueue();
      
      throw error;
    }
  }

  /**
   * Process queued requests
   */
  processQueue() {
    while (
      this.requestQueue.length > 0 &&
      this.activeRequests.size < this.config.maxConcurrentRequests
    ) {
      const { request, handler, resolve, reject } = this.requestQueue.shift();
      
      this.executeRequest(request, handler)
        .then(resolve)
        .catch(reject);
    }
  }

  /**
   * Rate limiting
   */
  async waitForRateLimit() {
    this.refillTokens();
    
    while (this.rateLimiter.tokens < 1) {
      await this.sleep(10);
      this.refillTokens();
    }
    
    this.rateLimiter.tokens--;
  }

  refillTokens() {
    const now = Date.now();
    const elapsed = now - this.rateLimiter.lastRefill;
    const tokensToAdd = (elapsed / 1000) * this.config.requestsPerSecond;
    
    this.rateLimiter.tokens = Math.min(
      this.rateLimiter.tokens + tokensToAdd,
      this.config.requestsPerSecond
    );
    this.rateLimiter.lastRefill = now;
  }

  /**
   * Circuit breaker pattern
   */
  getCircuitBreaker(target) {
    if (!this.circuitBreakers.has(target)) {
      this.circuitBreakers.set(target, {
        state: 'closed',
        failures: 0,
        successes: 0,
        lastFailureTime: null,
        nextAttemptTime: null
      });
    }
    return this.circuitBreakers.get(target);
  }

  recordSuccess(target) {
    const breaker = this.getCircuitBreaker(target);
    breaker.successes++;
    breaker.failures = Math.max(0, breaker.failures - 1);
    
    // Close circuit if it was half-open
    if (breaker.state === 'half-open') {
      breaker.state = 'closed';
      this.emit('circuit-closed', { target });
    }
  }

  recordFailure(target) {
    const breaker = this.getCircuitBreaker(target);
    breaker.failures++;
    breaker.lastFailureTime = Date.now();
    
    const totalRequests = breaker.failures + breaker.successes;
    const failureRate = breaker.failures / totalRequests;
    
    if (failureRate >= this.config.circuitBreakerThreshold && breaker.state === 'closed') {
      breaker.state = 'open';
      breaker.nextAttemptTime = Date.now() + this.config.circuitBreakerTimeout;
      this.emit('circuit-opened', { target });
      
      // Schedule circuit breaker reset
      setTimeout(() => {
        breaker.state = 'half-open';
        breaker.failures = 0;
        breaker.successes = 0;
        this.emit('circuit-half-open', { target });
      }, this.config.circuitBreakerTimeout);
    }
  }

  /**
   * Calculate retry delay
   */
  calculateRetryDelay(retryCount) {
    switch (this.config.retryStrategy) {
      case 'exponential':
        return Math.min(1000 * Math.pow(2, retryCount), 30000);
      
      case 'linear':
        return 1000 * (retryCount + 1);
      
      case 'constant':
        return 1000;
      
      default:
        return 1000 * Math.pow(2, retryCount);
    }
  }

  /**
   * Update metrics
   */
  updateMetrics(success, responseTime) {
    if (success) {
      this.metrics.successfulRequests++;
    } else {
      this.metrics.failedRequests++;
    }
    
    const totalCompleted = this.metrics.successfulRequests + this.metrics.failedRequests;
    const currentAvg = this.metrics.averageResponseTime;
    this.metrics.averageResponseTime = ((currentAvg * (totalCompleted - 1)) + responseTime) / totalCompleted;
  }

  /**
   * Start metrics tracking
   */
  startMetricsTracking() {
    setInterval(() => {
      const completed = this.metrics.successfulRequests + this.metrics.failedRequests;
      this.metrics.requestsPerSecond = completed; // Simplified - should track per second
      
      this.emit('metrics-updated', this.getStats());
    }, 1000);
  }

  /**
   * Get load balancer statistics
   */
  getStats() {
    return {
      ...this.metrics,
      activeRequests: this.activeRequests.size,
      queuedRequests: this.requestQueue.length,
      successRate: this.metrics.successfulRequests / (this.metrics.successfulRequests + this.metrics.failedRequests) || 0,
      circuitBreakers: Array.from(this.circuitBreakers.entries()).map(([target, breaker]) => ({
        target,
        state: breaker.state,
        failures: breaker.failures,
        successes: breaker.successes
      }))
    };
  }

  /**
   * Helper methods
   */
  generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Reset circuit breaker
   */
  resetCircuitBreaker(target) {
    if (this.circuitBreakers.has(target)) {
      const breaker = this.circuitBreakers.get(target);
      breaker.state = 'closed';
      breaker.failures = 0;
      breaker.successes = 0;
      this.emit('circuit-reset', { target });
    }
  }

  /**
   * Adjust configuration dynamically
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    this.emit('config-updated', this.config);
  }
}

module.exports = LoadBalancer;
