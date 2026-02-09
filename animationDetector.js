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
 * Animation types
 * @enum {string}
 */
const AnimationType = {
    CSS_ANIMATION: 'css_animation',
    CSS_TRANSITION: 'css_transition',
    JS_ANIMATION: 'js_animation',
    LOADING_SPINNER: 'loading_spinner',
    PROGRESS_BAR: 'progress_bar',
    FADE: 'fade',
    SLIDE: 'slide',
    SCALE: 'scale',
    ROTATE: 'rotate',
    UNKNOWN: 'unknown'
};

/**
 * Loading state
 * @enum {string}
 */
const LoadingState = {
    IDLE: 'idle',
    LOADING: 'loading',
    TRANSITIONING: 'transitioning',
    COMPLETE: 'complete'
};

/**
 * Animation Detector for detecting animations and transitions
 * @class
 * @extends EventEmitter
 */
class AnimationDetector extends EventEmitter {
    /**
     * Create a new AnimationDetector instance
     * @param {Object} options - Configuration options
     * @param {number} [options.minDuration=100] - Minimum animation duration (ms)
     * @param {number} [options.maxDuration=5000] - Maximum expected animation duration (ms)
     * @param {number} [options.frameRateThreshold=30] - Minimum frame rate for smooth animation
     * @param {boolean} [options.detectLoading=true] - Enable loading detection
     */
    constructor(options = {}) {
        super();
        
        this.minDuration = options.minDuration || 100;
        this.maxDuration = options.maxDuration || 5000;
        this.frameRateThreshold = options.frameRateThreshold || 30;
        this.detectLoading = options.detectLoading !== undefined ? options.detectLoading : true;
        
        // Animation tracking
        this.activeAnimations = new Map();
        this.animationHistory = [];
        this.loadingState = LoadingState.IDLE;
        this.loadingStartTime = null;
        
        // Statistics
        this.stats = {
            totalAnimations: 0,
            byType: {},
            averageDuration: 0,
            totalDuration: 0,
            loadingDetections: 0
        };
        
        console.log('[AnimationDetector] Initialized');
    }
    
    /**
     * Analyze animations in current page state
     * @param {Object} data - Analysis data
     * @param {string} data.dom - Current DOM
     * @param {string} [data.screenshot] - Current screenshot
     * @param {string} [data.previousScreenshot] - Previous screenshot for comparison
     * @param {Object} [data.viewport] - Viewport information
     * @returns {Promise<Object>} Animation analysis results
     */
    async analyzeAnimations(data) {
        console.log('[AnimationDetector] Analyzing animations');
        
        const animations = [];
        
        // Detect CSS animations
        const cssAnimations = this.detectCssAnimations(data.dom);
        animations.push(...cssAnimations);
        
        // Detect loading indicators
        if (this.detectLoading) {
            const loadingIndicators = this.detectLoadingIndicators(data.dom);
            animations.push(...loadingIndicators);
        }
        
        // Detect visual animations through screenshot comparison
        if (data.screenshot && data.previousScreenshot) {
            const visualAnimations = await this.detectVisualAnimations(
                data.screenshot,
                data.previousScreenshot
            );
            animations.push(...visualAnimations);
        }
        
        // Update loading state
        this.updateLoadingState(animations);
        
        // Calculate overall animation activity
        const activity = this.calculateAnimationActivity(animations);
        
        const analysis = {
            animations: animations,
            activity: activity,
            loadingState: this.loadingState,
            isAnimating: animations.length > 0,
            shouldWait: this.shouldWaitForAnimations(animations),
            estimatedCompletionTime: this.estimateCompletionTime(animations)
        };
        
        // Update statistics
        this.updateStats(animations);
        
        console.log(`[AnimationDetector] Detected ${animations.length} animations, state: ${this.loadingState}`);
        this.emit('animations:analyzed', analysis);
        
        return analysis;
    }
    
