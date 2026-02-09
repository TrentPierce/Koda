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
 * Change types detected by state tracker
 * @enum {string}
 */
const ChangeType = {
    VISUAL: 'visual',
    DOM: 'dom',
    URL: 'url',
    SCROLL: 'scroll',
    VIEWPORT: 'viewport',
    NONE: 'none'
};

/**
 * State comparison result
 * @typedef {Object} StateComparison
 * @property {Array<string>} changeTypes - Types of changes detected
 * @property {number} magnitude - Overall change magnitude (0-1)
 * @property {Object} details - Detailed change information
 */

/**
 * State Tracker for monitoring page state changes
 * @class
 * @extends EventEmitter
 */
class StateTracker extends EventEmitter {
    /**
     * Create a new StateTracker instance
     * @param {Object} options - Configuration options
     * @param {number} [options.maxHistory=50] - Maximum state history to retain
     * @param {number} [options.visualThreshold=0.05] - Visual change threshold (0-1)
     * @param {number} [options.domThreshold=0.1] - DOM change threshold (0-1)
     * @param {number} [options.scrollThreshold=50] - Scroll change threshold (pixels)
     * @param {boolean} [options.enableDiffing=true] - Enable screenshot differencing
     */
    constructor(options = {}) {
        super();
        
        this.maxHistory = options.maxHistory || 50;
        this.visualThreshold = options.visualThreshold || 0.05;
        this.domThreshold = options.domThreshold || 0.1;
        this.scrollThreshold = options.scrollThreshold || 50;
        this.enableDiffing = options.enableDiffing !== undefined ? options.enableDiffing : true;
        
        // State storage
        this.stateHistory = [];
        this.currentState = null;
        this.previousState = null;
        
        // Statistics
        this.stats = {
            totalStates: 0,
            totalChanges: 0,
            changesByType: {},
            averageChangeMagnitude: 0,
            totalChangeMagnitude: 0
        };
        
        console.log('[StateTracker] Initialized with maxHistory:', this.maxHistory);
    }
    
    /**
     * Capture current page state
     * @param {Object} state - State data
     * @param {string} state.dom - Simplified DOM
     * @param {string} state.screenshot - Base64 screenshot
     * @param {string} state.url - Current URL
     * @param {Object} state.viewport - Viewport information
     * @param {Object} [state.metadata] - Additional metadata
     * @returns {string} State ID
     */
    captureState(state) {
        const stateId = crypto.randomUUID();
        const timestamp = Date.now();
        
        // Create state snapshot
        const snapshot = {
            id: stateId,
            timestamp: timestamp,
            url: state.url,
            dom: state.dom,
            domHash: this.hashString(state.dom),
            screenshot: state.screenshot,
            screenshotHash: state.screenshot ? this.hashString(state.screenshot) : null,
            viewport: {
                width: state.viewport?.width || 0,
                height: state.viewport?.height || 0,
                scrollY: state.viewport?.scrollY || 0,
                scrollX: state.viewport?.scrollX || 0
            },
            metadata: state.metadata || {}
        };
        
        // Update state references
        this.previousState = this.currentState;
        this.currentState = snapshot;
        
        // Add to history
        this.stateHistory.push(snapshot);
        
        // Trim history if needed
        if (this.stateHistory.length > this.maxHistory) {
            const removed = this.stateHistory.shift();
            console.log(`[StateTracker] Removed old state ${removed.id} from history`);
        }
        
        this.stats.totalStates++;
        
        console.log(`[StateTracker] Captured state ${stateId} (history: ${this.stateHistory.length})`);
        this.emit('state:captured', { stateId, timestamp });
        
        return stateId;
    }
    
