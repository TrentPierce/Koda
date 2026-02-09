/**
 * Koda - Intelligent Browser Automation Library
 * This project uses Koda by Trent Pierce
 * https://github.com/TrentPierce/Koda
 * Licensed under the Koda Non-Commercial License
 *
 * Copyright (c) 2026 Trent Pierce. All rights reserved.
 * See LICENSE file for full terms.
 */

// src/browser/index.js
const fs = require('fs');
const path = require('path');

// Browser adapters
const BrowserAdapter = require('./BrowserAdapter');
const ChromeAdapter = require('./ChromeAdapter');
const FirefoxAdapter = require('./FirefoxAdapter');
const SafariAdapter = require('./SafariAdapter');
const EdgeAdapter = require('./EdgeAdapter');
const PageAdapter = require('./PageAdapter');
const ContextManager = require('./ContextManager');
const { BrowserFactory, BROWSER_TYPES } = require('./BrowserFactory');

module.exports = {
  BrowserAdapter,
  ChromeAdapter,
  FirefoxAdapter,
  SafariAdapter,
  EdgeAdapter,
  PageAdapter,
  ContextManager,
  BrowserFactory,
  BROWSER_TYPES
};
