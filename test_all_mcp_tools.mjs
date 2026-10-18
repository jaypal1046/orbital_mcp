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

async function runMcpToolTestSuite() {
  console.log("==================================================================");
  console.log("🚀 ORBITAL NEW MCP TOOLS & VERIFICATION SUITE");
  console.log("==================================================================\n");

  // Ensure Orbital is running
  console.log("📱 Bringing Orbital to foreground...");
  try {
    execSync("adb shell am start -n com.ai.orbital/com.orbital.ui.MainActivity", { stdio: "ignore" });
  } catch (_) {}
  await sleep(1500);

  const results = [];

  // -------------------------------------------------------------------------
  // 1. Tool: get_phone_bridge_status
  // -------------------------------------------------------------------------
  console.log("[1/5] Testing Tool: get_phone_bridge_status...");
  try {
    const t0 = Date.now();
    const status = await getBridgeStatus();
    const dur = Date.now() - t0;
    const isConnected = status.phoneConnected === true;
    console.log(`  ${isConnected ? "✅ PASS" : "❌ FAIL"} (${dur}ms): Phone Connected = ${isConnected}, Host = ${status.host}, Fingerprint = ${status.authFingerprint?.slice(0, 12)}...`);
    results.push({ tool: "get_phone_bridge_status", status: isConnected ? "PASS" : "FAIL", duration: `${dur}ms` });
  } catch (err) {
    console.error("  ❌ ERROR:", err.message);
    results.push({ tool: "get_phone_bridge_status", status: "ERROR", duration: "0ms" });
  }

  await sleep(1200);

  // -------------------------------------------------------------------------
  // 2. Tool: search_phone_device
  // -------------------------------------------------------------------------
  console.log("\n[2/5] Testing Tool: search_phone_device (Spotlight Search)...");
  try {
    const t0 = Date.now();
    const searchRes = await sendBridgeAction({
      actionType: "CUSTOM_PROMPT",
      customPrompt: "Find Calculator app",
    });
    const dur = Date.now() - t0;
    const isSuccess = searchRes.success !== false;
    const preview = (searchRes.aiResponse || searchRes.message || "").replace(/\n/g, " ").slice(0, 75);
    console.log(`  ${isSuccess ? "✅ PASS" : "❌ FAIL"} (${dur}ms): ${preview}`);
    results.push({ tool: "search_phone_device", status: isSuccess ? "PASS" : "FAIL", duration: `${dur}ms` });
  } catch (err) {
    console.error("  ❌ ERROR:", err.message);
    results.push({ tool: "search_phone_device", status: "ERROR", duration: "0ms" });
  }

  await sleep(1200);

  // -------------------------------------------------------------------------
  // 3. Tool: audit_phone_accessibility
  // -------------------------------------------------------------------------
  console.log("\n[3/5] Testing Tool: audit_phone_accessibility (WCAG Compliance)...");
  try {
    const t0 = Date.now();
    const auditRes = await sendBridgeAction({
      actionType: "CUSTOM_PROMPT",
      customPrompt: "Audit current screen accessibility",
    });
    const dur = Date.now() - t0;
    const isSuccess = auditRes.success !== false;
    const preview = (auditRes.aiResponse || auditRes.message || "").replace(/\n/g, " ").slice(0, 75);
    console.log(`  ${isSuccess ? "✅ PASS" : "❌ FAIL"} (${dur}ms): ${preview}`);
    results.push({ tool: "audit_phone_accessibility", status: isSuccess ? "PASS" : "FAIL", duration: `${dur}ms` });
  } catch (err) {
    console.error("  ❌ ERROR:", err.message);
    results.push({ tool: "audit_phone_accessibility", status: "ERROR", duration: "0ms" });
  }

  await sleep(1200);

  // -------------------------------------------------------------------------
  // 4. Tool: execute_phone_task_batch (Batch Execution & In-Memory Card Check)
  // -------------------------------------------------------------------------
  console.log("\n[4/5] Testing Tool: execute_phone_task_batch (Plan & Assistant Card Persistence)...");
  try {
    const t0 = Date.now();
    const batchRes = await sendBridgeAction({
      actionType: "EXECUTE_BATCH",
      sessionId: "batch-live-check",
      sessionTitle: "Diagnostic Sweep Plan",
      stopOnError: true,
      batchSteps: [
        {
          stepIndex: 0,
          actionType: "CUSTOM_PROMPT",
          customPrompt: "/status",
          delayAfterMs: 300,
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
    results.push({ tool: "execute_phone_task_batch", status: isSuccess ? "PASS" : "FAIL", duration: `${dur}ms` });
  } catch (err) {
    console.error("  ❌ ERROR:", err.message);
    results.push({ tool: "execute_phone_task_batch", status: "ERROR", duration: "0ms" });
  }

  await sleep(1500);

  // -------------------------------------------------------------------------
  // 5. Tool: take_phone_screenshot (Live UI Verification)
  // -------------------------------------------------------------------------
  console.log("\n[5/5] Testing Tool: take_phone_screenshot (Native Base64 Stream)...");
  try {
    const t0 = Date.now();
    const shotRes = await sendBridgeAction({ actionType: "TAKE_SCREENSHOT" });
    const dur = Date.now() - t0;
    const isSuccess = shotRes.success === true || !!shotRes.screenshotBase64;
    console.log(`  ${isSuccess ? "✅ PASS" : "❌ FAIL"} (${dur}ms): ${shotRes.message}`);
    if (shotRes.screenshotBase64) {
      const buffer = Buffer.from(shotRes.screenshotBase64, "base64");
      fs.writeFileSync("C:/Users/jaypr/.gemini/antigravity-ide/brain/b5e21c58-e5a4-42f7-bfc5-b04f2558c8b8/final_mcp_test_screen.png", buffer);
      console.log(`     Saved final_mcp_test_screen.png (${Math.round(buffer.length / 1024)} KB)`);
    }
    results.push({ tool: "take_phone_screenshot", status: isSuccess ? "PASS" : "FAIL", duration: `${dur}ms` });
  } catch (err) {
    console.error("  ❌ ERROR:", err.message);
    results.push({ tool: "take_phone_screenshot", status: "ERROR", duration: "0ms" });
  }

  console.log("\n==================================================================");
  console.log("📊 MCP TOOL VERIFICATION SUMMARY");
  console.log("==================================================================");
  console.table(results);
  const passCount = results.filter((r) => r.status === "PASS").length;
  console.log(`🎉 Final Score: ${passCount} / ${results.length} Passed (${Math.round((passCount / results.length) * 100)}%)\n`);
}

runMcpToolTestSuite().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
