import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const QRCode = require("qrcode");

const loadWorkerModule = async () => {
  const workerUrl = new URL("../src/workers/batchGenerator.worker.ts", import.meta.url);
  const source = await readFile(workerUrl, "utf8");
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2019,
      esModuleInterop: true
    },
    fileName: fileURLToPath(workerUrl)
  });

  const sandboxSelf = { postMessage: () => {} };
  const moduleScope = { exports: {} };
  const sandbox = {
    module: moduleScope,
    exports: moduleScope.exports,
    require,
    TextEncoder,
    self: sandboxSelf,
    setTimeout,
    clearTimeout,
    console
  };

  vm.runInNewContext(transpiled.outputText, sandbox, {
    filename: path.basename(workerUrl.pathname)
  });

  return { exports: moduleScope.exports, self: sandboxSelf };
};

test("createSegments returns byte segments as Uint8Array", async () => {
  const { exports } = await loadWorkerModule();
  const segments = exports.createSegments("Привет");

  assert.equal(Array.isArray(segments), true);
  assert.equal(segments[0].mode, "byte");
  assert.ok(segments[0].data instanceof Uint8Array);
  assert.deepEqual([...segments[0].data], [...new TextEncoder().encode("Привет")]);
});

test("QRCode accepts worker segments for SVG generation", async () => {
  const { exports } = await loadWorkerModule();
  const svg = await QRCode.toString(exports.createSegments("Hello"), {
    type: "svg",
    width: 128,
    errorCorrectionLevel: "M",
    margin: 4
  });

  assert.match(svg, /<svg/);
});
