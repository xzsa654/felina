## ADDED Requirements

### Requirement: Bundle tokscale binary as a Tauri sidecar

The build pipeline SHALL bundle the platform-native tokscale binary into the application installer via Tauri `bundle.externalBin`, placing it in the same directory as the main executable at install time. The bundled binary version MUST be pinned to a constant in the fetch script and MUST NOT track a floating latest tag.

#### Scenario: installer contains the platform binary

- **WHEN** the application bundle is built for a target platform
- **THEN** the produced installer SHALL contain the tokscale binary matching that platform's target triple
- **THEN** installing the application SHALL place the tokscale binary in the same directory as the main executable

#### Scenario: pinned version is reproducible

- **WHEN** the fetch script runs twice with the same pinned version
- **THEN** the second run SHALL detect the existing binary and skip the download

### Requirement: Fetch pinned binary from npm registry at build time

The build pipeline SHALL download the platform-specific tokscale binary from the official npm registry platform packages, extract the native binary from the package tarball, and write it to the sidecar staging directory named by Rust target triple. The staging directory MUST be excluded from version control.

#### Scenario: binary is fetched for the current platform

- **WHEN** the fetch script runs without arguments
- **THEN** it SHALL derive the Rust target triple from the current platform
- **THEN** it SHALL download the matching npm platform package tarball, extract the binary, and write it as the triple-suffixed sidecar file

##### Example: platform package mapping

| Rust target triple | npm package |
| ------------------ | ----------- |
| x86_64-pc-windows-msvc | @tokscale/cli-win32-x64-msvc |
| aarch64-apple-darwin | @tokscale/cli-darwin-arm64 |
| x86_64-apple-darwin | @tokscale/cli-darwin-x64 |

#### Scenario: registry unavailable without cached binary

- **WHEN** the npm registry is unreachable and no staged binary exists for the target
- **THEN** the fetch script SHALL exit non-zero with an explicit error message
- **THEN** the application build SHALL fail rather than produce an installer without the sidecar

#### Scenario: tarball layout is unexpected

- **WHEN** the downloaded tarball does not contain the expected binary path
- **THEN** the fetch script SHALL exit non-zero and list the tarball contents in the error output
