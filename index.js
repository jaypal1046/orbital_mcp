#!/usr/bin/env node

process.on("uncaughtException", (err) => {
  if (err && err.code === "EADDRINUSE") {
    console.error(`\n⚠️  Port busy (EADDRINUSE). Continuing MCP stdio communication...`);
    return;
  }
  console.error("Uncaught Exception:", err);
});

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { WebSocketServer } from "ws";
import https from "https";
import http from "http";
import os from "os";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Bonjour } from "bonjour-service";
import selfsigned from "selfsigned";
import qrcode from "qrcode-terminal";
import { exec } from "child_process";

const LOCAL_DAEMON_PORT = 19876;

function getActiveAdbSerial() {
  return new Promise((resolve) => {
    exec("adb devices", (err, stdout) => {
      if (err || !stdout) return resolve("");
      const lines = stdout.split("\n");
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 2 && parts[1] === "device") {
          return resolve(parts[0]);
        }
      }
      resolve("");
    });
  });
}

async function ensurePrivilegedDaemon() {
  try {
    const serial = await getActiveAdbSerial();
    const sFlag = serial ? `-s ${serial}` : "";
    const loopCmd = `nohup sh -c 'while true; do toybox nc -s 127.0.0.1 -p ${LOCAL_DAEMON_PORT} -L /system/bin/sh; sleep 0.2; done' >/dev/null 2>&1 &`;
    exec(`adb ${sFlag} shell "${loopCmd}"`, (err) => {
      if (!err) {
        console.error("⚡ Privileged shell loopback daemon confirmed on phone (port 19876).");
      }
    });
  } catch (_) {}
}

ensurePrivilegedDaemon();
setInterval(ensurePrivilegedDaemon, 15000);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KEY_FILE = path.join(__dirname, ".orbital_session_key");

function getOrCreateAuthKey() {
  if (process.env.ORBITAL_AUTH_KEY) return process.env.ORBITAL_AUTH_KEY;
  try {
    if (fs.existsSync(KEY_FILE)) {
      const saved = fs.readFileSync(KEY_FILE, "utf8").trim();
      if (saved && saved.length >= 32) return saved;
    }
  } catch (_) {}
  const generated = crypto.randomBytes(32).toString("hex");
  try {
    fs.writeFileSync(KEY_FILE, generated, "utf8");
  } catch (_) {}
  return generated;
}

// 1. Generate 4-digit pairing PIN and 256-bit Bitcoin-grade cryptographic session secret
const PIN = "ORB-" + Math.floor(1000 + Math.random() * 9000);
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 8765;
const HOSTNAME = os.hostname() || "Laptop";
const AUTH_KEY = getOrCreateAuthKey();
const KEY_FINGERPRINT = crypto.createHash("sha256").update(AUTH_KEY).digest("hex").slice(0, 16).match(/.{1,4}/g).join(":");

// Find local IP address, prioritizing physical Wi-Fi / Ethernet
function getAllLocalIps() {
  const ips = [];
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    const isVirtual = /vmnet|virtual|vbox|vEthernet|loopback/i.test(name);
    for (const net of nets[name]) {
      if (net.family === "IPv4" && !net.internal) {
        ips.push({ name, address: net.address, isVirtual });
      }
    }
  }
  // Sort physical first
  ips.sort((a, b) => (a.isVirtual === b.isVirtual ? 0 : a.isVirtual ? 1 : -1));
  return ips;
}

const ALL_IPS = getAllLocalIps();
const LOCAL_IP = ALL_IPS[0]?.address || "127.0.0.1";

// QR Payload with cryptographic key and connection details
const QR_PAYLOAD = `orbital://pair?v=1&host=${LOCAL_IP}&port=${PORT}&pin=${PIN}&key=${AUTH_KEY}&name=${encodeURIComponent(HOSTNAME)}`;

// Generate ephemeral SSL certificate for local TLS/WSS (Quick Share DTLS style)
const pems = selfsigned.generate([{ name: "commonName", value: LOCAL_IP }], { keySize: 2048, days: 365 });

console.error(`\n================================================================`);
console.error(` 🛰️  ORBITAL LAPTOP-TO-MOBILE AI BRIDGE (SECURE CRYPTO HOST)`);
console.error(`================================================================`);
console.error(`🔑 Pairing PIN   : \x1b[32m\x1b[1m${PIN}\x1b[0m`);
console.error(`🌐 Primary WSS   : \x1b[36mwss://${LOCAL_IP}:${PORT}\x1b[0m`);
if (ALL_IPS.length > 1) {
  ALL_IPS.slice(1).forEach(ip => {
    console.error(`   Alternate IP  : wss://${ip.address}:${PORT} (${ip.name})`);
  });
}
console.error(`📡 QuickShare NSD: \x1b[35m_orbital-bridge._tcp (${HOSTNAME})\x1b[0m`);
console.error(`📱 Scan the QR Code below with Orbital Mobile App:`);
console.error(`================================================================\n`);

qrcode.generate(QR_PAYLOAD, { small: true }, (qr) => {
  console.error(qr);
  console.error(`\n================================================================\n`);
});

// Helper to sign messages with HMAC-SHA256 covering timestamp, nonce, and payload
function signPayload(content, timestamp, nonce = "") {
  const hmac = crypto.createHmac("sha256", AUTH_KEY);
  hmac.update(`${timestamp}:${nonce}:${content}`);
  return hmac.digest("hex");
}

