/**
 * Distributed Execution System
 * Enables large-scale testing and automation across multiple nodes
 * @module enterprise/distributedExecutor
 */

const EventEmitter = require('events');
const { Worker } = require('worker_threads');
const cluster = require('cluster');
const os = require('os');

class DistributedExecutor extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      maxWorkers: config.maxWorkers || os.cpus().length,
      enableClustering: config.enableClustering !== false,
      taskTimeout: config.taskTimeout || 300000, // 5 minutes
      retryAttempts: config.retryAttempts || 3,
      loadBalancingStrategy: config.loadBalancingStrategy || 'least-loaded',
      enableHealthChecks: config.enableHealthChecks !== false,
      healthCheckInterval: config.healthCheckInterval || 30000,
      ...config
    };
    
    this.workers = new Map();
    this.taskQueue = [];
    this.activeTasks = new Map();
    this.completedTasks = [];
    this.metrics = {
      totalTasks: 0,
      completedTasks: 0,
      failedTasks: 0,
      averageExecutionTime: 0,
      workerUtilization: new Map()
    };
    
    this.isInitialized = false;
  }

  /**
   * Initialize distributed executor
   */
  async initialize() {
    if (this.isInitialized) return;
    
    if (this.config.enableClustering && cluster.isMaster) {
      await this.initializeCluster();
    } else {
      await this.initializeWorkers();
    }
    
    if (this.config.enableHealthChecks) {
      this.startHealthChecks();
    }
    
    this.isInitialized = true;
    this.emit('initialized');
  }

  /**
   * Initialize cluster mode
   */
  async initializeCluster() {
    const numWorkers = this.config.maxWorkers;
    
    for (let i = 0; i < numWorkers; i++) {
      const worker = cluster.fork();
      
      this.workers.set(worker.id, {
        id: worker.id,
        process: worker,
        status: 'idle',
        activeTasks: 0,
        completedTasks: 0,
        failedTasks: 0,
        lastHeartbeat: Date.now(),
        metrics: {
          cpu: 0,
          memory: 0,
          uptime: 0
        }
      });
      
      worker.on('message', (msg) => this.handleWorkerMessage(worker.id, msg));
      worker.on('exit', (code, signal) => this.handleWorkerExit(worker.id, code, signal));
    }
    
    cluster.on('exit', (worker, code, signal) => {
      console.log(`Worker ${worker.id} died. Restarting...`);
      const newWorker = cluster.fork();
      this.replaceWorker(worker.id, newWorker);
    });
  }

  /**
   * Initialize worker threads
   */
  async initializeWorkers() {
    const numWorkers = this.config.maxWorkers;
    
    for (let i = 0; i < numWorkers; i++) {
      await this.createWorker(i);
    }
  }

  /**
   * Create a new worker
   */
  async createWorker(id) {
    const worker = new Worker('./src/enterprise/worker.js', {
      workerData: {
        workerId: id,
        config: this.config
      }
    });
    
    this.workers.set(id, {
      id: id,
      thread: worker,
      status: 'idle',
      activeTasks: 0,
      completedTasks: 0,
      failedTasks: 0,
      lastHeartbeat: Date.now(),
      metrics: {
        cpu: 0,
        memory: 0,
        taskQueueSize: 0
      }
    });
    
    worker.on('message', (msg) => this.handleWorkerMessage(id, msg));
    worker.on('error', (error) => this.handleWorkerError(id, error));
    worker.on('exit', (code) => this.handleWorkerExit(id, code));
  }

  /**
   * Submit task for distributed execution
   */
  async submitTask(task) {
    this.metrics.totalTasks++;
    
    const taskData = {
      id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: task.type,
      payload: task.payload,
      priority: task.priority || 0,
      retries: 0,
      maxRetries: this.config.retryAttempts,
      submittedAt: Date.now(),
      timeout: task.timeout || this.config.taskTimeout
    };
    
    this.taskQueue.push(taskData);
    this.emit('task-queued', taskData);
    
    // Try to assign immediately
    await this.assignTasks();
    
    return new Promise((resolve, reject) => {
      const checkCompletion = () => {
        const completed = this.completedTasks.find(t => t.id === taskData.id);
        if (completed) {
          if (completed.success) {
            resolve(completed.result);
          } else {
            reject(new Error(completed.error || 'Task failed'));
          }
        } else {
          setTimeout(checkCompletion, 100);
        }
      };
      checkCompletion();
    });
  }

  /**
   * Assign tasks to available workers
   */
  async assignTasks() {
    while (this.taskQueue.length > 0) {
      const worker = this.selectWorker();
      if (!worker) break;
      
      const task = this.taskQueue.shift();
      await this.assignTaskToWorker(task, worker);
    }
  }

  /**
   * Select best worker based on load balancing strategy
   */
  selectWorker() {
    const availableWorkers = Array.from(this.workers.values())
      .filter(w => w.status === 'idle' || w.activeTasks < 5);
    
    if (availableWorkers.length === 0) return null;
    
    switch (this.config.loadBalancingStrategy) {
      case 'round-robin':
        return this.selectRoundRobin(availableWorkers);
      
      case 'least-loaded':
        return this.selectLeastLoaded(availableWorkers);
      
      case 'random':
        return availableWorkers[Math.floor(Math.random() * availableWorkers.length)];
      
      case 'performance-based':
        return this.selectByPerformance(availableWorkers);
      
      default:
        return this.selectLeastLoaded(availableWorkers);
    }
  }

  /**
   * Round-robin selection
   */
  selectRoundRobin(workers) {
    if (!this._lastRobinIndex) this._lastRobinIndex = 0;
    const worker = workers[this._lastRobinIndex % workers.length];
    this._lastRobinIndex++;
    return worker;
  }

  /**
   * Select worker with least active tasks
   */
  selectLeastLoaded(workers) {
    return workers.reduce((min, w) => 
      w.activeTasks < min.activeTasks ? w : min
    );
  }

  /**
   * Select worker based on performance metrics
   */
  selectByPerformance(workers) {
    return workers.reduce((best, w) => {
      const score = this.calculateWorkerScore(w);
      const bestScore = this.calculateWorkerScore(best);
      return score > bestScore ? w : best;
    });
  }

  /**
   * Calculate worker performance score
   */
  calculateWorkerScore(worker) {
    const completionRate = worker.completedTasks / (worker.completedTasks + worker.failedTasks + 1);
    const loadFactor = 1 - (worker.activeTasks / 5);
    const uptimeFactor = Math.min(worker.metrics.uptime / 3600000, 1); // Hours to ratio
    
    return (completionRate * 0.5) + (loadFactor * 0.3) + (uptimeFactor * 0.2);
  }

  /**
   * Assign task to specific worker
   */
  async assignTaskToWorker(task, worker) {
    worker.activeTasks++;
    worker.status = 'busy';
    
    this.activeTasks.set(task.id, {
      task: task,
      workerId: worker.id,
      startedAt: Date.now()
    });
    
    const message = {
      type: 'execute-task',
      task: task
    };
    
    if (worker.thread) {
      worker.thread.postMessage(message);
    } else if (worker.process) {
      worker.process.send(message);
    }
    
    // Set timeout
    setTimeout(() => {
      if (this.activeTasks.has(task.id)) {
        this.handleTaskTimeout(task.id);
      }
    }, task.timeout);
    
    this.emit('task-assigned', { taskId: task.id, workerId: worker.id });
  }

  /**
   * Handle worker messages
   */
  handleWorkerMessage(workerId, message) {
    const worker = this.workers.get(workerId);
    if (!worker) return;
    
    switch (message.type) {
      case 'task-completed':
        this.handleTaskCompleted(workerId, message.taskId, message.result);
        break;
      
      case 'task-failed':
        this.handleTaskFailed(workerId, message.taskId, message.error);
        break;
      
      case 'heartbeat':
        worker.lastHeartbeat = Date.now();
        if (message.metrics) {
          worker.metrics = { ...worker.metrics, ...message.metrics };
        }
        break;
      
      case 'log':
        this.emit('worker-log', { workerId, ...message.data });
        break;
    }
  }

  /**
   * Handle task completion
   */
  handleTaskCompleted(workerId, taskId, result) {
    const worker = this.workers.get(workerId);
    const activeTask = this.activeTasks.get(taskId);
    
    if (!worker || !activeTask) return;
    
    worker.activeTasks--;
    worker.completedTasks++;
    
    if (worker.activeTasks === 0) {
      worker.status = 'idle';
    }
    
    const executionTime = Date.now() - activeTask.startedAt;
    
    this.completedTasks.push({
      id: taskId,
      success: true,
      result: result,
      workerId: workerId,
      executionTime: executionTime,
      completedAt: Date.now()
    });
    
    this.activeTasks.delete(taskId);
    this.metrics.completedTasks++;
    
    // Update average execution time
    this.updateAverageExecutionTime(executionTime);
    
    this.emit('task-completed', { taskId, workerId, result, executionTime });
    
    // Try to assign more tasks
    this.assignTasks();
  }

  /**
   * Handle task failure
   */
  handleTaskFailed(workerId, taskId, error) {
    const worker = this.workers.get(workerId);
    const activeTask = this.activeTasks.get(taskId);
    
    if (!worker || !activeTask) return;
    
    worker.activeTasks--;
    worker.failedTasks++;
    
    if (worker.activeTasks === 0) {
      worker.status = 'idle';
    }
    
    const task = activeTask.task;
    task.retries++;
    
    // Retry if possible
    if (task.retries < task.maxRetries) {
      this.taskQueue.unshift(task); // Add to front of queue
      this.activeTasks.delete(taskId);
      this.emit('task-retry', { taskId, attempt: task.retries });
      this.assignTasks();
    } else {
      this.completedTasks.push({
        id: taskId,
        success: false,
        error: error,
        workerId: workerId,
        completedAt: Date.now()
      });
      
      this.activeTasks.delete(taskId);
      this.metrics.failedTasks++;
      
      this.emit('task-failed', { taskId, workerId, error });
    }
  }

  /**
   * Handle task timeout
   */
  handleTaskTimeout(taskId) {
    const activeTask = this.activeTasks.get(taskId);
    if (!activeTask) return;
    
    this.emit('task-timeout', { taskId, workerId: activeTask.workerId });
    this.handleTaskFailed(activeTask.workerId, taskId, 'Task timeout');
  }

  /**
   * Handle worker error
   */
  handleWorkerError(workerId, error) {
    const worker = this.workers.get(workerId);
    if (!worker) return;
    
    worker.status = 'error';
    this.emit('worker-error', { workerId, error });
    
    // Reassign tasks from this worker
    for (const [taskId, activeTask] of this.activeTasks) {
      if (activeTask.workerId === workerId) {
        this.taskQueue.unshift(activeTask.task);
        this.activeTasks.delete(taskId);
      }
    }
    
    // Restart worker
    this.restartWorker(workerId);
  }

  /**
   * Handle worker exit
   */
  handleWorkerExit(workerId, code, signal) {
    this.emit('worker-exit', { workerId, code, signal });
    
    // Reassign tasks
    for (const [taskId, activeTask] of this.activeTasks) {
      if (activeTask.workerId === workerId) {
        this.taskQueue.unshift(activeTask.task);
        this.activeTasks.delete(taskId);
      }
    }
    
    // Restart worker if needed
    if (code !== 0) {
      this.restartWorker(workerId);
    }
  }

  /**
   * Restart a worker
   */
  async restartWorker(workerId) {
    const worker = this.workers.get(workerId);
    if (!worker) return;
    
    if (worker.thread) {
      await worker.thread.terminate();
      await this.createWorker(workerId);
    }
    
    this.emit('worker-restarted', { workerId });
  }

  /**
   * Replace worker in cluster mode
   */
  replaceWorker(oldWorkerId, newWorker) {
    this.workers.delete(oldWorkerId);
    
    this.workers.set(newWorker.id, {
      id: newWorker.id,
      process: newWorker,
      status: 'idle',
      activeTasks: 0,
      completedTasks: 0,
      failedTasks: 0,
      lastHeartbeat: Date.now(),
      metrics: { cpu: 0, memory: 0, uptime: 0 }
    });
    
    newWorker.on('message', (msg) => this.handleWorkerMessage(newWorker.id, msg));
    newWorker.on('exit', (code, signal) => this.handleWorkerExit(newWorker.id, code, signal));
  }

  /**
   * Start health checks
   */
  startHealthChecks() {
    this.healthCheckInterval = setInterval(() => {
      this.performHealthChecks();
    }, this.config.healthCheckInterval);
  }

  /**
   * Perform health checks on all workers
   */
  performHealthChecks() {
    const now = Date.now();
    const timeout = this.config.healthCheckInterval * 2;
    
    for (const [workerId, worker] of this.workers) {
      const timeSinceHeartbeat = now - worker.lastHeartbeat;
      
      if (timeSinceHeartbeat > timeout) {
        console.log(`Worker ${workerId} failed health check`);
        this.handleWorkerError(workerId, new Error('Health check failed'));
      }
    }
    
    this.emit('health-check-completed', { workers: this.workers.size });
  }

  /**
   * Update average execution time
   */
  updateAverageExecutionTime(newTime) {
    const total = this.metrics.averageExecutionTime * (this.metrics.completedTasks - 1);
    this.metrics.averageExecutionTime = (total + newTime) / this.metrics.completedTasks;
  }

  /**
   * Get executor statistics
   */
  getStats() {
    const workerStats = Array.from(this.workers.values()).map(w => ({
      id: w.id,
      status: w.status,
      activeTasks: w.activeTasks,
      completedTasks: w.completedTasks,
      failedTasks: w.failedTasks,
      metrics: w.metrics
    }));
    
    return {
      ...this.metrics,
      queuedTasks: this.taskQueue.length,
      activeTasks: this.activeTasks.size,
      workers: workerStats,
      successRate: this.metrics.completedTasks / (this.metrics.completedTasks + this.metrics.failedTasks) || 0
    };
  }

  /**
   * Shutdown executor
   */
  async shutdown() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    
    // Wait for active tasks to complete or timeout
    const shutdownTimeout = 30000;
    const startTime = Date.now();
    
    while (this.activeTasks.size > 0 && (Date.now() - startTime) < shutdownTimeout) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Terminate all workers
    for (const worker of this.workers.values()) {
      if (worker.thread) {
        await worker.thread.terminate();
      } else if (worker.process) {
        worker.process.kill();
      }
    }
    
    this.workers.clear();
    this.emit('shutdown');
  }
}

module.exports = DistributedExecutor;
