const SVG_NS = "http://www.w3.org/2000/svg";

function clampSpacing(value) {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 0.6) return 0.6;
  return value;
}

function applyDotSpacing(svg, spacing) {
  const safeSpacing = clampSpacing(spacing);
  // Always apply spacing transformation, even when spacing = 0
  // This ensures we override any default spacing from the library
  const scale = 1 - safeSpacing;
  const rects = svg.querySelectorAll("rect");

  rects.forEach((rect) => {
    const width = Number(rect.getAttribute("width"));
    const height = Number(rect.getAttribute("height"));
    if (!width || !height) return;
    if (width > 40 || height > 40) return;

    const x = Number(rect.getAttribute("x"));
    const y = Number(rect.getAttribute("y"));
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;

    const centerX = x + width / 2;
    const centerY = y + height / 2;
    const newWidth = width * scale;
    const newHeight = height * scale;
    const newX = centerX - newWidth / 2;
    const newY = centerY - newHeight / 2;

    rect.setAttribute("x", newX.toFixed(3));
    rect.setAttribute("y", newY.toFixed(3));
    rect.setAttribute("width", newWidth.toFixed(3));
    rect.setAttribute("height", newHeight.toFixed(3));
  });
}

function findModuleSize(rects) {
  let smallest = Infinity;

  rects.forEach((rect) => {
    const width = Number(rect.getAttribute("width"));
    const height = Number(rect.getAttribute("height"));
    if (!Number.isFinite(width) || !Number.isFinite(height)) {
      return;
    }
    if (width <= 0 || height <= 0) {
      return;
    }

    smallest = Math.min(smallest, width, height);
  });

  return Number.isFinite(smallest) ? smallest : null;
}

function replaceRectWithShape(svg, rect, shape, scale) {
  const width = Number(rect.getAttribute("width"));
  const height = Number(rect.getAttribute("height"));
  if (!width || !height) return;

  const x = Number(rect.getAttribute("x"));
  const y = Number(rect.getAttribute("y"));
  if (!Number.isFinite(x) || !Number.isFinite(y)) return;

  const centerX = x + width / 2;
  const centerY = y + height / 2;
  const newSize = Math.min(width, height) * scale;
  const newX = centerX - newSize / 2;
  const newY = centerY - newSize / 2;

  const path = svg.ownerDocument.createElementNS(SVG_NS, "path");
  path.setAttribute("d", shape.renderPath(newX, newY, newSize));

  const fill = rect.getAttribute("fill");
  if (fill) {
    path.setAttribute("fill", fill);
  }

  rect.parentNode?.replaceChild(path, rect);
}

const CUSTOM_DOT_SHAPES = [
  {
    id: "heart",
    name: "Сердце",
    emoji: "❤️",
    renderPath: (x, y, size) => {
      const cx = x + size / 2;
      const cy = y + size / 2;
      const r = size / 4;
      return `M ${cx} ${cy + r}
              C ${cx} ${cy + r}, ${cx - r * 2} ${cy - r}, ${cx - r * 2} ${cy - r * 2}
              A ${r} ${r} 0 0 1 ${cx} ${cy - r}
              A ${r} ${r} 0 0 1 ${cx + r * 2} ${cy - r * 2}
              C ${cx + r * 2} ${cy - r}, ${cx} ${cy + r}, ${cx} ${cy + r} Z`;
    }
  },
  {
    id: "star",
    name: "Звезда",
    emoji: "⭐",
    renderPath: (x, y, size) => {
      const cx = x + size / 2;
      const cy = y + size / 2;
      const outerR = size / 2;
      const innerR = size / 4;
      let path = `M ${cx} ${cy - outerR}`;
      for (let i = 0; i < 5; i++) {
        const angle1 = (i * 72 - 90) * Math.PI / 180;
        const angle2 = (i * 72 - 90 + 36) * Math.PI / 180;
        const x1 = cx + innerR * Math.cos(angle2);
        const y1 = cy + innerR * Math.sin(angle2);
        const x2 = cx + outerR * Math.cos(angle1 + Math.PI * 2 / 5);
        const y2 = cy + outerR * Math.sin(angle1 + Math.PI * 2 / 5);
        path += ` L ${x1} ${y1} L ${x2} ${y2}`;
      }
      return path + " Z";
    }
  },
  {
    id: "plus",
    name: "Плюс",
    emoji: "➕",
    renderPath: (x, y, size) => {
      const w = size / 3;
      const cx = x + size / 2;
      const cy = y + size / 2;
      return `M ${cx - w / 2} ${y}
              H ${cx + w / 2}
              V ${cy - w / 2}
              H ${x + size}
              V ${cy + w / 2}
              H ${cx + w / 2}
              V ${y + size}
              H ${cx - w / 2}
              V ${cy + w / 2}
              H ${x}
              V ${cy - w / 2}
              H ${cx - w / 2} Z`;
    }
  },
  {
    id: "diamond",
    name: "Ромб",
    emoji: "💎",
    renderPath: (x, y, size) => {
      const cx = x + size / 2;
      const cy = y + size / 2;
      return `M ${cx} ${y}
              L ${x + size} ${cy}
              L ${cx} ${y + size}
              L ${x} ${cy} Z`;
    }
  }
];

function isCustomDotShapeSupported(shapeId) {
  if (typeof shapeId !== "string") {
    return false;
  }

  return CUSTOM_DOT_SHAPES.some((shape) => shape.id === shapeId);
}

function applyCustomDotShape(svg, shapeId, spacing, options = {}) {
  const shape = CUSTOM_DOT_SHAPES.find((item) => item.id === shapeId);
  if (!shape) {
    applyDotSpacing(svg, spacing);
    return;
  }

  const safeSpacing = clampSpacing(spacing);
  const scale = 1 - safeSpacing;
  const rects = Array.from(svg.querySelectorAll("rect"));
  const moduleSize = findModuleSize(rects);
  const innerSize = moduleSize ? moduleSize * 3 : null;
  const tolerance = moduleSize ? moduleSize * 0.2 : null;

  rects.forEach((rect) => {
    const width = Number(rect.getAttribute("width"));
    const height = Number(rect.getAttribute("height"));
    if (!width || !height) return;
    if (width > 40 || height > 40) return;

    if (options.skipInnerEyes && innerSize && tolerance) {
      if (Math.abs(width - innerSize) <= tolerance && Math.abs(height - innerSize) <= tolerance) {
        return;
      }
    }

    replaceRectWithShape(svg, rect, shape, scale);
  });
}

function applyCustomInnerEyeShape(svg, shapeId) {
  const shape = CUSTOM_DOT_SHAPES.find((item) => item.id === shapeId);
  if (!shape) {
    return;
  }

  const rects = Array.from(svg.querySelectorAll("rect"));
  if (!rects.length) {
    return;
  }

  const moduleSize = findModuleSize(rects);
  if (!moduleSize) {
    return;
  }

  const expectedSize = moduleSize * 3;
  const tolerance = moduleSize * 0.2;

  rects.forEach((rect) => {
    const width = Number(rect.getAttribute("width"));
    const height = Number(rect.getAttribute("height"));
    if (!width || !height) return;

    if (Math.abs(width - expectedSize) > tolerance || Math.abs(height - expectedSize) > tolerance) {
      return;
    }

    replaceRectWithShape(svg, rect, shape, 1);
  });
}

export {
  SVG_NS,
  clampSpacing,
  applyDotSpacing,
  CUSTOM_DOT_SHAPES,
  applyCustomDotShape,
  applyCustomInnerEyeShape,
  isCustomDotShapeSupported,
};
