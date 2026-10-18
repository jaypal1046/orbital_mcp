import https from "https";
import fs from "fs";

const taskDefinition = {
  instruction: "Open Settings and scroll down",
  targetApp: "Settings",
  scriptName: "open_settings_and_scroll.sh"
};

console.log("🚀 Starting Automated Task:", taskDefinition.instruction);
console.log("🎯 Target App:", taskDefinition.targetApp);

const actionPayload = {
  actionId: "auto-task-" + Date.now(),
  actionType: "AUTONOMOUS_TASK",
  customPrompt: taskDefinition.instruction,
  target: taskDefinition.targetApp,
  sessionTitle: taskDefinition.scriptName
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
    console.log("\n========================================================");
    console.log("✅ AUTOMATED TASK EXECUTION COMPLETED");
    console.log("========================================================");
    try {
      const parsed = JSON.parse(body);
      console.log("Message:", parsed.message);
      console.log("Duration:", parsed.executionDurationMs, "ms");
      if (parsed.aiResponse) {
        const details = JSON.parse(parsed.aiResponse);
        console.log("\n📄 Synthesized Script (" + details.scriptPath + "):");
        console.log(details.scriptCode);
        console.log("\n📊 Extracted Data:");
        console.log(JSON.stringify(details.extractedData, null, 2));
      }
    } catch (_) {
      console.log(body);
    }
  });
});

req.on("error", (err) => {
  console.error("❌ Request error:", err.message);
});

req.write(payload);
req.end();
