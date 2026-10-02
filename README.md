# 🛰️ Orbital MCP Server (`orbital-mcp`)

[![npm version](https://img.shields.io/npm/v/orbital-mcp.svg?style=for-the-badge&color=7C3AED)](https://www.npmjs.com/package/orbital-mcp)
[![Model Context Protocol](https://img.shields.io/badge/Protocol-Model%20Context%20Protocol%20(MCP)-blue?style=for-the-badge)](https://modelcontextprotocol.io/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)

The official **Model Context Protocol (MCP)** server for controlling, inspecting, and testing Android devices wirelessly in real-time from AI coding assistants (**Antigravity, Claude Desktop, Cursor IDE, Windsurf, VS Code**) using the **[Orbital Android App](https://github.com/jaypal1046/Orbital)**.

---

## ⚡ Zero-Install Quick Start (Recommended)

You don't need to clone the full Android codebase or install manual dependencies. Run `orbital-mcp` instantly with `npx`:

```bash
npx -y orbital-mcp
```

This launches the local bridge host with automatic IP discovery, QR code pairing, and mDNS network broadcasting:

```text
================================================================
 🛰️  ORBITAL LAPTOP-TO-MOBILE AI BRIDGE (SECURE CRYPTO HOST)
================================================================
🔑 Pairing PIN   : ORB-7821
🔐 Crypto Key ID : 4A8F:B12C:99E1:F3D0 (256-bit Bitcoin-grade Auth)
🌐 Primary WSS   : wss://192.168.1.5:8765
📡 QuickShare NSD: _orbital-bridge._tcp (Laptop)
📱 Scan QR Code or Connect via Orbital App
================================================================
```

---

## 🛠️ AI IDE Configuration

### 1. Antigravity IDE (`mcp_config.json`)
```json
{
  "mcpServers": {
    "orbital-phone": {
      "command": "npx",
      "args": ["-y", "orbital-mcp"]
    }
  }
}
```

### 2. Claude Desktop (`claude_desktop_config.json`)
```json
{
  "mcpServers": {
    "orbital-phone": {
      "command": "npx",
      "args": ["-y", "orbital-mcp"]
    }
  }
}
```

### 3. Cursor / Windsurf IDE
In **Cursor Settings** $\rightarrow$ **Features** $\rightarrow$ **MCP Servers** $\rightarrow$ **Add New**:
- **Name**: `orbital-phone`
- **Type**: `command`
- **Command**: `npx -y orbital-mcp`

---

## 📱 Connect Your Android Device

1. Install the **[Orbital Android Companion](https://github.com/jaypal1046/Orbital/releases)** APK.
2. Grant **Accessibility Service** permission on the phone.
3. Open the side menu $\rightarrow$ tap **Laptop AI Bridge**.
4. Scan the QR code displayed in your terminal or enter the 4-digit PIN.
5. The device connects immediately over an encrypted WebSocket tunnel.

---

## 🧰 Full Suite of 13 MCP Tools

| # | MCP Tool | Arguments | Description |
|---|---|---|---|
| 1 | `inspect_phone_screen` | _None_ | Captures live UI hierarchy, node bounding boxes, resource IDs, and clickability states. |
| 2 | `tap_phone_element` | `targetText`, `targetId` | Taps interactive UI elements matching exact text or resource ID. |
| 3 | `tap_phone_coordinates` | `x`, `y` | Taps exact pixel coordinates on the phone screen. |
| 4 | `type_phone_text` | `text`, `targetLabel` | Enters text into focused or targeted input fields. |
| 5 | `open_phone_app` | `packageName` | Dynamically launches installed applications by name or package ID. |
| 6 | `swipe_phone_screen` | `direction`, `startX`, `startY`, `endX`, `endY` | Scrolls or gestures across the screen in any direction or custom vector. |
| 7 | `press_phone_key` | `key` (`BACK`, `HOME`, `RECENTS`, `NOTIFICATIONS`, etc.) | Triggers global Android navigation and hardware keys. |
| 8 | `execute_device_action` | `action`, `target`, `query`, `enabled` | Controls system toggles (`FLASHLIGHT`, `DEVICE_STATUS`, `SET_SOUND_MODE`, `OPEN_SETTING`, `SET_TIMER`, `SEARCH_WEB`, `OPEN_URL`). |
| 9 | `assert_screen_contains` | `expectedText` | Asserts that specific text or element exists on the screen for test verification. |
| 10 | `ask_phone_ai` | `prompt`, `sessionTitle` | Delegates high-level natural language goals to the on-device Orbital AI companion. |
| 11 | `execute_phone_task_batch` | `planTitle`, `steps[]`, `stopOnError`, `createNewSession` | Executes multi-step batch interaction plans in a single round-trip with post-step assertions and telemetry. |
| 12 | `manage_phone_session` | `command` (`LIST`, `NEW`, `LOAD`, `RENAME`), `sessionId`, `title` | Manages persistent on-device Room-backed chat and execution sessions. |
| 13 | `explore_and_analyze_app` | `appName` | Autonomously explores any app, analyzes its spatial UI layout (top bar, utilities, canvas, bottom tabs), and generates a product comprehension report. |

---

## 🧪 Automated App Testing & QA

With `orbital-mcp`, agents can perform end-to-end multi-step verification on physical Android devices:

```json
{
  "planTitle": "Settings Display QA Flow",
  "steps": [
    { "actionType": "OPEN_APP", "packageName": "Settings", "delayAfterMs": 800, "assertionText": "Settings" },
    { "actionType": "CLICK_NODE", "targetText": "Display", "delayAfterMs": 500 },
    { "actionType": "INSPECT_SCREEN" },
    { "actionType": "PRESS_KEY", "keyCode": "HOME" }
  ]
}
```

---

## 🔒 Security & Privacy

- **100% Local**: Direct peer-to-peer WebSocket tunnel over your local network. No external servers or cloud middleman.
- **HMAC-SHA256 Authorization**: Every incoming MCP command is authenticated with a 256-bit cryptographic signature covering action parameters, timestamps, and nonces.
- **Payment App Shield**: Automatically conceals and freezes when banking or payment apps are active.

---

## 📂 Repositories & Resources

- **Standalone MCP Repository**: [https://github.com/jaypal1046/orbital_mcp](https://github.com/jaypal1046/orbital_mcp) (Direct clone for MCP-only developers)
- **Full Monorepo (Android App + Engine)**: [https://github.com/jaypal1046/Orbital](https://github.com/jaypal1046/Orbital)
- **Privacy Policy & Security Terms**: [https://github.com/jaypal1046/orbital_policy](https://github.com/jaypal1046/orbital_policy)
- **Zero-Install NPX Package**: `npx -y orbital-mcp`
- **License**: MIT
