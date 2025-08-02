# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2024-01-XX

### Added
- Initial release of Roku Package CLI
- Command-line interface for managing multiple Roku projects
- Configuration file support (`roku-pkg-config.json`)
- Commands:
  - `list` - Display all projects and device configuration
  - `add` - Add new projects interactively
  - `edit` - Modify existing project configurations
  - `remove` - Delete projects with confirmation
  - `device` - Configure Roku device settings
  - `generate` - Rekey device and create packages
- File validation before operations
- Path expansion support (`~` for home directory)
- Interactive prompts for user-friendly experience
- Error handling with helpful tips
- Comprehensive documentation

### Security
- Configuration file excluded from git by default
- Passwords masked in CLI output

## [Unreleased]

### Planned Features
- Batch operations for multiple projects
- Project templates
- Version tracking for generated packages
- Cloud storage integration
- CI/CD pipeline examples 