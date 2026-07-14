import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";

const developmentPreviewMeta =
  /<meta(?=[^>]*\bname=["']codex-preview["'])(?=[^>]*\bcontent=["']development["'])[^>]*>/i;

test("renders development preview metadata", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  const response = await worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );

  assert.equal(response.status, 200);
  assert.match(
    response.headers.get("content-type") ?? "",
    /^text\/html\b/i,
  );
  assert.match(await response.text(), developmentPreviewMeta);
});

test("hamster wheel uses a six-frame generated cartoon sprite sheet",async()=>{
  const [source,sprite]=await Promise.all([
    readFile(new URL("../app/page.tsx",import.meta.url),"utf8"),
    readFile(new URL("../public/assets/hamster-wheel-sprites.png",import.meta.url)),
  ]);
  assert.match(source,/hamster-wheel-sprites\.png/);
  assert.deepEqual([...sprite.subarray(0,8)],[137,80,78,71,13,10,26,10],"asset must be a PNG");
  assert.equal(sprite.readUInt32BE(16),768);
  assert.equal(sprite.readUInt32BE(20),512,"the 3x2 sheet must contain six square animation cells");
});
