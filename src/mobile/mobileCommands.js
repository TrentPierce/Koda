/**
 * Mobile-Specific Commands
 * Implements gestures and mobile-specific interactions
 */

class MobileCommands {
  constructor(driver, platform) {
    this.driver = driver;
    this.platform = platform.toLowerCase();
  }

  /**
     * Tap on element or coordinates
     */
  async tap(element, options = {}) {
    const { duration = 100, x, y } = options;

    try {
      if (element) {
        await element.click();
      } else if (x !== undefined && y !== undefined) {
        await this.driver.performActions([{
          type: 'pointer',
          id: 'finger1',
          parameters: { pointerType: 'touch' },
          actions: [
            { type: 'pointerMove', duration: 0, x, y },
            { type: 'pointerDown', button: 0 },
            { type: 'pause', duration },
            { type: 'pointerUp', button: 0 }
          ]
        }]);
      }
    } catch (error) {
      console.error('[MobileCommands] Tap failed:', error.message);
      throw error;
    }
  }

  /**
     * Long press on element
     */
  async longPress(element, options = {}) {
    const { duration = 1000, x, y } = options;

    try {
      if (element) {
        const location = await element.getLocation();
        const size = await element.getSize();
        const centerX = location.x + size.width / 2;
        const centerY = location.y + size.height / 2;
                
        await this.driver.performActions([{
          type: 'pointer',
          id: 'finger1',
          parameters: { pointerType: 'touch' },
          actions: [
            { type: 'pointerMove', duration: 0, x: centerX, y: centerY },
            { type: 'pointerDown', button: 0 },
            { type: 'pause', duration },
            { type: 'pointerUp', button: 0 }
          ]
        }]);
      } else if (x !== undefined && y !== undefined) {
        await this.driver.performActions([{
          type: 'pointer',
          id: 'finger1',
          parameters: { pointerType: 'touch' },
          actions: [
            { type: 'pointerMove', duration: 0, x, y },
            { type: 'pointerDown', button: 0 },
            { type: 'pause', duration },
            { type: 'pointerUp', button: 0 }
          ]
        }]);
      }
    } catch (error) {
      console.error('[MobileCommands] Long press failed:', error.message);
      throw error;
    }
  }

  /**
     * Swipe gesture
     */
  async swipe(options = {}) {
    const {
      startX,
      startY,
      endX,
      endY,
      duration = 500,
      direction = null
    } = options;

    try {
      let finalStartX = startX;
      let finalStartY = startY;
      let finalEndX = endX;
      let finalEndY = endY;

      // If direction is specified, calculate coordinates
      if (direction) {
        const windowSize = await this.driver.getWindowSize();
        const midX = windowSize.width / 2;
        const midY = windowSize.height / 2;
        const margin = 50;

        switch (direction.toLowerCase()) {
          case 'up':
            finalStartX = midX;
            finalStartY = windowSize.height - margin;
            finalEndX = midX;
            finalEndY = margin;
            break;
          case 'down':
            finalStartX = midX;
            finalStartY = margin;
            finalEndX = midX;
            finalEndY = windowSize.height - margin;
            break;
          case 'left':
            finalStartX = windowSize.width - margin;
            finalStartY = midY;
            finalEndX = margin;
            finalEndY = midY;
            break;
          case 'right':
            finalStartX = margin;
            finalStartY = midY;
            finalEndX = windowSize.width - margin;
            finalEndY = midY;
            break;
        }
      }

      await this.driver.performActions([{
        type: 'pointer',
        id: 'finger1',
        parameters: { pointerType: 'touch' },
        actions: [
          { type: 'pointerMove', duration: 0, x: finalStartX, y: finalStartY },
          { type: 'pointerDown', button: 0 },
          { type: 'pointerMove', duration, x: finalEndX, y: finalEndY },
          { type: 'pointerUp', button: 0 }
        ]
      }]);
    } catch (error) {
      console.error('[MobileCommands] Swipe failed:', error.message);
      throw error;
    }
  }

  /**
     * Pinch (zoom in/out)
     */
  async pinch(options = {}) {
    const { scale = 0.5, duration = 500 } = options;
    const windowSize = await this.driver.getWindowSize();
    const centerX = windowSize.width / 2;
    const centerY = windowSize.height / 2;
    const distance = 100;

    try {
      if (scale < 1) {
        // Pinch in (zoom out)
        await this.driver.performActions([
          {
            type: 'pointer',
            id: 'finger1',
            parameters: { pointerType: 'touch' },
            actions: [
              { type: 'pointerMove', duration: 0, x: centerX - distance, y: centerY },
              { type: 'pointerDown', button: 0 },
              { type: 'pointerMove', duration, x: centerX - distance * scale, y: centerY },
              { type: 'pointerUp', button: 0 }
            ]
          },
          {
            type: 'pointer',
            id: 'finger2',
            parameters: { pointerType: 'touch' },
            actions: [
              { type: 'pointerMove', duration: 0, x: centerX + distance, y: centerY },
              { type: 'pointerDown', button: 0 },
              { type: 'pointerMove', duration, x: centerX + distance * scale, y: centerY },
              { type: 'pointerUp', button: 0 }
            ]
          }
        ]);
      } else {
        // Pinch out (zoom in)
        await this.driver.performActions([
          {
            type: 'pointer',
            id: 'finger1',
            parameters: { pointerType: 'touch' },
            actions: [
              { type: 'pointerMove', duration: 0, x: centerX - distance * scale, y: centerY },
              { type: 'pointerDown', button: 0 },
              { type: 'pointerMove', duration, x: centerX - distance, y: centerY },
              { type: 'pointerUp', button: 0 }
            ]
          },
          {
            type: 'pointer',
            id: 'finger2',
            parameters: { pointerType: 'touch' },
            actions: [
              { type: 'pointerMove', duration: 0, x: centerX + distance * scale, y: centerY },
              { type: 'pointerDown', button: 0 },
              { type: 'pointerMove', duration, x: centerX + distance, y: centerY },
              { type: 'pointerUp', button: 0 }
            ]
          }
        ]);
      }
    } catch (error) {
      console.error('[MobileCommands] Pinch failed:', error.message);
      throw error;
    }
  }

