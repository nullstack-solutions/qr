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

  useEffect(() => {
    import("qr-code-styling").then((module) => {
      setQRCodeStylingCtor(() => module.default);
    });
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    if (!QRCodeStylingCtor) return;

    if (!qrRef.current) {
      const instance = new QRCodeStylingCtor({
        width: defaultStyle.size,
        height: defaultStyle.size,
        data: "https://t.me/durov",
        image: undefined,
        qrOptions: {
          errorCorrectionLevel: defaultStyle.errorCorrection,
          margin: defaultStyle.margin,
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
      scoped[field.name] = draft.formValues[key] ?? "";
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

    const options: any = {
      data: bytesToBinaryString(encodedBytes),
      width: draft.style.size,
      height: draft.style.size,
      image: draft.style.logoDataUrl,
      shape: draft.style.shape,
      qrOptions: {
        errorCorrectionLevel: draft.style.errorCorrection,
        margin: draft.style.margin,
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
    const hex = color.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness > 128;
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
