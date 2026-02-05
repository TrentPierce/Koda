# Contributing to BrowserAgent

Thank you for your interest in contributing to BrowserAgent! This document provides guidelines and instructions for contributing.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Testing](#testing)
- [Submitting Changes](#submitting-changes)
- [Release Process](#release-process)

## Code of Conduct

This project adheres to a code of conduct. By participating, you are expected to uphold this code:

- Be respectful and inclusive
- Welcome newcomers
- Focus on constructive feedback
- Respect different viewpoints and experiences

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm 9+
- Git

### Setup

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/BrowserAgent.git
   cd BrowserAgent
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

4. Create a `.env` file:
   ```bash
   cp .env.example .env
   # Edit .env with your API keys
   ```

5. Run tests to ensure everything works:
   ```bash
   npm test
   ```

## Development Workflow

### Branching Strategy

- `main` - Production-ready code
- `dev` - Development branch (create feature branches from here)
- `feature/*` - Feature branches
- `fix/*` - Bug fix branches

### Creating a Feature Branch

```bash
git checkout dev
git pull origin dev
git checkout -b feature/your-feature-name
```

### Making Changes

1. Make your changes in your feature branch
2. Follow the coding standards (see below)
3. Write or update tests as needed
4. Update documentation if applicable
5. Run the full test suite

## Coding Standards

### JavaScript Style Guide

We use ESLint with the following key rules:

- **Indentation**: 2 spaces
- **Quotes**: Single quotes (with escape support)
- **Semicolons**: Required
- **Line Endings**: Cross-platform (handled automatically)

### Code Quality

```bash
# Check for linting issues
npm run lint

# Auto-fix linting issues
npm run lint:fix
```

### Documentation

- Use JSDoc for all public APIs
- Include parameter types and descriptions
- Provide usage examples for complex functions

Example:
```javascript
/**
 * Create a new browser agent
 * @param {Object} options - Configuration options
 * @param {string} options.provider - LLM provider (gemini, openai, anthropic)
 * @param {string} options.apiKey - API key for the provider
 * @returns {Promise<BrowserAgent>} Initialized agent instance
 * @example
 * const agent = await createAgent({
 *   provider: 'gemini',
 *   apiKey: process.env.GEMINI_API_KEY
 * });
 */
async function createAgent(options) {
  // Implementation
}
```

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run with coverage report
npm run test:coverage

# Run specific test file
npm test -- tests/unit/core.test.js

# Run in watch mode (for development)
npm run test:watch
```

### Writing Tests

- Place tests in `tests/` directory
- Name test files with `.test.js` suffix
- Use descriptive test names
- Follow the Arrange-Act-Assert pattern

Example:
```javascript
describe('BrowserAgent', () => {
  describe('Initialization', () => {
    test('should initialize with valid config', async () => {
      // Arrange
      const config = { provider: 'gemini', apiKey: 'test' };
      
      // Act
      const agent = await createAgent(config);
      
      // Assert
      expect(agent).toBeDefined();
      expect(agent.initialized).toBe(true);
    });
  });
});
```

### Test Coverage

We aim for 70%+ coverage. Check coverage with:
```bash
npm run test:coverage
```

## Submitting Changes

### Before Submitting

1. Ensure all tests pass
2. Ensure linting passes
3. Update relevant documentation
4. Add entry to CHANGELOG.md if applicable

### Commit Messages

Use conventional commits format:

- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes
- `style:` Code style changes (formatting, semicolons, etc)
- `refactor:` Code refactoring
- `test:` Adding or updating tests
- `chore:` Build process or auxiliary tool changes

Examples:
```
feat: add Browserbase session pooling support
fix: resolve merge conflict in test files
docs: update README with enterprise features
test: add mocks for optional dependencies
```

### Pull Request Process

1. Push your branch to your fork
2. Create a pull request against the `dev` branch
3. Fill out the PR template completely
4. Ensure CI checks pass
5. Request review from maintainers
6. Address review feedback
7. Once approved, a maintainer will merge

### PR Checklist

- [ ] Tests pass locally
- [ ] Linting passes
- [ ] Documentation updated
- [ ] CHANGELOG.md updated
- [ ] Commit messages follow conventions
- [ ] PR description is clear and complete

## Release Process

Releases are managed by maintainers:

1. Version bumps follow [SemVer](https://semver.org/)
2. Releases are tagged with `v*.*.*` format
3. npm publishes happen automatically on tags
4. GitHub releases include changelogs

## Questions?

- Open an issue for bugs or feature requests
- Join discussions in existing issues
- Check existing documentation first

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to BrowserAgent! 🚀
