module.exports = {
  testEnvironment: 'node',
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.test.js',
    '!src/**/index.js'
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  },
  testMatch: [
    '**/tests/**/*.test.js',
    '**/__tests__/**/*.js'
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/coverage/'
  ],
  verbose: true,
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  moduleNameMapper: {
    '^sharp$': '<rootDir>/tests/__mocks__/sharp.js',
    '^opencv4nodejs$': '<rootDir>/tests/__mocks__/opencv4nodejs.js',
    '^better-sqlite3$': '<rootDir>/tests/__mocks__/better-sqlite3.js'
  },
  transformIgnorePatterns: [
    '/node_modules/(?!(@google/generative-ai)/)'
  ]
};
