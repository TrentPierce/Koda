/**
 * ============================================================================
 * TASK ORCHESTRATOR - Parallel Analysis Coordination
 * ============================================================================
 * 
 * Orchestrates parallel DOM and vision analysis tasks using worker threads
 * and job queues. Manages task lifecycle, priority scheduling, error handling,
 * and result aggregation for multiple concurrent analysis operations.
 * 
 * FEATURES:
 * - Worker thread pool management
 * - Parallel task execution with priority scheduling
 * - Task cancellation and timeout handling
 * - Error recovery and retry mechanisms
 * - Result aggregation and reconciliation
 * - Performance monitoring and statistics
 * 
 * USAGE:
 * const orchestrator = new TaskOrchestrator({ maxWorkers: 4 });
 * const result = await orchestrator.executeParallelAnalysis({
 *   dom: domData,
 *   screenshot: imageData,
 *   goal: userGoal
 * });
 * 
 * ============================================================================
 */

const { Worker } = require('worker_threads');
const EventEmitter = require('events');
const path = require('path');
const { JobQueue, Priority } = require('./jobQueue');
const { ResultReconciliator } = require('./resultReconciliator');

/**
 * Task types
 * @enum {string}
 */
const TaskType = {
    DOM_ANALYSIS: 'dom_analysis',
    VISION_ANALYSIS: 'vision_analysis',
    PATTERN_MATCHING: 'pattern_matching',
    LEARNING_INFERENCE: 'learning_inference',
    COMBINED_ANALYSIS: 'combined_analysis'
};

/**
 * Task status
 * @enum {string}
 */
const TaskStatus = {
    PENDING: 'pending',
    RUNNING: 'running',
    COMPLETED: 'completed',
    FAILED: 'failed',
    CANCELLED: 'cancelled',
    TIMEOUT: 'timeout'
};

/**
 * Worker pool for managing worker threads
 * @class
 * @private
 */
class WorkerPool {
    /**
     * Create a worker pool
     * @param {number} maxWorkers - Maximum number of workers
     * @param {string} workerScript - Path to worker script
     */
    constructor(maxWorkers, workerScript) {
        this.maxWorkers = maxWorkers;
        this.workerScript = workerScript;
        this.workers = [];
        this.availableWorkers = [];
        this.busyWorkers = new Set();
        
        console.log(`[WorkerPool] Initializing pool with ${maxWorkers} workers`);
    }
    
    /**
     * Initialize worker pool
     */
    initialize() {
        for (let i = 0; i < this.maxWorkers; i++) {
            const worker = this.createWorker();
            this.workers.push(worker);
            this.availableWorkers.push(worker);
        }
        
        console.log(`[WorkerPool] Pool initialized with ${this.workers.length} workers`);
    }
    
    /**
     * Create a new worker
     * @private
     * @returns {Worker} Worker instance
     */
    createWorker() {
        // Note: Worker script would need to be created separately
        // For now, we'll use a placeholder approach
        const worker = {
            id: crypto.randomUUID(),
            isAvailable: true,
            currentTask: null
        };
        
        return worker;
    }
    
    /**
     * Get an available worker
     * @returns {Object|null} Available worker or null
     */
    getAvailableWorker() {
        if (this.availableWorkers.length === 0) {
            return null;
        }
        
        const worker = this.availableWorkers.shift();
        this.busyWorkers.add(worker.id);
        worker.isAvailable = false;
        
        return worker;
    }
    
    /**
     * Release a worker back to the pool
     * @param {Object} worker - Worker to release
     */
    releaseWorker(worker) {
        worker.isAvailable = true;
        worker.currentTask = null;
        this.busyWorkers.delete(worker.id);
        this.availableWorkers.push(worker);
    }
    
    /**
     * Get pool statistics
     * @returns {Object} Pool stats
     */
    getStats() {
        return {
            totalWorkers: this.workers.length,
            availableWorkers: this.availableWorkers.length,
            busyWorkers: this.busyWorkers.size
        };
    }
    
    /**
     * Terminate all workers
     */
    terminate() {
        console.log('[WorkerPool] Terminating all workers');
        
        for (const worker of this.workers) {
            if (worker.terminate) {
                worker.terminate();
            }
        }
        
        this.workers = [];
        this.availableWorkers = [];
        this.busyWorkers.clear();
    }
}