    /**
     * Detect changes between current and previous state
     * @returns {StateComparison|null} Change detection results
     */
    detectChanges() {
        if (!this.currentState || !this.previousState) {
            console.log('[StateTracker] Insufficient state history for comparison');
            return null;
        }
        
        console.log('[StateTracker] Detecting changes between states');
        
        const changes = {
            changeTypes: [],
            magnitude: 0,
            details: {}
        };
        
        // URL change detection
        const urlChange = this.detectUrlChange();
        if (urlChange.changed) {
            changes.changeTypes.push(ChangeType.URL);
            changes.details.url = urlChange;
            changes.magnitude += 0.3;
        }
        
        // DOM change detection
        const domChange = this.detectDomChange();
        if (domChange.changed) {
            changes.changeTypes.push(ChangeType.DOM);
            changes.details.dom = domChange;
            changes.magnitude += domChange.magnitude * 0.4;
        }
        
        // Visual change detection
        if (this.enableDiffing && this.currentState.screenshot && this.previousState.screenshot) {
            const visualChange = this.detectVisualChange();
            if (visualChange.changed) {
                changes.changeTypes.push(ChangeType.VISUAL);
                changes.details.visual = visualChange;
                changes.magnitude += visualChange.magnitude * 0.2;
            }
        }
        
        // Scroll change detection
        const scrollChange = this.detectScrollChange();
        if (scrollChange.changed) {
            changes.changeTypes.push(ChangeType.SCROLL);
            changes.details.scroll = scrollChange;
            changes.magnitude += 0.05;
        }
        
        // Viewport change detection
        const viewportChange = this.detectViewportChange();
        if (viewportChange.changed) {
            changes.changeTypes.push(ChangeType.VIEWPORT);
            changes.details.viewport = viewportChange;
            changes.magnitude += 0.05;
        }
        
        // Normalize magnitude to 0-1
        changes.magnitude = Math.min(1, changes.magnitude);
        
        // Update statistics
        if (changes.changeTypes.length > 0) {
            this.stats.totalChanges++;
            this.stats.totalChangeMagnitude += changes.magnitude;
            this.stats.averageChangeMagnitude = 
                this.stats.totalChangeMagnitude / this.stats.totalChanges;
            
            for (const type of changes.changeTypes) {
                this.stats.changesByType[type] = (this.stats.changesByType[type] || 0) + 1;
            }
            
            console.log(`[StateTracker] Detected ${changes.changeTypes.length} change types with magnitude ${changes.magnitude.toFixed(3)}`);
            this.emit('changes:detected', changes);
        } else {
            changes.changeTypes.push(ChangeType.NONE);
            console.log('[StateTracker] No significant changes detected');
        }
        
        return changes;
    }
    
    /**
     * Detect URL changes
     * @private
     * @returns {Object} URL change details
     */
    detectUrlChange() {
        const prevUrl = this.previousState.url;
        const currUrl = this.currentState.url;
        
        if (prevUrl === currUrl) {
            return { changed: false };
        }
        
        // Determine type of URL change
        const prevParsed = this.parseUrl(prevUrl);
        const currParsed = this.parseUrl(currUrl);
        
        let changeType = 'navigation';
        if (prevParsed.origin !== currParsed.origin) {
            changeType = 'domain-change';
        } else if (prevParsed.pathname !== currParsed.pathname) {
            changeType = 'page-change';
        } else if (prevParsed.hash !== currParsed.hash) {
            changeType = 'hash-change';
        } else if (prevParsed.search !== currParsed.search) {
            changeType = 'query-change';
        }
        
        return {
            changed: true,
            type: changeType,
            from: prevUrl,
            to: currUrl
        };
    }
    
    /**
     * Detect DOM changes
     * @private
     * @returns {Object} DOM change details
     */
    detectDomChange() {
        const prevDom = this.previousState.dom;
        const currDom = this.currentState.dom;
        const prevHash = this.previousState.domHash;
        const currHash = this.currentState.domHash;
        
        // Quick hash comparison
        if (prevHash === currHash) {
            return { changed: false, magnitude: 0 };
        }
        
        // Calculate DOM difference
        const diff = this.calculateDomDifference(prevDom, currDom);
        
        if (diff.magnitude < this.domThreshold) {
            return { changed: false, magnitude: diff.magnitude };
        }
        
        return {
            changed: true,
            magnitude: diff.magnitude,
            addedElements: diff.added,
            removedElements: diff.removed,
            modifiedElements: diff.modified
        };
    }
    
