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
 * Mapping confidence levels
 * @enum {string}
 */
const MappingConfidence = {
    EXACT: 'exact',
    HIGH: 'high',
    MEDIUM: 'medium',
    LOW: 'low',
    UNCERTAIN: 'uncertain'
};

/**
 * Overlap resolution strategies
 * @enum {string}
 */
const OverlapStrategy = {
    HIGHEST_Z_INDEX: 'highest_z_index',
    SMALLEST_AREA: 'smallest_area',
    CENTER_POINT: 'center_point',
    INTERACTION_PRIORITY: 'interaction_priority'
};

/**
 * Visual-DOM Mapper for element mapping
 * @class
 * @extends EventEmitter
 */
class VisualDomMapper extends EventEmitter {
    /**
     * Create a new VisualDomMapper instance
     * @param {Object} options - Configuration options
     * @param {number} [options.coordinateTolerance=5] - Pixel tolerance for coordinate matching
     * @param {number} [options.overlapThreshold=0.5] - Overlap threshold (0-1)
     * @param {string} [options.overlapStrategy='highest_z_index'] - Strategy for resolving overlaps
     * @param {boolean} [options.considerVisibility=true] - Consider element visibility
     */
    constructor(options = {}) {
        super();
        
        this.coordinateTolerance = options.coordinateTolerance || 5;
        this.overlapThreshold = options.overlapThreshold || 0.5;
        this.overlapStrategy = options.overlapStrategy || OverlapStrategy.HIGHEST_Z_INDEX;
        this.considerVisibility = options.considerVisibility !== undefined ? options.considerVisibility : true;
        
        this.mappingCache = new Map();
        this.stats = {
            totalMappings: 0,
            successfulMappings: 0,
            ambiguousMappings: 0,
            failedMappings: 0,
            averageMappingTime: 0
        };
        
        console.log('[VisualDomMapper] Initialized');
    }
    
    /**
     * Map visual elements to DOM nodes
     * @param {Object} data - Mapping data
     * @param {Array} data.visualElements - Visual elements from analysis
     * @param {Array} data.domNodes - DOM nodes with position data
     * @param {Object} data.viewport - Viewport information
     * @param {Object} [options] - Mapping options
     * @returns {Promise<Object>} Mapping results
     */
    async mapVisualToDom(data, options = {}) {
        const startTime = Date.now();
        
        console.log(`[VisualDomMapper] Mapping ${data.visualElements.length} visual elements to ${data.domNodes.length} DOM nodes`);
        
        try {
            const mappings = [];
            const unmapped = [];
            const ambiguous = [];
            
            // Process each visual element
            for (const visualElement of data.visualElements) {
                const mapping = await this.findDomNodeForVisual(
                    visualElement,
                    data.domNodes,
                    data.viewport,
                    options
                );
                
                if (mapping.confidence === MappingConfidence.EXACT || 
                    mapping.confidence === MappingConfidence.HIGH) {
                    mappings.push(mapping);
                    this.stats.successfulMappings++;
                } else if (mapping.alternatives && mapping.alternatives.length > 1) {
                    ambiguous.push(mapping);
                    this.stats.ambiguousMappings++;
                } else {
                    unmapped.push(visualElement);
                    this.stats.failedMappings++;
                }
            }
            
            // Resolve overlapping elements
            const resolvedMappings = this.resolveOverlaps(mappings);
            
            const result = {
                mappings: resolvedMappings,
                unmapped: unmapped,
                ambiguous: ambiguous,
                statistics: {
                    total: data.visualElements.length,
                    mapped: resolvedMappings.length,
                    unmapped: unmapped.length,
                    ambiguous: ambiguous.length,
                    successRate: ((resolvedMappings.length / data.visualElements.length) * 100).toFixed(2) + '%'
                },
                metadata: {
                    viewportWidth: data.viewport.width,
                    viewportHeight: data.viewport.height,
                    mappedAt: Date.now()
                }
            };
            
            // Update stats
            const duration = Date.now() - startTime;
            this.stats.totalMappings++;
            this.stats.averageMappingTime = 
                (this.stats.averageMappingTime * (this.stats.totalMappings - 1) + duration) / this.stats.totalMappings;
            
            console.log(`[VisualDomMapper] Mapping completed in ${duration}ms: ${result.statistics.successRate} success rate`);
            this.emit('mapping:complete', { result, duration });
            
            return result;
            
        } catch (error) {
            console.error('[VisualDomMapper] Mapping failed:', error.message);
            this.emit('mapping:error', { error });
            throw error;
        }
    }
    
