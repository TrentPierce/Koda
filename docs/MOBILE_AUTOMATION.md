# Mobile Automation Guide

Comprehensive guide for using Koda's mobile automation capabilities with iOS and Android.

## Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [Platform-Agnostic Selectors](#platform-agnostic-selectors)
- [Mobile Commands](#mobile-commands)
- [State Detection](#state-detection)
- [Device Management](#device-management)
- [Examples](#examples)

## Overview

Koda now supports mobile automation for both iOS and Android platforms through Appium integration. The system provides:

- Unified API for both iOS and Android
- Platform-agnostic selectors that automatically adapt
- Mobile-specific gestures (swipe, tap, pinch, etc.)
- Real device and simulator/emulator support
- App state detection and navigation
- Seamless integration with reinforcement learning

## Prerequisites

### For Android

1. Install Android SDK and set ANDROID_HOME environment variable
2. Install Java JDK 8 or higher
3. Install Appium: `npm install -g appium`
4. Install UiAutomator2 driver: `appium driver install uiautomator2`
5. Start an emulator or connect a real device

### For iOS

1. macOS with Xcode installed
2. Install Appium: `npm install -g appium`
3. Install XCUITest driver: `appium driver install xcuitest`
4. For real devices: Configure provisioning profiles
5. For simulators: Ensure simulators are available

### Start Appium Server

```bash
appium --port 4723
```

## Quick Start

### Android App Automation

```javascript
const { MobileAgent } = require('@trentpierce/browser-agent/mobile');

// Create Android agent
const agent = new MobileAgent({
    platform: 'android',
    deviceName: 'Pixel_6_API_33',
    platformVersion: '13.0',
    appPackage: 'com.example.app',
    appActivity: '.MainActivity'
});

// Initialize
await agent.initialize();

// Perform actions
await agent.tap('~loginButton');
await agent.type('#username', 'testuser');
await agent.swipe({ direction: 'up' });

// Close
await agent.close();
```

### iOS App Automation

```javascript
const { MobileAgent } = require('@trentpierce/browser-agent/mobile');

// Create iOS agent
const agent = new MobileAgent({
    platform: 'ios',
    deviceName: 'iPhone 15',
    platformVersion: '17.0',
    bundleId: 'com.example.app'
});

// Initialize
await agent.initialize();

// Perform actions
await agent.tap('Login');
await agent.type('Username', 'testuser');
await agent.swipe({ direction: 'left' });

// Close
await agent.close();
```

## Configuration

### Android Configuration

```javascript
const config = {
    platform: 'android',
    deviceName: 'emulator-5554',
    platformVersion: '13.0',
    automationName: 'UiAutomator2',
    
    // App configuration
    app: '/path/to/app.apk',           // App file path
    appPackage: 'com.example.app',     // Package name
    appActivity: '.MainActivity',       // Launch activity
    
    // Optional
    udid: 'device-id',                  // Specific device UDID
    isRealDevice: false,                // Real device flag
    newCommandTimeout: 300,             // Timeout in seconds
    
    // Learning
    enableLearning: true                // Enable RL integration
};
```

### iOS Configuration

```javascript
const config = {
    platform: 'ios',
    deviceName: 'iPhone 15',
    platformVersion: '17.0',
    automationName: 'XCUITest',
    
    // App configuration
    app: '/path/to/app.app',            // App bundle path
    bundleId: 'com.example.app',        // Bundle identifier
    
    // Optional
    udid: 'device-udid',                // Specific device UDID
    isRealDevice: false,                // Real device flag
    newCommandTimeout: 300,             // Timeout in seconds
    
    // Learning
    enableLearning: true                // Enable RL integration
};
```

## Platform-Agnostic Selectors

Koda automatically converts selectors to platform-specific formats:

### Selector Types

```javascript
// ID selector (works on all platforms)
await agent.tap('#loginButton');

// Class selector
await agent.tap('.button');

// Text selector
await agent.tap('Login');

// XPath selector
await agent.tap('//button[@text="Login"]');

// Accessibility ID
await agent.tap('~login-btn');

// Tag selector
await agent.tap('button');
```

### Automatic Conversion

```javascript
const { PlatformSelectors } = require('@trentpierce/browser-agent/mobile');

const selectors = new PlatformSelectors('android');

// Converts '#loginButton' to appropriate Android selector
const androidSelector = selectors.convert('#loginButton', 'id');

// For iOS
const iosSelectors = new PlatformSelectors('ios');
const iosSelector = iosSelectors.convert('#loginButton', 'id');
```

## Mobile Commands

### Tap

```javascript
// Tap on element
await agent.tap('~loginButton');

// Tap at coordinates
await agent.tap(null, { x: 100, y: 200 });

// Tap with duration
await agent.tap('~button', { duration: 200 });
```

### Type

```javascript
// Type into input field
await agent.type('#username', 'testuser');
await agent.type('~passwordField', 'password123');
```

### Swipe

```javascript
// Swipe by direction
await agent.swipe({ direction: 'up' });
await agent.swipe({ direction: 'down' });
await agent.swipe({ direction: 'left' });
await agent.swipe({ direction: 'right' });

// Swipe with coordinates
await agent.swipe({
    startX: 100,
    startY: 500,
    endX: 100,
    endY: 100,
    duration: 500
});
```

### Long Press

```javascript
// Long press on element
await agent.longPress('~menuItem', { duration: 1000 });

// Long press at coordinates
await agent.longPress(null, { x: 100, y: 200, duration: 1500 });
```

### Scroll

```javascript
// Scroll in direction
await agent.scroll({ direction: 'down' });

// Scroll until element is visible
const element = await agent.findElement('#targetElement');
await agent.scroll({ element, direction: 'down', maxSwipes: 10 });
```

### Pinch

```javascript
const { MobileCommands } = require('@trentpierce/browser-agent/mobile');

const driver = await agent.driver.getDriver();
const commands = new MobileCommands(driver, 'ios');

// Pinch to zoom out
await commands.pinch({ scale: 0.5, duration: 500 });

// Pinch to zoom in
await commands.pinch({ scale: 2.0, duration: 500 });
```

### App Management

```javascript
// Install app
await agent.installApp('/path/to/app.apk');

// Launch app
await agent.launchApp();

// Close app
await agent.closeApp();

// Get app state
const state = await agent.getAppState('com.example.app');
console.log('App state:', state);
// Outputs: 'running in foreground', 'running in background', etc.
```

## State Detection

### Screen State Detection

```javascript
// Get current screen state
const state = await agent.getState();

console.log('Screen type:', state.screenType);
// Types: 'LOGIN', 'HOME', 'LIST', 'DETAIL', 'FORM', etc.

console.log('Element count:', state.elementCount);
console.log('Has modal:', state.hasModal);
console.log('Navigation context:', state.navigationContext);
```

### Navigation Context

```javascript
const state = await agent.getState();

if (state.navigationContext.hasBackButton) {
    console.log('Can navigate back');
}

if (state.navigationContext.hasTabBar) {
    console.log('Tab navigation available');
}
```

### Stuck Detection

```javascript
// Check if agent is stuck on same screen
if (agent.isStuck()) {
    console.log('Agent appears stuck, trying alternative action');
    await agent.swipe({ direction: 'up' });
}
```

## Device Management

### List Available Devices

```javascript
const { DeviceManager } = require('@trentpierce/browser-agent/mobile');

const manager = new DeviceManager();

// List all devices
const devices = await manager.listAllDevices();

for (const device of devices) {
    console.log(`${device.platform}: ${device.model} (${device.version})`);
    console.log(`UDID: ${device.udid}`);
    console.log(`Status: ${device.status}`);
}
```

### Start/Stop Simulators

```javascript
const manager = new DeviceManager();

// Start Android emulator
await manager.startAndroidEmulator('Pixel_6_API_33');

// Start iOS simulator
const devices = await manager.listIOSDevices();
await manager.startIOSSimulator(devices[0].udid);

// Stop emulator
await manager.stopAndroidEmulator('emulator-5554');

// Stop simulator
await manager.stopIOSSimulator(devices[0].udid);
```

### Install/Uninstall Apps

```javascript
const manager = new DeviceManager();

// Install app on device
await manager.installApp('device-udid', '/path/to/app.apk', 'android');

// Uninstall app
await manager.uninstallApp('device-udid', 'com.example.app', 'android');
```

## Examples

### Complete Android Test Flow

```javascript
const { MobileAgent } = require('@trentpierce/browser-agent/mobile');

async function testAndroidApp() {
    const agent = new MobileAgent({
        platform: 'android',
        deviceName: 'Pixel_6_API_33',
        platformVersion: '13.0',
        appPackage: 'com.example.app',
        appActivity: '.MainActivity'
    });

    try {
        await agent.initialize();
        
        // Login flow
        await agent.type('~username', 'testuser@example.com');
        await agent.type('~password', 'password123');
        await agent.tap('~loginButton');
        
        // Wait for home screen
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Navigate to profile
        await agent.tap('Profile');
        
        // Scroll to settings
        await agent.scroll({ direction: 'down' });
        
        // Take screenshot
        await agent.screenshot('./profile-screen.png');
        
        console.log('Test completed successfully');
    } catch (error) {
        console.error('Test failed:', error);
    } finally {
        await agent.close();
    }
}

testAndroidApp();
```

### Cross-Platform Test

```javascript
const { MobileAgent } = require('@trentpierce/browser-agent/mobile');

async function crossPlatformTest(platform) {
    const config = platform === 'android' ? {
        platform: 'android',
        deviceName: 'Pixel_6_API_33',
        platformVersion: '13.0',
        appPackage: 'com.example.app',
        appActivity: '.MainActivity'
    } : {
        platform: 'ios',
        deviceName: 'iPhone 15',
        platformVersion: '17.0',
        bundleId: 'com.example.app'
    };

    const agent = new MobileAgent(config);
    await agent.initialize();

    try {
        // Same test code works on both platforms
        await agent.tap('Login');
        await agent.type('Username', 'testuser');
        await agent.type('Password', 'password123');
        await agent.tap('Submit');
        
        const state = await agent.getState();
        console.log(`${platform} screen:`, state.screenType);
    } finally {
        await agent.close();
    }
}

// Run on both platforms
await crossPlatformTest('android');
await crossPlatformTest('ios');
```

### Integration with Reinforcement Learning

```javascript
const { MobileAgent } = require('@trentpierce/browser-agent/mobile');
const { ReinforcementAgent } = require('@trentpierce/browser-agent/learning');

async function learnMobileApp() {
    const mobileAgent = new MobileAgent({
        platform: 'android',
        deviceName: 'Pixel_6_API_33',
        appPackage: 'com.example.app',
        enableLearning: true
    });

    const rlAgent = new ReinforcementAgent({
        algorithm: 'qlearning',
        platform: 'android',
        enableDatabase: true
    });

    await mobileAgent.initialize();
    await rlAgent.initialize();

    try {
        for (let episode = 0; episode < 10; episode++) {
            let state = await mobileAgent.getState();
            let done = false;

            while (!done) {
                // Choose action using RL
                const validActions = ['tap', 'swipe', 'type'];
                const action = rlAgent.chooseAction(state, validActions);

                // Execute action
                const outcome = await mobileAgent.executeAction(action, {
                    selector: '~nextButton'
                });

                // Get next state
                const nextState = await mobileAgent.getState();

                // Calculate reward
                const reward = rlAgent.calculateReward({
                    ...outcome,
                    stateChange: { 
                        from: state.screenType, 
                        to: nextState.screenType 
                    }
                });

                // Learn from experience
                await rlAgent.learn(state, action, reward, nextState, done);

                state = nextState;

                // Check if goal reached
                if (nextState.screenType === 'SUCCESS') {
                    done = true;
                }
            }
        }

        console.log('Learning complete:', rlAgent.getStats());
    } finally {
        await rlAgent.close();
        await mobileAgent.close();
    }
}

learnMobileApp();
```

## Best Practices

1. **Always initialize before use**
   ```javascript
   await agent.initialize();
   ```

2. **Use platform-agnostic selectors when possible**
   ```javascript
   await agent.tap('~accessibilityId');  // Works on both platforms
   ```

3. **Handle timeouts appropriately**
   ```javascript
   const config = { newCommandTimeout: 300 };
   ```

4. **Clean up resources**
   ```javascript
   await agent.close();
   ```

5. **Use state detection for adaptive behavior**
   ```javascript
   const state = await agent.getState();
   if (state.hasModal) {
       await agent.tap('~closeModal');
   }
   ```

6. **Enable learning for complex workflows**
   ```javascript
   const agent = new MobileAgent({ enableLearning: true });
   ```

## Troubleshooting

### Appium Connection Failed

- Ensure Appium server is running: `appium --port 4723`
- Check device/emulator is connected: `adb devices` or `xcrun simctl list`

### Element Not Found

- Use `getPageSource()` to inspect current screen structure
- Try different selector types (id, text, xpath)
- Add wait time before finding element

### Slow Performance

- Use real devices instead of emulators when possible
- Reduce `newCommandTimeout` for faster failures
- Enable learning to optimize action selection

## Next Steps

- See [Reinforcement Learning Guide](./REINFORCEMENT_LEARNING.md) for RL integration
- Check [API Reference](./API_REFERENCE.md) for complete API documentation
- Explore [Examples](../examples/) for more use cases
