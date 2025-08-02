# Roku Package CLI

A comprehensive command-line tool for managing multiple Roku projects and automating package (.pkg) generation with advanced device discovery and automation features.

## Features

- 🔍 **Device Discovery**: Automatically discover Roku devices on your network using SSDP
- 📺 **Multi-Project Management**: Manage multiple Roku projects in one place
- 🤖 **Full Automation**: Complete CI/CD support with non-interactive flags
- 🔐 **Secure Configuration**: Store signing credentials and device configurations securely
- 🏗️ **Build Integration**: Seamless integration with VSCode tasks and custom build commands
- 🚀 **Smart Deployment**: Automated device rekeying and package generation
- 🏠 **Device Management**: Automatic home screen navigation for clean workflow
- 💾 **Configuration Persistence**: JSON-based configuration with easy migration
- 🎯 **Interactive & Automated**: Support both interactive prompts and full automation
- ✅ **Validation & Error Handling**: Comprehensive project structure validation
- 🔧 **VSCode Integration**: Built-in support for VSCode launch.json and tasks.json

## Installation

### Prerequisites

- Node.js v16 or higher
- npm, yarn, or pnpm
- A Roku device in developer mode
- Roku app source code with proper structure

### Install from NPM (Recommended)

```bash
npm install -g @jcjoyac/roku-pkg-cli
```

### Install from Source

```bash
# Clone the repository
git clone https://github.com/jcjoyac/roku-pkg-cli.git
cd roku-pkg-cli

# Install dependencies
npm install

# Build the project
npm run build

# Link globally
npm link
```

## Quick Start

### Method 1: Using Device Discovery (Recommended)

1. **Discover and configure your Roku device**
   ```bash
   roku-pkg discover --configure
   ```

2. **Add your first project**
   ```bash
   roku-pkg add
   ```

3. **Generate a package with full automation**
   ```bash
   roku-pkg generate myproject --discover --first-device --password mypass
   ```

### Method 2: Manual Configuration

1. **Configure your Roku device manually**
   ```bash
   roku-pkg device
   ```

2. **Add your first project**
   ```bash
   roku-pkg add
   ```

3. **Build and generate a package**
   ```bash
   roku-pkg generate
   ```

## Configuration

The tool stores all configuration in a `roku-pkg-config.json` file in your current directory:

```json
{
  "rokuDevice": {
    "ip": "192.168.2.35",
    "password": "your-dev-password"
  },
  "projects": [
    {
      "name": "MyApp",
      "rootDir": "/path/to/roku/app/source",
      "signKey": "your-signing-key",
      "signPackageLocation": "/path/to/signed.pkg",
      "outputLocation": "./output/MyApp.pkg"
    }
  ]
}
```

## Commands

### Device Discovery & Management

#### `roku-pkg discover`
Discover Roku devices on your network using SSDP protocol.

```bash
# Basic discovery
roku-pkg discover

# Discover and configure immediately
roku-pkg discover --configure

# Automation: auto-select first device and provide password
roku-pkg discover --configure --first-device --password mypass
```

#### `roku-pkg device`
Configure Roku device settings.

```bash
roku-pkg device
```

### `roku-pkg generate [project]`
Build, deploy, and generate a package for a project. This will:
1. Validate the project structure
2. Read VSCode launch.json configuration (if available)
3. Use the configured build directory or detect it automatically
4. **Rekey the Roku device** with the project's signing key and package
5. Deploy the build to your Roku device
6. Create a new signed package
7. Save it to the specified output location

```bash
roku-pkg generate MyApp
# or
roku-pkg generate  # Select from list
```

## Project Structure Requirements

Your Roku app must follow the standard structure:

```
your-roku-app/
├── manifest          # Required: App configuration
├── source/           # Required: BrightScript source files
│   └── main.brs      # Required: Entry point
├── components/       # Optional: SceneGraph components
├── images/           # Optional: Image assets
└── fonts/            # Optional: Font files
```

## VSCode Integration

The tool automatically detects and uses VSCode launch.json configuration if present in your project. This allows seamless integration with your existing development workflow.