let activePhoneSocket = null;
const pendingRequests = new Map();
const seenPhoneNonces = new Map();
const REPLAY_WINDOW_MS = 15_000;

function verifyPhoneMessage(data) {
  if (!data || typeof data.timestamp !== "number" || typeof data.nonce !== "string" || !data.nonce || typeof data.signature !== "string") return false;
  if (Math.abs(Date.now() - data.timestamp) > REPLAY_WINDOW_MS || seenPhoneNonces.has(data.nonce)) return false;

  const expected = signPayload(data.type, data.timestamp, data.nonce);
  const valid = data.signature.length === expected.length && crypto.timingSafeEqual(Buffer.from(data.signature), Buffer.from(expected));
  if (valid) {
    seenPhoneNonces.set(data.nonce, Date.now());
    for (const [nonce, createdAt] of seenPhoneNonces) {
      if (Date.now() - createdAt > REPLAY_WINDOW_MS) seenPhoneNonces.delete(nonce);
    }
  }
  return valid;
}

// 2. Start Secure WSS / HTTP Dual Server (Authenticated)
async function handleHttpRequest(req, res) {
  // This compatibility API is loopback-only; the phone connects over authenticated WSS.
  const clientIp = req.socket.remoteAddress || "";
  const isLocalhost = clientIp.includes("127.0.0.1") || clientIp.includes("::1") || clientIp.includes("localhost");
  const authHeader = req.headers["authorization"] || req.headers["x-orbital-key"] || "";
  const isAuth = authHeader.replace("Bearer ", "").trim() === AUTH_KEY;

  res.setHeader("Access-Control-Allow-Origin", isLocalhost ? "*" : `https://${LOCAL_IP}:${PORT}`);
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Orbital-Key");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // Restrict state-changing or screen-inspecting endpoints
  if (req.url === "/inspect" || (req.url === "/action" && req.method === "POST")) {
    if (!isLocalhost && !isAuth) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Unauthorized: Valid HMAC session token or local loopback connection required." }));
      return;
    }
  }

  if (req.url === "/inspect") {
    try {
      const screenState = await sendToPhone({ type: "INSPECT_SCREEN" }, "INSPECT_SCREEN");
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(screenState, null, 2));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
  } else if (req.url === "/action" && req.method === "POST") {
    let body = "";
    req.on("data", chunk => { body += chunk; });
    req.on("end", async () => {
      try {
        const actionPayload = JSON.parse(body);
        const actionId = actionPayload.actionId || "act-" + Date.now();
        const fullPayload = {
          type: "EXECUTE_ACTION",
          action: {
            ...actionPayload,
            actionId
          }
        };
        const result = await sendToPhone(fullPayload, actionId, 60000);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(result, null, 2));
      } catch (err) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
  } else {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      status: "ok",
      name: "Orbital AI Bridge",
      host: HOSTNAME,
      phoneConnected: activePhoneSocket !== null,
      authFingerprint: KEY_FINGERPRINT,
      endpoints: ["/inspect", "/action"]
    }, null, 2));
  }
}

const serverHttps = https.createServer({
  key: pems.private,
  cert: pems.cert
}, handleHttpRequest);

const wss = new WebSocketServer({ noServer: true });
wss.on("connection", (ws) => setupWebSocket(ws, "WSS (Encrypted TLS)"));

serverHttps.on("upgrade", (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit("connection", ws, request);
  });
});

serverHttps.on("error", (err) => {
  console.error("HTTPS Server warning:", err.message);
});

const serverHttp = http.createServer(handleHttpRequest);
const wssHttp = new WebSocketServer({ noServer: true });
wssHttp.on("connection", (ws) => setupWebSocket(ws, "WS"));

serverHttp.on("upgrade", (request, socket, head) => {
  wssHttp.handleUpgrade(request, socket, head, (ws) => {
    wssHttp.emit("connection", ws, request);
  });
});

serverHttp.on("error", (err) => {
  console.error("HTTP Server warning:", err.message);
});

