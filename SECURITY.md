# Security Policy

## Scope

PrintHub is a **local/LAN debugging tool**. The Bridge listens on TCP **9100** and HTTP/WebSocket **8081** on your machine or network. It is not intended to be exposed directly to the public internet.

## Reporting a vulnerability

If you find a security issue, please **do not** open a public issue with exploit details.

Instead, open a [GitHub Security Advisory](https://github.com/JackieLeee/PrintHub/security/advisories/new) or contact the repository owner privately.

Include:

- Description of the issue
- Steps to reproduce
- Impact assessment (especially for LAN exposure or arbitrary code execution)

## Supported versions

Security fixes are applied to the latest `main` branch. There are no long-term release branches at this time.

## Deployment guidance

- Run Bridge only on trusted networks.
- Do not port-forward 9100/8081 to the public internet without additional access controls.
- Treat received print payloads as untrusted input when adding new parsers or APIs.
