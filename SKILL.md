---
name: orbital-controller
description: Controls Android devices and tests apps wirelessly via the Orbital MCP Bridge. Use for inspecting live UI hierarchies, clicking elements, typing text, scrolling, launching apps, testing hardware toggles, and delegating autonomous on-device AI tasks.
---

# Orbital Android Controller & Execution Guide

This skill guides AI coding assistants (**Antigravity, Cursor, Claude Desktop, Windsurf, VS Code**) on how to interact with and execute mobile automation tasks through the **Orbital MCP Bridge (`orbital-phone`)**.

---

## 🏗️ End-to-End Task Execution Flow

Every MCP action follows an authenticated, hardware-level execution pipeline:

```mermaid
sequenceDiagram
    participant AI as AI Assistant (IDE)
    participant MCP as Orbital MCP Host (Node.js)
    participant Bridge as Orbital Bridge Client (Phone)
    participant Engine as ChatEngine / Room DB
    participant A11y as Android Accessibility Service

    AI->>MCP: Call Tool (e.g. execute_phone_task_batch)
    MCP->>MCP: Serialize Payload & Sign with HMAC-SHA256
    MCP->>Bridge: Send Signed WSS JSON Frame (with Nonce & Skew Window)
    Bridge->>Bridge: Verify 256-bit Crypto Signature & Nonce
    Bridge->>Engine: Bind & Initialize Session in Room DB
    loop Each Step in Plan
        Bridge->>A11y: Perform Node Tap / App Launch / Key Press
        Bridge->>Bridge: Apply delayAfterMs (UI Settle)
        opt Post-Step Assertion
            Bridge->>A11y: Capture Screen Hierarchy
            Bridge->>Bridge: Assert Text / UI State Present
        end
    end
    Bridge-->>MCP: Return BatchStepResults & Execution Telemetry
    MCP-->>AI: Formatted Content & Assertion Pass/Fail
```

---

## 🎯 The 4 Core Interaction Modes

### Mode 1: High-Speed Batch Interaction (`execute_phone_task_batch`)
**Best for:** Multi-step testing, form filling, and sequential UI flows in a single round-trip (<2s).
- Pre-plan a series of actions (`OPEN_APP`, `CLICK_NODE`, `TYPE_TEXT`, `PRESS_KEY`).
- Include `delayAfterMs` (e.g. 500-800ms) to allow screen rendering.
- Include `assertionText` to automatically verify expected UI states at critical steps.

### Mode 2: Autonomous On-Device AI Delegation (`ask_phone_ai`)
**Best for:** Complex natural language user goals without manually computing coordinates or node IDs.
- Example: `"Turn on flashlight and check remaining battery level"`
- The on-device companion routes locally through device intent heuristics and LLMs, records the session in Room DB, and returns the combined AI outcome.

### Mode 3: Interactive Exploration & Comprehension (`explore_and_analyze_app`)
**Best for:** Understanding unfamiliar mobile apps or extracting UX design systems.
- Launches target app, evaluates spatial layout (top bar, utilities, canvas, bottom navigation), and generates a structured product comprehension report.

### Mode 4: Discrete Step-by-Step Control
**Best for:** Fine-grained debugging or exploratory QA.
- `inspect_phone_screen` $\rightarrow$ inspects active view tree.
- `tap_phone_element` or `tap_phone_coordinates` $\rightarrow$ triggers click.
- `type_phone_text` $\rightarrow$ inputs text.
- `assert_screen_contains` $\rightarrow$ validates final visual outcome.

---

## 🛡️ Security & Reliability Best Practices

1. **Replay Protection**: The bridge enforces a 15-second timestamp window and consumes nonces via an LRU cache.
2. **Zero Hardcoding**: Never rely on static package names; use dynamic fuzzy lookup supported by the device package manager.
3. **Session Audit**: All batch tasks and phone AI delegations automatically persist to the phone's encrypted SQLite/Room database for full traceability.
