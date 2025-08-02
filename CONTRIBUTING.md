# Contributing to Roku Package CLI

Thank you for your interest in contributing to the Roku Package CLI! This document provides guidelines and information for contributors.

## Development Setup

### Prerequisites

- Node.js v16 or higher
- npm or yarn
- A Roku device in developer mode (for testing)

### Getting Started

1. **Fork and clone the repository**
   ```bash
   git clone https://github.com/yourusername/roku-pkg-cli.git
   cd roku-pkg-cli
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Build the project**
   ```bash
   npm run build
   ```

4. **Link for local testing**
   ```bash
   npm link
   ```

## Project Structure

```
roku-pkg-cli/
├── src/
│   ├── commands/          # CLI command implementations
│   │   ├── add.ts         # Add project command
│   │   ├── device.ts      # Device configuration
│   │   ├── discover.ts    # Device discovery
│   │   ├── edit.ts        # Edit project command
│   │   ├── generate.ts    # Package generation
│   │   ├── list.ts        # List projects
│   │   └── remove.ts      # Remove project
│   ├── lib/              # Core libraries
│   │   ├── config-manager.ts    # Configuration management
│   │   ├── roku-api.ts          # Roku device API
│   │   ├── roku-deploy.ts       # Deployment logic
│   │   └── roku-discovery.ts    # Device discovery service
│   ├── types/            # TypeScript interfaces
│   │   └── index.ts      # Type definitions
│   ├── utils/            # Utility functions
│   │   ├── validators.ts      # Input validation
│   │   ├── vscode-config.ts   # VSCode integration
│   │   └── vscode-tasks.ts    # VSCode tasks integration
│   └── index.ts          # CLI entry point
├── tests/
│   ├── unit/             # Unit tests
│   └── integration/      # Integration tests
├── .github/
│   └── workflows/        # GitHub Actions
└── dist/                 # Compiled output (generated)
```

## Development Scripts

- `npm run build` - Compile TypeScript to JavaScript
- `npm run build:clean` - Clean build directory and rebuild
- `npm run dev` - Run in development mode with tsx
- `npm test` - Run test suite
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Generate test coverage report

## Making Changes

### 1. Create a Feature Branch

```bash
git checkout -b feature/your-feature-name
```

### 2. Code Style

- Use TypeScript with strict type checking
- Follow existing code formatting and conventions
- Use descriptive variable and function names
- Add JSDoc comments for public APIs

### 3. Testing

- Write unit tests for new functionality
- Ensure all tests pass before submitting
- Test CLI commands manually with real Roku devices when possible

### 4. Commit Messages

Use conventional commit format:

```
type(scope): description

Examples:
feat(discovery): add SSDP device discovery
fix(generate): handle timeout errors gracefully
docs(readme): update installation instructions
```

## Adding New Commands

1. Create a new file in `src/commands/`
2. Export a function that configures the command using Commander.js
3. Import and register the command in `src/index.ts`
4. Add tests in `tests/unit/`
5. Update README.md with documentation

Example command structure:

```typescript
import { Command } from 'commander';
import { ConfigManager } from '../lib/config-manager';

export function myCommand(program: Command): void {
    program
        .command('my-command')
        .description('Description of my command')
        .option('--flag', 'Optional flag')
        .action(async (options) => {
            // Implementation here
        });
}
```

## Device Discovery Development

When working on device discovery features:

- Test with multiple Roku device models
- Handle network timeouts gracefully
- Respect device privacy and security
- Follow SSDP protocol standards

## Testing

### Unit Tests

```bash
npm test
```

### Manual Testing

1. Link the CLI locally: `npm link`
2. Test with real Roku devices
3. Verify all automation flags work correctly
4. Test CI/CD scenarios

### Test Coverage

Aim for >80% test coverage for new features:

```bash
npm run test:coverage
```

## Documentation

- Update README.md for new features
- Add JSDoc comments for public APIs
- Update CHANGELOG.md
- Include examples in documentation

## Pull Request Process

1. **Create a descriptive PR title**
   - Use conventional commit format
   - Include the type of change (feat, fix, docs, etc.)

2. **Fill out the PR template**
   - Describe what changes were made
   - List any breaking changes
   - Include testing instructions

3. **Ensure CI passes**
   - All tests must pass
   - Build must succeed
   - No linting errors

4. **Request review**
   - Tag relevant maintainers
   - Respond to feedback promptly

## Release Process

Releases are automated through GitHub Actions:

1. **Version bump**: Update version in `package.json`
2. **Update CHANGELOG.md**: Document changes
3. **Create release**: Tag and publish on GitHub
4. **NPM publish**: Automated via GitHub Actions

## Getting Help

- Open an issue for bugs or feature requests
- Join discussions in GitHub Discussions
- Check existing documentation and issues first

## Code of Conduct

- Be respectful and inclusive
- Focus on constructive feedback
- Help create a welcoming environment for all contributors

Thank you for contributing to the Roku Package CLI! 🚀