/**
 * Task Orchestrator for parallel analysis coordination
 * @class
 * @extends EventEmitter
 */
class TaskOrchestrator extends EventEmitter {
    /**
     * Create a new TaskOrchestrator instance
     * @param {Object} options - Configuration options
     * @param {number} [options.maxWorkers=4] - Maximum worker threads
     * @param {number} [options.maxConcurrent=3] - Maximum concurrent tasks
     * @param {number} [options.taskTimeout=30000] - Task timeout in milliseconds
     * @param {boolean} [options.enableWorkers=false] - Enable worker threads (experimental)
     * @param {Object} [options.reconciliatorOptions] - Options for result reconciliator
     */
    constructor(options = {}) {
        super();
        
        this.maxWorkers = options.maxWorkers || 4;
        this.maxConcurrent = options.maxConcurrent || 3;
        this.taskTimeout = options.taskTimeout || 30000;
        this.enableWorkers = options.enableWorkers || false;
        
        // Initialize job queue
        this.jobQueue = new JobQueue({
            maxConcurrent: this.maxConcurrent,
            maxRetries: 2,
            retryDelay: 1000
        });
        
        // Initialize result reconciliator
        this.reconciliator = new ResultReconciliator(options.reconciliatorOptions || {});
        
        // Initialize worker pool if enabled
        this.workerPool = null;
        if (this.enableWorkers) {
            this.workerPool = new WorkerPool(this.maxWorkers, './analysisWorker.js');
            this.workerPool.initialize();
        }
        
        // Task tracking
        this.tasks = new Map();
        this.activeAnalyses = new Map();
        
        // Statistics
        this.stats = {
            totalTasks: 0,
            completedTasks: 0,
            failedTasks: 0,
            cancelledTasks: 0,
            averageExecutionTime: 0,
            totalExecutionTime: 0
        };
        
        // Set up event listeners
        this.setupEventListeners();
        
        console.log('[TaskOrchestrator] Initialized');
    }
    
    /**
     * Set up event listeners for job queue
     * @private
     */
    setupEventListeners() {
        this.jobQueue.on('job:completed', ({ jobId, result, duration }) => {
            this.emit('task:completed', { taskId: jobId, result, duration });
        });
        
        this.jobQueue.on('job:failed', ({ jobId, error }) => {
            this.emit('task:failed', { taskId: jobId, error });
        });
        
        this.jobQueue.on('job:cancelled', ({ jobId }) => {
            this.emit('task:cancelled', { taskId: jobId });
        });
    }
    
