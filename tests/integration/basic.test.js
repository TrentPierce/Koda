/**
 * Basic Integration Tests
<<<<<<< HEAD
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

=======
 * Tests for basic integration scenarios
 */

describe('Basic Integration', () => {
>>>>>>> fix/ci-workflow-failures
  describe('Module Loading', () => {
    test('should load all exported modules without errors', () => {
      expect(() => {
        require('../../src/index');
      }).not.toThrow();
    });

    test('optional dependencies should not break module loading', () => {
<<<<<<< HEAD
=======
      // Test that module loads even if optional deps are missing
>>>>>>> fix/ci-workflow-failures
      const loadModule = () => {
        try {
          require('../../src/index');
          return true;
        } catch (error) {
<<<<<<< HEAD
          if (!error.message.includes('opencv') &&
            !error.message.includes('better-sqlite3') &&
            !error.message.includes('keytar')) {
=======
          // Only fail if it's not an optional dependency issue
          if (!error.message.includes('opencv') && 
              !error.message.includes('better-sqlite3') && 
              !error.message.includes('keytar')) {
>>>>>>> fix/ci-workflow-failures
            throw error;
          }
          return true;
        }
      };
<<<<<<< HEAD

=======
      
>>>>>>> fix/ci-workflow-failures
      expect(loadModule()).toBe(true);
    });
  });

  describe('Configuration', () => {
    test('should handle missing environment variables gracefully', () => {
      const originalEnv = process.env.GEMINI_API_KEY;
      delete process.env.GEMINI_API_KEY;
<<<<<<< HEAD

      expect(() => {
        require('../../src/index');
      }).not.toThrow();

=======
      
      expect(() => {
        // Module should load even without API keys
        require('../../src/index');
      }).not.toThrow();
      
>>>>>>> fix/ci-workflow-failures
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
