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

async function runOverlayTypingHardwareSuite() {
  console.log("==================================================================");
  console.log("🚀 ORBITAL OVERLAY CLEARANCE, FORM TYPING & HARDWARE SUITE");
  console.log("==================================================================");
  console.log("");

  const results = [];

  // =========================================================================
  // TEST 1: Dismiss Floating Calculator Overlay & Return Clean State
  // =========================================================================
  console.log("[1/5] Testing Floating Window Clearance & Dismissal (BACK / Click Close)...");
  try {
    const t0 = Date.now();
    // Press BACK to dismiss floating calculator window
    await sendBridgeAction({ actionType: "PRESS_KEY", keyCode: "BACK" });
    await sleep(800);
    // Bring Orbital to foreground
    try {
      execSync("adb shell am start -n com.ai.orbital/com.orbital.ui.MainActivity", { stdio: "ignore" });
    } catch (_) {}
    await sleep(1000);

    const dom = await sendBridgeAction({ actionType: "INSPECT_SCREEN" });
    const nodes = dom.updatedScreenState?.nodes || [];
    const dur = Date.now() - t0;
    const isClean = dom.updatedScreenState?.currentPackage === "com.ai.orbital" ||
      dom.updatedScreenState?.currentPackage?.includes("launcher");
    console.log(`  ${isClean ? "✅ PASS" : "❌ FAIL"} (${dur}ms): Dismissed floating window, returned to ${dom.updatedScreenState?.currentPackage} (${nodes.length} nodes)`);
    results.push({ test: "Floating Overlay Dismissal", status: isClean ? "PASS" : "FAIL", duration: `${dur}ms` });
  } catch (err) {
    console.error("  ❌ ERROR:", err.message);
    results.push({ test: "Floating Overlay Dismissal", status: "ERROR", duration: "0ms" });
  }

  await sleep(1200);

  // =========================================================================
  // TEST 2: Hardware Actuation: Physical Camera LED Flashlight (ON -> OFF)
  // =========================================================================
  console.log("\n[2/5] Testing Physical Flashlight Actuation (FLASHLIGHT ON -> OFF)...");
  try {
    const t0 = Date.now();
    const flashOn = await sendBridgeAction({
      actionType: "DEVICE_ACTION",
      deviceAction: "FLASHLIGHT",
      enabled: true,
    });
    console.log(`  - Flashlight ON: ${flashOn.message}`);
    await sleep(1000);

    const flashOff = await sendBridgeAction({
      actionType: "DEVICE_ACTION",
      deviceAction: "FLASHLIGHT",
      enabled: false,
    });
    console.log(`  - Flashlight OFF: ${flashOff.message}`);
    const dur = Date.now() - t0;
    const isOk = flashOn.success !== false && flashOff.success !== false;
    console.log(`  ${isOk ? "✅ PASS" : "❌ FAIL"} (${dur}ms): Hardware flashlight toggles executed`);
    results.push({ test: "Hardware Flashlight Toggle", status: isOk ? "PASS" : "FAIL", duration: `${dur}ms` });
  } catch (err) {
    console.error("  ❌ ERROR:", err.message);
    results.push({ test: "Hardware Flashlight Toggle", status: "ERROR", duration: "0ms" });
  }

  await sleep(1200);

  // =========================================================================
  // TEST 3: Sound Mode Setting: VIBRATE -> NORMAL
  // =========================================================================
  console.log("\n[3/5] Testing System Audio & Sound Mode (SET_SOUND_MODE)...");
  try {
    const t0 = Date.now();
    const soundVibrate = await sendBridgeAction({
      actionType: "DEVICE_ACTION",
      deviceAction: "SET_SOUND_MODE",
      target: "vibrate",
    });
    console.log(`  - Set Vibrate: ${soundVibrate.message}`);
    await sleep(600);

    const soundNormal = await sendBridgeAction({
      actionType: "DEVICE_ACTION",
      deviceAction: "SET_SOUND_MODE",
      target: "normal",
    });
    console.log(`  - Set Normal: ${soundNormal.message}`);
    const dur = Date.now() - t0;
    const isOk = soundNormal.success !== false;
    console.log(`  ${isOk ? "✅ PASS" : "❌ FAIL"} (${dur}ms): Audio profile switching verified`);
    results.push({ test: "System Sound Mode Actuation", status: isOk ? "PASS" : "FAIL", duration: `${dur}ms` });
  } catch (err) {
    console.error("  ❌ ERROR:", err.message);
    results.push({ test: "System Sound Mode Actuation", status: "ERROR", duration: "0ms" });
  }

  await sleep(1200);

  // =========================================================================
  // TEST 4: Live Form Field Typing & Submission (TYPE_TEXT)
  // =========================================================================
  console.log("\n[4/5] Testing Interactive Text Typing & Input Submission...");
  try {
    const t0 = Date.now();
    // Type text into the prompt input box
    const typeRes = await sendBridgeAction({
      actionType: "TYPE_TEXT",
      textToType: "/status",
      targetText: "Ask or command anything...",
    });
    console.log(`  - Typed text: ${typeRes.message}`);
    await sleep(600);

    // Send query to verify response
    const sendRes = await sendBridgeAction({
      actionType: "CUSTOM_PROMPT",
      customPrompt: "/status",
    });
    const dur = Date.now() - t0;
    const isOk = sendRes.success !== false;
    console.log(`  ${isOk ? "✅ PASS" : "❌ FAIL"} (${dur}ms): ${(sendRes.aiResponse || sendRes.message || "").replace(/\n/g, " ").slice(0, 70)}`);
    results.push({ test: "Live Form Typing & Submission", status: isOk ? "PASS" : "FAIL", duration: `${dur}ms` });
  } catch (err) {
    console.error("  ❌ ERROR:", err.message);
    results.push({ test: "Live Form Typing & Submission", status: "ERROR", duration: "0ms" });
  }

  await sleep(1200);

  // =========================================================================
  // TEST 5: Proof-of-Execution Clean Screenshot Stream
  // =========================================================================
  console.log("\n[5/5] Streaming Live Screenshot of Clean State...");
  try {
    const t0 = Date.now();
    const shotRes = await sendBridgeAction({ actionType: "TAKE_SCREENSHOT" });
    const dur = Date.now() - t0;
    const isOk = shotRes.success === true || !!shotRes.screenshotBase64;
    console.log(`  ${isOk ? "✅ PASS" : "❌ FAIL"} (${dur}ms): Screenshot captured (${shotRes.message})`);
    if (shotRes.screenshotBase64) {
      const buffer = Buffer.from(shotRes.screenshotBase64, "base64");
      fs.writeFileSync("C:/Users/jaypr/.gemini/antigravity-ide/brain/b5e21c58-e5a4-42f7-bfc5-b04f2558c8b8/clean_actuation_screen.png", buffer);
      console.log(`     Saved clean_actuation_screen.png (${Math.round(buffer.length / 1024)} KB)`);
    }
    results.push({ test: "Clean Screenshot Stream", status: isOk ? "PASS" : "FAIL", duration: `${dur}ms` });
  } catch (err) {
    console.error("  ❌ ERROR:", err.message);
    results.push({ test: "Clean Screenshot Stream", status: "ERROR", duration: "0ms" });
  }

  console.log("\n==================================================================");
  console.log("📊 OVERLAY & HARDWARE TEST SUMMARY");
  console.log("==================================================================");
  console.table(results);
  const passCount = results.filter((r) => r.status === "PASS").length;
  console.log(`🎉 Final Score: ${passCount} / ${results.length} Passed (${Math.round((passCount / results.length) * 100)}%)\n`);
}

runOverlayTypingHardwareSuite().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
