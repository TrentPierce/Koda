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

class ScreenshotTool extends EventEmitter {
  /**
     * Create screenshot tool
     * @param {Object} config - Configuration
     */
  constructor(config = {}) {
    super();
        
    this.config = {
      format: config.format || 'png',
      quality: config.quality || 80,
      fullPage: config.fullPage || false,
      ...config
    };
        
    this.page = null;
  }
    
  /**
     * Set page instance
     * @param {Object} page - Page instance (Puppeteer or Electron)
     */
  setPage(page) {
    this.page = page;
  }
    
  /**
     * Capture screenshot
     * @param {Object} options - Capture options
     * @returns {Promise<Buffer|string>} Screenshot data
     */
  async capture(options = {}) {
    if (!this.page) {
      throw new Error('Page instance not set');
    }
        
    const captureOptions = {
      type: options.format || this.config.format,
      quality: options.quality || this.config.quality,
      fullPage: options.fullPage !== undefined ? options.fullPage : this.config.fullPage,
      encoding: options.encoding || 'base64',
      ...options
    };
        
    this.emit('capturing', captureOptions);
        
    try {
      const screenshot = await this.page.screenshot(captureOptions);
            
      this.emit('captured', {
        size: screenshot.length,
        format: captureOptions.type
      });
            
      return screenshot;
    } catch (error) {
      this.emit('captureFailed', { error: error.message });
      throw error;
    }
  }
    
  /**
     * Capture element screenshot
     * @param {string} selector - Element selector
     * @param {Object} options - Capture options
     * @returns {Promise<Buffer|string>} Screenshot data
     */
  async captureElement(selector, options = {}) {
    if (!this.page) {
      throw new Error('Page instance not set');
    }
        
    const element = await this.page.$(selector);
    if (!element) {
      throw new Error(`Element not found: ${selector}`);
    }
        
    const captureOptions = {
      type: options.format || this.config.format,
      quality: options.quality || this.config.quality,
      encoding: options.encoding || 'base64',
      ...options
    };
        
    return await element.screenshot(captureOptions);
  }
}

module.exports = { ScreenshotTool };