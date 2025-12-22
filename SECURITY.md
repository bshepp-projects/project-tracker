# Security Policy

## Scope

Project Tracker is a local development tool that runs on your machine. It:
- Scans directories you specify on your local filesystem
- Runs a local server on localhost (not exposed to the network by default)
- Stores all data locally in JSON files

There is no authentication, user accounts, or network-facing API.

## Reporting a Vulnerability

If you discover a security issue, please open a GitHub issue describing:
- What the vulnerability is
- Steps to reproduce
- Potential impact

For issues that could affect users running the tool locally (e.g., path traversal, code injection), please email the maintainer directly rather than opening a public issue. Contact information is available in the repository.

## Security Considerations

When using Project Tracker:
- The server binds to `localhost` by default and is not accessible from other machines
- Directory paths you configure are stored in `server/directories.json`
- No data is sent to external services

If you modify the server to bind to `0.0.0.0` or expose it to a network, you assume responsibility for securing access.

