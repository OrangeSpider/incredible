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
    readFile(new URL("../engine/gadget-catalog.ts",import.meta.url),"utf8"),
    readFile(new URL("../public/assets/hamster-wheel-sprites.png",import.meta.url)),
  ]);
  assert.match(source,/hamster-wheel-sprites\.png/);
  assert.deepEqual([...sprite.subarray(0,8)],[137,80,78,71,13,10,26,10],"asset must be a PNG");
  assert.equal(sprite.readUInt32BE(16),768);
  assert.equal(sprite.readUInt32BE(20),512,"the 3x2 sheet must contain six square animation cells");
});

test("cat uses a generated three-state animation sprite sheet",async()=>{
  const [source,sprite]=await Promise.all([
    readFile(new URL("../engine/gadget-catalog.ts",import.meta.url),"utf8"),
    readFile(new URL("../public/assets/cat-animation-sprites.png",import.meta.url)),
  ]);
  assert.match(source,/cat-animation-sprites\.png/);
  assert.deepEqual([...sprite.subarray(0,8)],[137,80,78,71,13,10,26,10],"asset must be a PNG");
  assert.equal(sprite.readUInt32BE(16),768);
  assert.equal(sprite.readUInt32BE(20),768,"the 3x3 sheet must contain nine square animation cells");
  assert.equal(sprite[25],6,"the cat sprite sheet must use RGBA pixels with transparency");
});

test("mouse uses a transparent three-frame running sprite sheet",async()=>{
  const [source,sprite]=await Promise.all([
    readFile(new URL("../engine/gadget-catalog.ts",import.meta.url),"utf8"),
    readFile(new URL("../public/assets/mouse-running-sprites.png",import.meta.url)),
  ]);
  assert.match(source,/mouse-running-sprites\.png/);
  assert.deepEqual([...sprite.subarray(0,8)],[137,80,78,71,13,10,26,10],"asset must be a PNG");
  assert.equal(sprite.readUInt32BE(16),2172);
  assert.equal(sprite.readUInt32BE(20),724,"the horizontal sheet must contain three square animation cells");
  assert.equal(sprite[25],6,"the mouse sprite sheet must use RGBA pixels with transparency");
});

test("Mr. Blue uses a transparent three-state cartoon sprite sheet",async()=>{
  const [source,sprite]=await Promise.all([
    readFile(new URL("../engine/gadget-catalog.ts",import.meta.url),"utf8"),
    readFile(new URL("../public/assets/mr-blue-animation-sprites.png",import.meta.url)),
  ]);
  assert.match(source,/mr-blue-animation-sprites\.png/);
  assert.deepEqual([...sprite.subarray(0,8)],[137,80,78,71,13,10,26,10],"asset must be a PNG");
  assert.equal(sprite.readUInt32BE(16),1254);
  assert.equal(sprite.readUInt32BE(20),1254,"the 3x3 sheet must contain nine square animation cells");
  assert.equal(sprite[25],6,"Mr. Blue's sprite sheet must use RGBA pixels with transparency");
});

test("rockets use a transparent eight-frame ignition and launch sprite sheet",async()=>{
  const [source,sprite]=await Promise.all([
    readFile(new URL("../engine/gadget-catalog.ts",import.meta.url),"utf8"),
    readFile(new URL("../public/assets/rocket-launch-sprites.png",import.meta.url)),
  ]);
  assert.match(source,/rocket-launch-sprites\.png/);
  assert.deepEqual([...sprite.subarray(0,8)],[137,80,78,71,13,10,26,10],"asset must be a PNG");
  assert.equal(sprite.readUInt32BE(16),1776);
  assert.equal(sprite.readUInt32BE(20),888,"the 4x2 sheet must contain eight square animation cells");
  assert.equal(sprite[25],6,"the rocket sprite sheet must use RGBA pixels with transparency");
});