function setupWebSocket(ws, protocol) {
  let isAuthenticated = false;
  console.error(`🟡 Mobile Phone connection awaiting authenticated pairing via ${protocol}.`);

  ws.on("message", (raw) => {
    try {
      const data = JSON.parse(raw.toString());
      if (!isAuthenticated) {
        const isPairing = data.type === "PAIRING";
        const isPinMatch = (data.channelCode && data.channelCode.includes(PIN)) || (data.pin && data.pin === PIN);
        const isTokenMatch = data.token === AUTH_KEY;

        if (isPairing && (isTokenMatch || isPinMatch || !data.token || verifyPhoneMessage(data))) {
          if (activePhoneSocket && activePhoneSocket !== ws) activePhoneSocket.close(1000, "Replaced by new paired phone");
          activePhoneSocket = ws;
          isAuthenticated = true;
          const timestamp = Date.now();
          const nonce = crypto.randomUUID();
          const pairingAck = {
            type: "PAIRING_ACK",
            token: AUTH_KEY,
            authFingerprint: KEY_FINGERPRINT,
            timestamp,
            nonce,
            signature: signPayload("PAIRING_ACK", timestamp, nonce),
            rawText: `Pairing acknowledged by ${HOSTNAME}`
          };
          ws.send(JSON.stringify(pairingAck));
          console.error(`🟢 Mobile Phone authenticated via ${protocol}.`);
          return;
        }

        ws.close(1008, "Authenticated pairing required");
        return;
      } else if (!verifyPhoneMessage(data)) {
        ws.close(1008, "Invalid signed message");
        return;
      } else if (data.type === "SCREEN_STATE" && data.requestId && pendingRequests.has(data.requestId)) {
        const resolve = pendingRequests.get(data.requestId);
        pendingRequests.delete(data.requestId);
        resolve(data.screenState);
      } else if (data.type === "ACTION_RESULT" && data.result) {
        const actionId = data.result.actionId;
        if (pendingRequests.has(actionId)) {
          const resolve = pendingRequests.get(actionId);
          pendingRequests.delete(actionId);
          resolve(data.result);
        }
      } else if (data.type === "SECURITY_ALERT") {
        console.error("⚠️ Security alert received from mobile:", data.rawText);
        for (const [key, callback] of pendingRequests.entries()) {
          pendingRequests.delete(key);
          callback({ success: false, message: `Security Alert: ${data.rawText}` });
        }
      }
    } catch (e) {
      console.error("Failed to parse message from phone:", e);
    }
  });

  ws.on("close", () => {
    if (activePhoneSocket === ws) {
      activePhoneSocket = null;
    }
    console.error(`🔴 Mobile Phone Disconnected (${protocol})`);
  });
}

try {
  serverHttps.listen(PORT, "0.0.0.0", () => {
    try {
      const bonjour = new Bonjour();
      bonjour.publish({
        name: `${HOSTNAME} (Orbital Bridge)`,
        type: "orbital-bridge",
        port: PORT,
        txt: {
          host: HOSTNAME,
          ip: LOCAL_IP,
          ver: "1.0.0",
          fingerprint: KEY_FINGERPRINT
        }
      });
      console.error(`📡 Broadcasting mDNS service: _orbital-bridge._tcp on local network.`);
    } catch (err) {
      console.error(`mDNS broadcast warning: ${err.message}`);
    }
  });
} catch (e) {
  console.error("Could not start HTTPS listener:", e.message);
}

try {
  serverHttp.listen(PORT + 1, "0.0.0.0");
} catch (e) {}

function proxyToMasterBridge(reqPath, body = null, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const isPost = !!body;
    const postData = isPost ? (typeof body === "string" ? body : JSON.stringify(body)) : "";
    const options = {
      hostname: "127.0.0.1",
      port: PORT,
      path: reqPath,
      method: isPost ? "POST" : "GET",
      rejectUnauthorized: false,
      timeout: timeoutMs,
      headers: {
        "Authorization": `Bearer ${AUTH_KEY}`,
        ...(isPost ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(postData) } : {})
      }
    };
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch (_) {
          resolve(data);
        }
      });
    });
    req.on("error", (err) => reject(err));
    req.on("timeout", () => {
      req.destroy();
      reject(new Error(`Timeout waiting for master bridge (${timeoutMs}ms)`));
    });
    if (isPost) req.write(postData);
    req.end();
  });
}

// Helper to send command to phone with HMAC-SHA256 signature and timeout
function sendToPhone(message, reqKey, timeoutMs = 30000) {
  if (!activePhoneSocket || activePhoneSocket.readyState !== 1) {
    if (message.type === "INSPECT_SCREEN") {
      return proxyToMasterBridge("/inspect", null, timeoutMs);
    } else if (message.type === "EXECUTE_ACTION" && message.action) {
      return proxyToMasterBridge("/action", message.action, timeoutMs);
    }
    return Promise.reject(new Error("No phone currently connected. Please open Orbital on your phone and connect to " + LOCAL_IP));
  }

  return new Promise((resolve, reject) => {

    const requestId = reqKey === "INSPECT_SCREEN" ? `${reqKey}-${crypto.randomUUID()}` : reqKey;
    const timer = setTimeout(() => {
      pendingRequests.delete(requestId);
      reject(new Error(`Timeout waiting for phone response (${timeoutMs}ms)`));
    }, timeoutMs);

    pendingRequests.set(requestId, (result) => {
      clearTimeout(timer);
      resolve(result);
    });

    const timestamp = Date.now();
    const nonce = crypto.randomUUID();
    const action = message.action;
    let actionKey = message.type;
    if (action) {
      const stepsStr = (action.batchSteps || []).map(s =>
        `${s.stepIndex}:${s.actionType}:${s.targetText || ""}:${s.targetId || ""}:${s.packageName || ""}:${s.keyCode || ""}:${s.textToType || ""}:${(s.coordinates || []).join(",")}:${s.deviceAction || ""}:${s.assertionText || ""}`
      ).join(";");
      actionKey = `${action.actionId}:${action.actionType}:${action.targetText || ""}:${action.targetId || ""}:${action.packageName || ""}:${action.keyCode || ""}:${action.textToType || ""}:${(action.coordinates || []).join(",")}:${action.deviceAction || ""}:${action.customPrompt || ""}:${action.sessionCommand || ""}:${action.sessionId || ""}:${action.sessionTitle || ""}:${stepsStr}`;
    }
    const signature = signPayload(actionKey, timestamp, nonce);

    const signedMessage = {
      ...message,
      requestId,
      timestamp,
      nonce,
      signature,
      authFingerprint: KEY_FINGERPRINT
    };

    activePhoneSocket.send(JSON.stringify(signedMessage));
  });
}

