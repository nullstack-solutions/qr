import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

/**
 * Tests for QR code preview rendering
 *
 * These tests ensure that the QR code preview container has the correct
 * CSS styles to display the QR code fully, regardless of its size, shape,
 * or other settings.
 */

test("preview__canvas has container styles for proper QR display", async () => {
  const cssPath = new URL("../src/app/page.css", import.meta.url);
  const css = await readFile(cssPath, "utf8");

  // Check that .preview__canvas has width constraint
  assert.match(
    css,
    /\.preview__canvas\s*{[^}]*width:\s*100%/,
    ".preview__canvas should have width: 100%"
  );

  // Check that .preview__canvas has max-width constraint
  assert.match(
    css,
    /\.preview__canvas\s*{[^}]*max-width:\s*300px/,
    ".preview__canvas should have max-width: 300px"
  );

  // Check that .preview__canvas maintains a square aspect ratio
  assert.match(
    css,
    /\.preview__canvas\s*{[^}]*aspect-ratio:\s*1\s*\/\s*1/,
    ".preview__canvas should have aspect-ratio: 1 / 1"
  );

  // Check that .preview__canvas uses flexbox for centering
  assert.match(
    css,
    /\.preview__canvas\s*{[^}]*display:\s*flex/,
    ".preview__canvas should use display: flex"
  );

  // Check that .preview__canvas centers content
  assert.match(
    css,
    /\.preview__canvas\s*{[^}]*align-items:\s*center/,
    ".preview__canvas should center items vertically"
  );

  assert.match(
    css,
    /\.preview__canvas\s*{[^}]*justify-content:\s*center/,
    ".preview__canvas should center items horizontally"
  );
});

test("preview__canvas child elements have responsive sizing", async () => {
  const cssPath = new URL("../src/app/page.css", import.meta.url);
  const css = await readFile(cssPath, "utf8");

  // Check that direct child div, canvas, and svg have width: 100%
  assert.match(
    css,
    /\.preview__canvas\s*>\s*div[^}]*,\s*\.preview__canvas\s+canvas[^}]*,\s*\.preview__canvas\s+svg\s*{[^}]*width:\s*100%\s*!important/,
    ".preview__canvas > div, canvas, svg should have width: 100% !important"
  );

  // Check that height is set to auto for proper aspect ratio
  assert.match(
    css,
    /\.preview__canvas\s*>\s*div[^}]*,\s*\.preview__canvas\s+canvas[^}]*,\s*\.preview__canvas\s+svg\s*{[^}]*height:\s*auto\s*!important/,
    ".preview__canvas > div, canvas, svg should have height: auto !important"
  );

  // Check that max-width is 100% to prevent overflow
  assert.match(
    css,
    /\.preview__canvas\s*>\s*div[^}]*,\s*\.preview__canvas\s+canvas[^}]*,\s*\.preview__canvas\s+svg\s*{[^}]*max-width:\s*100%\s*!important/,
    ".preview__canvas > div, canvas, svg should have max-width: 100% !important"
  );

  // Check that object-fit is set to contain for proper scaling
  assert.match(
    css,
    /\.preview__canvas\s*>\s*div[^}]*,\s*\.preview__canvas\s+canvas[^}]*,\s*\.preview__canvas\s+svg\s*{[^}]*object-fit:\s*contain/,
    ".preview__canvas > div, canvas, svg should have object-fit: contain"
  );

  // Check that display is set to block to avoid inline cropping issues
  assert.match(
    css,
    /\.preview__canvas\s*>\s*div[^}]*,\s*\.preview__canvas\s+canvas[^}]*,\s*\.preview__canvas\s+svg\s*{[^}]*display:\s*block/,
    ".preview__canvas > div, canvas, svg should have display: block"
  );
});

test("preview container exists and has proper styling", async () => {
  const cssPath = new URL("../src/app/page.css", import.meta.url);
  const css = await readFile(cssPath, "utf8");

  // Verify .preview container exists
  assert.match(
    css,
    /\.preview\s*{/,
    ".preview container should be defined"
  );

  // Check that .preview uses flexbox
  assert.match(
    css,
    /\.preview\s*{[^}]*display:\s*flex/,
    ".preview should use display: flex"
  );

  // Check that .preview has flex-direction: column
  assert.match(
    css,
    /\.preview\s*{[^}]*flex-direction:\s*column/,
    ".preview should have flex-direction: column"
  );

  // Check that .preview centers its items
  assert.match(
    css,
    /\.preview\s*{[^}]*align-items:\s*center/,
    ".preview should center items"
  );
});

test("CSS prevents QR code from being cropped", async () => {
  const cssPath = new URL("../src/app/page.css", import.meta.url);
  const css = await readFile(cssPath, "utf8");

  // Ensure there are no fixed dimensions on canvas/svg that could cause cropping
  // The !important flags should override any inline styles from the QR library

  const canvasSvgRules = css.match(/\.preview__canvas\s*>\s*div[^}]*,\s*\.preview__canvas\s+canvas[^}]*,\s*\.preview__canvas\s+svg\s*{[^}]*}/s);

  assert.ok(canvasSvgRules, "Should have rules for .preview__canvas > div, canvas, svg");

  const ruleText = canvasSvgRules[0];

  // Verify !important is used for width, height, and max-width
  assert.match(ruleText, /width:\s*100%\s*!important/, "width should use !important");
  assert.match(ruleText, /height:\s*auto\s*!important/, "height should use !important");
  assert.match(ruleText, /max-width:\s*100%\s*!important/, "max-width should use !important");
});

test("preview styles work for different QR code shapes", async () => {
  const cssPath = new URL("../src/app/page.css", import.meta.url);
  const css = await readFile(cssPath, "utf8");

  // object-fit: contain ensures both square and circle shapes fit properly
  assert.match(
    css,
    /object-fit:\s*contain/,
    "object-fit: contain should handle different shapes (square/circle)"
  );

  // flexbox centering should work for any shape
  const previewCanvas = css.match(/\.preview__canvas\s*{[^}]*}/s);
  assert.ok(previewCanvas, ".preview__canvas should exist");

  assert.match(
    previewCanvas[0],
    /display:\s*flex/,
    "flexbox ensures proper centering regardless of shape"
  );
});
