import type { AwesomeQROptions } from "awesome-qr/dist/awesome-qr.js";

type GradientStop = { offset: number; color: string };
type GradientDefinition = {
  type: "linear" | "radial";
  rotation?: number;
  colorStops: GradientStop[];
};

type LegacyOptions = {
  width: number;
  height: number;
  data: string;
  margin?: number;
  moduleSpacing?: number;
  shape?: "square" | "circle";
  image?: string;
  imageOptions?: {
    imageSize?: number;
    margin?: number;
    hideBackgroundDots?: boolean;
  };
  qrOptions?: {
    errorCorrectionLevel?: "L" | "M" | "Q" | "H";
    mode?: string;
  };
  dotsOptions?: {
    color?: string;
    gradient?: GradientDefinition;
    type?: string;
  };
  backgroundOptions?: {
    color?: string;
    gradient?: GradientDefinition;
  };
  cornersSquareOptions?: {
    color?: string;
    gradient?: GradientDefinition;
    type?: string;
  };
  cornersDotOptions?: {
    color?: string;
    gradient?: GradientDefinition;
    type?: string;
  };
};

type ExportFormat = "png" | "svg";

const DEFAULT_SIZE = 512;

function getPrimaryColor(gradient?: GradientDefinition | null, fallback?: string) {
  if (!gradient) {
    return fallback ?? "#000000";
  }
  const first = gradient.colorStops?.[0];
  return first?.color ?? fallback ?? "#000000";
}

function clampSpacing(value: number | undefined) {
  if (!Number.isFinite(value)) return 0;
  if (value! < 0) return 0;
  if (value! > 0.6) return 0.6;
  return value!;
}

function toBase64(buffer: ArrayBuffer | Uint8Array) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0xffff;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  if (typeof btoa === "function") {
    return btoa(binary);
  }
  // Fallback for environments without btoa (shouldn't happen in browser client)
  return Buffer.from(binary, "binary").toString("base64");
}

function dataUrlToBlob(dataUrl: string, mime: string) {
  const [meta, data] = dataUrl.split(",");
  if (!meta || !data) {
    return new Blob([], { type: mime });
  }
  const binary = typeof atob === "function" ? atob(data) : Buffer.from(data, "base64").toString("binary");
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}

async function loadAwesomeQR() {
  const awesomeModule = await import("awesome-qr/dist/awesome-qr.js");
  const AwesomeQR = (awesomeModule as any).AwesomeQR ?? awesomeModule.default ?? awesomeModule;
  return AwesomeQR as { new (options: Partial<AwesomeQROptions>): { draw(): Promise<any> }; CorrectLevel: Record<string, number> };
}

function createLinearGradient(gradient: GradientDefinition, size: number, ctx: CanvasRenderingContext2D) {
  const rotation = ((gradient.rotation ?? 0) * Math.PI) / 180;
  const half = size / 2;
  const x = half + Math.cos(rotation) * half;
  const y = half + Math.sin(rotation) * half;
  const x0 = half - Math.cos(rotation) * half;
  const y0 = half - Math.sin(rotation) * half;
  return ctx.createLinearGradient(x0, y0, x, y);
}

function createRadialGradient(size: number, ctx: CanvasRenderingContext2D) {
  return ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
}

function createGradientDataUrl(size: number, gradient: GradientDefinition) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return undefined;
  }
  const grad = gradient.type === "linear" ? createLinearGradient(gradient, size, ctx) : createRadialGradient(size, ctx);
  for (const stop of gradient.colorStops ?? []) {
    grad.addColorStop(stop.offset, stop.color);
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  return canvas.toDataURL();
}

function resolveBackground(options: LegacyOptions, size: number) {
  const gradient = options.backgroundOptions?.gradient ?? null;
  const color = options.backgroundOptions?.color ?? "#ffffff";
  if (gradient && typeof document !== "undefined") {
    return {
      backgroundImage: createGradientDataUrl(size, gradient),
      colorLight: undefined
    } as const;
  }
  return {
    backgroundImage: undefined,
    colorLight: color
  } as const;
}

function resultToDataUrl(result: unknown, mime: string) {
  if (typeof result === "string") {
    if (result.startsWith("data:")) {
      return result;
    }
    return `data:${mime};base64,${result}`;
  }
  if (result instanceof ArrayBuffer || result instanceof Uint8Array) {
    const base64 = toBase64(result);
    return `data:${mime};base64,${base64}`;
  }
  return "";
}