  /**
     * Scroll to element or direction
     */
  async scroll(options = {}) {
    const { direction = 'down', element = null, maxSwipes = 10 } = options;

    try {
      if (element) {
        // Scroll until element is visible
        for (let i = 0; i < maxSwipes; i++) {
          if (await element.isDisplayed()) {
            return true;
          }
          await this.swipe({ direction });
          await this.driver.pause(300);
        }
        return false;
      } else {
        // Simple directional scroll
        await this.swipe({ direction });
        return true;
      }
    } catch (error) {
      console.error('[MobileCommands] Scroll failed:', error.message);
      throw error;
    }
  }

  /**
     * Drag and drop
     */
  async dragAndDrop(sourceElement, targetElement, options = {}) {
    const { duration = 1000 } = options;

    try {
      const sourceLocation = await sourceElement.getLocation();
      const sourceSize = await sourceElement.getSize();
      const targetLocation = await targetElement.getLocation();
      const targetSize = await targetElement.getSize();

      const startX = sourceLocation.x + sourceSize.width / 2;
      const startY = sourceLocation.y + sourceSize.height / 2;
      const endX = targetLocation.x + targetSize.width / 2;
      const endY = targetLocation.y + targetSize.height / 2;

      await this.driver.performActions([{
        type: 'pointer',
        id: 'finger1',
        parameters: { pointerType: 'touch' },
        actions: [
          { type: 'pointerMove', duration: 0, x: startX, y: startY },
          { type: 'pointerDown', button: 0 },
          { type: 'pause', duration: 500 },
          { type: 'pointerMove', duration, x: endX, y: endY },
          { type: 'pointerUp', button: 0 }
        ]
      }]);
    } catch (error) {
      console.error('[MobileCommands] Drag and drop failed:', error.message);
      throw error;
    }
  }

  /**
     * Double tap
     */
  async doubleTap(element, options = {}) {
    const { delay = 100 } = options;

    try {
      await this.tap(element, options);
      await this.driver.pause(delay);
      await this.tap(element, options);
    } catch (error) {
      console.error('[MobileCommands] Double tap failed:', error.message);
      throw error;
    }
  }

  /**
     * Install app
     */
  async installApp(appPath) {
    try {
      if (this.platform === 'android') {
        await this.driver.execute('mobile: installApp', { app: appPath });
      } else if (this.platform === 'ios') {
        await this.driver.execute('mobile: installApp', { app: appPath });
      }
      console.log('[MobileCommands] App installed successfully');
    } catch (error) {
      console.error('[MobileCommands] App installation failed:', error.message);
      throw error;
    }
  }

  /**
     * Remove app
     */
  async removeApp(bundleId) {
    try {
      if (this.platform === 'android') {
        await this.driver.execute('mobile: removeApp', { appId: bundleId });
      } else if (this.platform === 'ios') {
        await this.driver.execute('mobile: removeApp', { bundleId });
      }
      console.log('[MobileCommands] App removed successfully');
    } catch (error) {
      console.error('[MobileCommands] App removal failed:', error.message);
      throw error;
    }
  }

  /**
     * Launch app
     */
  async launchApp() {
    try {
      await this.driver.execute('mobile: launchApp');
      console.log('[MobileCommands] App launched successfully');
    } catch (error) {
      console.error('[MobileCommands] App launch failed:', error.message);
      throw error;
    }
  }

  /**
     * Close app
     */
  async closeApp() {
    try {
      await this.driver.execute('mobile: terminateApp');
      console.log('[MobileCommands] App closed successfully');
    } catch (error) {
      console.error('[MobileCommands] App close failed:', error.message);
      throw error;
    }
  }

  /**
     * Reset app
     */
  async resetApp() {
    try {
      await this.driver.execute('mobile: clearApp');
      console.log('[MobileCommands] App reset successfully');
    } catch (error) {
      console.error('[MobileCommands] App reset failed:', error.message);
      throw error;
    }
  }

  /**
     * Background app
     */
  async backgroundApp(seconds = -1) {
    try {
      await this.driver.background(seconds);
      console.log('[MobileCommands] App sent to background');
    } catch (error) {
      console.error('[MobileCommands] Background app failed:', error.message);
      throw error;
    }
  }

  /**
     * Get app state
     */
  async getAppState(bundleId) {
    try {
      let state;
      if (this.platform === 'android') {
        state = await this.driver.execute('mobile: queryAppState', { appId: bundleId });
      } else if (this.platform === 'ios') {
        state = await this.driver.execute('mobile: queryAppState', { bundleId });
      }
            
      const states = {
        0: 'not installed',
        1: 'not running',
        2: 'running in background (suspended)',
        3: 'running in background',
        4: 'running in foreground'
      };
            
      return states[state] || 'unknown';
    } catch (error) {
      console.error('[MobileCommands] Get app state failed:', error.message);
      throw error;
    }
  }
}

module.exports = MobileCommands;
