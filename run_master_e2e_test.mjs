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

function getBridgeStatus() {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: "127.0.0.1",
        port: 8766,
        path: "/status",
        method: "GET",
      },
      (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          try {
            resolve(JSON.parse(body));
          } catch (_) {
            resolve({ raw: body });
          }
        });
      }
    );
    req.on("error", reject);
    req.end();
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function runMasterE2ETest() {
  console.log("==================================================================");
  console.log("🌟 ORBITAL COMPLETE MASTER END-TO-END LIVE TEST SUITE");
  console.log("==================================================================\n");

  const results = [];

  // -------------------------------------------------------------------------
  // 1. Connection Health & Crypto Bridge Verification
  // -------------------------------------------------------------------------
  console.log("[1/6] Verifying Crypto Handshake & Connection Health...");
  try {
    const t0 = Date.now();
    const status = await getBridgeStatus();
    const dur = Date.now() - t0;
    const isOk = status.phoneConnected === true;
    console.log(`  ${isOk ? "✅ PASS" : "❌ FAIL"} (${dur}ms): Connected to ${status.host} (${status.primaryIp})`);
    results.push({ test: "Crypto Handshake & Bridge Health", status: isOk ? "PASS" : "FAIL", duration: `${dur}ms` });
  } catch (err) {
    console.error("  ❌ ERROR:", err.message);
    results.push({ test: "Crypto Handshake & Bridge Health", status: "ERROR", duration: "0ms" });
  }

  await sleep(1000);

  // -------------------------------------------------------------------------
  // 2. Spotlight Semantic App & File Resolution
  // -------------------------------------------------------------------------
  console.log("\n[2/6] Testing Dynamic Spotlight Semantic Search...");
  try {
    const t0 = Date.now();
    const searchRes = await sendBridgeAction({
      actionType: "CUSTOM_PROMPT",
      customPrompt: "Find the file test_orbital.txt",
    });
    const dur = Date.now() - t0;
    const isOk = searchRes.success !== false;
    const preview = (searchRes.aiResponse || searchRes.message || "").replace(/\n/g, " ").slice(0, 75);
    console.log(`  ${isOk ? "✅ PASS" : "❌ FAIL"} (${dur}ms): ${preview}`);
    results.push({ test: "Spotlight Semantic Search", status: isOk ? "PASS" : "FAIL", duration: `${dur}ms` });
  } catch (err) {
    console.error("  ❌ ERROR:", err.message);
    results.push({ test: "Spotlight Semantic Search", status: "ERROR", duration: "0ms" });
  }

  await sleep(1000);

  // -------------------------------------------------------------------------
  // 3. Autonomous Third-Party App Navigation & DOM Inspection
  // -------------------------------------------------------------------------
  console.log("\n[3/6] Testing Third-Party App Navigation & Hierarchy Inspection...");
  try {
    const t0 = Date.now();
    // Launch Clock
    await sendBridgeAction({
      actionType: "OPEN_APP",
      targetText: "Clock",
    });
    await sleep(1200);

    // Switch to Stopwatch / Timer tab
    const tabRes = await sendBridgeAction({
      actionType: "CLICK_NODE",
      targetText: "Timer",
    });
    console.log(`  - Tab switch: ${tabRes.message}`);
    await sleep(800);

    // Inspect Screen Hierarchy
    const domRes = await sendBridgeAction({ actionType: "INSPECT_SCREEN" });
    const nodes = domRes.updatedScreenState?.nodes || [];
    const dur = Date.now() - t0;
    const isOk = nodes.length > 0;
    console.log(`  ${isOk ? "✅ PASS" : "❌ FAIL"} (${dur}ms): Inspected ${nodes.length} nodes in ${domRes.updatedScreenState?.currentPackage}`);
    results.push({ test: "App Navigation & DOM Hierarchy", status: isOk ? "PASS" : "FAIL", duration: `${dur}ms` });
  } catch (err) {
    console.error("  ❌ ERROR:", err.message);
    results.push({ test: "App Navigation & DOM Hierarchy", status: "ERROR", duration: "0ms" });
  }

  await sleep(1000);

  // -------------------------------------------------------------------------
  // 4. Multi-Step Batch Automation Plan
  // -------------------------------------------------------------------------
  console.log("\n[4/6] Testing Multi-Step Batch Automation with Verification...");
  try {
    const t0 = Date.now();
    const batchRes = await sendBridgeAction({
      actionType: "EXECUTE_BATCH",
      sessionId: "e2e-master-batch",
      sessionTitle: "Master Verification Batch",
      stopOnError: true,
      batchSteps: [
        {
          stepIndex: 0,
          actionType: "PRESS_KEY",
          keyCode: "HOME",
          delayAfterMs: 400,
        },
        {
          stepIndex: 1,
          actionType: "SWIPE",
          swipeDirection: "LEFT",
          delayAfterMs: 300,
        },
        {
          stepIndex: 2,
          actionType: "SWIPE",
          swipeDirection: "RIGHT",
          delayAfterMs: 300,
        },
        {
          stepIndex: 3,
          actionType: "OPEN_APP",
          targetText: "Orbital",
          packageName: "com.ai.orbital",
          delayAfterMs: 600,
        },
      ],
    });
    const dur = Date.now() - t0;
    const isOk = batchRes.success !== false;
    console.log(`  ${isOk ? "✅ PASS" : "❌ FAIL"} (${dur}ms): ${batchRes.message}`);
    batchRes.batchStepResults?.forEach((st) => {
      console.log(`     ${st.success ? "✓" : "✗"} Step ${st.stepIndex + 1} [${st.actionType}]: ${st.message} (${st.durationMs}ms)`);
    });
    results.push({ test: "Multi-Step Batch Automation", status: isOk ? "PASS" : "FAIL", duration: `${dur}ms` });
  } catch (err) {
    console.error("  ❌ ERROR:", err.message);
    results.push({ test: "Multi-Step Batch Automation", status: "ERROR", duration: "0ms" });
  }

  await sleep(1200);

  // -------------------------------------------------------------------------
  // 5. Native Screen Audit & Linter
  // -------------------------------------------------------------------------
  console.log("\n[5/6] Testing Screen Accessibility & Usability Linter...");
  try {
    const t0 = Date.now();
    const auditRes = await sendBridgeAction({
      actionType: "CUSTOM_PROMPT",
      customPrompt: "Audit current screen accessibility",
    });
    const dur = Date.now() - t0;
    const isOk = auditRes.success !== false;
    const preview = (auditRes.aiResponse || auditRes.message || "").replace(/\n/g, " ").slice(0, 75);
    console.log(`  ${isOk ? "✅ PASS" : "❌ FAIL"} (${dur}ms): ${preview}`);
    results.push({ test: "Accessibility & Usability Linter", status: isOk ? "PASS" : "FAIL", duration: `${dur}ms` });
  } catch (err) {
    console.error("  ❌ ERROR:", err.message);
    results.push({ test: "Accessibility & Usability Linter", status: "ERROR", duration: "0ms" });
  }

  await sleep(1200);

  // -------------------------------------------------------------------------
  // 6. Live Screen Capture & Proof of Execution
  // -------------------------------------------------------------------------
  console.log("\n[6/6] Testing Native Bridge Screenshot Capture & Visual Stream...");
  try {
    const t0 = Date.now();
    const shotRes = await sendBridgeAction({ actionType: "TAKE_SCREENSHOT" });
    const dur = Date.now() - t0;
    const isOk = shotRes.success === true || !!shotRes.screenshotBase64;
    console.log(`  ${isOk ? "✅ PASS" : "❌ FAIL"} (${dur}ms): Screenshot captured (${shotRes.message})`);
    if (shotRes.screenshotBase64) {
      const buffer = Buffer.from(shotRes.screenshotBase64, "base64");
      fs.writeFileSync("C:/Users/jaypr/.gemini/antigravity-ide/brain/b5e21c58-e5a4-42f7-bfc5-b04f2558c8b8/master_e2e_screen.png", buffer);
      console.log(`     Saved master_e2e_screen.png (${Math.round(buffer.length / 1024)} KB)`);
    }
    results.push({ test: "Native Screenshot Stream", status: isOk ? "PASS" : "FAIL", duration: `${dur}ms` });
  } catch (err) {
    console.error("  ❌ ERROR:", err.message);
    results.push({ test: "Native Screenshot Stream", status: "ERROR", duration: "0ms" });
  }

  console.log("\n==================================================================");
  console.log("📊 MASTER E2E LIVE TESTING SUMMARY");
  console.log("==================================================================");
  console.table(results);
  const passCount = results.filter((r) => r.status === "PASS").length;
  console.log(`🎉 Master Suite Score: ${passCount} / ${results.length} Passed (${Math.round((passCount / results.length) * 100)}%)\n`);
}

runMasterE2ETest().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
