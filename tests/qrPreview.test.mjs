import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const cssPath = new URL("../src/app/page.css", import.meta.url);

const normalizeWhitespace = (value) => value.replace(/\s+/g, " ").trim();

const parseDeclarations = (block) =>
  block
    .split(";")
    .map((declaration) => declaration.trim())
    .filter(Boolean)
    .reduce((acc, declaration) => {
      const [property, ...valueParts] = declaration.split(":");
      if (!valueParts.length) {
        return acc;
      }

      const propertyName = property.trim();
      const value = normalizeWhitespace(valueParts.join(":"));

      acc[propertyName] = value;
      return acc;
    }, {});

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const buildSelectorPattern = (selector) => {
  let pattern = "";

  for (const char of selector) {
    if (/\s/.test(char)) {
      if (!pattern.endsWith("\\s+")) {
        pattern += "\\s+";
      }
    } else if (char === ">") {
      pattern += "\\s*>\\s*";
    } else {
      pattern += escapeRegex(char);
    }
  }

  return pattern;
};

const getRule = (css, selectors) => {
  const pattern = selectors
    .map((selector) => buildSelectorPattern(normalizeWhitespace(selector)))
    .join("\\s*,\\s*");

  const regex = new RegExp(`${pattern}\\s*{([^}]*)}`, "s");
  const match = css.match(regex);

  if (!match) {
    return null;
  }

  const declarations = match[1].trim();
  return {
    declarations,
    declarationMap: parseDeclarations(declarations),
  };
};

const loadCss = async () => readFile(cssPath, "utf8");

/**
 * Tests for QR code preview rendering
 *
 * These tests ensure that the QR code preview container has the correct
 * CSS styles to display the QR code fully, regardless of its size, shape,
 * or other settings.
 */

test("preview__canvas has container styles for proper QR display", async () => {
  const css = await loadCss();
  const rule = getRule(css, [".preview__canvas"]);

  assert.ok(rule, ".preview__canvas rule should be defined");

  assert.equal(rule.declarationMap.width, "100%", ".preview__canvas should have width: 100%");
  assert.equal(
    rule.declarationMap["max-width"],
    "300px",
    ".preview__canvas should have max-width: 300px"
  );
  assert.equal(
    rule.declarationMap["aspect-ratio"],
    "1 / 1",
    ".preview__canvas should maintain a 1 / 1 aspect ratio"
  );
  assert.equal(rule.declarationMap.display, "flex", ".preview__canvas should use display: flex");
  assert.equal(
    rule.declarationMap["align-items"],
    "center",
    ".preview__canvas should center items vertically"
  );
  assert.equal(
    rule.declarationMap["justify-content"],
    "center",
    ".preview__canvas should center items horizontally"
  );
});

test("preview__canvas child elements have responsive sizing", async () => {
  const css = await loadCss();
  const rule = getRule(css, [
    ".preview__canvas > div",
    ".preview__canvas canvas",
    ".preview__canvas svg",
  ]);

  assert.ok(rule, ".preview__canvas > div, canvas, svg rule should be defined");

  assert.equal(
    rule.declarationMap.width,
    "100% !important",
    ".preview__canvas > div, canvas, svg should have width: 100% !important"
  );
  assert.equal(
    rule.declarationMap.height,
    "100% !important",
    ".preview__canvas > div, canvas, svg should have height: 100% !important"
  );
  assert.equal(
    rule.declarationMap["max-width"],
    "100% !important",
    ".preview__canvas > div, canvas, svg should have max-width: 100% !important"
  );
  assert.equal(
    rule.declarationMap["max-height"],
    "100% !important",
    ".preview__canvas > div, canvas, svg should have max-height: 100% !important"
  );
  assert.equal(
    rule.declarationMap["object-fit"],
    "contain",
    ".preview__canvas > div, canvas, svg should have object-fit: contain"
  );
  assert.equal(
    rule.declarationMap.display,
    "block",
    ".preview__canvas > div, canvas, svg should have display: block"
  );
});

test("preview container exists and has proper styling", async () => {
  const css = await loadCss();
  const rule = getRule(css, [".preview"]);

  assert.ok(rule, ".preview rule should be defined");
  assert.equal(rule.declarationMap.display, "flex", ".preview should use display: flex");
  assert.equal(
    rule.declarationMap["flex-direction"],
    "column",
    ".preview should have flex-direction: column"
  );
  assert.equal(rule.declarationMap["align-items"], "center", ".preview should center items");
});

test("CSS prevents QR code from being cropped", async () => {
  const css = await loadCss();
  const rule = getRule(css, [
    ".preview__canvas > div",
    ".preview__canvas canvas",
    ".preview__canvas svg",
  ]);

  assert.ok(rule, ".preview__canvas > div, canvas, svg rule should be defined");

  assert.ok(
    rule.declarationMap.width?.includes("!important"),
    "width should use !important"
  );
  assert.ok(
    rule.declarationMap.height?.includes("!important"),
    "height should use !important"
  );
  assert.ok(
    rule.declarationMap["max-width"]?.includes("!important"),
    "max-width should use !important"
  );
});

test("preview styles work for different QR code shapes", async () => {
  const css = await loadCss();
  const rule = getRule(css, [
    ".preview__canvas > div",
    ".preview__canvas canvas",
    ".preview__canvas svg",
  ]);

  assert.ok(rule, ".preview__canvas > div, canvas, svg rule should be defined");
  assert.equal(
    rule.declarationMap["object-fit"],
    "contain",
    "object-fit: contain should handle different shapes (square/circle)"
  );
});