    /**
     * Detect CSS animations from DOM
     * @private
     * @param {string} dom - DOM string
     * @returns {Array<Object>} Detected CSS animations
     */
    detectCssAnimations(dom) {
        const animations = [];
        
        // Look for animation-related class names
        const animationPatterns = [
            { pattern: /animate|animation|animated/i, type: AnimationType.CSS_ANIMATION },
            { pattern: /transition|transitioning/i, type: AnimationType.CSS_TRANSITION },
            { pattern: /fade|fading|fade-in|fade-out/i, type: AnimationType.FADE },
            { pattern: /slide|sliding|slide-in|slide-out/i, type: AnimationType.SLIDE },
            { pattern: /scale|scaling|zoom/i, type: AnimationType.SCALE },
            { pattern: /rotate|rotating|spin/i, type: AnimationType.ROTATE }
        ];
        
        for (const { pattern, type } of animationPatterns) {
            const regex = new RegExp(`class=["'][^"']*${pattern.source}[^"']*["']`, 'gi');
            let match;
            
            while ((match = regex.exec(dom)) !== null) {
                animations.push({
                    type: type,
                    detected: 'class-pattern',
                    confidence: 0.7,
                    estimatedDuration: this.estimateDurationFromType(type),
                    detectedAt: Date.now()
                });
                
                // Limit to prevent duplicate detections
                if (animations.length > 20) break;
            }
        }
        
        return animations;
    }
    
    /**
     * Detect loading indicators
     * @private
     * @param {string} dom - DOM string
     * @returns {Array<Object>} Detected loading indicators
     */
    detectLoadingIndicators(dom) {
        const indicators = [];
        
        // Spinner patterns
        const spinnerPatterns = [
            /loading|loader|spinner|spin/i,
            /progress|progressing/i,
            /waiting|wait/i,
            /busy/i
        ];
        
        for (const pattern of spinnerPatterns) {
            if (pattern.test(dom)) {
                indicators.push({
                    type: AnimationType.LOADING_SPINNER,
                    detected: 'spinner-pattern',
                    confidence: 0.8,
                    estimatedDuration: 2000,
                    detectedAt: Date.now()
                });
                break; // Only add one spinner detection
            }
        }
        
        // Progress bar patterns
        if (/progress-bar|progressbar|progress/i.test(dom)) {
            indicators.push({
                type: AnimationType.PROGRESS_BAR,
                detected: 'progress-pattern',
                confidence: 0.75,
                estimatedDuration: 3000,
                detectedAt: Date.now()
            });
        }
        
        // Skeleton loaders
        if (/skeleton|placeholder|loading-placeholder/i.test(dom)) {
            indicators.push({
                type: AnimationType.LOADING_SPINNER,
                detected: 'skeleton-pattern',
                confidence: 0.7,
                estimatedDuration: 2500,
                detectedAt: Date.now()
            });
        }
        
        return indicators;
    }
    
    /**
     * Detect visual animations through screenshot comparison
     * @private
     * @param {string} currentScreenshot - Current screenshot
     * @param {string} previousScreenshot - Previous screenshot
     * @returns {Promise<Array<Object>>} Detected visual animations
     */
    async detectVisualAnimations(currentScreenshot, previousScreenshot) {
        const animations = [];
        
        // Compare screenshots for significant changes
        // In production, would use Canvas API for pixel-level comparison
        
        if (currentScreenshot === previousScreenshot) {
            return animations;
        }
        
        // Estimate visual change (simplified)
        const changeDetected = currentScreenshot !== previousScreenshot;
        
        if (changeDetected) {
            animations.push({
                type: AnimationType.UNKNOWN,
                detected: 'visual-comparison',
                confidence: 0.5,
                estimatedDuration: 500,
                detectedAt: Date.now()
            });
        }
        
        return animations;
    }
    
    /**
     * Update loading state based on detected animations
     * @private
     * @param {Array<Object>} animations - Detected animations
     */
    updateLoadingState(animations) {
        const hasLoadingIndicators = animations.some(a => 
            a.type === AnimationType.LOADING_SPINNER || 
            a.type === AnimationType.PROGRESS_BAR
        );
        
        const previousState = this.loadingState;
        
        if (hasLoadingIndicators) {
            if (this.loadingState === LoadingState.IDLE) {
                this.loadingState = LoadingState.LOADING;
                this.loadingStartTime = Date.now();
                console.log('[AnimationDetector] Loading state started');
                this.emit('loading:started');
            }
        } else {
            if (this.loadingState === LoadingState.LOADING) {
                this.loadingState = LoadingState.COMPLETE;
                const duration = Date.now() - (this.loadingStartTime || Date.now());
                console.log(`[AnimationDetector] Loading completed after ${duration}ms`);
                this.emit('loading:completed', { duration });
            } else if (this.loadingState === LoadingState.COMPLETE) {
                this.loadingState = LoadingState.IDLE;
            }
        }
        
        if (animations.length > 0 && this.loadingState === LoadingState.IDLE) {
            this.loadingState = LoadingState.TRANSITIONING;
        }
        
        if (previousState !== this.loadingState) {
            this.emit('state:changed', { 
                from: previousState, 
                to: this.loadingState 
            });
        }
    }
    