    /**
     * Find DOM node for a visual element
     * @private
     * @param {Object} visualElement - Visual element data
     * @param {Array} domNodes - Available DOM nodes
     * @param {Object} viewport - Viewport info
     * @param {Object} options - Mapping options
     * @returns {Promise<Object>} Mapping result
     */
    async findDomNodeForVisual(visualElement, domNodes, viewport, options) {
        const candidates = [];
        
        // Find candidate DOM nodes based on position
        for (const domNode of domNodes) {
            if (!domNode.bounds) continue;
            
            // Calculate position match
            const positionMatch = this.calculatePositionMatch(
                visualElement.bounds,
                domNode.bounds
            );
            
            if (positionMatch.overlap > 0.1) {
                const candidate = {
                    domNode: domNode,
                    matchScore: this.calculateMatchScore(visualElement, domNode, positionMatch),
                    positionMatch: positionMatch,
                    confidence: this.determineConfidence(positionMatch, visualElement, domNode)
                };
                
                candidates.push(candidate);
            }
        }
        
        // Sort by match score
        candidates.sort((a, b) => b.matchScore - a.matchScore);
        
        if (candidates.length === 0) {
            return {
                visualElement: visualElement,
                domNode: null,
                confidence: MappingConfidence.UNCERTAIN,
                matchScore: 0,
                alternatives: []
            };
        }
        
        // Best match
        const bestMatch = candidates[0];
        
        return {
            visualElement: visualElement,
            domNode: bestMatch.domNode,
            confidence: bestMatch.confidence,
            matchScore: bestMatch.matchScore,
            positionMatch: bestMatch.positionMatch,
            alternatives: candidates.slice(1, 4).map(c => ({
                domNode: c.domNode,
                matchScore: c.matchScore,
                confidence: c.confidence
            }))
        };
    }
    
    /**
     * Calculate position match between visual and DOM bounds
     * @private
     * @param {Object} visualBounds - Visual element bounds
     * @param {Object} domBounds - DOM node bounds
     * @returns {Object} Position match analysis
     */
    calculatePositionMatch(visualBounds, domBounds) {
        // Calculate intersection
        const intersection = this.calculateIntersection(visualBounds, domBounds);
        const visualArea = visualBounds.width * visualBounds.height;
        const domArea = domBounds.width * domBounds.height;
        
        // Calculate overlap percentage
        const overlapVisual = visualArea > 0 ? intersection.area / visualArea : 0;
        const overlapDom = domArea > 0 ? intersection.area / domArea : 0;
        const overlap = Math.max(overlapVisual, overlapDom);
        
        // Calculate center distance
        const visualCenter = {
            x: visualBounds.x + visualBounds.width / 2,
            y: visualBounds.y + visualBounds.height / 2
        };
        const domCenter = {
            x: domBounds.x + domBounds.width / 2,
            y: domBounds.y + domBounds.height / 2
        };
        const centerDistance = Math.sqrt(
            Math.pow(visualCenter.x - domCenter.x, 2) + 
            Math.pow(visualCenter.y - domCenter.y, 2)
        );
        
        // Calculate size similarity
        const sizeSimilarity = 1 - Math.abs(visualArea - domArea) / Math.max(visualArea, domArea);
        
        return {
            overlap: overlap,
            centerDistance: centerDistance,
            sizeSimilarity: sizeSimilarity,
            intersection: intersection,
            visualArea: visualArea,
            domArea: domArea
        };
    }
    
    /**
     * Calculate intersection rectangle
     * @private
     * @param {Object} rect1 - First rectangle
     * @param {Object} rect2 - Second rectangle
     * @returns {Object} Intersection bounds and area
     */
    calculateIntersection(rect1, rect2) {
        const x1 = Math.max(rect1.x, rect2.x);
        const y1 = Math.max(rect1.y, rect2.y);
        const x2 = Math.min(rect1.x + rect1.width, rect2.x + rect2.width);
        const y2 = Math.min(rect1.y + rect1.height, rect2.y + rect2.height);
        
        const width = Math.max(0, x2 - x1);
        const height = Math.max(0, y2 - y1);
        const area = width * height;
        
        return {
            x: x1,
            y: y1,
            width: width,
            height: height,
            area: area
        };
    }
    
