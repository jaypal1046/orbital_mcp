import WebSocket from "ws";

const WS_URL = process.env.WS_URL || "ws://127.0.0.1:8765";

console.log(`Testing connection to local Orbital Bridge at ${WS_URL}...`);
const ws = new WebSocket(WS_URL);

ws.on("open", () => {
  console.log("🟢 Connected to Bridge WebSocket Server successfully!");
  ws.send(JSON.stringify({
    type: "HEARTBEAT",
    timestamp: Date.now()
  }));
});

ws.on("message", (raw) => {
  console.log("📨 Received bridge acknowledgment:", raw.toString());
  setTimeout(() => {
    console.log("✅ WebSocket connection verification passed.");
    ws.close();
    process.exit(0);
  }, 300);
});

ws.on("error", (err) => {
  console.error("❌ Connection error:", err.message);
  process.exit(1);
});