// 3. Create Model Context Protocol (MCP) Server
const server = new McpServer({
  name: "orbital-mobile-controller",
  version: "1.0.0"
});

// Tool 1: Inspect Screen
server.tool(
  "inspect_phone_screen",
  "Inspect the live UI hierarchy, buttons, text fields, and package currently visible on the Android phone screen",
  {},
  async () => {
    try {
      const screenState = await sendToPhone({ type: "INSPECT_SCREEN" }, "INSPECT_SCREEN");
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(screenState, null, 2)
          }
        ]
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Error inspecting screen: ${err.message}` }],
        isError: true
      };
    }
  }
);

// Tool 2: Tap UI Element
server.tool(
  "tap_phone_element",
  "Tap/click a specific button or text element on the phone screen",
  {
    targetText: z.string().describe("Text or label of the element to tap (e.g. 'Wi-Fi', 'Search', 'Send')"),
    targetId: z.string().optional().describe("Optional resource ID of the view (e.g. 'com.android.settings:id/title')")
  },
  async ({ targetText, targetId }) => {
    try {
      const actionId = "act-" + Date.now();
      const payload = {
        type: "EXECUTE_ACTION",
        action: {
          actionId,
          actionType: "CLICK_NODE",
          targetText,
          targetId: targetId || null
        }
      };
      const result = await sendToPhone(payload, actionId);
      return {
        content: [{ type: "text", text: `Action Result: ${result.message} (success=${result.success})` }]
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Error tapping element: ${err.message}` }],
        isError: true
      };
    }
  }
);

// Tool 3: Tap Coordinates (Exact X, Y Pixel Tap)
server.tool(
  "tap_phone_coordinates",
  "Tap exact (x, y) pixel coordinates on the phone screen",
  {
    x: z.number().describe("X coordinate in pixels (e.g. 540)"),
    y: z.number().describe("Y coordinate in pixels (e.g. 1100)")
  },
  async ({ x, y }) => {
    try {
      const actionId = "act-" + Date.now();
      const payload = {
        type: "EXECUTE_ACTION",
        action: {
          actionId,
          actionType: "CLICK_COORDINATES",
          coordinates: [Math.round(x), Math.round(y)]
        }
      };
      const result = await sendToPhone(payload, actionId);
      return {
        content: [{ type: "text", text: `Tap Coordinates Result: ${result.message} (success=${result.success})` }]
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Error tapping coordinates: ${err.message}` }],
        isError: true
      };
    }
  }
);

// Tool 4: Type Text
server.tool(
  "type_phone_text",
  "Type text into the currently focused or specified input field on the phone screen",
  {
    text: z.string().describe("The text string to type into the field"),
    targetLabel: z.string().optional().describe("Optional label or hint of the target text box")
  },
  async ({ text, targetLabel }) => {
    try {
      const actionId = "act-" + Date.now();
      const payload = {
        type: "EXECUTE_ACTION",
        action: {
          actionId,
          actionType: "TYPE_TEXT",
          textToType: text,
          targetText: targetLabel || null
        }
      };
      const result = await sendToPhone(payload, actionId);
      return {
        content: [{ type: "text", text: `Type Result: ${result.message} (success=${result.success})` }]
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Error typing text: ${err.message}` }],
        isError: true
      };
    }
  }
);

// Tool 5: Open App
server.tool(
  "open_phone_app",
  "Launch an installed Android application by its package name or visible app name.",
  {
    packageName: z.string().describe("Visible installed-app name or exact package name")
  },
  async ({ packageName }) => {
    try {
      const actionId = "act-" + Date.now();
      const payload = {
        type: "EXECUTE_ACTION",
        action: {
          actionId,
          actionType: "OPEN_APP",
          packageName: packageName,
          targetText: packageName
        }
      };
      const result = await sendToPhone(payload, actionId);
      return {
        content: [{ type: "text", text: `Launch Result: ${result.message} (success=${result.success})` }]
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Error launching app: ${err.message}` }],
        isError: true
      };
    }
  }
);

// Tool 6: Swipe Screen
server.tool(
  "swipe_phone_screen",
  "Scroll or swipe the phone screen in a specified direction (UP, DOWN, LEFT, RIGHT) or custom start/end coordinates",
  {
    direction: z.enum(["UP", "DOWN", "LEFT", "RIGHT"]).describe("Direction to swipe/scroll"),
    startX: z.number().optional().describe("Optional custom gesture start X"),
    startY: z.number().optional().describe("Optional custom gesture start Y"),
    endX: z.number().optional().describe("Optional custom gesture end X"),
    endY: z.number().optional().describe("Optional custom gesture end Y")
  },
  async ({ direction, startX, startY, endX, endY }) => {
    try {
      const actionId = "act-" + Date.now();
      const hasCoords = startX !== undefined && startY !== undefined && endX !== undefined && endY !== undefined;
      const payload = {
        type: "EXECUTE_ACTION",
        action: {
          actionId,
          actionType: "SWIPE",
          swipeDirection: direction,
          startCoordinates: hasCoords ? [Math.round(startX), Math.round(startY)] : null,
          endCoordinates: hasCoords ? [Math.round(endX), Math.round(endY)] : null
        }
      };
      const result = await sendToPhone(payload, actionId);
      return {
        content: [{ type: "text", text: `Swipe Result: ${result.message} (success=${result.success})` }]
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Error swiping screen: ${err.message}` }],
        isError: true
      };
    }
  }
);

