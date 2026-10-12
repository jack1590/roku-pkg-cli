# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.1] - 2026-10-12

### Fixed
- `generate --json`: a sign failure caused by the device being keyed for another app now reports `KEY_MISMATCH` with a fix (run again with the rekey), instead of the device's "Failed: Invalid Password." and an unrelated `--package-only` hint.
- `generate --json`: `packagePath` in the result is always absolute, even when the project's output path is relative.

## [1.2.0] - 2026-10-11

### Added
- `generate --json`: progress as JSON lines (`step`, `log`, `result`). Never prompts; every prompt site fails with an error code instead. SIGTERM/SIGINT report `CANCELLED` and exit 130.
- `generate --host <ip>`: use a specific device without changing the saved one. Cannot be combined with `--discover`.
- `inspect <dir> [--json]`: manifest, build folder and VSCode tasks of a Roku app folder.
- Projects can store `defaultBuildTask`, used by `--json` runs when no build flag is given.

### Changed
- The config file (`~/.roku-pkg/config.json`) is now written readable only by its owner (0600). It holds sign keys and the device password.

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