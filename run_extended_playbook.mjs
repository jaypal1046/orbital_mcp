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

const EXTENDED_TESTS = [
  // Suite A Remaining
  { id: "SYS-08", suite: "System & Slash Commands", prompt: "/replay", type: "CUSTOM_PROMPT" },
  { id: "SYS-09", suite: "System & Slash Commands", prompt: "/plan Open Settings and check display brightness", type: "CUSTOM_PROMPT" },
  { id: "SYS-10", suite: "System & Slash Commands", prompt: "/goal Check current battery percentage and device storage", type: "CUSTOM_PROMPT" },

  // Suite B Remaining (Hardware & 1-Hop)
  { id: "HW-01", suite: "Hardware & Intents", action: { actionType: "DEVICE_ACTION", deviceAction: "FLASHLIGHT", enabled: true } },
  { id: "HW-02", suite: "Hardware & Intents", action: { actionType: "DEVICE_ACTION", deviceAction: "FLASHLIGHT", enabled: false } },
  { id: "HW-05", suite: "Hardware & Intents", action: { actionType: "DEVICE_ACTION", deviceAction: "OPEN_SETTING", target: "battery" } },
  { id: "HW-06", suite: "Hardware & Intents", prompt: "Open https://github.com in browser", type: "CUSTOM_PROMPT" },
  { id: "HW-07", suite: "Hardware & Intents", prompt: "Directions to Central Park New York", type: "CUSTOM_PROMPT" },

  // Suite C Remaining (CSV Spreadsheets)
  { id: "FILE-05", suite: "File & Document Engine", prompt: "Create a CSV spreadsheet /sdcard/Download/groceries.csv with headers Item,Qty,Price and 3 sample rows", type: "CUSTOM_PROMPT" },
  { id: "FILE-06", suite: "File & Document Engine", prompt: "Edit spreadsheet /sdcard/Download/groceries.csv by setting row 1 column Price to 4.99", type: "CUSTOM_PROMPT" },

  // Suite D Remaining (Synonyms)
  { id: "SRC-03", suite: "Semantic Search", prompt: "Search for torch setting", type: "CUSTOM_PROMPT" },

  // Suite E (Autonomous Multi-Step ReAct UI Automation)
  {
    id: "REACT-01",
    suite: "Autonomous ReAct Automation",
    action: {
      actionType: "EXECUTE_BATCH",
      sessionId: "react-calc-test",
      sessionTitle: "🧮 Calculator Computation (250 + 175)",
      batchSteps: [
        { stepIndex: 0, actionType: "OPEN_APP", packageName: "com.google.android.calculator", targetText: "Calculator", delayAfterMs: 600 },
        { stepIndex: 1, actionType: "CLICK_NODE", targetText: "2", delayAfterMs: 200 },
        { stepIndex: 2, actionType: "CLICK_NODE", targetText: "5", delayAfterMs: 200 },
        { stepIndex: 3, actionType: "CLICK_NODE", targetText: "0", delayAfterMs: 200 },
        { stepIndex: 4, actionType: "CLICK_NODE", targetText: "+", delayAfterMs: 200 },
        { stepIndex: 5, actionType: "CLICK_NODE", targetText: "1", delayAfterMs: 200 },
        { stepIndex: 6, actionType: "CLICK_NODE", targetText: "7", delayAfterMs: 200 },
        { stepIndex: 7, actionType: "CLICK_NODE", targetText: "5", delayAfterMs: 200 },
        { stepIndex: 8, actionType: "CLICK_NODE", targetText: "=", delayAfterMs: 400 }
      ]
    }
  },
  {
    id: "REACT-02",
    suite: "Autonomous ReAct Automation",
    action: {
      actionType: "EXECUTE_BATCH",
      sessionId: "react-clock-test",
      sessionTitle: "⏱️ Clock Timer Navigation",
      batchSteps: [
        { stepIndex: 0, actionType: "OPEN_APP", targetText: "Clock", delayAfterMs: 600 },
        { stepIndex: 1, actionType: "CLICK_NODE", targetText: "Timer", delayAfterMs: 300 }
      ]
    }
  }
];

async function runExtendedSuite() {
  console.log("==================================================================");
  console.log("🚀 ORBITAL FULL EXTENDED PLAYBOOK LIVE DEVICE TEST SUITE");
  console.log("==================================================================\n");

  const results = [];

  for (let i = 0; i < EXTENDED_TESTS.length; i++) {
    const test = EXTENDED_TESTS[i];
    console.log(`[${i + 1}/${EXTENDED_TESTS.length}] Running [${test.id}] (${test.suite})...`);

    const payload = test.action || {
      actionType: test.type,
      customPrompt: test.prompt
    };

    const start = Date.now();
    try {
      const res = await sendBridgeAction(payload);
      const duration = Date.now() - start;
      const isSuccess = res.success !== false && !res.error;
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
  console.log("📊 EXTENDED PLAYBOOK TEST REPORT SUMMARY");
  console.log("==================================================================");
  console.table(results);
  const passCount = results.filter(r => r.status === "PASS").length;
  console.log(`\n🎉 Extended Suite Score: ${passCount} / ${results.length} Passed (${Math.round(passCount / results.length * 100)}%)\n`);
}

runExtendedSuite().catch(err => {
  console.error("Runner encountered fatal error:", err);
  process.exit(1);
});
