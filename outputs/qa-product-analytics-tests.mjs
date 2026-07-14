import assert from "node:assert/strict";
import fs from "node:fs";

const app = fs.readFileSync("index.html", "utf8");
const config = fs.readFileSync("analytics-config.js", "utf8");

assert.ok(config.includes('posthogProjectKey: ""'), "analytics must be disabled until a public project key is configured");
assert.ok(app.includes('getProductAnalyticsConsent().decision !== "unknown"'), "analytics consent prompt must respect an existing choice");
assert.ok(app.includes('consent.decision !== "granted"'), "analytics initialization must require opt-in consent");
assert.ok(app.includes('maskAllInputs: true'), "session replay must mask form inputs");
assert.ok(app.includes('maskTextSelector: "*"'), "session replay must mask text by default");
assert.ok(app.includes('mask_all_element_attributes: true'), "autocapture must mask element attributes");
assert.ok(app.includes('resetProductAnalyticsIdentity();'), "logout must reset analytics identity");
assert.ok(app.includes('trackProductEvent("workout completed"'), "workout completion funnel event is missing");
assert.ok(app.includes('trackProductEvent("subscription checkout started"'), "checkout funnel event is missing");

const identifyStart = app.indexOf("function identifyProductAnalytics");
const identifyEnd = app.indexOf("function resetProductAnalyticsIdentity", identifyStart);
const identifyBlock = app.slice(identifyStart, identifyEnd);
assert.ok(!identifyBlock.includes("full_name"), "analytics identity must not include a user name");
assert.ok(!identifyBlock.includes("email"), "analytics identity must not include an email");

const completionCaptureStart = app.indexOf('trackProductEvent("workout completed"');
const completionCaptureEnd = app.indexOf("});", completionCaptureStart) + 3;
const completionCapture = app.slice(completionCaptureStart, completionCaptureEnd);
assert.ok(!completionCapture.includes("workout_code"), "analytics must not capture the user-defined workout code");
assert.ok(!completionCapture.includes("total_volume_kg"), "analytics must not capture total workout volume");

console.log("qa-product-analytics-tests: OK");
