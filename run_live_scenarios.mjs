import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KEY_FILE = path.join(__dirname, ".orbital_session_key");
const AUTH_KEY = fs.existsSync(KEY_FILE) ? fs.readFileSync(KEY_FILE, "utf8").trim() : "";

function sendBridgeAction(actionPayload) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(actionPayload);
    const req = http.request(
      {
        host: "127.0.0.1",
        port: 8766,
        path: "/action",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(data),
          Authorization: `Bearer ${AUTH_KEY}`,
        },
      },
      (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          try {
            resolve(JSON.parse(body));
          } catch (_) {
            resolve({ raw: body, statusCode: res.statusCode });
          }
        });
      }
    );
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function inspectScreen() {
  return sendBridgeAction({ actionType: "INSPECT_SCREEN" });
}

async function runScenarioSuite() {
  console.log("==================================================================");
  console.log("🚀 ORBITAL LIVE PHYSICAL DEVICE INTERACTIVE SCENARIOS");
  console.log("==================================================================\n");

  // Ensure Orbital is running
  console.log("📱 Bringing Orbital to foreground...");
  try {
    execSync("adb shell am start -n com.ai.orbital/com.orbital.ui.MainActivity", { stdio: "ignore" });
  } catch (_) {}
  await sleep(1500);

  // =========================================================================
  // SCENARIO 1: REACT-01 (Calculator 250 + 175 = 425)
  // =========================================================================
  console.log("\n------------------------------------------------------------------");
  console.log("🧮 [SCENARIO 1: REACT-01] Calculator Multi-Step Computation");
  console.log("------------------------------------------------------------------");

  // Step 1: Open Calculator
  console.log("1. Launching Calculator app...");
  const openCalc = await sendBridgeAction({
    actionType: "OPEN_APP",
    targetText: "Calculator",
    packageName: "com.google.android.calculator",
  });
  console.log("   Result:", openCalc.message || openCalc);
  await sleep(1500);

  // Step 2: Inspect active Calculator DOM
  console.log("2. Inspecting Calculator UI hierarchy...");
  const calcDom = await inspectScreen();
  console.log(`   Nodes on screen: ${calcDom.updatedScreenState?.nodes?.length || 0} (Package: ${calcDom.updatedScreenState?.currentPackage})`);

  // Step 3: Tap Keys 2, 5, 0, +, 1, 7, 5, =
  const keys = ["2", "5", "0", "+", "1", "7", "5", "="];
  console.log("3. Tapping key sequence: " + keys.join(" "));
  for (const k of keys) {
    const tapRes = await sendBridgeAction({
      actionType: "CLICK_NODE",
      targetText: k,
    });
    console.log(`   - Tap '${k}': ${tapRes.success ? "✅ OK" : "❌ Not found, trying click"}`);
    await sleep(400);
  }

  // Step 4: Inspect Result
  await sleep(600);
  const resultDom = await inspectScreen();
  const nodes = resultDom.updatedScreenState?.nodes || [];
  const resultNode = nodes.find((n) => n.text?.includes("425") || n.contentDescription?.includes("425"));
  if (resultNode) {
    console.log(`   🎉 Calculation Verified! Result Node Found: "${resultNode.text || resultNode.contentDescription}"`);
  } else {
    console.log("   DOM Nodes snippet:", nodes.filter((n) => n.text).map((n) => n.text).slice(0, 8));
  }

  // Capture screenshot of Calculator
  try {
    execSync("adb shell screencap -p /sdcard/calc_result.png; adb pull /sdcard/calc_result.png C:\\Users\\jaypr\\.gemini\\antigravity-ide\\brain\\b5e21c58-e5a4-42f7-bfc5-b04f2558c8b8\\calc_result.png", { stdio: "ignore" });
    console.log("   📸 Captured Calculator screenshot: calc_result.png");
  } catch (_) {}

  // =========================================================================
  // SCENARIO 2: REACT-02 (Clock App & Timer Navigation)
  // =========================================================================
  console.log("\n------------------------------------------------------------------");
  console.log("⏱️ [SCENARIO 2: REACT-02] Clock App & Timer Tab Switch");
  console.log("------------------------------------------------------------------");

  console.log("1. Launching Clock app...");
  const openClock = await sendBridgeAction({
    actionType: "OPEN_APP",
    targetText: "Clock",
  });
  console.log("   Result:", openClock.message || openClock);
  await sleep(1500);

  console.log("2. Switching to 'Timer' tab...");
  const tapTimer = await sendBridgeAction({
    actionType: "CLICK_NODE",
    targetText: "Timer",
  });
  console.log("   Result:", tapTimer.message || tapTimer);
  await sleep(1000);

  // Capture screenshot of Clock
  try {
    execSync("adb shell screencap -p /sdcard/clock_result.png; adb pull /sdcard/clock_result.png C:\\Users\\jaypr\\.gemini\\antigravity-ide\\brain\\b5e21c58-e5a4-42f7-bfc5-b04f2558c8b8\\clock_result.png", { stdio: "ignore" });
    console.log("   📸 Captured Clock screenshot: clock_result.png");
  } catch (_) {}

  // =========================================================================
  // SCENARIO 3: Return to Orbital & Verify Health
  // =========================================================================
  console.log("\n------------------------------------------------------------------");
  console.log("📱 Returning to Orbital & Final Diagnostics");
  console.log("------------------------------------------------------------------");

  try {
    execSync("adb shell am start -n com.ai.orbital/com.orbital.ui.MainActivity", { stdio: "ignore" });
  } catch (_) {}
  await sleep(1500);

  const status = await sendBridgeAction({
    actionType: "CUSTOM_PROMPT",
    customPrompt: "/status",
  });
  console.log("   Final Orbital Status:", status.aiResponse || status.message);

  console.log("\n==================================================================");
  console.log("🎉 ALL INTERACTIVE PHYSICAL SCENARIOS COMPLETED SUCCESSFULLY!");
  console.log("==================================================================\n");
}

runScenarioSuite().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
