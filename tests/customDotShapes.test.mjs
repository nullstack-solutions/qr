import test from "node:test";
import assert from "node:assert/strict";

import {
  applyCustomDotShape,
  applyDotSpacing,
  clampSpacing,
  CUSTOM_DOT_SHAPES,
  isCustomDotShapeSupported,
} from "../src/lib/qrCustomShapes.mjs";

const createRect = ({ width, height, x = 0, y = 0, fill = "#000000" }) => {
  const attributes = new Map([
    ["width", String(width)],
    ["height", String(height)],
    ["x", String(x)],
    ["y", String(y)],
    ["fill", fill],
  ]);

  return {
    tagName: "rect",
    attributes,
    parentNode: null,
    getAttribute(name) {
      return attributes.get(name) ?? null;
    },
    setAttribute(name, value) {
      attributes.set(name, String(value));
    },
  };
};

const createSvg = (rects) => {
  const replacements = [];
  const created = [];

  const parentNode = {
    replaceChild(newNode, oldNode) {
      replacements.push({ newNode, oldNode });
      newNode.parentNode = parentNode;
      const index = rects.indexOf(oldNode);
      if (index >= 0) {
        rects[index] = newNode;
      }
    },
  };

  rects.forEach((rect) => {
    rect.parentNode = parentNode;
  });

  const svg = {
    ownerDocument: {
      createElementNS(_ns, tag) {
        const attrs = new Map();
        const node = {
          tagName: tag,
          parentNode: null,
          attributes: attrs,
          setAttribute(name, value) {
            attrs.set(name, String(value));
          },
          getAttribute(name) {
            return attrs.get(name) ?? null;
          },
        };
        created.push(node);
        return node;
      },
    },
    querySelectorAll(selector) {
      if (selector === "rect") {
        return rects;
      }
      return [];
    },
  };

  return { svg, parentNode, replacements, created };
};

test("clampSpacing enforces bounds", () => {
  assert.equal(clampSpacing(-1), 0);
  assert.equal(clampSpacing(0.3), 0.3);
  assert.equal(clampSpacing(1.5), 0.6);
  assert.equal(clampSpacing(Number.NaN), 0);
});

test("applyDotSpacing scales modules when no custom shape is provided", () => {
  const rect = createRect({ width: 10, height: 10, x: 0, y: 0 });
  const { svg } = createSvg([rect]);

  applyDotSpacing(svg, 0.2);

  assert.equal(rect.getAttribute("width"), "8.000");
  assert.equal(rect.getAttribute("height"), "8.000");
  assert.equal(rect.getAttribute("x"), "1.000");
  assert.equal(rect.getAttribute("y"), "1.000");
});

test("applyDotSpacing respects provided filter", () => {
  const rectA = createRect({ width: 10, height: 10, x: 0, y: 0 });
  const rectB = createRect({ width: 12, height: 12, x: 20, y: 0 });
  const { svg } = createSvg([rectA, rectB]);

  applyDotSpacing(svg, 0.2, (rect) => rect === rectA);

  assert.equal(rectA.getAttribute("width"), "8.000");
  assert.equal(rectA.getAttribute("height"), "8.000");
  assert.equal(rectB.getAttribute("width"), "12");
  assert.equal(rectB.getAttribute("height"), "12");
});

test("applyCustomDotShape replaces rects with SVG paths", () => {
  const rect = createRect({ width: 12, height: 12, x: 4, y: 6, fill: "#ff0000" });
  const { svg, replacements } = createSvg([rect]);
  const heart = CUSTOM_DOT_SHAPES.find((shape) => shape.id === "heart");
  assert.ok(heart, "heart shape should exist");

  const calls = [];
  const originalRender = heart.renderPath;
  heart.renderPath = (x, y, size) => {
    calls.push({ x, y, size });
    return originalRender(x, y, size);
  };

  try {
    applyCustomDotShape(svg, "heart", 0.1);
  } finally {
    heart.renderPath = originalRender;
  }

  assert.equal(replacements.length, 1, "rect should be replaced with a path");
  const [replacement] = replacements;
  assert.equal(replacement.newNode.tagName, "path");
  assert.equal(replacement.newNode.getAttribute("fill"), "#ff0000");
  assert.ok(replacement.newNode.getAttribute("d"), "path should have drawing instructions");

  assert.equal(calls.length, 1, "renderPath should be called once per rect");
  const { x, y, size } = calls[0];
  assert.equal(Number(x.toFixed(3)), 4.6);
  assert.equal(Number(y.toFixed(3)), 6.6);
  assert.equal(Number(size.toFixed(3)), 10.8);
});

test("applyCustomDotShape falls back to spacing for unsupported shape", () => {
  const rect = createRect({ width: 20, height: 20, x: 0, y: 0 });
  const { svg, replacements } = createSvg([rect]);

  applyCustomDotShape(svg, "unknown", 0.25);

  assert.equal(replacements.length, 0, "rect should not be replaced for unknown shapes");
  assert.equal(rect.getAttribute("width"), "15.000");
  assert.equal(rect.getAttribute("height"), "15.000");
  assert.equal(rect.getAttribute("x"), "2.500");
  assert.equal(rect.getAttribute("y"), "2.500");
});

test("applyCustomDotShape skips large positioning modules", () => {
  const rect = createRect({ width: 50, height: 50, x: 0, y: 0 });
  const { svg, replacements } = createSvg([rect]);

  applyCustomDotShape(svg, "star", 0);

  assert.equal(replacements.length, 0);
});

test("isCustomDotShapeSupported guards against invalid values", () => {
  assert.equal(isCustomDotShapeSupported("heart"), true);
  assert.equal(isCustomDotShapeSupported("unknown"), false);
  assert.equal(isCustomDotShapeSupported(null), false);
});

test("applyCustomDotShape only transforms rects accepted by filter", () => {
  const heart = CUSTOM_DOT_SHAPES.find((shape) => shape.id === "heart");
  assert.ok(heart);

  const rectSmall = createRect({ width: 12, height: 12, x: 0, y: 0, fill: "#000" });
  const rectLarge = createRect({ width: 36, height: 36, x: 20, y: 20, fill: "#111" });
  const { svg, replacements } = createSvg([rectSmall, rectLarge]);

  applyCustomDotShape(svg, "heart", 0, (rect, width) => width < 20);

  assert.equal(replacements.length, 1);
  assert.equal(replacements[0].oldNode, rectSmall);
  assert.equal(rectLarge.tagName, "rect");
  assert.equal(rectLarge.getAttribute("fill"), "#111");
});
