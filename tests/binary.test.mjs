import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ts = require("typescript");

async function loadBinaryModule() {
  const moduleUrl = new URL("../src/lib/binary.ts", import.meta.url);
  const source = await readFile(moduleUrl, "utf8");
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2019,
      esModuleInterop: true
    },
    fileName: fileURLToPath(moduleUrl)
  });

  const module = { exports: {} };
  const sandbox = {
    module,
    exports: module.exports,
    require,
    TextEncoder,
    TextDecoder
  };

  vm.runInNewContext(transpiled.outputText, sandbox, {
    filename: fileURLToPath(moduleUrl)
  });

  return sandbox.module.exports;
}

test("bytesToBinaryString preserves byte values", async () => {
  const { bytesToBinaryString } = await loadBinaryModule();
  const encoder = new TextEncoder();
  const payload = encoder.encode("Привет, мир!");

  const binary = bytesToBinaryString(payload);

  assert.equal(binary.length, payload.length);
  for (let index = 0; index < payload.length; index += 1) {
    assert.equal(binary.charCodeAt(index), payload[index]);
  }
});

test("bytesToBinaryString handles large arrays in chunks", async () => {
  const { bytesToBinaryString } = await loadBinaryModule();
  const size = 0x8000 * 2 + 123;
  const bytes = new Uint8Array(size);
  for (let index = 0; index < size; index += 1) {
    bytes[index] = index % 256;
  }

  const binary = bytesToBinaryString(bytes);

  assert.equal(binary.length, bytes.length);
  for (let index = 0; index < size; index += Math.max(1, Math.floor(size / 128))) {
    assert.equal(binary.charCodeAt(index), bytes[index]);
  }
  assert.equal(binary.charCodeAt(size - 1), bytes[size - 1]);
});
