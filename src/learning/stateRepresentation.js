/**
 * State Representation
 * Creates consistent state representations for web and mobile environments
 */

class StateRepresentation {
    constructor(platform = 'web') {
        this.platform = platform.toLowerCase();
    }

    /**
     * Create state representation from raw environment data
     */
    createState(rawData) {
        if (this.platform === 'web') {
            return this.createWebState(rawData);
        } else if (this.platform === 'android' || this.platform === 'ios') {
            return this.createMobileState(rawData);
        }
        
        throw new Error(`Unsupported platform: ${this.platform}`);
    }

    /**
     * Create state representation for web
     */
    createWebState(rawData) {
        const {
            url,
            title,
            dom,
            screenshot,
            viewport,
            loadState
        } = rawData;

        // Extract key features from DOM
        const elements = this.extractWebElements(dom);
        
        // Classify page type
        const pageType = this.classifyWebPage(url, title, elements);
        
        // Extract interaction opportunities
        const interactions = this.extractWebInteractions(elements);
        
        return {
            platform: 'web',
            pageType,
            url: this.normalizeUrl(url),
            elementCount: elements.length,
            interactiveElements: interactions.length,
            hasForm: interactions.some(i => i.type === 'input' || i.type === 'textarea'),
            hasModal: this.detectWebModal(elements),
            loadState,
            viewport,
            elements: elements.slice(0, 20),
            interactions: interactions.slice(0, 15),
            timestamp: Date.now()
        };
    }

    /**
     * Create state representation for mobile
     */
    createMobileState(rawData) {
        const {
            screenType,
            elements,
            navigationContext,
            hasModal,
            screenSize,
            appState
        } = rawData;

        // Extract interaction opportunities
        const interactions = this.extractMobileInteractions(elements);
        
        return {
            platform: this.platform,
            screenType,
            elementCount: elements?.length || 0,
            interactiveElements: interactions.length,
            hasModal,
            hasTabBar: navigationContext?.hasTabBar || false,
            hasNavBar: navigationContext?.hasNavBar || false,
            hasBackButton: navigationContext?.hasBackButton || false,
            screenSize,
            appState,
            elements: elements?.slice(0, 20) || [],
            interactions: interactions.slice(0, 15),
            timestamp: Date.now()
        };
    }

    /**
     * Extract elements from web DOM
     */
    extractWebElements(dom) {
        if (!dom) return [];
        
        const elements = [];
        const lines = dom.split('\n');
        
        for (const line of lines) {
            const tagMatch = line.match(/<(\w+)/);            const idMatch = line.match(/id="([^"]+)"/); 
            const textMatch = line.match(/>([^<]+)</);            
            if (tagMatch) {
                elements.push({
                    tag: tagMatch[1],
                    id: idMatch ? idMatch[1] : null,
                    text: textMatch ? textMatch[1].trim().substring(0, 50) : ''
                });
            }
        }
        
        return elements;
    }

    /**
     * Extract interactive elements from web DOM
     */
    extractWebInteractions(elements) {
        const interactiveTags = ['button', 'a', 'input', 'textarea', 'select'];
        
        return elements.filter(el => 
            interactiveTags.includes(el.tag.toLowerCase())
        );
    }

    /**
     * Extract interactive elements from mobile
     */
    extractMobileInteractions(elements) {
        if (!elements) return [];
        
        return elements.filter(el => el.isClickable || 
            el.type?.includes('Button') || 
            el.type?.includes('TextField') ||
            el.type?.includes('EditText')
        );
    }

    /**
     * Classify web page type
     */
    classifyWebPage(url, title, elements) {
        const text = (title + ' ' + elements.map(e => e.text).join(' ')).toLowerCase();
        
        // Login/Auth pages
        if (text.includes('login') || text.includes('sign in') || text.includes('authentication')) {
            return 'LOGIN';
        }
        
        // Search pages
        if (url?.includes('search') || text.includes('search results')) {
            return 'SEARCH';
        }
        
        // Product/Detail pages
        if (text.includes('product') || text.includes('details') || text.includes('description')) {
            return 'DETAIL';
        }
        
        // Form pages
        const inputCount = elements.filter(e => e.tag === 'input' || e.tag === 'textarea').length;
        if (inputCount >= 3) {
            return 'FORM';
        }
        
        // List pages
        const listCount = elements.filter(e => e.tag === 'li' || e.tag === 'article').length;
        if (listCount > 5) {
            return 'LIST';
        }
        
        // Home pages
        if (url === '/' || url?.endsWith('/') || text.includes('home') || text.includes('dashboard')) {
            return 'HOME';
        }
        
        return 'GENERAL';
    }

    /**
     * Detect modal on web page
     */
    detectWebModal(elements) {
        return elements.some(el => 
            el.text?.toLowerCase().includes('modal') ||
            el.text?.toLowerCase().includes('dialog') ||
            el.text?.toLowerCase().includes('popup')
        );
    }

    /**
     * Normalize URL for consistency
     */
    normalizeUrl(url) {
        if (!url) return 'unknown';
        
        try {
            const parsed = new URL(url);
            // Return domain + path (without query params)
            return parsed.hostname + parsed.pathname;
        } catch (e) {
            return url;
        }
    }

    /**
     * Calculate state similarity
     */
    calculateSimilarity(state1, state2) {
        let similarity = 0;
        let totalFeatures = 0;

        // Compare platform
        if (state1.platform === state2.platform) {
            similarity += 1;
        }
        totalFeatures += 1;

        // Compare type/page
        const type1 = state1.pageType || state1.screenType;
        const type2 = state2.pageType || state2.screenType;
        if (type1 === type2) {
            similarity += 1;
        }
        totalFeatures += 1;

        // Compare element count (with tolerance)
        const countDiff = Math.abs(state1.elementCount - state2.elementCount);
        if (countDiff < 10) {
            similarity += 1 - (countDiff / 10);
        }
        totalFeatures += 1;

        // Compare interactive elements
        const interactiveDiff = Math.abs(
            state1.interactiveElements - state2.interactiveElements
        );
        if (interactiveDiff < 5) {
            similarity += 1 - (interactiveDiff / 5);
        }
        totalFeatures += 1;

        // Compare modal presence
        if (state1.hasModal === state2.hasModal) {
            similarity += 1;
        }
        totalFeatures += 1;

        return similarity / totalFeatures;
    }

    /**
     * Create compact state key for storage
     */
    createStateKey(state) {
        const key = {
            platform: state.platform,
            type: state.pageType || state.screenType,
            elementCount: Math.floor(state.elementCount / 10) * 10,
            hasModal: state.hasModal,
            hasForm: state.hasForm
        };
        
        return JSON.stringify(key);
    }

    /**
     * Extract features for learning
     */
    extractFeatures(state) {
        return {
            platform: state.platform,
            type: state.pageType || state.screenType,
            elementCount: state.elementCount,
            interactiveElements: state.interactiveElements,
            hasModal: state.hasModal ? 1 : 0,
            hasForm: state.hasForm ? 1 : 0,
            hasNavigation: (state.hasTabBar || state.hasNavBar || state.hasBackButton) ? 1 : 0
        };
    }
}

module.exports = StateRepresentation;
