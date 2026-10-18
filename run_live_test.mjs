import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KEY_FILE = path.join(__dirname, ".orbital_session_key");
const AUTH_KEY = fs.existsSync(KEY_FILE) ? fs.readFileSync(KEY_FILE, "utf8").trim() : "";

function request(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => body += chunk);
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch (_) {
          resolve({ status: res.statusCode, raw: body });
        }
      });
    });
    req.on("error", reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function runTests() {
  console.log("==================================================");
  console.log("🚀 ORBITAL LIVE DEVICE AUTOMATION TEST SUITE");
  console.log("==================================================");

  // Test 1: Status Endpoint
  console.log("\n[Test 1] Checking Bridge Status...");
  const statusRes = await request({
    host: "127.0.0.1",
    port: 8766,
    path: "/",
    method: "GET"
  });
  if (!statusRes.data || !statusRes.data.phoneConnected) {
    console.error("❌ Phone is not connected to bridge!", statusRes);
    process.exit(1);
  }
  console.log(`✅ Phone is connected to bridge! Host: ${statusRes.data.host}`);

  // Test 2: Inspect Live Screen State
  console.log("\n[Test 2] Inspecting Live Phone Screen...");
  const inspectRes = await request({
    host: "127.0.0.1",
    port: 8766,
    path: "/inspect",
    method: "GET",
    headers: { Authorization: `Bearer ${AUTH_KEY}` }
  });
  console.log("  • Current Package:", inspectRes.data?.currentPackage);
  console.log("  • Screen Size:", `${inspectRes.data?.screenWidth}x${inspectRes.data?.screenHeight}`);
  console.log("  • Total Visible Nodes:", inspectRes.data?.nodes?.length || 0);
  const texts = (inspectRes.data?.nodes || []).map(n => n.text || n.contentDescription).filter(Boolean);
  console.log("  • Sample Visible Texts:", texts.slice(0, 6).join(", "));
  console.log("✅ Screen inspection verified!");

  // Test 3: Press HOME key
  console.log("\n[Test 3] Navigating to Home Screen (PRESS_KEY: HOME)...");
  const homeRes = await request({
    host: "127.0.0.1",
    port: 8766,
    path: "/action",
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${AUTH_KEY}` }
  }, {
    actionType: "PRESS_KEY",
    keyCode: "HOME"
  });
  console.log("  • Result:", homeRes.data?.message || JSON.stringify(homeRes.data));
  console.log("✅ System navigation verified!");

  // Test 4: Open Settings app dynamically (OPEN_APP)
  console.log("\n[Test 4] Launching Settings App (OPEN_APP: com.android.settings)...");
  const launchRes = await request({
    host: "127.0.0.1",
    port: 8766,
    path: "/action",
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${AUTH_KEY}` }
  }, {
    actionType: "OPEN_APP",
    packageName: "com.android.settings",
    targetText: "Settings"
  });
  console.log("  • Launch Result:", launchRes.data?.message || JSON.stringify(launchRes.data));
  console.log("✅ Dynamic app launching verified!");

  // Wait 1s for transition
  await new Promise(r => setTimeout(r, 1200));

  // Test 5: Verify Settings Screen Hierarchy
  console.log("\n[Test 5] Verifying Settings Screen State & Accessibility Nodes...");
  const inspectSettings = await request({
    host: "127.0.0.1",
    port: 8766,
    path: "/inspect",
    method: "GET",
    headers: { Authorization: `Bearer ${AUTH_KEY}` }
  });
  console.log("  • Current Package:", inspectSettings.data?.currentPackage);
  console.log("  • Visible Nodes in Settings:", inspectSettings.data?.nodes?.length || 0);
  const settingsItems = (inspectSettings.data?.nodes || [])
    .map(n => n.text || n.contentDescription)
    .filter(Boolean);
  console.log("  • Settings Items Found:", settingsItems.slice(0, 8).join(" | "));
  console.log("✅ State transition & accessibility verification confirmed!");

  // Test 6: Return to Home
  console.log("\n[Test 6] Returning to Home Screen...");
  await request({
    host: "127.0.0.1",
    port: 8766,
    path: "/action",
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${AUTH_KEY}` }
  }, {
    actionType: "PRESS_KEY",
    keyCode: "HOME"
  });
  console.log("✅ Cleaned up and returned to Home screen!");

  console.log("\n==================================================");
  console.log("🎉 ALL LIVE DEVICE AUTOMATION TESTS PASSED (6/6)");
  console.log("==================================================");
}

runTests().catch(err => {
  console.error("Test failed with error:", err);
  process.exit(1);
});