    /**
     * Calculate animation activity level
     * @private
     * @param {Array<Object>} animations - Detected animations
     * @returns {Object} Activity analysis
     */
    calculateAnimationActivity(animations) {
        if (animations.length === 0) {
            return {
                level: 'none',
                score: 0,
                animationCount: 0
            };
        }
        
        const avgConfidence = animations.reduce((sum, a) => sum + a.confidence, 0) / animations.length;
        const activityScore = Math.min(1, animations.length * 0.1 + avgConfidence * 0.5);
        
        let level = 'low';
        if (activityScore > 0.7) level = 'high';
        else if (activityScore > 0.4) level = 'medium';
        
        return {
            level: level,
            score: activityScore,
            animationCount: animations.length
        };
    }
    
    /**
     * Determine if should wait for animations to complete
     * @private
     * @param {Array<Object>} animations - Detected animations
     * @returns {boolean} Should wait
     */
    shouldWaitForAnimations(animations) {
        // Wait if loading indicators present
        const hasLoading = animations.some(a => 
            a.type === AnimationType.LOADING_SPINNER || 
            a.type === AnimationType.PROGRESS_BAR
        );
        
        if (hasLoading) return true;
        
        // Wait if many animations active
        if (animations.length > 3) return true;
        
        // Wait if high confidence animations
        const highConfidenceAnimations = animations.filter(a => a.confidence > 0.8);
        if (highConfidenceAnimations.length > 1) return true;
        
        return false;
    }
    
    /**
     * Estimate completion time for active animations
     * @private
     * @param {Array<Object>} animations - Detected animations
     * @returns {number} Estimated completion time in milliseconds
     */
    estimateCompletionTime(animations) {
        if (animations.length === 0) {
            return 0;
        }
        
        // Find longest estimated duration
        const maxDuration = Math.max(...animations.map(a => a.estimatedDuration || 0));
        
        // Add safety margin
        return maxDuration * 1.2;
    }
    
    /**
     * Estimate duration from animation type
     * @private
     * @param {string} type - Animation type
     * @returns {number} Estimated duration in milliseconds
     */
    estimateDurationFromType(type) {
        const durations = {
            [AnimationType.CSS_ANIMATION]: 500,
            [AnimationType.CSS_TRANSITION]: 300,
            [AnimationType.JS_ANIMATION]: 600,
            [AnimationType.LOADING_SPINNER]: 2000,
            [AnimationType.PROGRESS_BAR]: 3000,
            [AnimationType.FADE]: 300,
            [AnimationType.SLIDE]: 400,
            [AnimationType.SCALE]: 250,
            [AnimationType.ROTATE]: 500
        };
        
        return durations[type] || 500;
    }
    
    /**
     * Check if page is currently loading
     * @returns {boolean} Is loading
     */
    isPageLoading() {
        return this.loadingState === LoadingState.LOADING;
    }
    
    /**
     * Check if page is transitioning
     * @returns {boolean} Is transitioning
     */
    isPageTransitioning() {
        return this.loadingState === LoadingState.TRANSITIONING;
    }
    
    /**
     * Get current loading state
     * @returns {string} Loading state
     */
    getLoadingState() {
        return this.loadingState;
    }
    
    /**
     * Track animation completion
     * @param {string} animationId - Animation ID
     * @param {number} actualDuration - Actual duration in milliseconds
     */
    trackAnimationCompletion(animationId, actualDuration) {
        const animation = this.activeAnimations.get(animationId);
        
        if (!animation) {
            console.warn(`[AnimationDetector] Animation ${animationId} not found`);
            return;
        }
        
        animation.actualDuration = actualDuration;
        animation.completedAt = Date.now();
        
        // Move to history
        this.animationHistory.push(animation);
        this.activeAnimations.delete(animationId);
        
        // Limit history size
        if (this.animationHistory.length > 100) {
            this.animationHistory.shift();
        }
        
        console.log(`[AnimationDetector] Animation ${animationId} completed in ${actualDuration}ms`);
        this.emit('animation:completed', { animationId, actualDuration });
    }
    
