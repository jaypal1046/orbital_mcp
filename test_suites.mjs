import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KEY_FILE = path.join(__dirname, ".orbital_session_key");
const AUTH_KEY = fs.existsSync(KEY_FILE) ? fs.readFileSync(KEY_FILE, "utf8").trim() : "";

export function sendBridgeAction(actionPayload) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(actionPayload);
    const req = http.request({
      host: "127.0.0.1",
      port: 8766,
      path: "/action",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(data),
        Authorization: `Bearer ${AUTH_KEY}`
      }
    }, (res) => {
      let body = "";
      res.on("data", (chunk) => body += chunk);
      res.on("end", () => {
        try {
          resolve(JSON.parse(body));
        } catch (_) {
          resolve({ raw: body, statusCode: res.statusCode });
        }
      });
    });
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

export function inspectScreen() {
  return new Promise((resolve, reject) => {
    const req = http.request({
      host: "127.0.0.1",
      port: 8766,
      path: "/inspect",
      method: "GET",
      headers: {
        Authorization: `Bearer ${AUTH_KEY}`
      }
    }, (res) => {
      let body = "";
      res.on("data", (chunk) => body += chunk);
      res.on("end", () => {
        try {
          resolve(JSON.parse(body));
        } catch (_) {
          resolve({ raw: body, statusCode: res.statusCode });
        }
      });
    });
    req.on("error", reject);
    req.end();
  });
}

const testId = process.argv[2] || "SYS-01";

async function main() {
  console.log(`\n========================================`);
  console.log(`🧪 EXECUTING LIVE TEST: [${testId}]`);
  console.log(`========================================\n`);

  switch (testId) {
    case "SYS-01": { // /doctor
      console.log("Sending: /doctor");
      const res = await sendBridgeAction({
        actionType: "CUSTOM_PROMPT",
        customPrompt: "/doctor"
      });
      console.log("\n[Response from Device]:\n", res.message || res);
      break;
    }

    case "SYS-02": { // /help
      console.log("Sending: /help");
      const res = await sendBridgeAction({
        actionType: "CUSTOM_PROMPT",
        customPrompt: "/help"
      });
      console.log("\n[Response from Device]:\n", res.message || res);
      break;
    }

    case "SYS-03": { // /smoke
      console.log("Sending: /smoke (Autonomous 7-point health sweep)...");
      const res = await sendBridgeAction({
        actionType: "CUSTOM_PROMPT",
        customPrompt: "/smoke"
      });
      console.log("\n[Response from Device]:\n", res.message || res);
      break;
    }

    case "SYS-04": { // /benchmark
      console.log("Sending: /benchmark (Scanning installed apps capability matrix)...");
      const res = await sendBridgeAction({
        actionType: "CUSTOM_PROMPT",
        customPrompt: "/benchmark"
      });
      console.log("\n[Response from Device]:\n", res.message || res);
      break;
    }

    case "SYS-05": { // /status
      console.log("Sending: /status");
      const res = await sendBridgeAction({
        actionType: "CUSTOM_PROMPT",
        customPrompt: "/status"
      });
      console.log("\n[Response from Device]:\n", res.message || res);
      break;
    }

    case "SYS-06": { // /skills
      console.log("Sending: /skills");
      const res = await sendBridgeAction({
        actionType: "CUSTOM_PROMPT",
        customPrompt: "/skills"
      });
      console.log("\n[Response from Device]:\n", res.message || res);
      break;
    }

    case "SYS-07": { // /cost
      console.log("Sending: /cost");
      const res = await sendBridgeAction({
        actionType: "CUSTOM_PROMPT",
        customPrompt: "/cost"
      });
      console.log("\n[Response from Device]:\n", res.message || res);
      break;
    }

    case "HW-01": { // Turn on flashlight
      console.log("Action: Turn on Flashlight");
      const res = await sendBridgeAction({
        actionType: "DEVICE_ACTION",
        deviceAction: "FLASHLIGHT",
        target: "on",
        enabled: true
      });
      console.log("\n[Result]:", res);
      break;
    }

    case "HW-02": { // Turn off flashlight
      console.log("Action: Turn off Flashlight");
      const res = await sendBridgeAction({
        actionType: "DEVICE_ACTION",
        deviceAction: "FLASHLIGHT",
        target: "off",
        enabled: false
      });
      console.log("\n[Result]:", res);
      break;
    }

    case "HW-03": { // Open Wi-Fi settings
      console.log("Action: Open Wi-Fi Settings");
      const res = await sendBridgeAction({
        actionType: "DEVICE_ACTION",
        deviceAction: "OPEN_SETTING",
        target: "WIFI"
      });
      console.log("\n[Result]:", res);
      break;
    }

    case "FILE-01": { // Create text file
      console.log("Action: Create text file /sdcard/Download/test_orbital.txt");
      const res = await sendBridgeAction({
        actionType: "CUSTOM_PROMPT",
        customPrompt: 'Create a text file called /sdcard/Download/test_orbital.txt with content: "Orbital live testing verified"'
      });
      console.log("\n[Result]:", res.message || res);
      break;
    }

    case "FILE-02": { // Read text file
      console.log("Action: Read file /sdcard/Download/test_orbital.txt");
      const res = await sendBridgeAction({
        actionType: "CUSTOM_PROMPT",
        customPrompt: 'Read the file /sdcard/Download/test_orbital.txt'
      });
      console.log("\n[Result]:", res.message || res);
      break;
    }

    case "FILE-03": { // Search word in file
      console.log("Action: Search for 'verified' in /sdcard/Download/test_orbital.txt");
      const res = await sendBridgeAction({
        actionType: "CUSTOM_PROMPT",
        customPrompt: 'Search for the word "verified" in /sdcard/Download/test_orbital.txt'
      });
      console.log("\n[Result]:", res.message || res);
      break;
    }

    case "FILE-04": { // Edit text file
      console.log("Action: Edit file /sdcard/Download/test_orbital.txt");
      const res = await sendBridgeAction({
        actionType: "CUSTOM_PROMPT",
        customPrompt: 'Edit the file /sdcard/Download/test_orbital.txt by replacing "verified" with "completed successfully"'
      });
      console.log("\n[Result]:", res.message || res);
      break;
    }

    case "SRC-01": { // Find Calculator app
      console.log("Action: Find Calculator app");
      const res = await sendBridgeAction({
        actionType: "CUSTOM_PROMPT",
        customPrompt: 'Find Calculator app'
      });
      console.log("\n[Result]:", res.message || res);
      break;
    }

    case "SRC-02": { // Find file
      console.log("Action: Find the file test_orbital.txt");
      const res = await sendBridgeAction({
        actionType: "CUSTOM_PROMPT",
        customPrompt: 'Find the file test_orbital.txt'
      });
      console.log("\n[Result]:", res.message || res);
      break;
    }

    case "AUDIT-01": { // Accessibility audit
      console.log("Action: Audit current screen accessibility");
      const res = await sendBridgeAction({
        actionType: "CUSTOM_PROMPT",
        customPrompt: 'Audit current screen accessibility'
      });
      console.log("\n[Result]:", res.message || res);
      break;
    }

    default: {
      console.log(`Sending custom prompt: ${testId}`);
      const res = await sendBridgeAction({
        actionType: "CUSTOM_PROMPT",
        customPrompt: testId
      });
      console.log("\n[Response]:\n", res.message || res);
      break;
    }
  }

  console.log("\n========================================\n");
}

main().catch(err => {
  console.error("Execution error:", err);
  process.exit(1);
});
