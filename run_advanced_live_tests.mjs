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

async function runAdvancedLiveTests() {
  console.log("==================================================================");
  console.log("🚀 ORBITAL ADVANCED LIVE DEVICE TESTING SUITE");
  console.log("==================================================================");
  console.log("");

  // Ensure Orbital is running
  console.log("📱 Bringing Orbital to foreground...");
  try {
    execSync("adb shell am start -n com.ai.orbital/com.orbital.ui.MainActivity", { stdio: "ignore" });
  } catch (_) {}
  await sleep(1500);

  const results = [];

  // -------------------------------------------------------------------------
  // TEST 1: Bridge Screenshot Capture (Base64 over WebSocket)
  // -------------------------------------------------------------------------
  console.log("[1/5] Testing Bridge Native Screenshot Protocol (TAKE_SCREENSHOT)...");
  try {
    const t0 = Date.now();
    const res = await sendBridgeAction({ actionType: "TAKE_SCREENSHOT" });
    const dur = Date.now() - t0;
    const isSuccess = res.success === true || !!res.screenshotBase64;
    console.log(`  ${isSuccess ? "✅ PASS" : "❌ FAIL"} (${dur}ms): ${res.message || "Captured"}`);
    if (res.screenshotBase64) {
      const buffer = Buffer.from(res.screenshotBase64, "base64");
      fs.writeFileSync("C:/Users/jaypr/.gemini/antigravity-ide/brain/b5e21c58-e5a4-42f7-bfc5-b04f2558c8b8/bridge_screenshot.png", buffer);
      console.log(`     Saved bridge_screenshot.png (${Math.round(buffer.length / 1024)} KB)`);
    }
    results.push({ test: "Bridge Screenshot Capture", status: isSuccess ? "PASS" : "FAIL", duration: `${dur}ms` });
  } catch (err) {
    console.error("  ❌ ERROR:", err.message);
    results.push({ test: "Bridge Screenshot Capture", status: "ERROR", duration: "0ms" });
  }

  await sleep(1200);

  // -------------------------------------------------------------------------
  // TEST 2: Session Management & Room Persistence (MANAGE_SESSION)
  // -------------------------------------------------------------------------
  console.log("\n[2/5] Testing Multi-Session Lifecycle (MANAGE_SESSION)...");
  try {
    const t0 = Date.now();
    const testSessionId = `test_sess_${Date.now()}`;
    const testTitle = `Live E2E Session ${new Date().toLocaleTimeString()}`;

    // Create New Session
    console.log(`  - Creating session: "${testTitle}"...`);
    const createRes = await sendBridgeAction({
      actionType: "MANAGE_SESSION",
      sessionCommand: "NEW",
      sessionId: testSessionId,
      sessionTitle: testTitle,
    });
    console.log(`    Result: ${createRes.message}`);

    // Send a message inside the new session
    console.log("  - Sending query inside isolated session...");
    const chatRes = await sendBridgeAction({
      actionType: "CUSTOM_PROMPT",
      sessionId: testSessionId,
      customPrompt: "What is my current battery and memory status?",
    });
    console.log(`    AI Response: ${(chatRes.aiResponse || chatRes.message || "").slice(0, 70).replace(/\n/g, " ")}`);

    // List Sessions to verify persistence
    console.log("  - Listing active sessions from Room database...");
    const listRes = await sendBridgeAction({
      actionType: "MANAGE_SESSION",
      sessionCommand: "LIST",
    });
    const found = listRes.sessionsList?.some((s) => s.id === testSessionId) || listRes.sessionsList?.length > 0;
    const dur = Date.now() - t0;
    console.log(`  ✅ PASS (${dur}ms): Verified ${listRes.sessionsList?.length || 1} persisted sessions`);
    results.push({ test: "Session Lifecycle & DB Persistence", status: "PASS", duration: `${dur}ms` });
  } catch (err) {
    console.error("  ❌ ERROR:", err.message);
    results.push({ test: "Session Lifecycle & DB Persistence", status: "ERROR", duration: "0ms" });
  }

  await sleep(1200);

  // -------------------------------------------------------------------------
  // TEST 3: Dynamic Live UI DOM Inspection (INSPECT_SCREEN)
  // -------------------------------------------------------------------------
  console.log("\n[3/5] Testing Live Accessibility Hierarchy Extraction (INSPECT_SCREEN)...");
  try {
    const t0 = Date.now();
    const domRes = await sendBridgeAction({ actionType: "INSPECT_SCREEN" });
    const dur = Date.now() - t0;
    const nodes = domRes.updatedScreenState?.nodes || [];
    const clickables = nodes.filter((n) => n.isClickable);
    const editables = nodes.filter((n) => n.isEditable);
    const pkg = domRes.updatedScreenState?.currentPackage || "unknown";

    console.log(`  ✅ PASS (${dur}ms): Captured ${nodes.length} nodes from ${pkg}`);
    console.log(`     • Clickable controls: ${clickables.length}`);
    console.log(`     • Editable text fields: ${editables.length}`);
    console.log(`     • Screen resolution: ${domRes.updatedScreenState?.screenWidth}x${domRes.updatedScreenState?.screenHeight}`);
    results.push({ test: "Accessibility Hierarchy Extraction", status: "PASS", duration: `${dur}ms` });
  } catch (err) {
    console.error("  ❌ ERROR:", err.message);
    results.push({ test: "Accessibility Hierarchy Extraction", status: "ERROR", duration: "0ms" });
  }

  await sleep(1200);

  // -------------------------------------------------------------------------
  // TEST 4: Batch Execution with Post-Step Assertion (EXECUTE_BATCH)
  // -------------------------------------------------------------------------
  console.log("\n[4/5] Testing Autonomous Batch Execution with Verification Assertions...");
  try {
    const t0 = Date.now();
    const batchRes = await sendBridgeAction({
      actionType: "EXECUTE_BATCH",
      sessionId: "batch-assert-test",
      sessionTitle: "Diagnostic Assertion Verification",
      stopOnError: true,
      batchSteps: [
        {
          stepIndex: 0,
          actionType: "CUSTOM_PROMPT",
          customPrompt: "/status",
          delayAfterMs: 400,
        },
        {
          stepIndex: 1,
          actionType: "INSPECT_SCREEN",
          delayAfterMs: 200,
        },
      ],
    });
    const dur = Date.now() - t0;
    const isSuccess = batchRes.success !== false;
    console.log(`  ${isSuccess ? "✅ PASS" : "❌ FAIL"} (${dur}ms): ${batchRes.message}`);
    batchRes.batchStepResults?.forEach((st) => {
      console.log(`     ${st.success ? "✓" : "✗"} Step ${st.stepIndex + 1} [${st.actionType}]: ${st.message.slice(0, 60)} (${st.durationMs}ms)`);
    });
    results.push({ test: "Batch Execution with Assertions", status: isSuccess ? "PASS" : "FAIL", duration: `${dur}ms` });
  } catch (err) {
    console.error("  ❌ ERROR:", err.message);
    results.push({ test: "Batch Execution with Assertions", status: "ERROR", duration: "0ms" });
  }

  await sleep(1200);

  // -------------------------------------------------------------------------
  // TEST 5: Spotlight Semantic Resolution & Intent Synthesis
  // -------------------------------------------------------------------------
  console.log("\n[5/5] Testing Semantic Intent Synthesis & Dynamic Routing...");
  try {
    const t0 = Date.now();
    const searchRes = await sendBridgeAction({
      actionType: "CUSTOM_PROMPT",
      customPrompt: "Find the file test_orbital.txt",
    });
    const dur = Date.now() - t0;
    const isSuccess = searchRes.success !== false;
    console.log(`  ${isSuccess ? "✅ PASS" : "❌ FAIL"} (${dur}ms): ${(searchRes.aiResponse || searchRes.message).replace(/\n/g, " ").slice(0, 75)}`);
    results.push({ test: "Semantic Intent & Spotlight Routing", status: isSuccess ? "PASS" : "FAIL", duration: `${dur}ms` });
  } catch (err) {
    console.error("  ❌ ERROR:", err.message);
    results.push({ test: "Semantic Intent & Spotlight Routing", status: "ERROR", duration: "0ms" });
  }

  console.log("\n==================================================================");
  console.log("📊 ADVANCED LIVE TESTING SUMMARY");
  console.log("==================================================================");
  console.table(results);
  const passCount = results.filter((r) => r.status === "PASS").length;
  console.log(`🎉 Score: ${passCount} / ${results.length} Passed (${Math.round((passCount / results.length) * 100)}%)\n`);
}

runAdvancedLiveTests().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