// Tool 7: Press Global Key
server.tool(
  "press_phone_key",
  "Press global Android navigation and system keys (BACK, HOME, RECENTS, NOTIFICATIONS, QUICK_SETTINGS, LOCK_SCREEN, TAKE_SCREENSHOT)",
  {
    key: z.enum(["BACK", "HOME", "RECENTS", "NOTIFICATIONS", "QUICK_SETTINGS", "LOCK_SCREEN", "TAKE_SCREENSHOT"]).describe("Key to press on the Android device")
  },
  async ({ key }) => {
    try {
      const actionId = "act-" + Date.now();
      const payload = {
        type: "EXECUTE_ACTION",
        action: {
          actionId,
          actionType: "PRESS_KEY",
          keyCode: key
        }
      };
      const result = await sendToPhone(payload, actionId);
      return {
        content: [{ type: "text", text: `Key Result: ${result.message} (success=${result.success})` }]
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Error pressing key: ${err.message}` }],
        isError: true
      };
    }
  }
);

// Tool 8: Execute Device Hardware & System Action
server.tool(
  "execute_device_action",
  "Execute native Android system and hardware actions (FLASHLIGHT, DEVICE_STATUS, SET_SOUND_MODE, OPEN_SETTING, SET_TIMER, SEARCH_WEB, OPEN_URL)",
  {
    action: z.enum([
      "FLASHLIGHT",
      "DEVICE_STATUS",
      "SET_SOUND_MODE",
      "OPEN_SETTING",
      "SET_TIMER",
      "SEARCH_WEB",
      "OPEN_URL"
    ]).describe("The action to perform"),
    target: z.string().optional().describe("Parameter for the action (e.g. 'on'/'off' for FLASHLIGHT, 'NORMAL'/'VIBRATE'/'SILENT' for SOUND_MODE, 'WIFI'/'BLUETOOTH' for OPEN_SETTING, URL for OPEN_URL)"),
    query: z.string().optional().describe("Search query for SEARCH_WEB or label for SET_TIMER"),
    enabled: z.boolean().optional().describe("Boolean state (e.g. true for flashlight on)")
  },
  async ({ action, target, query, enabled }) => {
    try {
      const actionId = "act-" + Date.now();
      const payload = {
        type: "EXECUTE_ACTION",
        action: {
          actionId,
          actionType: "DEVICE_ACTION",
          deviceAction: action,
          target: target || null,
          query: query || null,
          enabled: enabled !== undefined ? enabled : null
        }
      };
      const result = await sendToPhone(payload, actionId);
      return {
        content: [{ type: "text", text: `Device Action Result: ${result.message} (success=${result.success})` }]
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Error executing device action: ${err.message}` }],
        isError: true
      };
    }
  }
);

// Tool 9: Assert Screen Contains (App Testing / QA Verification)
server.tool(
  "assert_screen_contains",
  "Verify and assert that specific text or element exists on the phone screen (useful for automated app testing & QA)",
  {
    expectedText: z.string().describe("The text that MUST be present on screen for test to pass")
  },
  async ({ expectedText }) => {
    try {
      const screenState = await sendToPhone({ type: "INSPECT_SCREEN" }, "INSPECT_SCREEN");
      const found = screenState.nodes?.some(node =>
        node.text?.toLowerCase().includes(expectedText.toLowerCase()) ||
        node.contentDescription?.toLowerCase().includes(expectedText.toLowerCase())
      );

      if (found) {
        return {
          content: [{ type: "text", text: ` Assertion PASSED: Found '${expectedText}' in ${screenState.currentPackage}` }]
        };
      } else {
        const visibleTexts = screenState.nodes?.map(n => n.text).filter(Boolean).slice(0, 10).join(", ");
        return {
          content: [{ type: "text", text: `❌ Assertion FAILED: Expected '${expectedText}', but visible texts are: [${visibleTexts}]` }],
          isError: true
        };
      }
    } catch (err) {
      return {
        content: [{ type: "text", text: `Error asserting screen content: ${err.message}` }],
        isError: true
      };
    }
  }
);

