"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import classNames from "classnames";
import { QRType, QR_TYPES, getTypeDefinition } from "@/lib/qrTypes";
import { bytesToBinaryString } from "@/lib/binary";
import { useDraft } from "@/hooks/useDraft";
import styles from "./Generator.module.css";

// Haptic feedback helper
function triggerHaptic(style: 'light' | 'medium' | 'heavy' = 'medium') {
  if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
    window.Telegram.WebApp.HapticFeedback.impactOccurred(style);
  }
}

function hexToRgb(hex: string) {
  const sanitized = hex.replace('#', '');
  if (sanitized.length === 3) {
    const r = parseInt(sanitized[0] + sanitized[0], 16);
    const g = parseInt(sanitized[1] + sanitized[1], 16);
    const b = parseInt(sanitized[2] + sanitized[2], 16);
    return { r, g, b };
  }
  if (sanitized.length !== 6) {
    return null;
  }
  const r = parseInt(sanitized.slice(0, 2), 16);
  const g = parseInt(sanitized.slice(2, 4), 16);
  const b = parseInt(sanitized.slice(4, 6), 16);
  if ([r, g, b].some((component) => Number.isNaN(component))) {
    return null;
  }
  return { r, g, b };
}

function relativeLuminance({ r, g, b }: { r: number; g: number; b: number }) {
  const srgb = [r, g, b].map((value) => {
    const channel = value / 255;
    return channel <= 0.03928 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
}

function getContrastRatio(foreground: string, background: string) {
  const fg = hexToRgb(foreground);
  const bg = hexToRgb(background);
  if (!fg || !bg) return 0;
  const l1 = relativeLuminance(fg) + 0.05;
  const l2 = relativeLuminance(bg) + 0.05;
  return l1 > l2 ? l1 / l2 : l2 / l1;
}

function radiansToDegrees(radians?: number) {
  return Math.round(((radians ?? 0) * 180) / Math.PI);
}

function degreesToRadians(degrees: number) {
  return (degrees * Math.PI) / 180;
}

type ErrorCorrection = "L" | "M" | "Q" | "H";
type DotStyle = "dots" | "rounded" | "classy" | "classy-rounded" | "square" | "extra-rounded";
type EyeStyle = "square" | "extra-rounded" | "dot";
type EyeDotStyle = "square" | "dot";
type ShapeType = "square" | "circle";
type GradientType = "linear" | "radial";

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
  size: number;
  errorCorrection: ErrorCorrection;
  foreground: string;
  background: string;
  margin: number;
  dotStyle: DotStyle;
  eyeOuter: EyeStyle;
  eyeInner: EyeDotStyle;
  logoDataUrl?: string;
  logoSize: number;
  shape: ShapeType;
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
  size: 512,
  errorCorrection: "H",
  foreground: "#000000",
  background: "#ffffff",
  margin: 4,
  dotStyle: "rounded",
  eyeOuter: "square",
  eyeInner: "square",
  logoSize: 18,
  shape: "square",
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

// Color presets
const COLOR_PRESETS = [
  { name: "Классический", emoji: "⚫", fg: "#000000", bg: "#ffffff" },
  { name: "Современный", emoji: "🔵", fg: "#667eea", bg: "#f0f4ff" },
  { name: "Природа", emoji: "🌿", fg: "#2d5016", bg: "#f5f1e8" },
  { name: "Закат", emoji: "🌅", fg: "#ff6b35", bg: "#ffe5d9" }
];

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

// Style presets
const STYLE_PRESETS = [
  { id: "square", emoji: "⬛", label: "Квадраты", dotStyle: "square" as DotStyle },
  { id: "dots", emoji: "⚫", label: "Точки", dotStyle: "dots" as DotStyle },
  { id: "rounded", emoji: "🔘", label: "Скругленные", dotStyle: "rounded" as DotStyle },
  { id: "elegant", emoji: "💎", label: "Элегантный", dotStyle: "extra-rounded" as DotStyle }
];

export function GeneratorNew() {
  const { value: draft, setValue: setDraft, hydrated } = useDraft<GeneratorDraft>(
    "generator",
    {
      type: "url",
      formValues: {},
      style: defaultStyle
    }
  );

  const [activeTab, setActiveTab] = useState<"content" | "style" | "advanced">("content");
  const [qrPayload, setQrPayload] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [byteLength, setByteLength] = useState(0);
  const [QRCodeStylingCtor, setQRCodeStylingCtor] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const qrRef = useRef<any>();

  const activeDefinition = useMemo(() => getTypeDefinition(draft.type), [draft.type]);

  const updateStyle = useCallback(
    (update: Partial<StyleOptions>) => {
      setDraft((prev) => ({ ...prev, style: { ...prev.style, ...update } }));
    },
    [setDraft]
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

  const logoSizeExceedsLimit = Boolean(
    draft.style.logoDataUrl && draft.style.logoSize > maxLogoSize
  );

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

  const handleFileUpload = useCallback(
    (file: File | null) => {
      if (!file) {
        triggerHaptic('light');
        updateStyle({ logoDataUrl: undefined });
        return;
      }
      if (!file.type.startsWith("image/")) {
        triggerHaptic('light');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        triggerHaptic('medium');
        updateStyle({ logoDataUrl: reader.result as string });
      };
      reader.readAsDataURL(file);
    },
    [updateStyle]
  );

  useEffect(() => {
    if (!containerRef.current) return;
    if (!QRCodeStylingCtor) return;

    if (!qrRef.current) {
      const instance = new QRCodeStylingCtor({
        width: defaultStyle.size,
        height: defaultStyle.size,
        data: "https://t.me/durov",
        image: undefined,
        margin: defaultStyle.margin,
        qrOptions: {
          errorCorrectionLevel: defaultStyle.errorCorrection,
          mode: "Byte"
        }
      });
      qrRef.current = instance;
      instance.append(containerRef.current);
    }
  }, [QRCodeStylingCtor]);

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

  const contrastRatio = useMemo(
    () => getContrastRatio(draft.style.foreground, draft.style.background),
    [draft.style.foreground, draft.style.background]
  );
  const showContrastWarning = contrastRatio > 0 && contrastRatio < 4.5;

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

    const options: any = {
      data: bytesToBinaryString(encodedBytes),
      width: draft.style.size,
      height: draft.style.size,
      image: draft.style.logoDataUrl,
      shape: draft.style.shape,
      margin: draft.style.margin,
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
        hideBackgroundDots: draft.style.hideBackgroundDots
      }
    };

    qrRef.current?.update(options);
    return true;
  }, [activeDefinition, formValues, draft.style]);

  useEffect(() => {
    if (!qrRef.current) return;
    regenerate();
  }, [QRCodeStylingCtor, regenerate]);

  useEffect(() => {
    if (!hydrated) return;
    if (!qrRef.current) return;
    regenerate();
  }, [regenerate, hydrated]);

  const exportBlob = useCallback(
    async (format: "png" | "svg") => {
      if (!qrRef.current) return;
      const ok = regenerate();
      if (!ok) return;

      setIsLoading(true);
      triggerHaptic('heavy');

      try {
        const payload = qrPayload || activeDefinition.buildPayload(formValues);
        const blob = await qrRef.current.getRawData(format);
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
    [regenerate, qrPayload, activeDefinition, formValues]
  );

  const isLightColor = (color: string) => {
    const rgb = hexToRgb(color);
    if (!rgb) return false;
    return relativeLuminance(rgb) > 0.5;
  };

  return (
    <section className={styles.generator}>
      <div className={styles.qrPreview}>
        <div className={styles.qrCode}>
          <div ref={containerRef} />
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
          {activeDefinition.fields.map((field) => (
            <div key={field.name} className={styles.inputGroup}>
              <label className={styles.inputLabel}>
                <span>{field.label}{field.required && " *"}</span>
              </label>
              {field.type === "textarea" ? (
                <textarea
                  className={classNames(styles.textarea, { error: Boolean(errors[field.name]) })}
                  value={formValues[field.name] ?? ""}
                  onChange={(e) => updateValue(field.name, e.target.value)}
                  placeholder={field.placeholder}
                />
              ) : (
                <input
                  type={field.type === "email" ? "email" : field.type === "number" ? "number" : "text"}
                  className={classNames(styles.input, { error: Boolean(errors[field.name]) })}
                  value={formValues[field.name] ?? ""}
                  onChange={(e) => updateValue(field.name, e.target.value)}
                  placeholder={field.placeholder}
                />
              )}
              {field.helper && <small style={{ fontSize: "12px", opacity: 0.6, marginTop: "4px" }}>{field.helper}</small>}
              {errors[field.name] && <span className="error-text">{errors[field.name]}</span>}
            </div>
          ))}
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
            <span>🎭 Стиль QR-кода</span>
          </label>
          <div className={styles.styleGrid}>
            {STYLE_PRESETS.map((preset) => (
              <div
                key={preset.id}
                className={classNames(styles.styleOption, {
                  [styles.styleOptionActive]: draft.style.dotStyle === preset.dotStyle
                })}
                onClick={() => {
                  updateStyle({ dotStyle: preset.dotStyle });
                  triggerHaptic('light');
                }}
              >
                <div className={styles.stylePreview}>{preset.emoji}</div>
                <div className={styles.styleLabel}>{preset.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.divider}></div>

        <div className={styles.inputGroup}>
          <label className={styles.inputLabel}>
            <span>🎨 Цветовая схема</span>
          </label>
          <div className={styles.colorPickerGroup}>
            <div className={styles.colorPicker}>
              <label className={styles.inputLabel} style={{ marginBottom: "8px" }}>Передний план</label>
              <div
                className={styles.colorPreview}
                style={{
                  background: draft.style.foreground,
                  color: isLightColor(draft.style.foreground) ? "#000" : "#fff"
                }}
              >
                {draft.style.foreground.toUpperCase()}
              </div>
              <input
                type="color"
                className={styles.colorInput}
                value={draft.style.foreground}
                onChange={(e) => updateStyle({ foreground: e.target.value })}
              />
            </div>
            <div className={styles.colorPicker}>
              <label className={styles.inputLabel} style={{ marginBottom: "8px" }}>Фон</label>
              <div
                className={styles.colorPreview}
                style={{
                  background: draft.style.background,
                  color: isLightColor(draft.style.background) ? "#000" : "#fff"
                }}
              >
                {draft.style.background.toUpperCase()}
              </div>
              <input
                type="color"
                className={styles.colorInput}
                value={draft.style.background}
                onChange={(e) => updateStyle({ background: e.target.value })}
              />
            </div>
          </div>
        </div>

        {showContrastWarning && (
          <div className={classNames(styles.infoCard, styles.infoCardWarning)}>
            ⚠️ <strong>Низкий контраст:</strong> текущее соотношение {contrastRatio.toFixed(2)}:1.
            {" "}Подберите более контрастные цвета для лучшей сканируемости QR-кода.
          </div>
        )}

        <div className={styles.divider}></div>

        <div className={styles.inputGroup}>
          <label className={styles.inputLabel}>
            <span>🪪 Логотип в центре</span>
            <span className={styles.badge}>
              {draft.style.logoDataUrl
                ? `Макс ${maxLogoSize}% при ${draft.style.errorCorrection}`
                : "Рекомендуем Q или H"}
            </span>
          </label>

          <div className={styles.logoControls}>
            <div className={styles.logoButtons}>
              <label className={styles.logoUploadButton}>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml"
                  className={styles.logoUploadInput}
                  onChange={(event) => handleFileUpload(event.target.files?.[0] ?? null)}
                />
                {draft.style.logoDataUrl ? "Заменить логотип" : "Загрузить логотип"}
              </label>
              {draft.style.logoDataUrl && (
                <button
                  type="button"
                  className={styles.logoRemoveButton}
                  onClick={() => handleFileUpload(null)}
                >
                  Удалить
                </button>
              )}
            </div>

            {draft.style.logoDataUrl && (
              <>
                <div className={styles.logoPreview}>
                  <img src={draft.style.logoDataUrl} alt="Предпросмотр логотипа" />
                  <div className={styles.logoHint}>Логотип будет размещён по центру QR-кода.</div>
                </div>

                <div className={styles.rangeGroup}>
                  <label className={styles.inputLabel}>
                    <span>Размер логотипа</span>
                    <span className={styles.rangeValue}>
                      {Math.min(draft.style.logoSize, maxLogoSize)}%
                    </span>
                  </label>
                  <input
                    type="range"
                    className={styles.rangeInput}
                    min={10}
                    max={maxLogoSize}
                    value={Math.min(draft.style.logoSize, maxLogoSize)}
                    onChange={(event) => updateStyle({ logoSize: Number(event.target.value) })}
                  />
                </div>

                <label className={styles.checkboxRow}>
                  <input
                    type="checkbox"
                    checked={draft.style.hideBackgroundDots}
                    onChange={(event) => updateStyle({ hideBackgroundDots: event.target.checked })}
                  />
                  <span>Скрыть точки под логотипом</span>
                </label>

                {logoSizeExceedsLimit && (
                  <div className={classNames(styles.infoCard, styles.infoCardWarning)}>
                    ⚠️ Логотип автоматически уменьшен до {maxLogoSize}% из-за текущего уровня коррекции ошибок.
                    Увеличьте коррекцию для более крупного изображения.
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <div className={styles.divider}></div>

        <div className={styles.templateGrid}>
          {COLOR_PRESETS.map((preset) => (
            <div
              key={preset.name}
              className={styles.templateCard}
              onClick={() => {
                updateStyle({ foreground: preset.fg, background: preset.bg });
                triggerHaptic('medium');
              }}
            >
              <div className={styles.templateName}>{preset.emoji} {preset.name}</div>
              <div className={styles.templateDesc}>{preset.fg} / {preset.bg}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Advanced Tab */}
      <div className={classNames(styles.tabContent, { [styles.tabContentActive]: activeTab === "advanced" })}>
        <div className={styles.rangeGroup}>
          <label className={styles.inputLabel}>
            <span>📏 Размер QR-кода</span>
            <span className={styles.rangeValue}>{draft.style.size}px</span>
          </label>
          <input
            type="range"
            className={styles.rangeInput}
            min={256}
            max={2048}
            step={64}
            value={draft.style.size}
            onChange={(e) => updateStyle({ size: Number(e.target.value) })}
          />
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
        </div>

        <div className={styles.rangeGroup}>
          <label className={styles.inputLabel}>
            <span>🖼️ Отступ</span>
            <span className={styles.rangeValue}>{draft.style.margin}</span>
          </label>
          <input
            type="range"
            className={styles.rangeInput}
            min={0}
            max={10}
            value={draft.style.margin}
            onChange={(e) => updateStyle({ margin: Number(e.target.value) })}
          />
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
      <div className={styles.actionButtons}>
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