    /**
     * Detect visual changes through screenshot differencing
     * @private
     * @returns {Object} Visual change details
     */
    detectVisualChange() {
        const prevScreenshot = this.previousState.screenshot;
        const currScreenshot = this.currentState.screenshot;
        const prevHash = this.previousState.screenshotHash;
        const currHash = this.currentState.screenshotHash;
        
        // Quick hash comparison
        if (prevHash === currHash) {
            return { changed: false, magnitude: 0 };
        }
        
        // Calculate visual difference
        const diff = this.calculateVisualDifference(prevScreenshot, currScreenshot);
        
        if (diff.magnitude < this.visualThreshold) {
            return { changed: false, magnitude: diff.magnitude };
        }
        
        return {
            changed: true,
            magnitude: diff.magnitude,
            changedRegions: diff.regions,
            changePercentage: (diff.magnitude * 100).toFixed(2) + '%'
        };
    }
    
    /**
     * Detect scroll changes
     * @private
     * @returns {Object} Scroll change details
     */
    detectScrollChange() {
        const prevScroll = this.previousState.viewport;
        const currScroll = this.currentState.viewport;
        
        const deltaY = Math.abs(currScroll.scrollY - prevScroll.scrollY);
        const deltaX = Math.abs(currScroll.scrollX - prevScroll.scrollX);
        
        if (deltaY < this.scrollThreshold && deltaX < this.scrollThreshold) {
            return { changed: false };
        }
        
        return {
            changed: true,
            deltaY: deltaY,
            deltaX: deltaX,
            direction: deltaY > deltaX ? 
                (currScroll.scrollY > prevScroll.scrollY ? 'down' : 'up') :
                (currScroll.scrollX > prevScroll.scrollX ? 'right' : 'left')
        };
    }
    
    /**
     * Detect viewport changes
     * @private
     * @returns {Object} Viewport change details
     */
    detectViewportChange() {
        const prevViewport = this.previousState.viewport;
        const currViewport = this.currentState.viewport;
        
        const widthChanged = prevViewport.width !== currViewport.width;
        const heightChanged = prevViewport.height !== currViewport.height;
        
        if (!widthChanged && !heightChanged) {
            return { changed: false };
        }
        
        return {
            changed: true,
            widthChange: currViewport.width - prevViewport.width,
            heightChange: currViewport.height - prevViewport.height,
            type: widthChanged && heightChanged ? 'resize' : 
                  widthChanged ? 'width-change' : 'height-change'
        };
    }
    
    /**
     * Calculate DOM difference
     * @private
     * @param {string} prevDom - Previous DOM
     * @param {string} currDom - Current DOM
     * @returns {Object} DOM difference analysis
     */
    calculateDomDifference(prevDom, currDom) {
        // Extract data-agent-id elements
        const prevElements = this.extractElementIds(prevDom);
        const currElements = this.extractElementIds(currDom);
        
        const added = currElements.filter(id => !prevElements.includes(id));
        const removed = prevElements.filter(id => !currElements.includes(id));
        const modified = this.detectModifiedElements(prevDom, currDom, prevElements, currElements);
        
        const totalPrev = prevElements.length;
        const totalChanges = added.length + removed.length + modified.length;
        
        const magnitude = totalPrev > 0 ? totalChanges / totalPrev : 0;
        
        return {
            magnitude: Math.min(1, magnitude),
            added: added.length,
            removed: removed.length,
            modified: modified.length
        };
    }
    
    /**
     * Calculate visual difference between screenshots
     * @private
     * @param {string} prevScreenshot - Previous screenshot (base64)
     * @param {string} currScreenshot - Current screenshot (base64)
     * @returns {Object} Visual difference analysis
     */
    calculateVisualDifference(prevScreenshot, currScreenshot) {
        // Simple hash-based comparison
        // In production, would use actual image differencing with Canvas API
        
        const prevHash = this.hashString(prevScreenshot);
        const currHash = this.hashString(currScreenshot);
        
        if (prevHash === currHash) {
            return { magnitude: 0, regions: [] };
        }
        
        // Estimate magnitude based on string similarity
        const similarity = this.calculateStringSimilarity(prevScreenshot, currScreenshot);
        const magnitude = 1 - similarity;
        
        return {
            magnitude: magnitude,
            regions: this.estimateChangedRegions(magnitude)
        };
    }
    