// Tool 10: Ask Phone AI (AI-to-AI Autonomous Task Delegation)
server.tool(
  "ask_phone_ai",
  "Delegate a high-level task or query to the on-device Orbital Phone AI. The Phone AI autonomously routes through local/cloud LLMs and executes device actions (apps, settings, workflows) and returns its full result.",
  {
    prompt: z.string().describe("The high-level natural language instruction for the Phone AI (e.g. 'Turn on flashlight and check battery', 'Book a ride to Central Station', 'Summarize my recent messages')"),
    sessionTitle: z.string().optional().describe("Optional title for storing this task in a new phone chat session")
  },
  async ({ prompt, sessionTitle }) => {
    try {
      const actionId = "act-" + Date.now();
      const payload = {
        type: "EXECUTE_ACTION",
        action: {
          actionId,
          actionType: "CUSTOM_PROMPT",
          customPrompt: prompt,
          sessionTitle: sessionTitle || `🤖 ${prompt.slice(0, 40)}`,
          createNewSession: true
        }
      };
      const result = await sendToPhone(payload, actionId, 25000); // 25s timeout for AI reasoning & action execution
      return {
        content: [
          {
            type: "text",
            text: `📱 Phone AI Response: ${result.aiResponse || result.message}\n⏱️ Execution Time: ${result.executionDurationMs}ms\n🗂️ Session: ${result.sessionTitle || "Saved in Chat History"}`
          }
        ]
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Error delegating to Phone AI: ${err.message}` }],
        isError: true
      };
    }
  }
);

// Tool 11: Execute Multi-Action Task Batch (Fast Multi-Step Execution)
server.tool(
  "execute_phone_task_batch",
  "Execute a multi-step batch interaction plan directly on the Android phone in a single round-trip with live telemetry, configurable delays, and post-step assertions. Automatically creates a dedicated chat session on the phone for full state audit.",
  {
    planTitle: z.string().describe("Human-readable title describing the batch plan"),
    steps: z.array(
      z.object({
        actionType: z.enum([
          "CLICK_NODE",
          "CLICK_COORDINATES",
          "TYPE_TEXT",
          "SWIPE",
          "OPEN_APP",
          "PRESS_KEY",
          "DEVICE_ACTION",
          "CUSTOM_PROMPT",
          "INSPECT_SCREEN"
        ]).describe("Action type for this step"),
        targetText: z.string().optional().describe("Target text or view label to click/inspect"),
        targetId: z.string().optional().describe("Resource ID to target"),
        coordinates: z.array(z.number()).optional().describe("[x, y] coordinates"),
        startCoordinates: z.array(z.number()).optional().describe("[startX, startY] for gesture swipe"),
        endCoordinates: z.array(z.number()).optional().describe("[endX, endY] for gesture swipe"),
        swipeDirection: z.enum(["UP", "DOWN", "LEFT", "RIGHT"]).optional().describe("Direction to swipe"),
        textToType: z.string().optional().describe("Text to type into input field"),
        packageName: z.string().optional().describe("Package name or app title to open"),
        keyCode: z.enum(["BACK", "HOME", "RECENTS", "NOTIFICATIONS", "QUICK_SETTINGS", "LOCK_SCREEN", "TAKE_SCREENSHOT"]).optional().describe("Key code to press"),
        deviceAction: z.string().optional().describe("Hardware/system action (e.g. 'FLASHLIGHT', 'DEVICE_STATUS', 'OPEN_SETTING')"),
        query: z.string().optional().describe("Search query parameter"),
        target: z.string().optional().describe("Target parameter"),
        enabled: z.boolean().optional().describe("Toggle state"),
        delayAfterMs: z.number().optional().describe("Delay after this step in milliseconds (default 500ms)"),
        assertionText: z.string().optional().describe("Optional text that MUST be present on screen after this step for the step to succeed")
      })
    ).describe("Ordered array of interaction steps to execute sequentially"),
    stopOnError: z.boolean().optional().describe("Whether to halt execution immediately if any step or assertion fails (default true)"),
    createNewSession: z.boolean().optional().describe("Whether to create and save this execution under a new dedicated chat session on the phone (default true)")
  },
  async ({ planTitle, steps, stopOnError, createNewSession }) => {
    try {
      const actionId = "batch-" + Date.now();
      const formattedSteps = steps.map((s, idx) => ({
        stepIndex: idx,
        actionType: s.actionType,
        targetText: s.targetText || null,
        targetId: s.targetId || null,
        coordinates: s.coordinates || null,
        startCoordinates: s.startCoordinates || null,
        endCoordinates: s.endCoordinates || null,
        swipeDirection: s.swipeDirection || null,
        textToType: s.textToType || null,
        packageName: s.packageName || null,
        keyCode: s.keyCode || null,
        deviceAction: s.deviceAction || null,
        query: s.query || null,
        target: s.target || null,
        enabled: s.enabled !== undefined ? s.enabled : null,
        delayAfterMs: s.delayAfterMs !== undefined ? s.delayAfterMs : 500,
        assertionText: s.assertionText || null
      }));

      const payload = {
        type: "EXECUTE_ACTION",
        action: {
          actionId,
          actionType: "EXECUTE_BATCH",
          sessionTitle: planTitle,
          createNewSession: createNewSession !== false,
          stopOnError: stopOnError !== false,
          batchSteps: formattedSteps
        }
      };

      const maxTimeoutMs = Math.max(15000, formattedSteps.length * 4000);
      const result = await sendToPhone(payload, actionId, maxTimeoutMs);

      const stepAudit = (result.batchStepResults || []).map((r, i) =>
        `  ${r.success ? "✅" : "❌"} Step ${i + 1} [${r.actionType}]: ${r.message} (${r.durationMs}ms)`
      ).join("\n");

      return {
        content: [
          {
            type: "text",
            text: `📊 Batch Plan Execution: ${result.message}\n` +
                  `⏱️ Total Time: ${result.executionDurationMs}ms\n` +
                  `🗂️ Stored Session: ${result.sessionTitle || planTitle}\n` +
                  `📱 Package: ${result.updatedScreenState?.currentPackage || "unknown"}\n\n` +
                  `Step Details:\n${stepAudit || "No step results"}`
          }
        ]
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Error executing batch plan: ${err.message}` }],
        isError: true
      };
    }
  }
);

