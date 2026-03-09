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

## Dynamic Configuration Updates

The MCP Proxy Server supports dynamic configuration updates without requiring clients to restart their connections. When the configuration changes (detected through polling the `CONFIGURATION_URL`), the server automatically:

1. **Reconnects to backend servers** - Establishes new connections to servers based on the updated configuration
2. **Sends list change notifications** - Notifies connected clients that the available resources, tools, and prompts may have changed

### List Change Notifications

When the configuration is updated, the proxy server sends the following MCP notifications to all connected clients:

- `notifications/resources/list_changed` - Indicates the list of available resources has changed
- `notifications/tools/list_changed` - Indicates the list of available tools has changed  
- `notifications/prompts/list_changed` - Indicates the list of available prompts has changed

These notifications allow MCP clients to refresh their local caches and update their user interfaces without requiring a restart. Clients that support these notifications will automatically reflect the new capabilities from the updated server configuration.

### Configuration Polling

The server polls the `CONFIGURATION_URL` at regular intervals (configurable via `CONFIGURATION_POLL_INTERVAL` environment variable). When a change is detected:

1. The server logs "Configuration changed, reconnecting clients"
2. Backend server connections are refreshed
3. List change notifications are sent to all connected clients
4. The server logs "Sending list changed notifications to connected clients"

This ensures that clients always have access to the most current set of tools, resources, and prompts available from the configured backend servers.

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

## Testing

The MCP Proxy Server includes a comprehensive test suite covering both stdio and SSE (Server-Sent Events) transports.

### Test Structure

The test suite is organized in the `test` directory with the following structure:

- `helpers.ts` - Mock implementations and testing utilities
  - Creates mock MCP servers with configurable tools, resources, and prompts
  - Provides mock transport implementations for testing
  - Includes utilities for creating test configurations
- `unit.test.ts` - Unit tests for individual components
  - Tests configuration loading and parsing
  - Verifies client connection management
  - Checks server creation and initialization
- `stdio.test.ts` - Integration tests for the StdioServerTransport
  - Tests server connection to stdio transport
  - Verifies request handling over stdio
  - Validates tools, resources, and prompts operations via stdio
- `sse.test.ts` - Integration tests for the SSEServerTransport
  - Tests server connection to SSE transport
  - Verifies HTTP endpoints for SSE communication
  - Checks message handling between client and server
- `proxy.test.ts` - End-to-end tests for the full proxy functionality
  - Tests aggregating results from multiple backend servers
  - Verifies forwarding requests to the appropriate backend
  - Checks error propagation and resource cleanup
- `index.test.ts` - Main test file that imports all tests

### Running Tests

The tests can be run using Bun's built-in testing capabilities:

```bash
# Run all tests
bun test

# Run tests with watch mode (auto-rerun on file changes)
bun test:watch

# Run tests with coverage reporting
bun test:coverage
```

### Type Errors in Tests

You may see TypeScript errors in the test files. This is expected and won't prevent the tests from running. The errors occur because:

1. We're using type assertions to handle the MCP SDK's complex types
2. We're mocking certain SDK functions that have complex signatures
3. We're accessing internal APIs for testing purposes

These type errors are confined to the test code and don't affect the actual application code.

#### Running Tests with Type Checking Disabled

To run tests without seeing TypeScript errors, you can use:

```bash
bun --bun test
```

This runs tests with Bun's native runtime instead of TypeScript.

### Test Coverage

The test suite verifies the MCP Proxy Server's ability to:

1. Connect to multiple backend MCP servers
2. Aggregate resources, tools, and prompts from these backends
3. Forward requests to the appropriate backend server
4. Handle various types of errors gracefully

Both stdio and SSE transports are thoroughly tested to ensure the MCP server functions correctly in both modes.


# Testing in MCP Proxy Server

## Unit Tests

This project uses Bun's built-in test runner for unit testing.

### Running Tests

To run all tests:

```bash
bun test
```

To run tests in watch mode (tests rerun when files change):

```bash
bun test --watch
```

To run tests with coverage reporting:

```bash
bun test --coverage
```

## Test Structure

- `test/` - Contains all test files
  - `logger.test.ts` - Tests for the logger module

## Mocking Strategy

The tests use Bun's built-in mocking functionality to mock:

- File system operations
- Date objects
- Bun.file API

This approach prevents tests from creating actual log files during test runs while still verifying the correct behavior.