    /**
     * Calculate overall match score
     * @private
     * @param {Object} visualElement - Visual element
     * @param {Object} domNode - DOM node
     * @param {Object} positionMatch - Position match data
     * @returns {number} Match score (0-1)
     */
    calculateMatchScore(visualElement, domNode, positionMatch) {
        let score = 0;
        
        // Position overlap (40% weight)
        score += positionMatch.overlap * 0.4;
        
        // Size similarity (30% weight)
        score += positionMatch.sizeSimilarity * 0.3;
        
        // Center distance (20% weight)
        const maxDistance = 100;
        const distanceScore = Math.max(0, 1 - (positionMatch.centerDistance / maxDistance));
        score += distanceScore * 0.2;
        
        // Type match (10% weight)
        if (visualElement.type && domNode.type) {
            if (visualElement.type === domNode.type) {
                score += 0.1;
            } else if (this.areTypesCompatible(visualElement.type, domNode.type)) {
                score += 0.05;
            }
        }
        
        return Math.min(1, score);
    }
    
    /**
     * Check if element types are compatible
     * @private
     * @param {string} type1 - First type
     * @param {string} type2 - Second type
     * @returns {boolean} Are types compatible
     */
    areTypesCompatible(type1, type2) {
        const compatibleGroups = [
            ['button', 'link'],
            ['input', 'textarea'],
            ['heading', 'text'],
            ['icon', 'image']
        ];
        
        for (const group of compatibleGroups) {
            if (group.includes(type1) && group.includes(type2)) {
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * Determine mapping confidence
     * @private
     * @param {Object} positionMatch - Position match data
     * @param {Object} visualElement - Visual element
     * @param {Object} domNode - DOM node
     * @returns {string} Confidence level
     */
    determineConfidence(positionMatch, visualElement, domNode) {
        // Exact match criteria
        if (positionMatch.overlap > 0.95 && positionMatch.sizeSimilarity > 0.95) {
            return MappingConfidence.EXACT;
        }
        
        // High confidence criteria
        if (positionMatch.overlap > 0.8 && positionMatch.centerDistance < 10) {
            return MappingConfidence.HIGH;
        }
        
        // Medium confidence criteria
        if (positionMatch.overlap > 0.5 && positionMatch.sizeSimilarity > 0.7) {
            return MappingConfidence.MEDIUM;
        }
        
        // Low confidence criteria
        if (positionMatch.overlap > 0.3) {
            return MappingConfidence.LOW;
        }
        
        return MappingConfidence.UNCERTAIN;
    }
    
    /**
     * Resolve overlapping element mappings
     * @private
     * @param {Array} mappings - Initial mappings
     * @returns {Array} Resolved mappings
     */
    resolveOverlaps(mappings) {
        const resolved = [];
        const processed = new Set();
        
        for (const mapping of mappings) {
            if (processed.has(mapping.visualElement)) {
                continue;
            }
            
            // Find overlapping mappings
            const overlapping = this.findOverlappingMappings(mapping, mappings);
            
            if (overlapping.length === 0) {
                resolved.push(mapping);
                processed.add(mapping.visualElement);
            } else {
                // Resolve overlap based on strategy
                const best = this.selectBestMapping(
                    [mapping, ...overlapping],
                    this.overlapStrategy
                );
                
                resolved.push(best);
                processed.add(best.visualElement);
                
                // Mark others as processed
                for (const other of overlapping) {
                    processed.add(other.visualElement);
                }
            }
        }
        
        return resolved;
    }
    
    /**
     * Find overlapping mappings
     * @private
     * @param {Object} mapping - Mapping to check
     * @param {Array} allMappings - All mappings
     * @returns {Array} Overlapping mappings
     */
    findOverlappingMappings(mapping, allMappings) {
        const overlapping = [];
        
        for (const other of allMappings) {
            if (other === mapping) continue;
            
            // Check if DOM nodes overlap significantly
            if (other.domNode && mapping.domNode) {
                const intersection = this.calculateIntersection(
                    mapping.domNode.bounds,
                    other.domNode.bounds
                );
                
                const area1 = mapping.domNode.bounds.width * mapping.domNode.bounds.height;
                const overlapRatio = area1 > 0 ? intersection.area / area1 : 0;
                
                if (overlapRatio > this.overlapThreshold) {
                    overlapping.push(other);
                }
            }
        }
        
        return overlapping;
    }
    
    /**
     * Select best mapping from overlapping candidates
     * @private
     * @param {Array} candidates - Candidate mappings
     * @param {string} strategy - Selection strategy
     * @returns {Object} Best mapping
     */
    selectBestMapping(candidates, strategy) {
        switch (strategy) {
            case OverlapStrategy.HIGHEST_Z_INDEX:
                return this.selectByZIndex(candidates);
                
            case OverlapStrategy.SMALLEST_AREA:
                return this.selectByArea(candidates);
                
            case OverlapStrategy.CENTER_POINT:
                return this.selectByCenterPoint(candidates);
                
            case OverlapStrategy.INTERACTION_PRIORITY:
                return this.selectByInteraction(candidates);
                
            default:
                return candidates[0];
        }
    }
    
    /**
     * Select mapping by z-index
     * @private
     * @param {Array} candidates - Candidates
     * @returns {Object} Selected mapping
     */
    selectByZIndex(candidates) {
        return candidates.reduce((best, current) => {
            const currentZ = current.domNode?.zIndex || 0;
            const bestZ = best.domNode?.zIndex || 0;
            return currentZ > bestZ ? current : best;
        });
    }
    
    /**
     * Select mapping by smallest area
     * @private
     * @param {Array} candidates - Candidates
     * @returns {Object} Selected mapping
     */
    selectByArea(candidates) {
        return candidates.reduce((best, current) => {
            const currentArea = current.positionMatch?.domArea || Infinity;
            const bestArea = best.positionMatch?.domArea || Infinity;
            return currentArea < bestArea ? current : best;
        });
    }
    
    /**
     * Select mapping by center point match
     * @private
     * @param {Array} candidates - Candidates
     * @returns {Object} Selected mapping
     */
    selectByCenterPoint(candidates) {
        return candidates.reduce((best, current) => {
            const currentDist = current.positionMatch?.centerDistance || Infinity;
            const bestDist = best.positionMatch?.centerDistance || Infinity;
            return currentDist < bestDist ? current : best;
        });
    }
    
    /**
     * Select mapping by interaction priority
     * @private
     * @param {Array} candidates - Candidates
     * @returns {Object} Selected mapping
     */
    selectByInteraction(candidates) {
        const interactionPriority = {
            'button': 10,
            'link': 9,
            'input': 8,
            'select': 7,
            'checkbox': 6,
            'radio': 5
        };
        
        return candidates.reduce((best, current) => {
            const currentPriority = interactionPriority[current.visualElement?.type] || 0;
            const bestPriority = interactionPriority[best.visualElement?.type] || 0;
            return currentPriority > bestPriority ? current : best;
        });
    }
    
    /**
     * Find click target for coordinates
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @param {Array} mappings - Available mappings
     * @returns {Object|null} Click target mapping
     */
    findClickTarget(x, y, mappings) {
        const candidates = [];
        
        for (const mapping of mappings) {
            if (!mapping.domNode || !mapping.domNode.bounds) continue;
            
            const bounds = mapping.domNode.bounds;
            
            // Check if point is within bounds
            if (x >= bounds.x && x <= bounds.x + bounds.width &&
                y >= bounds.y && y <= bounds.y + bounds.height) {
                
                candidates.push({
                    mapping: mapping,
                    zIndex: mapping.domNode.zIndex || 0,
                    area: bounds.width * bounds.height
                });
            }
        }
        
        if (candidates.length === 0) {
            return null;
        }
        
        // Sort by z-index (descending) then area (ascending)
        candidates.sort((a, b) => {
            if (b.zIndex !== a.zIndex) {
                return b.zIndex - a.zIndex;
            }
            return a.area - b.area;
        });
        
        return candidates[0].mapping;
    }
    
    /**
     * Get mapping statistics
     * @returns {Object} Statistics
     */
    getStats() {
        const total = this.stats.successfulMappings + this.stats.ambiguousMappings + this.stats.failedMappings;
        
        return {
            ...this.stats,
            successRate: total > 0 ? ((this.stats.successfulMappings / total) * 100).toFixed(2) + '%' : '0%',
            ambiguousRate: total > 0 ? ((this.stats.ambiguousMappings / total) * 100).toFixed(2) + '%' : '0%',
            failureRate: total > 0 ? ((this.stats.failedMappings / total) * 100).toFixed(2) + '%' : '0%'
        };
    }
    
    /**
     * Clear mapping cache
     */
    clearCache() {
        const size = this.mappingCache.size;
        this.mappingCache.clear();
        console.log(`[VisualDomMapper] Cleared ${size} cached mappings`);
    }
}

module.exports = { 
    VisualDomMapper, 
    MappingConfidence, 
    OverlapStrategy 
};
