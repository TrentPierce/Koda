/**
 * Mobile Driver - Appium Integration
 * Provides unified interface for iOS and Android automation
 */

const { remote } = require('webdriverio');

class MobileDriver {
    constructor(config = {}) {
        this.config = {
            platform: config.platform || 'android',
            deviceName: config.deviceName || 'emulator',
            platformVersion: config.platformVersion || '11.0',
            automationName: config.automationName || (config.platform === 'ios' ? 'XCUITest' : 'UiAutomator2'),
            app: config.app || null,
            appPackage: config.appPackage || null,
            appActivity: config.appActivity || null,
            bundleId: config.bundleId || null,
            udid: config.udid || null,
            isRealDevice: config.isRealDevice || false,
            newCommandTimeout: config.newCommandTimeout || 300,
            ...config
        };
        
        this.driver = null;
        this.isInitialized = false;
    }

    async initialize() {
        if (this.isInitialized) {
            return;
        }

        const capabilities = this.buildCapabilities();
        
        try {
            this.driver = await remote({
                protocol: 'http',
                hostname: 'localhost',
                port: 4723,
                path: '/wd/hub',
                capabilities
            });
            
            this.isInitialized = true;
            console.log('[MobileDriver] Initialized successfully for', this.config.platform);
        } catch (error) {
            console.error('[MobileDriver] Initialization failed:', error.message);
            throw new Error(`Failed to initialize mobile driver: ${error.message}`);
        }
    }

    buildCapabilities() {
        const baseCapabilities = {
            platformName: this.config.platform.toLowerCase() === 'ios' ? 'iOS' : 'Android',
            'appium:deviceName': this.config.deviceName,
            'appium:platformVersion': this.config.platformVersion,
            'appium:automationName': this.config.automationName,
            'appium:newCommandTimeout': this.config.newCommandTimeout
        };

        if (this.config.udid) {
            baseCapabilities['appium:udid'] = this.config.udid;
        }

        // Android specific
        if (this.config.platform.toLowerCase() === 'android') {
            if (this.config.app) {
                baseCapabilities['appium:app'] = this.config.app;
            }
            if (this.config.appPackage) {
                baseCapabilities['appium:appPackage'] = this.config.appPackage;
            }
            if (this.config.appActivity) {
                baseCapabilities['appium:appActivity'] = this.config.appActivity;
            }
            baseCapabilities['appium:autoGrantPermissions'] = true;
        }

        // iOS specific
        if (this.config.platform.toLowerCase() === 'ios') {
            if (this.config.app) {
                baseCapabilities['appium:app'] = this.config.app;
            }
            if (this.config.bundleId) {
                baseCapabilities['appium:bundleId'] = this.config.bundleId;
            }
            baseCapabilities['appium:autoAcceptAlerts'] = true;
        }

        return baseCapabilities;
    }

    async getDriver() {
        if (!this.isInitialized) {
            await this.initialize();
        }
        return this.driver;
    }

    async quit() {
        if (this.driver) {
            await this.driver.deleteSession();
            this.driver = null;
            this.isInitialized = false;
            console.log('[MobileDriver] Session closed');
        }
    }

    async restart() {
        await this.quit();
        await this.initialize();
    }

    getPlatform() {
        return this.config.platform;
    }

    isIOS() {
        return this.config.platform.toLowerCase() === 'ios';
    }

    isAndroid() {
        return this.config.platform.toLowerCase() === 'android';
    }
}

module.exports = MobileDriver;