    /**
     * Execute parallel analysis of DOM and vision data
     * @param {Object} analysisData - Data for analysis
     * @param {string} analysisData.dom - Simplified DOM string
     * @param {string} analysisData.screenshot - Base64 screenshot
     * @param {string} analysisData.goal - User goal
     * @param {Object} analysisData.context - Additional context
     * @param {Object} options - Analysis options
     * @param {Array<string>} [options.analysisTypes] - Types of analysis to run
     * @param {string} [options.priority] - Task priority
     * @returns {Promise<Object>} Reconciled analysis result
     */
    async executeParallelAnalysis(analysisData, options = {}) {
        const analysisId = crypto.randomUUID();
        const startTime = Date.now();
        
        console.log(`[TaskOrchestrator] Starting parallel analysis ${analysisId}`);
        
        // Default analysis types
        const analysisTypes = options.analysisTypes || [
            TaskType.DOM_ANALYSIS,
            TaskType.VISION_ANALYSIS
        ];
        
        const priority = options.priority || Priority.MEDIUM;
        
        // Create analysis tasks
        const taskPromises = [];
        const taskIds = [];
        
        for (const analysisType of analysisTypes) {
            const taskId = await this.createAnalysisTask(
                analysisType,
                analysisData,
                { priority, timeout: this.taskTimeout }
            );
            
            taskIds.push(taskId);
            taskPromises.push(this.jobQueue.waitForJob(taskId));
        }
        
        // Store active analysis
        this.activeAnalyses.set(analysisId, {
            id: analysisId,
            taskIds: taskIds,
            startTime: startTime,
            status: 'running'
        });
        
        try {
            // Wait for all tasks to complete
            const results = await Promise.allSettled(taskPromises);
            
            // Extract successful results
            const successfulResults = [];
            const failedTasks = [];
            
            results.forEach((result, index) => {
                if (result.status === 'fulfilled' && result.value) {
                    successfulResults.push(result.value);
                } else {
                    failedTasks.push({
                        taskId: taskIds[index],
                        reason: result.reason?.message || 'Unknown error'
                    });
                }
            });
            
            if (failedTasks.length > 0) {
                console.warn(`[TaskOrchestrator] ${failedTasks.length} tasks failed:`, failedTasks);
            }
            
            // Reconcile results
            let reconciledResult;
            
            if (successfulResults.length === 0) {
                throw new Error('All analysis tasks failed');
            } else if (successfulResults.length === 1) {
                reconciledResult = successfulResults[0];
                reconciledResult.confidence = reconciledResult.confidence || 0.7;
            } else {
                reconciledResult = await this.reconciliator.reconcile(
                    successfulResults,
                    { context: analysisData.context }
                );
            }
            
            // Update statistics
            const duration = Date.now() - startTime;
            this.updateStats(duration, true);
            
            // Update active analysis
            const analysis = this.activeAnalyses.get(analysisId);
            if (analysis) {
                analysis.status = 'completed';
                analysis.duration = duration;
                analysis.result = reconciledResult;
            }
            
            console.log(`[TaskOrchestrator] Parallel analysis ${analysisId} completed in ${duration}ms`);
            this.emit('analysis:completed', { analysisId, result: reconciledResult, duration });
            
            return reconciledResult;
            
        } catch (error) {
            console.error(`[TaskOrchestrator] Parallel analysis ${analysisId} failed:`, error.message);
            
            const duration = Date.now() - startTime;
            this.updateStats(duration, false);
            
            const analysis = this.activeAnalyses.get(analysisId);
            if (analysis) {
                analysis.status = 'failed';
                analysis.duration = duration;
                analysis.error = error.message;
            }
            
            this.emit('analysis:failed', { analysisId, error });
            
            throw error;
        }
    }
    
    /**
     * Create an analysis task
     * @private
     * @param {string} taskType - Type of analysis task
     * @param {Object} data - Analysis data
     * @param {Object} options - Task options
     * @returns {Promise<string>} Task ID
     */
    async createAnalysisTask(taskType, data, options = {}) {
        this.stats.totalTasks++;
        
        // Create task function based on type
        const taskFn = this.createTaskFunction(taskType, data);
        
        // Add task to job queue
        const taskId = this.jobQueue.addJob(
            taskFn,
            [],
            {
                priority: options.priority || Priority.MEDIUM,
                timeout: options.timeout || this.taskTimeout,
                metadata: {
                    taskType: taskType,
                    createdAt: Date.now()
                }
            }
        );
        
        // Track task
        this.tasks.set(taskId, {
            id: taskId,
            type: taskType,
            status: TaskStatus.PENDING,
            createdAt: Date.now()
        });
        
        console.log(`[TaskOrchestrator] Created ${taskType} task ${taskId}`);
        
        return taskId;
    }
    
    /**
     * Create task function for specific analysis type
     * @private
     * @param {string} taskType - Task type
     * @param {Object} data - Analysis data
     * @returns {Function} Async task function
     */
    createTaskFunction(taskType, data) {
        switch (taskType) {
            case TaskType.DOM_ANALYSIS:
                return async () => this.executeDomAnalysis(data);
                
            case TaskType.VISION_ANALYSIS:
                return async () => this.executeVisionAnalysis(data);
                
            case TaskType.PATTERN_MATCHING:
                return async () => this.executePatternMatching(data);
                
            case TaskType.LEARNING_INFERENCE:
                return async () => this.executeLearningInference(data);
                
            default:
                throw new Error(`Unknown task type: ${taskType}`);
        }
    }
    
