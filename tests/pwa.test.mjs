import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

test("PWA metadata exposes an installable standalone game", async () => {
  const [manifestText, layout, support] = await Promise.all([
    readFile(new URL("../public/manifest.webmanifest", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/game/PwaSupport.tsx", import.meta.url), "utf8"),
  ]);
  const manifest = JSON.parse(manifestText);
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.start_url, "/");
  assert.equal(manifest.scope, "/");
  assert.deepEqual(manifest.icons.map(icon => icon.sizes), ["192x192", "512x512"]);
  assert.match(layout, /manifest:\s*"\/manifest\.webmanifest"/);
  assert.match(layout, /viewportFit:\s*"cover"/);
  assert.match(support, /serviceWorker\.register\("\/sw\.js"\)/);
  assert.match(support, /beforeinstallprompt/);
});

test("offline worker precaches every bundled animation asset", async () => {
  const [worker, assets] = await Promise.all([
    readFile(new URL("../public/sw.js", import.meta.url), "utf8"),
    readdir(new URL("../public/assets/", import.meta.url)),
  ]);
  for (const asset of assets.filter(name => name.endsWith(".png"))) {
    assert.match(worker, new RegExp(`/assets/${asset.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
  }
  assert.match(worker, /request\.mode === "navigate"/);
  assert.match(worker, /caches\.match\("\/"\)/);
});

test("the install icons have the declared PNG dimensions", async () => {
  for (const size of [192, 512]) {
    const image = await readFile(new URL(`../public/app-icon-${size}.png`, import.meta.url));
    assert.deepEqual([...image.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
    assert.equal(image.readUInt32BE(16), size);
    assert.equal(image.readUInt32BE(20), size);
  }
});

test("the mobile game keeps all 34 built-in levels and hides only the editor shortcut", async () => {
  const [levels, toolbar, styles] = await Promise.all([
    readdir(new URL("../levels/", import.meta.url)),
    readFile(new URL("../components/game/GameToolbar.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.equal(levels.filter(name => /^level-\d+\.json$/.test(name)).length, 34);
  assert.match(toolbar, /desktop-editor/);
  assert.match(styles, /\.desktop-editor\{display:none!important\}/);
  assert.match(styles, /orientation:landscape/);
});