    /**
     * Extract element IDs from DOM
     * @private
     * @param {string} dom - DOM string
     * @returns {Array<string>} Element IDs
     */
    extractElementIds(dom) {
        const ids = [];
        const regex = /data-agent-id=["'](\d+)["']/g;
        let match;
        
        while ((match = regex.exec(dom)) !== null) {
            ids.push(match[1]);
        }
        
        return ids;
    }
    
    /**
     * Detect modified elements
     * @private
     * @param {string} prevDom - Previous DOM
     * @param {string} currDom - Current DOM
     * @param {Array<string>} prevIds - Previous element IDs
     * @param {Array<string>} currIds - Current element IDs
     * @returns {Array<string>} Modified element IDs
     */
    detectModifiedElements(prevDom, currDom, prevIds, currIds) {
        const modified = [];
        const commonIds = prevIds.filter(id => currIds.includes(id));
        
        for (const id of commonIds) {
            const prevElement = this.extractElementById(prevDom, id);
            const currElement = this.extractElementById(currDom, id);
            
            if (prevElement !== currElement) {
                modified.push(id);
            }
        }
        
        return modified;
    }
    
    /**
     * Extract element by ID from DOM
     * @private
     * @param {string} dom - DOM string
     * @param {string} id - Element ID
     * @returns {string} Element HTML
     */
    extractElementById(dom, id) {
        const regex = new RegExp(`<[^>]*data-agent-id=["']${id}["'][^>]*>.*?</[^>]+>`, 's');
        const match = dom.match(regex);
        return match ? match[0] : '';
    }
    
    /**
     * Estimate changed regions from magnitude
     * @private
     * @param {number} magnitude - Change magnitude
     * @returns {Array<Object>} Estimated changed regions
     */
    estimateChangedRegions(magnitude) {
        // Simple region estimation based on magnitude
        if (magnitude < 0.05) return [];
        
        const regionCount = Math.ceil(magnitude * 10);
        return Array(Math.min(5, regionCount)).fill(null).map((_, i) => ({
            index: i,
            estimatedChange: magnitude
        }));
    }
    
    /**
     * Calculate string similarity
     * @private
     * @param {string} str1 - First string
     * @param {string} str2 - Second string
     * @returns {number} Similarity score (0-1)
     */
    calculateStringSimilarity(str1, str2) {
        if (str1 === str2) return 1;
        if (!str1 || !str2) return 0;
        
        const len1 = str1.length;
        const len2 = str2.length;
        const maxLen = Math.max(len1, len2);
        
        if (maxLen === 0) return 1;
        
        // Simple length-based similarity
        const lengthSimilarity = 1 - Math.abs(len1 - len2) / maxLen;
        
        // Sample-based similarity (check first 1000 chars)
        const sampleSize = Math.min(1000, Math.min(len1, len2));
        let matches = 0;
        
        for (let i = 0; i < sampleSize; i++) {
            if (str1[i] === str2[i]) matches++;
        }
        
        const sampleSimilarity = sampleSize > 0 ? matches / sampleSize : 0;
        
        // Weighted average
        return lengthSimilarity * 0.3 + sampleSimilarity * 0.7;
    }
    
    /**
     * Hash a string for quick comparison
     * @private
     * @param {string} str - String to hash
     * @returns {string} Hash value
     */
    hashString(str) {
        return crypto.createHash('md5').update(str).digest('hex');
    }
    
    /**
     * Parse URL into components
     * @private
     * @param {string} url - URL to parse
     * @returns {Object} Parsed URL components
     */
    parseUrl(url) {
        try {
            const parsed = new URL(url);
            return {
                origin: parsed.origin,
                protocol: parsed.protocol,
                hostname: parsed.hostname,
                pathname: parsed.pathname,
                search: parsed.search,
                hash: parsed.hash
            };
        } catch (error) {
            return {
                origin: '',
                protocol: '',
                hostname: '',
                pathname: url,
                search: '',
                hash: ''
            };
        }
    }
    
    /**
     * Get state by ID
     * @param {string} stateId - State ID
     * @returns {Object|null} State snapshot
     */
    getState(stateId) {
        return this.stateHistory.find(s => s.id === stateId) || null;
    }
    
    /**
     * Get current state
     * @returns {Object|null} Current state snapshot
     */
    getCurrentState() {
        return this.currentState;
    }
    
    /**
     * Get previous state
     * @returns {Object|null} Previous state snapshot
     */
    getPreviousState() {
        return this.previousState;
    }
    
    /**
     * Get state history
     * @param {number} [limit] - Limit number of states returned
     * @returns {Array<Object>} State history
     */
    getHistory(limit = null) {
        if (limit) {
            return this.stateHistory.slice(-limit);
        }
        return [...this.stateHistory];
    }
    
    /**
     * Compare two specific states
     * @param {string} stateId1 - First state ID
     * @param {string} stateId2 - Second state ID
     * @returns {Object|null} Comparison results
     */
    compareStates(stateId1, stateId2) {
        const state1 = this.getState(stateId1);
        const state2 = this.getState(stateId2);
        
        if (!state1 || !state2) {
            console.warn('[StateTracker] Cannot compare: one or both states not found');
            return null;
        }
        
        // Temporarily swap states for comparison
        const origCurrent = this.currentState;
        const origPrevious = this.previousState;
        
        this.currentState = state2;
        this.previousState = state1;
        
        const comparison = this.detectChanges();
        
        // Restore original states
        this.currentState = origCurrent;
        this.previousState = origPrevious;
        
        return comparison;
    }
    
    /**
     * Calculate state stability (how much state is changing)
     * @param {number} [windowSize=5] - Number of recent states to analyze
     * @returns {Object} Stability analysis
     */
    calculateStability(windowSize = 5) {
        if (this.stateHistory.length < 2) {
            return {
                stable: true,
                volatility: 0,
                reason: 'Insufficient history'
            };
        }
        
        const recentStates = this.stateHistory.slice(-windowSize);
        const changes = [];
        
        for (let i = 1; i < recentStates.length; i++) {
            const state1 = recentStates[i - 1];
            const state2 = recentStates[i];
            
            const urlChanged = state1.url !== state2.url;
            const domChanged = state1.domHash !== state2.domHash;
            const visualChanged = state1.screenshotHash !== state2.screenshotHash;
            
            const changeScore = (urlChanged ? 0.4 : 0) + 
                               (domChanged ? 0.4 : 0) + 
                               (visualChanged ? 0.2 : 0);
            
            changes.push(changeScore);
        }
        
        const avgChange = changes.reduce((sum, c) => sum + c, 0) / changes.length;
        const volatility = avgChange;
        
        return {
            stable: volatility < 0.3,
            volatility: volatility,
            reason: volatility < 0.3 ? 'Low change rate' : 'High change rate',
            windowSize: recentStates.length,
            changes: changes
        };
    }
    
    /**
     * Get state tracker statistics
     * @returns {Object} Statistics
     */
    getStats() {
        return {
            ...this.stats,
            historySize: this.stateHistory.length,
            hasCurrentState: !!this.currentState,
            hasPreviousState: !!this.previousState,
            averageChangeMagnitude: this.stats.averageChangeMagnitude.toFixed(3)
        };
    }
    
    /**
     * Clear state history
     * @param {number} [keepLast=10] - Number of recent states to keep
     */
    clearHistory(keepLast = 10) {
        const originalSize = this.stateHistory.length;
        
        if (keepLast > 0 && this.stateHistory.length > keepLast) {
            this.stateHistory = this.stateHistory.slice(-keepLast);
        } else if (keepLast === 0) {
            this.stateHistory = [];
            this.previousState = null;
            this.currentState = null;
        }
        
        const cleared = originalSize - this.stateHistory.length;
        
        console.log(`[StateTracker] Cleared ${cleared} states from history`);
        this.emit('history:cleared', { cleared, remaining: this.stateHistory.length });
    }
    
    /**
     * Reset state tracker
     */
    reset() {
        console.log('[StateTracker] Resetting tracker');
        
        this.stateHistory = [];
        this.currentState = null;
        this.previousState = null;
        
        this.stats = {
            totalStates: 0,
            totalChanges: 0,
            changesByType: {},
            averageChangeMagnitude: 0,
            totalChangeMagnitude: 0
        };
        
        this.emit('tracker:reset');
    }
}

module.exports = { StateTracker, ChangeType };
