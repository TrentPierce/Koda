/**
 * Mobile Automation Module
 * Exports all mobile-related classes
 */

const MobileAgent = require('./mobileAgent');
const MobileDriver = require('./mobileDriver');
const MobileCommands = require('./mobileCommands');
const PlatformSelectors = require('./platformSelectors');
const MobileStateDetector = require('./mobileStateDetector');
const DeviceManager = require('./deviceManager');

module.exports = {
  MobileAgent,
  MobileDriver,
  MobileCommands,
  PlatformSelectors,
  MobileStateDetector,
  DeviceManager
};
