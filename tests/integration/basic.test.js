/**
 * Basic Integration Tests
 */

describe('Integration Tests', () => {
  test('environment should be configured', () => {
    expect(process.env.NODE_ENV).toBeDefined();
  });

  test('Node.js version should be >= 18', () => {
    const version = process.version;
    const major = parseInt(version.slice(1).split('.')[0]);
    expect(major).toBeGreaterThanOrEqual(18);
  });

  describe('Module Loading', () => {
    test('should load all exported modules without errors', () => {
      expect(() => {
        require('../../src/index');
      }).not.toThrow();
    });

    test('optional dependencies should not break module loading', () => {
      const loadModule = () => {
        try {
          require('../../src/index');
          return true;
        } catch (error) {
          if (!error.message.includes('opencv') &&
            !error.message.includes('better-sqlite3') &&
            !error.message.includes('keytar')) {
            throw error;
          }
          return true;
        }
      };

      expect(loadModule()).toBe(true);
    });
  });

  describe('Configuration', () => {
    test('should handle missing environment variables gracefully', () => {
      const originalEnv = process.env.GEMINI_API_KEY;
      delete process.env.GEMINI_API_KEY;

      expect(() => {
        require('../../src/index');
      }).not.toThrow();

      if (originalEnv) {
        process.env.GEMINI_API_KEY = originalEnv;
      }
    });
  });

  describe('System Compatibility', () => {
    test('should detect operating system', () => {
      expect(['darwin', 'linux', 'win32']).toContain(process.platform);
    });

    test('should have access to file system', () => {
      const fs = require('fs');
      expect(fs.existsSync(__filename)).toBe(true);
    });
  });
});
