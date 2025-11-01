"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import classNames from "classnames";
import { QRType, getTypeDefinition } from "@/lib/qrTypes";
import { bytesToBinaryString } from "@/lib/binary";
import { useDraft } from "@/hooks/useDraft";
import { QR_SYSTEM, calculateMarginPx } from "@/lib/qrConstants";
import styles from "./Generator.module.css";
import {
  SVG_NS,
  applyCustomDotShape,
  applyCustomInnerEyeShape,
  applyDotSpacing,
  clampSpacing,
  CUSTOM_DOT_SHAPES,
  isCustomDotShapeSupported,
} from "@/lib/qrCustomShapes.mjs";

// Haptic feedback helper
function triggerHaptic(style: 'light' | 'medium' | 'heavy' = 'medium') {
  if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
    window.Telegram.WebApp.HapticFeedback.impactOccurred(style);
  }
}

type ErrorCorrection = "L" | "M" | "Q" | "H";
type DotStyle = "dots" | "rounded" | "classy" | "classy-rounded" | "square" | "extra-rounded";
type EyeStyle = "square" | "extra-rounded" | "dot";
type EyeDotStyle = "square" | "dot";
type ShapeType = "square" | "circle";
type GradientType = "linear" | "radial";
function ensureCircleLogo(svg: SVGElement, options: any) {
  const image = svg.querySelector("image");
  if (!image) {
    return;
  }

  if (options.shape !== "circle") {
    image.removeAttribute("clip-path");
    return;
  }

  const width = Number(svg.getAttribute("width")) || Number(options.width) || QR_SYSTEM.PREVIEW.LOGICAL_SIZE;
  const height = Number(svg.getAttribute("height")) || Number(options.height) || QR_SYSTEM.PREVIEW.LOGICAL_SIZE;
  const margin = Number(options.margin ?? 0);
  const radius = Math.max(0, Math.min(width, height) / 2 - margin);
  const centerX = width / 2;
  const centerY = height / 2;

  let defs = svg.querySelector("defs");
  if (!defs) {
    defs = svg.ownerDocument.createElementNS(SVG_NS, "defs");
    svg.insertBefore(defs, svg.firstChild);
  }

  const clipId = "qr-logo-circle-mask";
  let clipPath = defs.querySelector(`#${clipId}`) as SVGClipPathElement | null;
  if (!clipPath) {
    clipPath = svg.ownerDocument.createElementNS(SVG_NS, "clipPath");
    clipPath.setAttribute("id", clipId);
    defs.appendChild(clipPath);
  }

  let circle = clipPath.querySelector("circle") as SVGCircleElement | null;
  if (!circle) {
    circle = svg.ownerDocument.createElementNS(SVG_NS, "circle");
    clipPath.appendChild(circle);
  }

  circle.setAttribute("cx", centerX.toFixed(3));
  circle.setAttribute("cy", centerY.toFixed(3));
  circle.setAttribute("r", Math.max(radius, 0).toFixed(3));

  image.setAttribute("clip-path", `url(#${clipId})`);
}

function spacingExtension(svg: SVGElement, options: any) {
  const spacing = clampSpacing(Number(options.moduleSpacing ?? 0));
  const customShape = options.customDotShape;
  const customEyeShape = options.customEyeInnerShape;

  if (isCustomDotShapeSupported(customShape)) {
    applyCustomDotShape(svg, customShape, spacing, {
      skipInnerEyes: isCustomDotShapeSupported(customEyeShape),
    });
  } else {
    applyDotSpacing(svg, spacing);
  }

  if (isCustomDotShapeSupported(customEyeShape)) {
    applyCustomInnerEyeShape(svg, customEyeShape);
  }

  ensureCircleLogo(svg, options);
}

interface ColorStop {
  offset: number;
  color: string;
}

interface Gradient {
  type: GradientType;
  rotation?: number;
  colorStops: ColorStop[];
}

interface StyleOptions {
  /** Размер для ЭКСПОРТА (256-4096px) - НЕ влияет на preview */
  exportSize: number;
  /** Margin в процентах (0-20%) - автоматически масштабируется */
  marginPercent: number;
  errorCorrection: ErrorCorrection;
  foreground: string;
  background: string;
  dotStyle: DotStyle;
  eyeOuter: EyeStyle;
  eyeInner: EyeDotStyle;
  logoDataUrl?: string;
  logoSize: number;
  shape: ShapeType;
  dotSpacing: number;
  customDotShape?: string;
  customEyeInnerShape?: string;
  useDotsGradient: boolean;
  dotsGradient?: Gradient;
  useBackgroundGradient: boolean;
  backgroundGradient?: Gradient;
  useCornersGradient: boolean;
  cornersGradient?: Gradient;
  hideBackgroundDots: boolean;
}

interface GeneratorDraft {
  type: QRType;
  formValues: Record<string, string>;
  style: StyleOptions;
}

