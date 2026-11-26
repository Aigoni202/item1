const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");

test("home cards dispatch taps to the existing feature handler", () => {
  const wxml = fs.readFileSync(
    path.join(root, "miniprogram/pages/index/index.wxml"),
    "utf8"
  );

  for (const id of ["learn", "book", "mistakes", "new-words", "pk", "challenge", "ai"]) {
    assert.match(
      wxml,
      new RegExp(`bindtap="onFeatureTap"[^>]*data-id="${id}"`),
      `${id} must dispatch through onFeatureTap`
    );
  }
});

test("custom tab items dispatch taps to the switchTab handler", () => {
  const wxml = fs.readFileSync(
    path.join(root, "miniprogram/custom-tab-bar/index.wxml"),
    "utf8"
  );

  assert.match(wxml, /bindtap="switchTab"/);
  assert.match(wxml, /data-index="\{\{index\}\}"/);
});
