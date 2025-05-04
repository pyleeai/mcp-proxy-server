# mcp-proxy-server

A proxy server for Model Context Protocol (MCP) that allows connections to multiple backend MCP servers.

## Getting Started

### Installation

### Globally
Install the package globally:

```bash
npm install -g @pyleeai/mcp-proxy-server
```

### As a library

Install it in your project:

```bash
npm install @pyleeai/mcp-proxy-server
```

## Usage

If installed globally:

```bash
mcp-proxy-server
```

### Configuration

The MCP Proxy Server can be configured using environment variables. 

```
CONFIGURATION_URL="http://example.com/configuration"
LOG_PATH=./logs/mcp-proxy-server.log
```

#### Environment Variables
 - **The CONFIGURATION_URL is required**.
 - _The LOG_PATH is optional_.

#### Configuration JSON
The CONFIGURATION_URL points to JSON that contains the configuration for the proxy server. It should have the following structure:

```
{
    "mcp": {
        "servers": {
            "fetch": {
                "args": [
                    "mcp-server-fetch"
                ],
                "command": "uvx"
            },
            "filesystem": {
                "args": [
                    "-y",
                    "@modelcontextprotocol/server-filesystem",
                    "."
                ],
                "command": "npx"
            }
        }
    }
}
```

## Contributing

Contributions are welcome! Here's how you can contribute to the project:

### Prerequisites

- [Bun](https://bun.sh) v1.2.2 or later

### Setup

1. Clone the repository:

```bash
git clone https://github.com/your-username/mcp-proxy-server.git
cd mcp-proxy-server
```

2. Install dependencies:

```bash
bun install
```

### Usage

#### Running the Server

Start the server:

```bash
bun start
```

### Scripts

The project includes several npm scripts to help with development:

- `bun lint` - Lints the codebase using Biome
- `bun format` - Formats the codebase using Biome
- `bun check` - Runs both lint and format checks
- `bun typecheck` - Checks TypeScript types without emitting output
- `bun test` - Runs all tests
- `bun start` - Starts the development server
- `bun build` - Builds the project
- `bun inspector` - Runs the MCP inspector tool

### Code Style

This project uses [Biome](https://biomejs.dev/) for code formatting and linting. Please ensure your code follows these standards by running:

```bash
bun check
```

### Testing

The project uses Bun's built-in test runner for comprehensive testing.

#### Running Tests

```bash
# Run all tests
bun test

# Run tests with watch mode (auto-rerun on file changes)
bun test --watch

# Run tests with coverage reporting
bun test --coverage
```

#### Test Structure

The test suite is organized in the `test` directory with the following subdirectories:

- `test/unit` - Unit tests for individual components
- `test/integration` - Integration tests for combined components

### Publishing

To publish the package to npm using Bun:

1. Update the version in `package.json`:

```bash
bun run npm version [patch|minor|major]
```

2. Build the package:

```bash
bun run build
```

3. Publish to npm:

```bash
bun publish
```

_Note that publishing requires appropriate npm credentials and access rights_.

### Release Process

This project uses [GoReleaser](https://goreleaser.com/) for creating and publishing releases.

#### GoReleaser Configuration

The release process is defined in `.goreleaser.yaml` and includes:
- Building for multiple platforms (Linux, macOS, Windows)
- Support for both x64 and arm64 architectures
- Creating distributable archives 
- Generating changelogs
- Creating GitHub releases

#### Creating a Release

1. Tag a new version:

```bash
git tag -a v1.0.0 -m "Release v1.0.0"
```

2. Push the tag:

```bash
git push origin v1.0.0
```

3. The CI/CD pipeline will automatically:
   - Build for all target platforms
   - Create archives for distribution
   - Generate changelogs
   - Publish the release on GitHub