const defaultStyle: StyleOptions = {
  exportSize: QR_SYSTEM.EXPORT.DEFAULT_SIZE,
  marginPercent: QR_SYSTEM.MARGIN.DEFAULT,
  errorCorrection: "H",
  foreground: "#000000",
  background: "#ffffff",
  dotStyle: "rounded",
  eyeOuter: "square",
  eyeInner: "square",
  logoSize: 18,
  shape: "square",
  dotSpacing: 0,
  customDotShape: undefined,
  customEyeInnerShape: undefined,
  useDotsGradient: false,
  dotsGradient: {
    type: "linear",
    rotation: 0,
    colorStops: [
      { offset: 0, color: "#0b1220" },
      { offset: 1, color: "#4a5568" }
    ]
  },
  useBackgroundGradient: false,
  backgroundGradient: {
    type: "linear",
    rotation: 0,
    colorStops: [
      { offset: 0, color: "#ffffff" },
      { offset: 1, color: "#f7fafc" }
    ]
  },
  useCornersGradient: false,
  cornersGradient: {
    type: "linear",
    rotation: 0,
    colorStops: [
      { offset: 0, color: "#0b1220" },
      { offset: 1, color: "#4a5568" }
    ]
  },
  hideBackgroundDots: true
};

const MAX_PAYLOAD_BYTES = 2953;

function fieldKey(type: QRType, field: string) {
  return `${type}.${field}`;
}

// Template mapping for QR types - ALL 10 TYPES
const QR_TEMPLATES = [
  { type: "url", emoji: "🌐", name: "URL", desc: "Ссылка на сайт" },
  { type: "text", emoji: "📄", name: "Текст", desc: "Произвольный текст" },
  { type: "tel", emoji: "📞", name: "Телефон", desc: "Звонок" },
  { type: "sms", emoji: "💬", name: "SMS", desc: "Сообщение" },
  { type: "mailto", emoji: "📧", name: "Email", desc: "Почта" },
  { type: "geo", emoji: "📍", name: "Геометка", desc: "Координаты" },
  { type: "wifi", emoji: "📶", name: "Wi-Fi", desc: "Подключение" },
  { type: "vcard", emoji: "👤", name: "vCard", desc: "Визитка" },
  { type: "mecard", emoji: "💳", name: "MeCard", desc: "Компакт визитка" },
  { type: "ics", emoji: "📅", name: "Событие", desc: "Календарь" }
];

type DotStyleSelectOption = {
  id: string;
  label: string;
  value: string;
  dotStyle: DotStyle;
  customShape?: string;
};

const DOT_STYLE_SELECT_OPTIONS: DotStyleSelectOption[] = [
  { id: "square", value: "square", label: "Квадраты", dotStyle: "square" },
  { id: "rounded", value: "rounded", label: "Скругленные", dotStyle: "rounded" },
  { id: "extra-rounded", value: "extra-rounded", label: "Очень скругленные", dotStyle: "extra-rounded" },
  { id: "dots", value: "dots", label: "Точки", dotStyle: "dots" },
  { id: "classy", value: "classy", label: "Classy", dotStyle: "classy" },
  { id: "classy-rounded", value: "classy-rounded", label: "Classy Rounded", dotStyle: "classy-rounded" },
  ...CUSTOM_DOT_SHAPES.map((shape) => ({
    id: `custom-dot-${shape.id}`,
    value: `custom:${shape.id}`,
    label: `${shape.emoji} ${shape.name}`,
    dotStyle: "square" as DotStyle,
    customShape: shape.id,
  })),
];

const EYE_OUTER_OPTIONS: { value: EyeStyle; label: string }[] = [
  { value: "square", label: "Квадрат" },
  { value: "extra-rounded", label: "Скруглённый" },
  { value: "dot", label: "Точка" }
];

type EyeInnerSelectOption = {
  id: string;
  label: string;
  value: string;
  eyeInner: EyeDotStyle;
  customShape?: string;
};

const EYE_INNER_SELECT_OPTIONS: EyeInnerSelectOption[] = [
  { id: "square", value: "square", label: "Квадрат", eyeInner: "square" },
  { id: "dot", value: "dot", label: "Точка", eyeInner: "dot" },
  ...CUSTOM_DOT_SHAPES.map((shape) => ({
    id: `custom-eye-${shape.id}`,
    value: `custom:${shape.id}`,
    label: `${shape.emoji} ${shape.name}`,
    eyeInner: "square" as EyeDotStyle,
    customShape: shape.id,
  })),
];

const SHAPE_OPTIONS: { value: ShapeType; label: string }[] = [
  { value: "square", label: "Квадрат" },
  { value: "circle", label: "Круг" }
];

// Константы перенесены в /src/lib/qrConstants.ts

