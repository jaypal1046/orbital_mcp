import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KEY_FILE = path.join(__dirname, ".orbital_session_key");
const AUTH_KEY = fs.existsSync(KEY_FILE) ? fs.readFileSync(KEY_FILE, "utf8").trim() : "";

function sendBridgeAction(actionPayload) {
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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const PLAYBOOK_TESTS = [
  { id: "SYS-01", suite: "System & Health", prompt: "/doctor", type: "CUSTOM_PROMPT" },
  { id: "SYS-02", suite: "System & Health", prompt: "/help", type: "CUSTOM_PROMPT" },
  { id: "SYS-03", suite: "System & Health", prompt: "/smoke", type: "CUSTOM_PROMPT" },
  { id: "SYS-04", suite: "System & Health", prompt: "/benchmark", type: "CUSTOM_PROMPT" },
  { id: "SYS-05", suite: "System & Health", prompt: "/status", type: "CUSTOM_PROMPT" },
  { id: "SYS-06", suite: "System & Health", prompt: "/skills", type: "CUSTOM_PROMPT" },
  { id: "SYS-07", suite: "System & Health", prompt: "/cost", type: "CUSTOM_PROMPT" },
  { id: "HW-03", suite: "Hardware & Intents", action: { actionType: "DEVICE_ACTION", deviceAction: "OPEN_SETTING", target: "WIFI" } },
  { id: "HW-04", suite: "Hardware & Intents", action: { actionType: "DEVICE_ACTION", deviceAction: "OPEN_SETTING", target: "BLUETOOTH" } },
  { id: "FILE-01", suite: "File Operations", prompt: 'Create a text file called /sdcard/Download/test_orbital.txt with content: "Orbital live testing verified"', type: "CUSTOM_PROMPT" },
  { id: "FILE-02", suite: "File Operations", prompt: 'Read the file /sdcard/Download/test_orbital.txt', type: "CUSTOM_PROMPT" },
  { id: "FILE-03", suite: "File Operations", prompt: 'Search for the word "verified" in /sdcard/Download/test_orbital.txt', type: "CUSTOM_PROMPT" },
  { id: "FILE-04", suite: "File Operations", prompt: 'Edit the file /sdcard/Download/test_orbital.txt by replacing "verified" with "completed successfully"', type: "CUSTOM_PROMPT" },
  { id: "SRC-01", suite: "Semantic Search", prompt: 'Find Calculator app', type: "CUSTOM_PROMPT" },
  { id: "SRC-02", suite: "Semantic Search", prompt: 'Find the file test_orbital.txt', type: "CUSTOM_PROMPT" },
  { id: "AUDIT-01", suite: "Accessibility", prompt: 'Audit current screen accessibility', type: "CUSTOM_PROMPT" }
];

async function runAll() {
  console.log("==================================================================");
  console.log("🚀 ORBITAL FULL PLAYBOOK AUTOMATED LIVE DEVICE TEST SUITE");
  console.log("==================================================================\n");

  const results = [];

  for (let i = 0; i < PLAYBOOK_TESTS.length; i++) {
    const test = PLAYBOOK_TESTS[i];
    console.log(`[${i + 1}/${PLAYBOOK_TESTS.length}] Running [${test.id}] (${test.suite})...`);

    const payload = test.action || {
      actionType: test.type,
      customPrompt: test.prompt
    };

    const start = Date.now();
    try {
      const res = await sendBridgeAction(payload);
      const duration = Date.now() - start;
      const isSuccess = res.success !== false;
      const preview = (res.aiResponse || res.message || JSON.stringify(res)).replace(/\n+/g, " ").slice(0, 80);

      results.push({
        id: test.id,
        suite: test.suite,
        status: isSuccess ? "PASS" : "FAIL",
        duration: `${duration}ms`,
        preview
      });

      console.log(`  ${isSuccess ? "✅ PASS" : "❌ FAIL"} (${duration}ms): ${preview}\n`);
    } catch (err) {
      const duration = Date.now() - start;
      results.push({
        id: test.id,
        suite: test.suite,
        status: "ERROR",
        duration: `${duration}ms`,
        preview: err.message
      });
      console.log(`  ❌ ERROR (${duration}ms): ${err.message}\n`);
    }

    await sleep(1500);
  }

  console.log("\n==================================================================");
  console.log("📊 FINAL PLAYBOOK TEST REPORT SUMMARY");
  console.log("==================================================================");
  console.table(results);
  const passCount = results.filter(r => r.status === "PASS").length;
  console.log(`\n🎉 Total Score: ${passCount} / ${results.length} Passed (${Math.round(passCount / results.length * 100)}%)\n`);
}

runAll().catch(err => {
  console.error("Runner encountered fatal error:", err);
  process.exit(1);
});