export class AwesomeQrStyling {
  private static ctorPromise: Promise<Awaited<ReturnType<typeof loadAwesomeQR>>> | null = null;

  private static AwesomeQRRef: Awaited<ReturnType<typeof loadAwesomeQR>> | null = null;

  private options: LegacyOptions;

  private imageElement: HTMLImageElement;

  private renderPromise: Promise<string> | null = null;

  constructor(options: LegacyOptions) {
    this.options = options;
    this.imageElement = document.createElement("img");
    this.imageElement.alt = "QR code";
    this.imageElement.style.width = "100%";
    this.imageElement.style.height = "100%";
    this.imageElement.style.objectFit = "contain";
  }

  private static async loadCtor() {
    if (!this.ctorPromise) {
      this.ctorPromise = loadAwesomeQR();
    }
    return this.ctorPromise;
  }

  private buildOptions(sizeOverride?: number): Partial<AwesomeQROptions> {
    const size = sizeOverride ?? this.options.width ?? DEFAULT_SIZE;
    const spacing = clampSpacing(this.options.moduleSpacing ?? 0);
    const dotScale = Math.max(0.2, 1 - spacing);
    const logoScale = this.options.imageOptions?.imageSize ?? 0.2;
    const { backgroundImage, colorLight } = resolveBackground(this.options, size);
    const dotsColor = this.options.dotsOptions?.color ?? getPrimaryColor(this.options.dotsOptions?.gradient, "#000000");

    const AwesomeQR = AwesomeQrStyling.AwesomeQRRef;
    const correctLevel = this.options.qrOptions?.errorCorrectionLevel ?? "H";

    let logoCornerRadius = 0;
    if (this.options.shape === "circle") {
      logoCornerRadius = Math.max(0, Math.round((logoScale || 0.2) * size * 0.5));
    } else {
      logoCornerRadius = Math.round((this.options.imageOptions?.margin ?? 0) * 2);
    }

    return {
      text: this.options.data,
      size,
      margin: Math.max(0, Math.round(this.options.margin ?? 0)),
      correctLevel: AwesomeQR?.CorrectLevel?.[correctLevel] ?? 3,
      colorDark: dotsColor,
      colorLight,
      autoColor: false,
      backgroundImage,
      backgroundDimming: "rgba(0,0,0,0)",
      whiteMargin: true,
      logoImage: this.options.image,
      logoScale: logoScale > 0 ? logoScale : 0.2,
      logoMargin: this.options.imageOptions?.margin ?? 0,
      logoCornerRadius,
      dotScale,
      components: {
        data: { scale: dotScale },
        timing: { scale: dotScale, protectors: true },
        alignment: { scale: dotScale, protectors: true },
        cornerAlignment: { scale: dotScale, protectors: true }
      }
    } satisfies Partial<AwesomeQROptions>;
  }

  private async render(sizeOverride?: number) {
    const AwesomeQR = await AwesomeQrStyling.loadCtor();
    AwesomeQrStyling.AwesomeQRRef = AwesomeQR;
    const options = this.buildOptions(sizeOverride);
    const result = await new AwesomeQR(options).draw();
    const dataUrl = resultToDataUrl(result, "image/png");
    this.imageElement.src = dataUrl;
    return dataUrl;
  }

  append(container: HTMLElement) {
    if (!container.contains(this.imageElement)) {
      container.appendChild(this.imageElement);
    }
    if (!this.renderPromise) {
      this.renderPromise = this.render();
    }
  }

  async update(options: LegacyOptions) {
    this.options = { ...this.options, ...options };
    this.renderPromise = null;
    await this.render();
  }

  // Compatibility shim – no-op in the AwesomeQR implementation
  applyExtension() {
    return;
  }

  async getRawData(format: ExportFormat) {
    const AwesomeQR = await AwesomeQrStyling.loadCtor();
    AwesomeQrStyling.AwesomeQRRef = AwesomeQR;
    const result = await new AwesomeQR(this.buildOptions()).draw();
    if (format === "png") {
      const dataUrl = resultToDataUrl(result, "image/png");
      return dataUrlToBlob(dataUrl, "image/png");
    }

    const dataUrl = resultToDataUrl(result, "image/png");
    const base64 = dataUrl.split(",")[1] ?? "";
    const size = this.options.width ?? DEFAULT_SIZE;
    const svg = `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><image width="${size}" height="${size}" href="data:image/png;base64,${base64}" /></svg>`;
    return new Blob([svg], { type: "image/svg+xml" });
  }
}

export type { LegacyOptions as AwesomeQrStylingOptions };