export function GeneratorNew() {
  const { value: rawDraft, setValue: setDraft, hydrated } = useDraft<GeneratorDraft>(
    "generator",
    {
      type: "url",
      formValues: {},
      style: defaultStyle
    }
  );

  // Миграция старых черновиков: size → exportSize, margin → marginPercent
  const draft = useMemo(() => {
    const style = { ...rawDraft.style };

    // Если нет exportSize, но есть старый size - мигрируем
    if (!style.exportSize && (style as any).size) {
      style.exportSize = (style as any).size;
      delete (style as any).size;
    }

    // Если нет marginPercent, но есть старый margin - конвертируем в проценты
    if (style.marginPercent === undefined && (style as any).margin !== undefined) {
      const oldMargin = (style as any).margin;
      style.marginPercent = Math.min(QR_SYSTEM.MARGIN.MAX, Math.max(QR_SYSTEM.MARGIN.MIN, oldMargin * 2));
      delete (style as any).margin;
    }

    // Устанавливаем дефолтные значения если их нет
    if (!style.exportSize) {
      style.exportSize = QR_SYSTEM.EXPORT.DEFAULT_SIZE;
    }
    if (style.marginPercent === undefined) {
      style.marginPercent = QR_SYSTEM.MARGIN.DEFAULT;
    }

    return { ...rawDraft, style };
  }, [rawDraft]);

  const [activeTab, setActiveTab] = useState<"content" | "style" | "advanced">("content");
  const [qrPayload, setQrPayload] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [byteLength, setByteLength] = useState(0);
  const [QRCodeStylingCtor, setQRCodeStylingCtor] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const qrRef = useRef<any>(null);

  const ensurePreviewFits = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    container.style.width = "100%";
    container.style.height = "100%";
    container.style.maxWidth = "100%";
    container.style.maxHeight = "100%";
    container.style.display = "grid";
    container.style.setProperty("place-items", "center");
    container.style.overflow = "hidden";
    container.style.aspectRatio = "1 / 1";

    const firstChild = container.firstElementChild as HTMLElement | null;
    if (firstChild) {
      firstChild.style.width = "100%";
      firstChild.style.height = "100%";
      firstChild.style.maxWidth = "100%";
      firstChild.style.maxHeight = "100%";
      firstChild.style.display = "grid";
      firstChild.style.setProperty("place-items", "center");
      firstChild.style.overflow = "hidden";
      firstChild.style.aspectRatio = "1 / 1";
    }

    const svg = container.querySelector("svg") as SVGElement | null;
    if (svg) {
      const width = Number(svg.getAttribute("width")) || QR_SYSTEM.PREVIEW.LOGICAL_SIZE;
      const height = Number(svg.getAttribute("height")) || QR_SYSTEM.PREVIEW.LOGICAL_SIZE;
      if (!svg.getAttribute("viewBox") && width && height) {
        svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
      }
      svg.removeAttribute("width");
      svg.removeAttribute("height");
      svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
      // Не устанавливаем фиксированные размеры - пусть SVG масштабируется естественно
      svg.style.width = "100%";
      svg.style.height = "100%";
      svg.style.maxWidth = "100%";
      svg.style.maxHeight = "100%";
      svg.style.display = "block";
      svg.style.margin = "0 auto";
      svg.style.objectFit = "contain";
      svg.style.setProperty("image-rendering", "pixelated");
      svg.setAttribute("shape-rendering", "crispEdges");
    }

    const canvas = container.querySelector("canvas") as HTMLCanvasElement | null;
    if (canvas) {
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      canvas.style.maxWidth = "100%";
      canvas.style.maxHeight = "100%";
      canvas.style.objectFit = "contain";
      canvas.style.setProperty("image-rendering", "pixelated");
    }
  }, []); // Убрали зависимость от draft.style - preview всегда фиксированный

  const schedulePreviewFit = useCallback(() => {
    if (typeof window === "undefined") {
      ensurePreviewFits();
      return;
    }

    window.requestAnimationFrame(() => {
      ensurePreviewFits();
    });
  }, [ensurePreviewFits]);

  const activeDefinition = useMemo(() => getTypeDefinition(draft.type), [draft.type]);

  const updateStyle = useCallback(
    (update: Partial<StyleOptions>) => {
      setDraft((prev) => ({ ...prev, style: { ...prev.style, ...update } }));
    },
    [setDraft]
  );

  const handleMarginChange = useCallback(
    (percent: number) => {
      const clamped = Math.min(
        QR_SYSTEM.MARGIN.MAX,
        Math.max(QR_SYSTEM.MARGIN.MIN, Math.round(percent))
      );
      updateStyle({ marginPercent: clamped });
      schedulePreviewFit();
    },
    [schedulePreviewFit, updateStyle]
  );

  const handleExportSizeChange = useCallback(
    (value: number) => {
      const clamped = Math.min(
        QR_SYSTEM.EXPORT.MAX_SIZE,
        Math.max(
          QR_SYSTEM.EXPORT.MIN_SIZE,
          Math.round(value / QR_SYSTEM.EXPORT.STEP) * QR_SYSTEM.EXPORT.STEP
        )
      );
      // Размер экспорта НЕ влияет на preview - не вызываем schedulePreviewFit!
      updateStyle({ exportSize: clamped });
    },
    [updateStyle]
  );

  const updateValue = useCallback(
    (name: string, value: string) => {
      setDraft((prev) => ({
        ...prev,
        formValues: {
          ...prev.formValues,
          [fieldKey(prev.type, name)]: value
        }
      }));
    },
    [setDraft]
  );

  const switchType = useCallback(
    (type: QRType) => {
      triggerHaptic('light');
      setErrors({});
      setDraft((prev) => ({
        ...prev,
        type,
        formValues: prev.formValues,
        style: prev.style
      }));
    },
    [setDraft]
  );

  const maxLogoSize = useMemo(() => {
    const limits: Record<ErrorCorrection, number> = {
      L: 15,
      M: 20,
      Q: 25,
      H: 30
    };
    return limits[draft.style.errorCorrection] ?? 30;
  }, [draft.style.errorCorrection]);

  useEffect(() => {
    if (draft.style.dotSpacing === undefined) {
      updateStyle({ dotSpacing: defaultStyle.dotSpacing });
    }
  }, [draft.style.dotSpacing, updateStyle]);

  useEffect(() => {
    if (draft.style.logoDataUrl && draft.style.logoSize > maxLogoSize) {
      updateStyle({ logoSize: maxLogoSize });
    }
  }, [draft.style.logoDataUrl, draft.style.logoSize, maxLogoSize, updateStyle]);

  useEffect(() => {
    import("qr-code-styling").then((module) => {
      setQRCodeStylingCtor(() => module.default);
    });
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    if (!QRCodeStylingCtor) return;

    // Очищаем старый QR instance если он есть
    if (qrRef.current) {
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
      qrRef.current = null;
    }

    if (!qrRef.current) {
      // Preview всегда использует фиксированный размер 512px
      const previewSize = QR_SYSTEM.PREVIEW.LOGICAL_SIZE;
      // Для preview используем margin, рассчитанный из процентов черновика
      const previewMargin = calculateMarginPx(previewSize, draft.style.marginPercent);

      const instance = new QRCodeStylingCtor({
        type: "svg", // SVG для превью
        width: previewSize,
        height: previewSize,
        data: "https://t.me/durov",
        image: undefined,
        margin: previewMargin,
        qrOptions: {
          errorCorrectionLevel: draft.style.errorCorrection,
          mode: "Byte"
        },
        imageOptions: {
          hideBackgroundDots: draft.style.hideBackgroundDots,
          imageSize: draft.style.logoSize / 100,
          margin: 4,
          saveAsBlob: true
        }
      });
      qrRef.current = instance;
      instance.append(containerRef.current);
      instance.applyExtension(spacingExtension);
      schedulePreviewFit();
    }
  }, [QRCodeStylingCtor, draft.style.errorCorrection, draft.style.hideBackgroundDots, draft.style.logoSize, draft.style.marginPercent, schedulePreviewFit]);

  const formValues = useMemo(() => {
    const scoped: Record<string, string> = {};
    for (const field of activeDefinition.fields) {
      const key = fieldKey(draft.type, field.name);
      const stored = draft.formValues[key];
      if (stored === undefined && field.prefill !== undefined) {
        scoped[field.name] = field.prefill;
      } else {
        scoped[field.name] = stored ?? "";
      }
    }
    return scoped;
  }, [draft.formValues, draft.type, activeDefinition.fields]);

  const regenerate = useCallback(() => {
    if (!qrRef.current) return false;

    const payload = activeDefinition.buildPayload(formValues);
    const encoder = new TextEncoder();
    const encodedBytes = encoder.encode(payload);
    const bytes = encodedBytes.length;
    setByteLength(bytes);

    const newErrors: Record<string, string> = {};
    activeDefinition.fields.forEach((field) => {
      const value = formValues[field.name] ?? "";
      if (field.required && !value.trim()) {
        newErrors[field.name] = "Обязательное поле";
        return;
      }
      if (field.validate) {
        const error = field.validate(value, formValues);
        if (error) {
          newErrors[field.name] = error;
        }
      }
      if (field.pattern && value && !field.pattern.test(value)) {
        newErrors[field.name] = "Некорректное значение";
      }
    });

    if (!payload) {
      newErrors.__payload = "Заполните обязательные поля";
    }
    if (bytes > MAX_PAYLOAD_BYTES) {
      newErrors.__payload = `Предел ${MAX_PAYLOAD_BYTES} байт, сейчас ${bytes}`;
    }

    setErrors(newErrors);

    if (Object.keys(newErrors).length > 0) {
      triggerHaptic('light');
      return false;
    }

    triggerHaptic('medium');
    setQrPayload(payload);

    // Preview всегда использует фиксированный размер
    const previewSize = QR_SYSTEM.PREVIEW.LOGICAL_SIZE;
    const previewMargin = calculateMarginPx(previewSize, draft.style.marginPercent);

    const options: any = {
      type: "svg",
      data: bytesToBinaryString(encodedBytes),
      width: previewSize,
      height: previewSize,
      image: draft.style.logoDataUrl,
      shape: draft.style.shape,
      margin: previewMargin,
      moduleSpacing: (draft.style.dotSpacing ?? 0) / 100,
      customDotShape: draft.style.customDotShape,
      customEyeInnerShape: draft.style.customEyeInnerShape,
      qrOptions: {
        errorCorrectionLevel: draft.style.errorCorrection,
        mode: "Byte"
      },
      dotsOptions: {
        ...(draft.style.useDotsGradient && draft.style.dotsGradient
          ? { gradient: draft.style.dotsGradient }
          : { color: draft.style.foreground }),
        type: draft.style.dotStyle
      },
      backgroundOptions: {
        ...(draft.style.useBackgroundGradient && draft.style.backgroundGradient
          ? { gradient: draft.style.backgroundGradient }
          : { color: draft.style.background })
      },
      cornersSquareOptions: {
        ...(draft.style.useCornersGradient && draft.style.cornersGradient
          ? { gradient: draft.style.cornersGradient }
          : { color: draft.style.foreground }),
        type: draft.style.eyeOuter
      },
      cornersDotOptions: {
        ...(draft.style.useCornersGradient && draft.style.cornersGradient
          ? { gradient: draft.style.cornersGradient }
          : { color: draft.style.foreground }),
        type: draft.style.eyeInner
      },
      imageOptions: {
        imageSize: draft.style.logoSize / 100,
        margin: 4,
        hideBackgroundDots: draft.style.hideBackgroundDots,
        saveAsBlob: true
      }
    };

    const finalizePreview = () => {
      qrRef.current?.applyExtension((svg: SVGElement, opts: any) =>
        spacingExtension(svg, {
          ...opts,
          customDotShape: draft.style.customDotShape,
          customEyeInnerShape: draft.style.customEyeInnerShape
        })
      );
      schedulePreviewFit();
    };

    const updateResult = qrRef.current?.update(options);
    if (updateResult && typeof (updateResult as Promise<unknown>).then === "function") {
      (updateResult as Promise<unknown>).finally(finalizePreview);
    } else {
      finalizePreview();
    }
    return true;
  }, [activeDefinition, formValues, draft.style, schedulePreviewFit]);

  useEffect(() => {
    if (!qrRef.current) return;
    regenerate();
  }, [QRCodeStylingCtor, regenerate]);

  useEffect(() => {
    if (!hydrated) return;
    if (!qrRef.current) return;
    regenerate();
  }, [regenerate, hydrated]);

  // Preview размер фиксированный, но margin нужно обновлять
  useEffect(() => {
    schedulePreviewFit();
  }, [draft.style.marginPercent, schedulePreviewFit]);

  const exportBlob = useCallback(
    async (format: "png" | "svg") => {
      if (!qrRef.current) return;
      const ok = regenerate();
      if (!ok) return;

      setIsLoading(true);
      triggerHaptic('heavy');

      try {
        const payload = qrPayload || activeDefinition.buildPayload(formValues);
        const encoder = new TextEncoder();
        const encodedBytes = encoder.encode(payload);

        // Для экспорта используем размер из настроек
        const exportSize = draft.style.exportSize;
        const exportMargin = calculateMarginPx(exportSize, draft.style.marginPercent);

        // Создаем временный экземпляр с размером для экспорта
        const exportOptions: any = {
          type: "svg",
          data: bytesToBinaryString(encodedBytes),
          width: exportSize,
          height: exportSize,
          image: draft.style.logoDataUrl,
          shape: draft.style.shape,
          margin: exportMargin,
          moduleSpacing: (draft.style.dotSpacing ?? 0) / 100,
          customDotShape: draft.style.customDotShape,
          customEyeInnerShape: draft.style.customEyeInnerShape,
          qrOptions: {
            errorCorrectionLevel: draft.style.errorCorrection,
            mode: "Byte"
          },
          dotsOptions: {
            ...(draft.style.useDotsGradient && draft.style.dotsGradient
              ? { gradient: draft.style.dotsGradient }
              : { color: draft.style.foreground }),
            type: draft.style.dotStyle
          },
          backgroundOptions: {
            ...(draft.style.useBackgroundGradient && draft.style.backgroundGradient
              ? { gradient: draft.style.backgroundGradient }
              : { color: draft.style.background })
          },
          cornersSquareOptions: {
            ...(draft.style.useCornersGradient && draft.style.cornersGradient
              ? { gradient: draft.style.cornersGradient }
              : { color: draft.style.foreground }),
            type: draft.style.eyeOuter
          },
          cornersDotOptions: {
            ...(draft.style.useCornersGradient && draft.style.cornersGradient
              ? { gradient: draft.style.cornersGradient }
              : { color: draft.style.foreground }),
            type: draft.style.eyeInner
          },
          imageOptions: {
            imageSize: draft.style.logoSize / 100,
            margin: 4,
            hideBackgroundDots: draft.style.hideBackgroundDots,
            saveAsBlob: true
          }
        };

        // Создаем временный экземпляр для экспорта
        const exportQR = new QRCodeStylingCtor(exportOptions);
        exportQR.applyExtension((svg: SVGElement, opts: any) =>
          spacingExtension(svg, {
            ...opts,
            customDotShape: draft.style.customDotShape,
            customEyeInnerShape: draft.style.customEyeInnerShape
          })
        );

        const blob = await exportQR.getRawData(format);
        if (!blob) {
          return;
        }

        const slug =
          payload
            .slice(0, 32)
            .replace(/[^a-z0-9]+/gi, "-")
            .replace(/^-|-$/g, "")
            .toLowerCase() || "qr";
        const fileName = `${slug}.${format}`;
        const mimeType = format === "svg" ? "image/svg+xml" : "image/png";
        const nav = typeof window !== "undefined" ? window.navigator : undefined;

        if (nav && typeof nav.share === "function" && typeof File !== "undefined") {
          const filesSupported = typeof nav.canShare === "function";
          const shareFile = new File([blob], fileName, { type: mimeType });

          if (!filesSupported || nav.canShare({ files: [shareFile] })) {
            try {
              await nav.share({
                files: [shareFile],
                title: "QR код",
                text: payload
              });
              return;
            } catch (error) {
              if (error instanceof DOMException && error.name === "AbortError") {
                return;
              }
              // fall through to download fallback if sharing fails for another reason
            }
          }
        }

        const url = URL.createObjectURL(blob);
        try {
          const link = document.createElement("a");
          link.href = url;
          link.download = fileName;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        } finally {
          URL.revokeObjectURL(url);
        }
      } finally {
        setIsLoading(false);
      }
    },
    [regenerate, qrPayload, activeDefinition, formValues, draft.style, QRCodeStylingCtor]
  );

  return (
    <section className={styles.generator}>
      <div className={classNames(styles.qrPreview, "preview")}>
        <div className={classNames(styles.qrCode, "preview__canvas")}>
          <div ref={containerRef} className={styles.qrCanvas} />
        </div>
      </div>

      <div className={styles.tabs}>
        <button
          className={classNames(styles.tab, { [styles.tabActive]: activeTab === "content" })}
          onClick={() => {
            setActiveTab("content");
            triggerHaptic('light');
          }}
        >
          📝 Контент
        </button>
        <button
          className={classNames(styles.tab, { [styles.tabActive]: activeTab === "style" })}
          onClick={() => {
            setActiveTab("style");
            triggerHaptic('light');
          }}
        >
          🎨 Стиль
        </button>
        <button
          className={classNames(styles.tab, { [styles.tabActive]: activeTab === "advanced" })}
          onClick={() => {
            setActiveTab("advanced");
            triggerHaptic('light');
          }}
        >
          ⚙️ Продвинутые
        </button>
      </div>

      {/* Content Tab */}
      <div className={classNames(styles.tabContent, { [styles.tabContentActive]: activeTab === "content" })}>
        <div className={styles.inputGroup}>
          <label className={styles.inputLabel}>
            <span>Выберите тип QR-кода</span>
          </label>
          <div className={styles.templateGrid}>
            {QR_TEMPLATES.map((template) => (
              <div
                key={template.type}
                data-testid={`qr-template-${template.type}`}
                className={classNames(styles.templateCard, {
                  [styles.templateCardActive]: draft.type === template.type
                })}
                onClick={() => switchType(template.type as QRType)}
              >
                <div className={styles.templateName}>{template.emoji} {template.name}</div>
                <div className={styles.templateDesc}>{template.desc}</div>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.divider}></div>

        <div className={styles.inputGroup}>
          <label className={styles.inputLabel}>
            <span>{activeDefinition.title}</span>
            <span className={styles.badge}>{activeDefinition.description}</span>
          </label>
          {activeDefinition.fields.map((field) => {
            const fieldId = `qr-input-${field.name}`;

            return (
              <div key={field.name} className={styles.inputGroup}>
                <label className={styles.inputLabel} htmlFor={fieldId}>
                  <span>
                    {field.label}
                    {field.required && " *"}
                  </span>
                </label>
                {field.type === "textarea" ? (
                  <textarea
                    id={fieldId}
                    name={field.name}
                    data-testid={`qr-input-${field.name}`}
                    className={classNames(styles.textarea, { error: Boolean(errors[field.name]) })}
                    value={formValues[field.name] ?? ""}
                    onChange={(e) => updateValue(field.name, e.target.value)}
                    placeholder={field.placeholder}
                  />
                ) : (
                  <input
                    id={fieldId}
                    name={field.name}
                    data-testid={`qr-input-${field.name}`}
                    type={field.type === "email" ? "email" : field.type === "number" ? "number" : "text"}
                    className={classNames(styles.input, { error: Boolean(errors[field.name]) })}
                    value={formValues[field.name] ?? ""}
                    onChange={(e) => updateValue(field.name, e.target.value)}
                    placeholder={field.placeholder}
                  />
                )}
                {field.helper && (
                  <small style={{ fontSize: "12px", opacity: 0.6, marginTop: "4px" }}>{field.helper}</small>
                )}
                {errors[field.name] && <span className="error-text">{errors[field.name]}</span>}
              </div>
            );
          })}
          {errors.__payload && <span className="error-text">{errors.__payload}</span>}
        </div>

        <div className={styles.infoCard}>
          💡 <strong>Совет:</strong> Используйте короткие данные для лучшего сканирования QR-кода. Длина: {byteLength} / {MAX_PAYLOAD_BYTES} байт
        </div>
      </div>

      {/* Style Tab */}
      <div className={classNames(styles.tabContent, { [styles.tabContentActive]: activeTab === "style" })}>
        <div className={styles.inputGroup}>
          <label className={styles.inputLabel}>
            <span>🧩 Геометрия</span>
            <span className={styles.badge}>Форма и глазки</span>
          </label>
          <div className={styles.fieldGrid}>
            <label className={styles.fieldControl}>
              <span className={styles.fieldTitle}>Форма QR</span>
              <select
                className={styles.select}
                value={draft.style.shape}
                onChange={(event) => {
                  updateStyle({ shape: event.target.value as ShapeType });
                  triggerHaptic('light');
                }}
              >
                {SHAPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.fieldControl}>
              <span className={styles.fieldTitle}>Стиль точек</span>
              <select
                className={styles.select}
                value={draft.style.customDotShape ? `custom:${draft.style.customDotShape}` : draft.style.dotStyle}
                onChange={(event) => {
                  const selected = DOT_STYLE_SELECT_OPTIONS.find((option) => option.value === event.target.value);
                  if (!selected) {
                    return;
                  }
                  updateStyle({
                    dotStyle: selected.dotStyle,
                    customDotShape: selected.customShape,
                  });
                  triggerHaptic('light');
                }}
              >
                {DOT_STYLE_SELECT_OPTIONS.map((option) => (
                  <option key={option.id} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.fieldControl}>
              <span className={styles.fieldTitle}>Внешние глазки</span>
              <select
                className={styles.select}
                value={draft.style.eyeOuter}
                onChange={(event) => {
                  updateStyle({ eyeOuter: event.target.value as EyeStyle });
                  triggerHaptic('light');
                }}
              >
                {EYE_OUTER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.fieldControl}>
              <span className={styles.fieldTitle}>Внутренние глазки</span>
              <select
                className={styles.select}
                value={draft.style.customEyeInnerShape ? `custom:${draft.style.customEyeInnerShape}` : draft.style.eyeInner}
                onChange={(event) => {
                  const selected = EYE_INNER_SELECT_OPTIONS.find((option) => option.value === event.target.value);
                  if (!selected) {
                    return;
                  }
                  updateStyle({
                    eyeInner: selected.eyeInner,
                    customEyeInnerShape: selected.customShape,
                  });
                  triggerHaptic('light');
                }}
              >
                {EYE_INNER_SELECT_OPTIONS.map((option) => (
                  <option key={option.id} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className={styles.rangeGroup}>
            <label className={styles.inputLabel}>
              <span>↔️ Расстояние между точками</span>
              <span className={styles.rangeValue}>{draft.style.dotSpacing}%</span>
            </label>
            <input
              type="range"
              className={styles.rangeInput}
              min={0}
              max={60}
              step={5}
              value={draft.style.dotSpacing ?? 0}
              onChange={(event) => {
                updateStyle({ dotSpacing: Number(event.target.value) });
                triggerHaptic('light');
              }}
            />
            <div className={styles.rangeHint}>0% — плотная сетка, 60% — заметные промежутки.</div>
          </div>
        </div>
      </div>

      {/* Advanced Tab */}
      <div className={classNames(styles.tabContent, { [styles.tabContentActive]: activeTab === "advanced" })}>
        <div className={styles.infoCard}>
          ℹ️ <strong>Важно:</strong> Размер экспорта не влияет на превью. Превью всегда оптимизировано для экрана устройства.
        </div>

        <div className={styles.rangeGroup}>
          <label className={styles.inputLabel}>
            <span>📏 Размер экспорта (для скачивания)</span>
            <span className={styles.rangeValue}>{draft.style.exportSize}px</span>
          </label>
          <input
            type="range"
            className={styles.rangeInput}
            min={QR_SYSTEM.EXPORT.MIN_SIZE}
            max={QR_SYSTEM.EXPORT.MAX_SIZE}
            step={QR_SYSTEM.EXPORT.STEP}
            value={draft.style.exportSize}
            onChange={(e) => handleExportSizeChange(Number(e.target.value))}
          />
          <div className={styles.rangeHint}>
            От {QR_SYSTEM.EXPORT.MIN_SIZE}px (веб) до {QR_SYSTEM.EXPORT.MAX_SIZE}px (печать, билборды)
          </div>
        </div>

        <div className={styles.rangeGroup}>
          <label className={styles.inputLabel}>
            <span>🛡️ Уровень коррекции ошибок</span>
            <span className={styles.rangeValue}>
              {draft.style.errorCorrection === "L" && "Низкий"}
              {draft.style.errorCorrection === "M" && "Средний"}
              {draft.style.errorCorrection === "Q" && "Высокий"}
              {draft.style.errorCorrection === "H" && "Очень высокий"}
            </span>
          </label>
          <select
            className={styles.select}
            value={draft.style.errorCorrection}
            onChange={(e) => updateStyle({ errorCorrection: e.target.value as ErrorCorrection })}
          >
            <option value="L">L — до 7%</option>
            <option value="M">M — до 15%</option>
            <option value="Q">Q — до 25%</option>
            <option value="H">H — до 30%</option>
          </select>
          <div className={styles.rangeHint}>
            Проценты показывают, какую часть QR-кода можно закрыть или испортить, чтобы он всё равно считывался.
          </div>
        </div>

        <div className={styles.rangeGroup}>
          <label className={styles.inputLabel}>
            <span>🖼️ Отступ (Quiet Zone)</span>
            <span className={styles.rangeValue}>{draft.style.marginPercent}%</span>
          </label>
          <input
            type="range"
            className={styles.rangeInput}
            min={QR_SYSTEM.MARGIN.MIN}
            max={QR_SYSTEM.MARGIN.MAX}
            step={QR_SYSTEM.MARGIN.STEP}
            value={draft.style.marginPercent}
            onChange={(e) => handleMarginChange(Number(e.target.value))}
            onInput={(e) => handleMarginChange(Number((e.target as HTMLInputElement).value))}
          />
          <div className={styles.rangeControls}>
            <button
              type="button"
              className={styles.rangeStepper}
              onClick={() => handleMarginChange(draft.style.marginPercent - QR_SYSTEM.MARGIN.STEP)}
              aria-label="Уменьшить отступ"
            >
              −
            </button>
            <input
              type="number"
              className={styles.rangeNumber}
              min={QR_SYSTEM.MARGIN.MIN}
              max={QR_SYSTEM.MARGIN.MAX}
              step={QR_SYSTEM.MARGIN.STEP}
              value={draft.style.marginPercent}
              onChange={(event) => handleMarginChange(Number(event.target.value))}
            />
            <button
              type="button"
              className={styles.rangeStepper}
              onClick={() => handleMarginChange(draft.style.marginPercent + QR_SYSTEM.MARGIN.STEP)}
              aria-label="Увеличить отступ"
            >
              +
            </button>
          </div>
          <div className={styles.rangeHint}>
            В процентах от размера QR. 8% = стандарт, 0% = без отступа.
          </div>
        </div>

        <div className={styles.divider}></div>

        <div className={styles.infoCard}>
          ⚠️ <strong>Внимание:</strong> Высокий уровень коррекции ошибок делает QR-код более устойчивым к повреждениям, но увеличивает его сложность
        </div>

        <div className={styles.inputGroup}>
          <label className={styles.inputLabel}>
            <span>📦 Формат экспорта</span>
          </label>
          <select className={styles.select}>
            <option value="png">PNG (Рекомендуется)</option>
            <option value="svg">SVG (Векторный)</option>
          </select>
        </div>
      </div>

      {/* Fixed Action Buttons */}
      <div className={classNames(styles.actionButtons, "preview__actions")}>
        <button
          className={classNames(styles.btn, styles.btnSecondary)}
          onClick={() => {
            regenerate();
            triggerHaptic('medium');
          }}
        >
          👁️ Превью
        </button>
        <button
          className={classNames(styles.btn, styles.btnPrimary)}
          onClick={() => exportBlob("png")}
        >
          ⬇️ Скачать QR
        </button>
      </div>

      {/* Loading Indicator */}
      {isLoading && (
        <div className={classNames(styles.loading, styles.loadingActive)}>
          ⏳ Генерация QR-кода...
        </div>
      )}
    </section>
  );
}