    /**
     * Execute DOM analysis
     * @private
     * @param {Object} data - Analysis data
     * @returns {Promise<Object>} Analysis result
     */
    async executeDomAnalysis(data) {
        console.log('[TaskOrchestrator] Executing DOM analysis');
        
        // Simulate DOM analysis (would be replaced with actual implementation)
        await this.simulateWork(1000);
        
        // Parse DOM and extract actionable elements
        const elementCount = (data.dom.match(/data-agent-id/g) || []).length;
        const hasPopups = data.dom.includes('[IN-POPUP]') || data.dom.includes('[COOKIE-BANNER]');
        const hasDecoys = data.dom.includes('[DECOY]');
        
        // Basic heuristic analysis
        let action = 'wait';
        let confidence = 0.6;
        let selector = null;
        let reason = 'DOM analysis';
        
        if (hasPopups) {
            const popupMatch = data.dom.match(/<button[^>]*id="(\d+)"[^>]*>\[COOKIE-BANNER\]Accept/i);
            if (popupMatch) {
                action = 'click';
                selector = `[data-agent-id='${popupMatch[1]}']`;
                reason = 'Close cookie banner';
                confidence = 0.9;
            }
        }
        
        return {
            source: 'dom',
            action: action,
            selector: selector,
            confidence: confidence,
            reason: reason,
            metadata: {
                elementCount: elementCount,
                hasPopups: hasPopups,
                hasDecoys: hasDecoys
            }
        };
    }
    
    /**
     * Execute vision analysis
     * @private
     * @param {Object} data - Analysis data
     * @returns {Promise<Object>} Analysis result
     */
    async executeVisionAnalysis(data) {
        console.log('[TaskOrchestrator] Executing vision analysis');
        
        // Simulate vision analysis (would use Gemini vision model)
        await this.simulateWork(1500);
        
        // Placeholder analysis result
        return {
            source: 'vision',
            action: 'scroll',
            confidence: 0.7,
            reason: 'Vision analysis suggests scrolling',
            metadata: {
                hasScreenshot: !!data.screenshot
            }
        };
    }
    
    /**
     * Execute pattern matching
     * @private
     * @param {Object} data - Analysis data
     * @returns {Promise<Object>} Analysis result
     */
    async executePatternMatching(data) {
        console.log('[TaskOrchestrator] Executing pattern matching');
        
        await this.simulateWork(500);
        
        return {
            source: 'pattern',
            action: 'click',
            confidence: 0.75,
            reason: 'Pattern matching result',
            metadata: {}
        };
    }
    
    /**
     * Execute learning inference
     * @private
     * @param {Object} data - Analysis data
     * @returns {Promise<Object>} Analysis result
     */
    async executeLearningInference(data) {
        console.log('[TaskOrchestrator] Executing learning inference');
        
        await this.simulateWork(800);
        
        return {
            source: 'learning',
            action: 'type',
            confidence: 0.65,
            reason: 'Learning-based inference',
            metadata: {}
        };
    }
    
    /**
     * Simulate work for testing
     * @private
     * @param {number} duration - Duration in milliseconds
     * @returns {Promise<void>}
     */
    async simulateWork(duration) {
        return new Promise(resolve => setTimeout(resolve, duration));
    }
    
    /**
     * Cancel an active analysis
     * @param {string} analysisId - Analysis ID to cancel
     * @returns {boolean} True if cancelled successfully
     */
    cancelAnalysis(analysisId) {
        const analysis = this.activeAnalyses.get(analysisId);
        
        if (!analysis) {
            console.warn(`[TaskOrchestrator] Analysis ${analysisId} not found`);
            return false;
        }
        
        if (analysis.status !== 'running') {
            console.warn(`[TaskOrchestrator] Analysis ${analysisId} is not running`);
            return false;
        }
        
        console.log(`[TaskOrchestrator] Cancelling analysis ${analysisId}`);
        
        // Cancel all associated tasks
        let cancelledCount = 0;
        for (const taskId of analysis.taskIds) {
            if (this.jobQueue.cancelJob(taskId)) {
                cancelledCount++;
            }
        }
        
        analysis.status = 'cancelled';
        this.stats.cancelledTasks += cancelledCount;
        
        this.emit('analysis:cancelled', { analysisId, cancelledTasks: cancelledCount });
        
        return true;
    }
    
