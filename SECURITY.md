# 🛡️ Security Policy — Orbital MCP Bridge

## Supported Versions

| Version | Supported          |
| :---    | :---               |
| `1.x.x` | :white_check_mark: |
| `< 1.0` | :x:                |

## Security Invariants

1. **HMAC-SHA256 Signing**: Every action payload sent to the phone is cryptographically signed with a 256-bit secret, 15-second timestamp skew check, and unique nonce.
2. **Local P2P Communication**: The bridge only connects directly to your phone over local Wi-Fi / WebSockets (no cloud relay).
3. **Safe Field Filtering**: Screen inspect and accessibility calls avoid capturing banking and credential inputs.

## Reporting a Vulnerability

Please report security issues privately to `jaypal24202899@gmail.com` or via [GitHub Security Advisories](https://github.com/jaypal1046/orbital_mcp/security/advisories/new).
