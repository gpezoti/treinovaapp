import fs from "node:fs";
import assert from "node:assert/strict";

const html = fs.readFileSync("index.html", "utf8");

assert.match(html, /\.auth-footer \{ margin-top: auto;/);
assert.doesNotMatch(html, /position:fixed;left:0;right:0;bottom:14px/);
assert.match(html, /id="auth-choice"/);
assert.match(html, /function showSignupPanel\(\)[\s\S]*choice\.style\.display = "none"/);
assert.match(html, /function showForgotPanel\(\)[\s\S]*choice\.style\.display = "none"/);
assert.match(html, /function showAuthForm\(\)[\s\S]*choice\.style\.display = "grid"/);

console.log("Auth mobile UX QA passed.");
