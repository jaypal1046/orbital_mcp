import WebSocket from "ws";

const WS_URL = "wss://127.0.0.1:8765";

// Connect to bridge to send inspection test
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

console.log("Connecting to verify live phone screen...");
// In our index.js, activePhoneSocket is already holding the connection.