### Example .vscode/launch.json

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "brightscript",
      "request": "launch",
      "name": "BrightScript Debug: Launch",
      "rootDir": "${workspaceFolder}",
      "outDir": "${workspaceFolder}/dist",
      "stagingFolderPath": "${workspaceFolder}/.out"
    }
  ]
}
```

The tool will automatically:
- Read the build output directory from `stagingFolderPath`, `outDir`, or common build directories (`dist`, `build`, `out`, `.out`)
- Use the configured build directory for deployment
- Fall back to the project root if no build directory is found

## Workflow

### Setting up a new project

1. **Prepare your Roku app**: Ensure your app follows the standard Roku structure
2. **Get your signing credentials**: You need an existing signed .pkg file and its signing key
3. **Add the project**: Run `roku-pkg add` and provide all required information
4. **Generate packages**: Run `roku-pkg generate <project-name>` to build and package

## CI/CD Integration

The CLI is designed for seamless CI/CD integration with complete automation support:

```bash
# GitHub Actions, Jenkins, etc.
roku-pkg generate myproject \
  --discover \
  --first-device \
  --password "$ROKU_DEV_PASSWORD" \
  --build-task "build:production" \
  --skip-build  # if build happens in previous CI step
```

**Environment Variables:**
- Set `ROKU_DEV_PASSWORD` in your CI environment
- Use `--first-device` to automatically select the first discovered device
- Combine with `--build-task` to specify exact build commands

### The generation process

When you run `roku-pkg generate`, the tool will:

1. **Validate** your project structure
2. **Read** VSCode launch.json configuration (if available)
3. **Detect** the build directory automatically
4. **Deploy** the build to your Roku device using roku-deploy
5. **Rekey** your device with the project's signing key
6. **Generate** a signed .pkg file
7. **Save** the package to your specified output location

## Tips

### Path expansion
- The tool supports `~` in paths (expands to home directory)
- Relative paths are converted to absolute paths for rootDir

### Project validation
- The tool validates that your project has the required structure
- Missing files or directories will be reported before build

### Build artifacts
- The tool automatically detects build directories from VSCode configuration
- Common build directories are checked: `dist`, `build`, `out`, `.out`
- Final packages are saved to your configured output location

### Error handling
- Connection errors include helpful tips about network and device setup
- Build errors show what's missing in your project structure
- Authentication errors suggest checking passwords

## Troubleshooting

### "Project missing rootDir configuration"
- Your project needs to be updated with the root directory
- Run `roku-pkg edit <project>` to add the rootDir

### "Missing required file: manifest"
- Your Roku app is missing the manifest file
- Create a manifest file in your app's root directory

### "Missing required directory: source"
- Your Roku app needs a source directory
- Create a `source` folder with at least a `main.brs` file

### "Cannot connect to Roku device"
- Ensure your Roku is on the same network as your computer
- Verify developer mode is enabled on your Roku
- Check the IP address is correct
- Try pinging the device: `ping <roku-ip>`

### "Authentication failed"
- Verify your Roku developer password
- Re-run `roku-pkg device` to update credentials

### "Rekey operation failed"
- Check that the signing key matches the signed package
- Ensure the signed package file exists and is valid
- Verify the package was signed with the provided key

## Development

### Project Structure
```
roku-pkg-cli/
├── src/
│   ├── index.ts              # CLI entry point
│   ├── commands/             # Command implementations
│   ├── lib/                  # Core libraries
│   │   ├── config-manager.ts # Configuration management
│   │   ├── roku-api.ts       # Roku device API
│   │   └── roku-deploy.ts    # roku-deploy integration
│   ├── types/                # TypeScript types
│   └── utils/                # Utility functions
│       └── vscode-config.ts  # VSCode configuration reader
├── dist/                     # Compiled JavaScript
├── package.json
└── tsconfig.json
```

### Building
```bash
npm run build
```

### Development mode
```bash
npm run dev
```

## Dependencies

This tool uses the official [roku-deploy](https://github.com/RokuCommunity/roku-deploy) package from the Roku Community for building, deploying, and packaging Roku applications.

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request. 