    /**
     * Cancel a specific task
     * @param {string} taskId - Task ID to cancel
     * @returns {boolean} True if cancelled successfully
     */
    cancelTask(taskId) {
        const task = this.tasks.get(taskId);
        
        if (!task) {
            console.warn(`[TaskOrchestrator] Task ${taskId} not found`);
            return false;
        }
        
        const result = this.jobQueue.cancelJob(taskId);
        
        if (result) {
            task.status = TaskStatus.CANCELLED;
            this.stats.cancelledTasks++;
        }
        
        return result;
    }
    
    /**
     * Get task status
     * @param {string} taskId - Task ID
     * @returns {Object|null} Task status
     */
    getTaskStatus(taskId) {
        const jobStatus = this.jobQueue.getJobStatus(taskId);
        const task = this.tasks.get(taskId);
        
        if (!jobStatus || !task) {
            return null;
        }
        
        return {
            ...jobStatus,
            type: task.type
        };
    }
    
    /**
     * Get analysis status
     * @param {string} analysisId - Analysis ID
     * @returns {Object|null} Analysis status
     */
    getAnalysisStatus(analysisId) {
        const analysis = this.activeAnalyses.get(analysisId);
        
        if (!analysis) {
            return null;
        }
        
        const taskStatuses = analysis.taskIds.map(taskId => this.getTaskStatus(taskId));
        
        return {
            ...analysis,
            tasks: taskStatuses
        };
    }
    
    /**
     * Update statistics
     * @private
     * @param {number} duration - Task duration
     * @param {boolean} success - Whether task succeeded
     */
    updateStats(duration, success) {
        if (success) {
            this.stats.completedTasks++;
        } else {
            this.stats.failedTasks++;
        }
        
        this.stats.totalExecutionTime += duration;
        this.stats.averageExecutionTime = 
            this.stats.totalExecutionTime / (this.stats.completedTasks + this.stats.failedTasks);
    }
    
    /**
     * Get orchestrator statistics
     * @returns {Object} Statistics
     */
    getStats() {
        const queueStats = this.jobQueue.getStats();
        const reconciliatorStats = this.reconciliator.getStats();
        const workerStats = this.workerPool ? this.workerPool.getStats() : null;
        
        return {
            orchestrator: {
                ...this.stats,
                activeAnalyses: this.activeAnalyses.size,
                activeTasks: this.tasks.size
            },
            queue: queueStats,
            reconciliator: reconciliatorStats,
            workers: workerStats
        };
    }
    
    /**
     * Cleanup old completed analyses and tasks
     * @param {number} maxAge - Maximum age in milliseconds
     * @returns {number} Number of items cleaned up
     */
    cleanup(maxAge = 3600000) {
        const now = Date.now();
        let count = 0;
        
        // Cleanup old analyses
        for (const [analysisId, analysis] of this.activeAnalyses.entries()) {
            if (analysis.status !== 'running' && 
                analysis.startTime && 
                (now - analysis.startTime) > maxAge) {
                this.activeAnalyses.delete(analysisId);
                count++;
            }
        }
        
        // Cleanup old tasks
        for (const [taskId, task] of this.tasks.entries()) {
            if (task.createdAt && (now - task.createdAt) > maxAge) {
                this.tasks.delete(taskId);
                count++;
            }
        }
        
        // Cleanup job queue
        count += this.jobQueue.cleanup(maxAge);
        
        if (count > 0) {
            console.log(`[TaskOrchestrator] Cleaned up ${count} old items`);
        }
        
        return count;
    }
    
    /**
     * Destroy orchestrator and cleanup resources
     */
    destroy() {
        console.log('[TaskOrchestrator] Destroying orchestrator');
        
        // Cancel all active analyses
        for (const analysisId of this.activeAnalyses.keys()) {
            this.cancelAnalysis(analysisId);
        }
        
        // Destroy job queue
        this.jobQueue.destroy();
        
        // Terminate worker pool
        if (this.workerPool) {
            this.workerPool.terminate();
        }
        
        // Clear data structures
        this.tasks.clear();
        this.activeAnalyses.clear();
        
        // Remove listeners
        this.removeAllListeners();
        
        console.log('[TaskOrchestrator] Destroyed');
    }
}

module.exports = { 
    TaskOrchestrator, 
    TaskType, 
    TaskStatus 
};