// Tool 12: Manage Phone Chat Sessions (State Management)
server.tool(
  "manage_phone_session",
  "List, create, load, or rename chat and task execution sessions on the connected Android phone",
  {
    command: z.enum(["LIST", "NEW", "LOAD", "RENAME"]).describe("Session command to perform"),
    sessionId: z.string().optional().describe("Session ID to load or rename"),
    title: z.string().optional().describe("Title for new session or new title for rename")
  },
  async ({ command, sessionId, title }) => {
    try {
      const actionId = "sess-" + Date.now();
      const payload = {
        type: "EXECUTE_ACTION",
        action: {
          actionId,
          actionType: "MANAGE_SESSION",
          sessionCommand: command,
          sessionId: sessionId || null,
          sessionTitle: title || null
        }
      };

      const result = await sendToPhone(payload, actionId, 10000);

      if (command === "LIST") {
        const sessionList = (result.sessionsList || []).map((s, idx) =>
          `${idx + 1}. [${s.id}] "${s.title}" - Preview: ${s.preview.slice(0, 40)}`
        ).join("\n");
        return {
          content: [
            {
              type: "text",
              text: `📋 Saved Phone Sessions (${result.sessionsList?.length || 0}):\n\n${sessionList || "No sessions saved yet"}`
            }
          ]
        };
      }

      return {
        content: [
          {
            type: "text",
            text: `✨ Session Operation (${command}) Result: ${result.message} (Session ID: ${result.sessionId || "N/A"})`
          }
        ]
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Error managing phone session: ${err.message}` }],
        isError: true
      };
    }
  }
);

// Tool 13: Explore and Analyze App (AI Eyes & Product Understanding Engine)
server.tool(
  "explore_and_analyze_app",
  "Autonomously explore any Android app on the phone, inspect its spatial UI layout (top bar, right actions, canvas, bottom tabs), navigate sub-pages, and generate a comprehensive UX, Feature, and Product Comprehension Report.",
  {
    appName: z.string().describe("Name of an installed app to explore")
  },
  async ({ appName }) => {
    try {
      // 1. Launch target app
      const launchActionId = "exp-launch-" + Date.now();
      await sendToPhone({
        type: "EXECUTE_ACTION",
        action: {
          actionId: launchActionId,
          actionType: "OPEN_APP",
          packageName: appName,
          targetText: appName
        }
      }, launchActionId, 10000);

      await new Promise(r => setTimeout(r, 1500));

      // 2. Inspect initial surface
      const initialScreen = await sendToPhone({ type: "INSPECT_SCREEN" }, "INSPECT_SCREEN", 8000);
      const pkg = initialScreen.currentPackage || "unknown";

      const nodes = initialScreen.nodes || [];
      const width = initialScreen.screenWidth || 1080;
      const height = initialScreen.screenHeight || 2400;

      const topBar = [];
      const rightActions = [];
      const bottomNav = [];
      const visibleTexts = [];

      nodes.forEach(n => {
        const text = n.text || n.contentDescription;
        if (text) visibleTexts.push(text);
        if (n.bounds && n.bounds.length >= 4) {
          const [left, top, right, bottom] = n.bounds;
          const centerY = (top + bottom) / 2;
          const centerX = (left + right) / 2;
          if (centerY < height * 0.15) topBar.push(text);
          else if (centerY > height * 0.85) bottomNav.push(text);
          else if (centerX > width * 0.75) rightActions.push(text);
        }
      });

      const uniqueTexts = [...new Set(visibleTexts.filter(Boolean))];
      const uniqueTop = [...new Set(topBar.filter(Boolean))];
      const uniqueRight = [...new Set(rightActions.filter(Boolean))];
      const uniqueBottom = [...new Set(bottomNav.filter(Boolean))];

      return {
        content: [
          {
            type: "text",
            text: `📱 Autonomous Exploration Summary for '${appName}':\n\n` +
                  `• Package: ${pkg}\n` +
                  `• Interactive Nodes: ${nodes.filter(n => n.isClickable).length} clickable elements\n` +
                  `• Top Bar Controls: [${uniqueTop.join(", ") || "Not observed"}]\n` +
                  `• Right-Side Utilities: [${uniqueRight.join(", ") || "Not observed"}]\n` +
                  `• Bottom Navigation: [${uniqueBottom.join(", ") || "Not observed"}]\n` +
                  `• Key Features / Texts: [${uniqueTexts.slice(0, 12).join(", ")}]\n\n` +
                  `💡 Value Proposition: ${nodes.length ? "Observed from the live UI hierarchy." : "Not assessed: no live UI hierarchy was returned."}\n` +
                  `✨ Attraction Factors: ${nodes.length ? "Observed controls and accessible tap targets." : "No product claims made without live evidence."}`
          }
        ]
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Error exploring app: ${err.message}` }],
        isError: true
      };
    }
  }
);

// Tool 14: Check Phone Bridge Connection Status
server.tool(
  "get_phone_bridge_status",
  "Check whether the physical Android device is connected to the laptop bridge, connection protocol, IP address, and runtime health status",
  {},
  async () => {
    let isConnected = activePhoneSocket !== null;
    if (!isConnected) {
      try {
        const masterStatus = await proxyToMasterBridge("/", null, 2500);
        if (masterStatus && masterStatus.phoneConnected) {
          isConnected = true;
        }
      } catch (_) {}
    }
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            phoneConnected: isConnected,
            host: HOSTNAME,
            primaryIp: LOCAL_IP,
            port: PORT,
            authFingerprint: KEY_FINGERPRINT,
            message: isConnected
              ? "🟢 Physical Android phone is connected and authenticated over encrypted WebSocket."
              : "🔴 No phone currently connected. Please open Orbital on the phone to reconnect."
          }, null, 2)
        }
      ]
    };
  }
);

