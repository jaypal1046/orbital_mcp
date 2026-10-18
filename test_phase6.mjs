import https from "https";

const actionPayload = {
  actionId: "auto-phase6-" + Date.now(),
  actionType: "AUTONOMOUS_TASK",
  customPrompt: "Open Settings and scroll down",
  target: "com.android.settings",
  sessionTitle: "phase6_test.sh"
};

const payload = JSON.stringify(actionPayload);

const req = https.request({
  hostname: "127.0.0.1",
  port: 8765,
  path: "/action",
  method: "POST",
  rejectUnauthorized: false,
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer 73aaa73d6cee6e7fefc43d60b498ff407407391ec00b1de3b06707a0f1598917",
    "Content-Length": Buffer.byteLength(payload)
  }
}, (res) => {
  let body = "";
  res.on("data", chunk => body += chunk);
  res.on("end", () => {
    console.log("=== PHASE 6 AUTONOMOUS TASK RESULT ===");
    console.log(body);
  });
});

req.on("error", (err) => {
  console.error("Request error:", err.message);
});

req.write(payload);
req.end();
