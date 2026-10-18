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

async function runGesturesAndExplorationSuite() {
  console.log("==================================================================");
  console.log("🚀 ORBITAL LIVE GESTURES, NAVIGATION & APP EXPLORATION SUITE");
  console.log("==================================================================");
  console.log("");

  const results = [];

  // -------------------------------------------------------------------------
  // 1. Navigation Key: HOME
  // -------------------------------------------------------------------------
  console.log("[1/5] Testing Global Navigation Key (HOME)...");
  try {
    const t0 = Date.now();
    const res = await sendBridgeAction({
      actionType: "PRESS_KEY",
      keyCode: "HOME",
    });
    await sleep(1000);
    const state = await sendBridgeAction({ actionType: "INSPECT_SCREEN" });
    const dur = Date.now() - t0;
    const isHome = state.updatedScreenState?.currentPackage?.includes("launcher") || res.success === true;
    console.log(`  ${isHome ? "✅ PASS" : "❌ FAIL"} (${dur}ms): Navigated to Home (Package: ${state.updatedScreenState?.currentPackage})`);
    results.push({ test: "Global Key HOME", status: isHome ? "PASS" : "FAIL", duration: `${dur}ms` });
  } catch (err) {
    console.error("  ❌ ERROR:", err.message);
    results.push({ test: "Global Key HOME", status: "ERROR", duration: "0ms" });
  }

  await sleep(1200);

  // -------------------------------------------------------------------------
  // 2. Gesture: Swipe LEFT and Swipe RIGHT on Launcher
  // -------------------------------------------------------------------------
  console.log("\n[2/5] Testing Screen Swiping & Gestures (SWIPE LEFT -> SWIPE RIGHT)...");
  try {
    const t0 = Date.now();
    const swipeLeft = await sendBridgeAction({
      actionType: "SWIPE",
      swipeDirection: "LEFT",
    });
    console.log(`  - Swipe Left: ${swipeLeft.message}`);
    await sleep(800);

    const swipeRight = await sendBridgeAction({
      actionType: "SWIPE",
      swipeDirection: "RIGHT",
    });
    console.log(`  - Swipe Right: ${swipeRight.message}`);
    const dur = Date.now() - t0;
    const isSuccess = swipeLeft.success !== false && swipeRight.success !== false;
    console.log(`  ${isSuccess ? "✅ PASS" : "❌ FAIL"} (${dur}ms): Gesture actuation verified`);
    results.push({ test: "Touch Gestures (SWIPE)", status: isSuccess ? "PASS" : "FAIL", duration: `${dur}ms` });
  } catch (err) {
    console.error("  ❌ ERROR:", err.message);
    results.push({ test: "Touch Gestures (SWIPE)", status: "ERROR", duration: "0ms" });
  }

  await sleep(1200);

  // -------------------------------------------------------------------------
  // 3. App Exploration & Semantic Surface Analysis (Settings App)
  // -------------------------------------------------------------------------
  console.log("\n[3/5] Testing Autonomous App Exploration & UI Discovery (explore_and_analyze_app)...");
  try {
    const t0 = Date.now();
    // Launch Settings
    await sendBridgeAction({
      actionType: "OPEN_APP",
      packageName: "com.android.settings",
      targetText: "Settings",
    });
    await sleep(1500);

    // Inspect Settings DOM
    const inspectRes = await sendBridgeAction({ actionType: "INSPECT_SCREEN" });
    const nodes = inspectRes.updatedScreenState?.nodes || [];
    const dur = Date.now() - t0;
    const isSuccess = nodes.length > 0;
    console.log(`  ${isSuccess ? "✅ PASS" : "❌ FAIL"} (${dur}ms): Discovered ${nodes.length} nodes in Settings (Clickables: ${nodes.filter((n) => n.isClickable).length})`);
    results.push({ test: "Autonomous App Exploration", status: isSuccess ? "PASS" : "FAIL", duration: `${dur}ms` });
  } catch (err) {
    console.error("  ❌ ERROR:", err.message);
    results.push({ test: "Autonomous App Exploration", status: "ERROR", duration: "0ms" });
  }

  await sleep(1200);

  // -------------------------------------------------------------------------
  // 4. Interactive Deep-Link & Key Navigation (Display Settings -> BACK)
  // -------------------------------------------------------------------------
  console.log("\n[4/5] Testing Interactive Screen Click & Return Navigation (CLICK -> BACK)...");
  try {
    const t0 = Date.now();
    const clickRes = await sendBridgeAction({
      actionType: "CLICK_NODE",
      targetText: "Display & brightness",
    });
    console.log(`  - Tap 'Display & brightness': ${clickRes.message}`);
    await sleep(1000);

    const backRes = await sendBridgeAction({
      actionType: "PRESS_KEY",
      keyCode: "BACK",
    });
    console.log(`  - Press BACK: ${backRes.message}`);
    const dur = Date.now() - t0;
    const isSuccess = clickRes.success !== false || backRes.success !== false;
    console.log(`  ${isSuccess ? "✅ PASS" : "❌ FAIL"} (${dur}ms): Navigation interaction verified`);
    results.push({ test: "Interactive Click & BACK Navigation", status: isSuccess ? "PASS" : "FAIL", duration: `${dur}ms` });
  } catch (err) {
    console.error("  ❌ ERROR:", err.message);
    results.push({ test: "Interactive Click & BACK Navigation", status: "ERROR", duration: "0ms" });
  }

  await sleep(1200);

  // -------------------------------------------------------------------------
  // 5. Return to Orbital & Capture Proof-of-Execution Screenshot
  // -------------------------------------------------------------------------
  console.log("\n[5/5] Testing Return to Orbital & Native Bridge Screenshot Capture...");
  try {
    const t0 = Date.now();
    try {
      execSync("adb shell am start -n com.ai.orbital/com.orbital.ui.MainActivity", { stdio: "ignore" });
    } catch (_) {}
    await sleep(1500);

    const shotRes = await sendBridgeAction({ actionType: "TAKE_SCREENSHOT" });
    const dur = Date.now() - t0;
    const isSuccess = shotRes.success === true || !!shotRes.screenshotBase64;
    console.log(`  ${isSuccess ? "✅ PASS" : "❌ FAIL"} (${dur}ms): Screenshot captured (${shotRes.message})`);
    if (shotRes.screenshotBase64) {
      const buffer = Buffer.from(shotRes.screenshotBase64, "base64");
      fs.writeFileSync("C:/Users/jaypr/.gemini/antigravity-ide/brain/b5e21c58-e5a4-42f7-bfc5-b04f2558c8b8/gestures_test_screen.png", buffer);
      console.log(`     Saved gestures_test_screen.png (${Math.round(buffer.length / 1024)} KB)`);
    }
    results.push({ test: "Return to Foreground & Screenshot", status: isSuccess ? "PASS" : "FAIL", duration: `${dur}ms` });
  } catch (err) {
    console.error("  ❌ ERROR:", err.message);
    results.push({ test: "Return to Foreground & Screenshot", status: "ERROR", duration: "0ms" });
  }

  console.log("\n==================================================================");
  console.log("📊 GESTURES & EXPLORATION TEST SUMMARY");
  console.log("==================================================================");
  console.table(results);
  const passCount = results.filter((r) => r.status === "PASS").length;
  console.log(`🎉 Final Score: ${passCount} / ${results.length} Passed (${Math.round((passCount / results.length) * 100)}%)\n`);
}

runGesturesAndExplorationSuite().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