    /**
     * Analyze frame rate from state changes
     * @param {Array<Object>} stateHistory - Recent state history
     * @returns {Object} Frame rate analysis
     */
    analyzeFrameRate(stateHistory) {
        if (stateHistory.length < 2) {
            return {
                fps: 0,
                smooth: false,
                reason: 'Insufficient data'
            };
        }
        
        const timestamps = stateHistory.map(s => s.timestamp);
        const intervals = [];
        
        for (let i = 1; i < timestamps.length; i++) {
            intervals.push(timestamps[i] - timestamps[i - 1]);
        }
        
        const avgInterval = intervals.reduce((sum, i) => sum + i, 0) / intervals.length;
        const fps = avgInterval > 0 ? 1000 / avgInterval : 0;
        
        return {
            fps: fps.toFixed(2),
            smooth: fps >= this.frameRateThreshold,
            averageInterval: avgInterval.toFixed(2),
            reason: fps >= this.frameRateThreshold ? 'Smooth animation' : 'Low frame rate'
        };
    }
    
    /**
     * Predict when current animations will complete
     * @returns {Object} Completion prediction
     */
    predictCompletion() {
        if (this.activeAnimations.size === 0) {
            return {
                willComplete: true,
                estimatedTime: 0,
                confidence: 1.0
            };
        }
        
        const now = Date.now();
        let maxCompletion = 0;
        
        for (const animation of this.activeAnimations.values()) {
            const elapsed = now - animation.detectedAt;
            const remaining = animation.estimatedDuration - elapsed;
            maxCompletion = Math.max(maxCompletion, remaining);
        }
        
        return {
            willComplete: true,
            estimatedTime: Math.max(0, maxCompletion),
            confidence: 0.7,
            activeCount: this.activeAnimations.size
        };
    }
    
    /**
     * Wait for animations to complete
     * @param {number} [timeout=5000] - Maximum wait time in milliseconds
     * @returns {Promise<boolean>} True if animations completed, false if timeout
     */
    async waitForCompletion(timeout = 5000) {
        const startTime = Date.now();
        
        console.log('[AnimationDetector] Waiting for animations to complete');
        
        while (this.loadingState !== LoadingState.IDLE && 
               this.loadingState !== LoadingState.COMPLETE) {
            
            if (Date.now() - startTime > timeout) {
                console.warn('[AnimationDetector] Wait timeout reached');
                return false;
            }
            
            await this.sleep(100);
        }
        
        const duration = Date.now() - startTime;
        console.log(`[AnimationDetector] Animations completed after ${duration}ms`);
        
        return true;
    }
    
    /**
     * Update statistics
     * @private
     * @param {Array<Object>} animations - Detected animations
     */
    updateStats(animations) {
        this.stats.totalAnimations += animations.length;
        
        for (const animation of animations) {
            const type = animation.type;
            this.stats.byType[type] = (this.stats.byType[type] || 0) + 1;
            
            if (animation.estimatedDuration) {
                this.stats.totalDuration += animation.estimatedDuration;
            }
            
            if (type === AnimationType.LOADING_SPINNER || type === AnimationType.PROGRESS_BAR) {
                this.stats.loadingDetections++;
            }
        }
        
        const completedCount = this.stats.totalAnimations;
        if (completedCount > 0) {
            this.stats.averageDuration = this.stats.totalDuration / completedCount;
        }
    }
    
    /**
     * Get detector statistics
     * @returns {Object} Statistics
     */
    getStats() {
        return {
            ...this.stats,
            averageDuration: this.stats.averageDuration.toFixed(2) + 'ms',
            activeAnimations: this.activeAnimations.size,
            historySize: this.animationHistory.length,
            currentState: this.loadingState
        };
    }
    
    /**
     * Sleep utility
     * @private
     * @param {number} ms - Milliseconds to sleep
     * @returns {Promise<void>}
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    /**
     * Clear animation history
     */
    clearHistory() {
        const size = this.animationHistory.length;
        this.animationHistory = [];
        console.log(`[AnimationDetector] Cleared ${size} animation records`);
    }
    
    /**
     * Reset detector state
     */
    reset() {
        console.log('[AnimationDetector] Resetting detector');
        
        this.activeAnimations.clear();
        this.animationHistory = [];
        this.loadingState = LoadingState.IDLE;
        this.loadingStartTime = null;
        
        this.emit('detector:reset');
    }
}

module.exports = { AnimationDetector, AnimationType, LoadingState };