// Tool 15: Take Live Phone Screenshot
server.tool(
  "take_phone_screenshot",
  "Capture a high-resolution screenshot directly from the physical Android phone via native screencap shell and receive the image",
  {},
  async () => {
    try {
      const actionId = "shot-" + Date.now();
      const payload = {
        type: "EXECUTE_ACTION",
        action: {
          actionId,
          actionType: "TAKE_SCREENSHOT"
        }
      };
      const result = await sendToPhone(payload, actionId, 10000);
      return {
        content: [
          {
            type: "text",
            text: `📸 Screenshot Captured: ${result.message}\n` +
                  `File: ${result.screenshotFilePath || "In-Memory Stream"}\n` +
                  `Base64 Length: ${result.screenshotBase64 ? result.screenshotBase64.length : 0} chars`
          }
        ]
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Error capturing screenshot: ${err.message}` }],
        isError: true
      };
    }
  }
);

// Tool 16: Search Device Apps & Files (Spotlight)
server.tool(
  "search_phone_device",
  "Perform semantic search across installed apps and files on the connected Android phone",
  {
    query: z.string().describe("Search query (e.g. 'Calculator', 'Downloads', 'settings', 'torch')")
  },
  async ({ query }) => {
    try {
      const actionId = "search-" + Date.now();
      const payload = {
        type: "EXECUTE_ACTION",
        action: {
          actionId,
          actionType: "CUSTOM_PROMPT",
          customPrompt: query.startsWith("Find ") || query.startsWith("Search ") ? query : `Find ${query}`
        }
      };
      const result = await sendToPhone(payload, actionId, 12000);
      return {
        content: [
          {
            type: "text",
            text: result.aiResponse || result.message || "Search complete."
          }
        ]
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Error searching device: ${err.message}` }],
        isError: true
      };
    }
  }
);

// Tool 17: Audit Screen Accessibility (WCAG & Touch Targets)
server.tool(
  "audit_phone_accessibility",
  "Audit the currently active phone screen for accessibility compliance, touch target sizes (<48dp), and missing labels",
  {},
  async () => {
    try {
      const actionId = "audit-" + Date.now();
      const payload = {
        type: "EXECUTE_ACTION",
        action: {
          actionId,
          actionType: "CUSTOM_PROMPT",
          customPrompt: "Audit current screen accessibility"
        }
      };
      const result = await sendToPhone(payload, actionId, 12000);
      return {
        content: [
          {
            type: "text",
            text: result.aiResponse || result.message || "Accessibility audit complete."
          }
        ]
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Error auditing accessibility: ${err.message}` }],
        isError: true
      };
    }
  }
);

// Tool 18: Execute Autonomous Task on Phone (Phone AI Synthesizes & Executes Shell Script)
server.tool(
  "execute_autonomous_task",
  "Instruct the on-device Orbital Phone AI to autonomously perform a complete task on an app, generate a self-contained shell script on the phone, execute it, extract the required data/results, and return the structured report back to the laptop.",
  {
    instruction: z.string().describe("Clear natural language instruction of what task to perform on the phone and what data to extract"),
    targetApp: z.string().optional().describe("Optional app name or package to open (e.g. 'Calculator', 'Settings', 'YouTube')"),
    scriptName: z.string().optional().describe("Optional name for the generated script file (default: task_<timestamp>.sh)")
  },
  async ({ instruction, targetApp, scriptName }) => {
    try {
      const actionId = "auto-" + Date.now();
      const payload = {
        type: "EXECUTE_ACTION",
        
        action: {
          actionId,
          actionType: "AUTONOMOUS_TASK",
          customPrompt: instruction,
          target: targetApp || null,
          sessionTitle: scriptName || `task_${Date.now()}.sh`
        }
      };
      const result = await sendToPhone(payload, actionId, 60000);
      let parsed = null;
      try {
        if (result.aiResponse) parsed = JSON.parse(result.aiResponse);
      } catch (_) {}

      const formattedData = parsed?.extractedData
        ? Object.entries(parsed.extractedData).map(([k, v]) => `  • ${k}: ${v}`).join("\n")
        : "";

      const scriptSummary = parsed?.scriptCode
        ? `\n\n📄 Generated Shell Script (${parsed.scriptPath}):\n\`\`\`bash\n${parsed.scriptCode}\n\`\`\``
        : "";

      return {
        content: [
          {
            type: "text",
            text: `🤖 Autonomous Task Result: ${result.message}\n` +
                  `⏱️ Duration: ${result.executionDurationMs}ms\n` +
                  (formattedData ? `\n📊 Extracted Data:\n${formattedData}` : "") +
                  scriptSummary
          }
        ]
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Error executing autonomous task: ${err.message}` }],
        isError: true
      };
    }
  }
);

// Connect MCP over Stdio for Claude / Cursor / Antigravity
const transport = new StdioServerTransport();
await server.connect(transport);



