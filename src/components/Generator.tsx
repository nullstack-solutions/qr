"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import classNames from "classnames";
import { QRType, QR_TYPES, getTypeDefinition } from "@/lib/qrTypes";
import { bytesToBinaryString } from "@/lib/binary";
import { useDraft } from "@/hooks/useDraft";

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

// Validate HEX color code
function isValidHex(hex: string): boolean {
  return /^#?([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(hex);
}

// Normalize HEX code (add # if missing, expand 3-char to 6-char)
function normalizeHex(hex: string): string {
  let normalized = hex.trim();
  if (!normalized.startsWith('#')) {
    normalized = '#' + normalized;
  }
  // Expand 3-char hex to 6-char
  if (normalized.length === 4) {
    normalized = '#' + normalized[1] + normalized[1] + normalized[2] + normalized[2] + normalized[3] + normalized[3];
  }
  return normalized.toUpperCase();
}

// Calculate relative luminance (WCAG formula)
function getLuminance(hex: string): number {
  const rgb = parseInt(hex.slice(1), 16);
  const r = ((rgb >> 16) & 0xff) / 255;
  const g = ((rgb >> 8) & 0xff) / 255;
  const b = (rgb & 0xff) / 255;

  const srgb = [r, g, b].map(val =>
    val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4)
  );

  return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
}

// Calculate contrast ratio (WCAG)
function getContrastRatio(hex1: string, hex2: string): number {
  const lum1 = getLuminance(hex1);
  const lum2 = getLuminance(hex2);
  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);
  return (lighter + 0.05) / (darker + 0.05);
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
  // Gradient options
  useDotsGradient: boolean;
  dotsGradient?: Gradient;
  useBackgroundGradient: boolean;
  backgroundGradient?: Gradient;
  useCornersGradient: boolean;
  cornersGradient?: Gradient;
  // Image options
  hideBackgroundDots: boolean;
}

interface GeneratorDraft {
  type: QRType;
  formValues: Record<string, string>;
  style: StyleOptions;
}

const defaultStyle: StyleOptions = {
  size: 320,
  errorCorrection: "H",
  foreground: "#0b1220",
  background: "#ffffff",
  margin: 12,
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

export function Generator() {
  const { value: draft, setValue: setDraft, hydrated } = useDraft<GeneratorDraft>(
    "generator",
    {
      type: "url",
      formValues: {},
      style: defaultStyle
    }
  );

  const [qrPayload, setQrPayload] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [byteLength, setByteLength] = useState(0);
  const [QRCodeStylingCtor, setQRCodeStylingCtor] = useState<any>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const qrRef = useRef<any>();

  // New states for spec compliance
  const [hexErrors, setHexErrors] = useState<{ foreground?: string; background?: string }>({});
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [exportFormat, setExportFormat] = useState<"png" | "svg">("png");
  const [exportSize, setExportSize] = useState<number>(1000);
  const [showTypeSwitch, setShowTypeSwitch] = useState<QRType | null>(null);

  const activeDefinition = useMemo(() => getTypeDefinition(draft.type), [draft.type]);

  const scrollToQR = useCallback(() => {
    if (!previewRef.current) return;
    triggerHaptic('light');
    previewRef.current.scrollIntoView({
      behavior: 'smooth',
      block: 'center'
    });
  }, []);

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

  const hasFormData = useMemo(() => {
    return activeDefinition.fields.some((field) => {
      const key = fieldKey(draft.type, field.name);
      return Boolean(draft.formValues[key]?.trim());
    });
  }, [draft.formValues, draft.type, activeDefinition.fields]);

  const switchType = useCallback(
    (type: QRType) => {
      // Check if user has entered data
      if (hasFormData && type !== draft.type) {
        setShowTypeSwitch(type);
        return;
      }

      triggerHaptic('light');
      setErrors({});
      setDraft((prev) => ({
        ...prev,
        type,
        formValues: prev.formValues,
        style: prev.style
      }));
    },
    [setDraft, hasFormData, draft.type]
  );

  const confirmTypeSwitch = useCallback(
    (type: QRType) => {
      triggerHaptic('medium');
      setErrors({});
      setShowTypeSwitch(null);
      setDraft((prev) => ({
        ...prev,
        type,
        formValues: prev.formValues,
        style: prev.style
      }));
    },
    [setDraft]
  );

  const handleHexInput = useCallback(
    (field: 'foreground' | 'background', value: string) => {
      const trimmed = value.trim();

      if (!trimmed) {
        setHexErrors(prev => ({ ...prev, [field]: undefined }));
        return;
      }

      if (!isValidHex(trimmed)) {
        setHexErrors(prev => ({ ...prev, [field]: 'Enter a valid hex code' }));
        return;
      }

      const normalized = normalizeHex(trimmed);
      setHexErrors(prev => ({ ...prev, [field]: undefined }));
      updateStyle({ [field]: normalized });
    },
    [updateStyle]
  );

  const contrastRatio = useMemo(() => {
    try {
      return getContrastRatio(draft.style.foreground, draft.style.background);
    } catch {
      return 0;
    }
  }, [draft.style.foreground, draft.style.background]);

  const hasLowContrast = contrastRatio > 0 && contrastRatio < 4.5;

  // Calculate max logo size based on error correction level
  const maxLogoSize = useMemo(() => {
    const limits: Record<ErrorCorrection, number> = {
      'L': 15,  // 7% error correction
      'M': 20,  // 15% error correction
      'Q': 25,  // 25% error correction
      'H': 30   // 30% error correction
    };
    return limits[draft.style.errorCorrection] || 30;
  }, [draft.style.errorCorrection]);

  const logoSizeExceedsLimit = draft.style.logoDataUrl && draft.style.logoSize > maxLogoSize;

  // Auto-adjust logo size when error correction changes
  useEffect(() => {
    if (draft.style.logoDataUrl && draft.style.logoSize > maxLogoSize) {
      updateStyle({ logoSize: maxLogoSize });
    }
  }, [draft.style.errorCorrection, maxLogoSize, draft.style.logoDataUrl, draft.style.logoSize, updateStyle]);

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
        data: "https://example.com",
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

    // Определяем форму фона на основе формы QR кода
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

  const handleFileUpload = useCallback(
    (file: File | null) => {
      if (!file) {
        updateStyle({ logoDataUrl: undefined });
        return;
      }
      if (!file.type.startsWith("image/")) {
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        updateStyle({ logoDataUrl: reader.result as string });
      };
      reader.readAsDataURL(file);
    },
    [updateStyle]
  );

  const openExportDialog = useCallback((format: "png" | "svg") => {
    // Check if QR is valid before opening dialog
    const ok = regenerate();
    if (!ok) return;

    setExportFormat(format);
    setShowExportDialog(true);
    triggerHaptic('light');
  }, [regenerate]);

  const exportBlob = useCallback(
    async () => {
      if (!qrRef.current) return;

      triggerHaptic('heavy');

      // Temporarily update size for export
      const originalSize = draft.style.size;
      const exportOptions: any = {
        data: qrPayload,
        width: exportSize,
        height: exportSize,
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

      qrRef.current.update(exportOptions);

      const payload = qrPayload || activeDefinition.buildPayload(formValues);
      const blob = await qrRef.current.getRawData(exportFormat);

      // Restore original size
      qrRef.current.update({ ...exportOptions, width: originalSize, height: originalSize });

      if (!blob) return;

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const slug = payload.slice(0, 32).replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "qr";
      link.href = url;
      link.download = `${slug}.${exportFormat}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setShowExportDialog(false);
    },
    [qrPayload, activeDefinition, formValues, exportFormat, exportSize, draft.style]
  );

  return (
    <section className="card">
      <header className="card__header">
        <div>
          <h1>Этап A. Генерация QR</h1>
          <p>Статические QR-коды всех типов с настройкой дизайна.</p>
        </div>
        <span className="badge">Автосохранение в браузере</span>
      </header>

      <div className="type-grid">
        {QR_TYPES.map((type) => (
          <button
            key={type.type}
            className={classNames("pill", {
              pill__active: type.type === draft.type
            })}
            onClick={() => switchType(type.type)}
          >
            <strong>{type.title}</strong>
            <span>{type.description}</span>
          </button>
        ))}
      </div>

      <div className="grid">
        <div className="grid__column">
          <h2>Данные</h2>
          <form
            className="form"
            onSubmit={(event) => {
              event.preventDefault();
              regenerate();
            }}
          >
            {activeDefinition.fields.map((field) => (
              <label key={field.name} className="form__field">
                <span>{field.label}</span>
                {field.type === "textarea" ? (
                  <textarea
                    value={formValues[field.name] ?? ""}
                    onChange={(event) => updateValue(field.name, event.target.value)}
                    placeholder={field.placeholder}
                    className={classNames({ error: Boolean(errors[field.name]) })}
                  />
                ) : (
                  <input
                    type={field.type === "email" ? "email" : "text"}
                    value={formValues[field.name] ?? ""}
                    onChange={(event) => updateValue(field.name, event.target.value)}
                    placeholder={field.placeholder}
                    className={classNames({ error: Boolean(errors[field.name]) })}
                  />
                )}
                {field.helper ? <small>{field.helper}</small> : null}
                {errors[field.name] ? <span className="error-text">{errors[field.name]}</span> : null}
              </label>
            ))}

            <div className="form__foot">
              <span>
                Длина: {byteLength} байт из {MAX_PAYLOAD_BYTES}
              </span>
              {errors.__payload ? <span className="error-text">{errors.__payload}</span> : null}
            </div>

            <button type="submit" className="primary">Собрать QR</button>
          </form>
        </div>

        <div className="grid__column">
          <h2>Настройки стиля</h2>
          <div className="panel">
            <label className="panel__field">
              <span>Размер, px</span>
              <input
                type="range"
                min={240}
                max={520}
                value={draft.style.size}
                onChange={(event) => updateStyle({ size: Number(event.target.value) })}
              />
              <strong>{draft.style.size}</strong>
            </label>

            <label className="panel__field">
              <span>Коррекция ошибок</span>
              <select
                value={draft.style.errorCorrection}
                onChange={(event) => updateStyle({ errorCorrection: event.target.value as ErrorCorrection })}
              >
                <option value="L">L — до 7%</option>
                <option value="M">M — до 15%</option>
                <option value="Q">Q — до 25%</option>
                <option value="H">H — до 30% (рекомендуется для логотипа)</option>
              </select>
              {draft.style.logoDataUrl && (
                <small style={{ color: 'var(--hint)', marginTop: '4px' }}>
                  Высокий уровень коррекции (Q/H) позволяет размещать больший логотип
                </small>
              )}
            </label>

            <label className="panel__field">
              <span>Цвет точек (HEX)</span>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  type="text"
                  value={draft.style.foreground}
                  onChange={(event) => handleHexInput('foreground', event.target.value)}
                  placeholder="#000000"
                  maxLength={7}
                  className={classNames({ error: Boolean(hexErrors.foreground) })}
                  style={{ flex: 1 }}
                />
                <input
                  type="color"
                  value={draft.style.foreground}
                  onChange={(event) => updateStyle({ foreground: event.target.value })}
                  style={{ width: '48px', height: '48px', cursor: 'pointer', padding: '2px' }}
                  title="Выбрать цвет"
                />
              </div>
              {hexErrors.foreground && <span className="error-text">{hexErrors.foreground}</span>}
            </label>

            <label className="panel__field">
              <span>Цвет фона (HEX)</span>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  type="text"
                  value={draft.style.background}
                  onChange={(event) => handleHexInput('background', event.target.value)}
                  placeholder="#FFFFFF"
                  maxLength={7}
                  className={classNames({ error: Boolean(hexErrors.background) })}
                  style={{ flex: 1 }}
                />
                <input
                  type="color"
                  value={draft.style.background}
                  onChange={(event) => updateStyle({ background: event.target.value })}
                  style={{ width: '48px', height: '48px', cursor: 'pointer', padding: '2px' }}
                  title="Выбрать цвет"
                />
              </div>
              {hexErrors.background && <span className="error-text">{hexErrors.background}</span>}
            </label>

            {hasLowContrast && (
              <div style={{
                padding: '12px',
                background: 'rgba(255, 193, 7, 0.1)',
                border: '1px solid rgba(255, 193, 7, 0.3)',
                borderRadius: '8px',
                fontSize: '14px',
                color: 'var(--text)'
              }}>
                ⚠️ Adjust colors for better scannability (contrast: {contrastRatio.toFixed(2)}:1, recommended: ≥4.5:1)
              </div>
            )}

            <label className="panel__field">
              <span>Внешний отступ (модули)</span>
              <input
                type="range"
                min={0}
                max={10}
                value={draft.style.margin}
                onChange={(event) => updateStyle({ margin: Number(event.target.value) })}
              />
              <strong>{draft.style.margin}</strong>
            </label>

            <label className="panel__field">
              <span>
                <input
                  type="checkbox"
                  checked={draft.style.useDotsGradient}
                  onChange={(event) =>
                    updateStyle({
                      useDotsGradient: event.target.checked
                    })
                  }
                  style={{ width: "auto", marginRight: "8px" }}
                />
                Градиент для QR кода
              </span>
            </label>

            {draft.style.useDotsGradient && draft.style.dotsGradient && (
              <>
                <label className="panel__field">
                  <span>Тип градиента</span>
                  <select
                    value={draft.style.dotsGradient.type}
                    onChange={(event) =>
                      updateStyle({
                        dotsGradient: { ...draft.style.dotsGradient!, type: event.target.value as GradientType }
                      })
                    }
                  >
                    <option value="linear">Линейный</option>
                    <option value="radial">Радиальный</option>
                  </select>
                </label>

                {draft.style.dotsGradient.type === "linear" && (
                  <label className="panel__field">
                    <span>Угол поворота, °</span>
                    <input
                      type="range"
                      min={0}
                      max={360}
                      value={radiansToDegrees(draft.style.dotsGradient.rotation)}
                      onChange={(event) =>
                        updateStyle({
                          dotsGradient: {
                            ...draft.style.dotsGradient!,
                            rotation: degreesToRadians(Number(event.target.value))
                          }
                        })
                      }
                    />
                    <strong>{radiansToDegrees(draft.style.dotsGradient.rotation)}</strong>
                  </label>
                )}

                <label className="panel__field">
                  <span>Начальный цвет градиента</span>
                  <input
                    type="color"
                    value={draft.style.dotsGradient.colorStops[0].color}
                    onChange={(event) =>
                      updateStyle({
                        dotsGradient: {
                          ...draft.style.dotsGradient!,
                          colorStops: [
                            { ...draft.style.dotsGradient!.colorStops[0], color: event.target.value },
                            draft.style.dotsGradient!.colorStops[1]
                          ]
                        }
                      })
                    }
                  />
                </label>

                <label className="panel__field">
                  <span>Конечный цвет градиента</span>
                  <input
                    type="color"
                    value={draft.style.dotsGradient.colorStops[1].color}
                    onChange={(event) =>
                      updateStyle({
                        dotsGradient: {
                          ...draft.style.dotsGradient!,
                          colorStops: [
                            draft.style.dotsGradient!.colorStops[0],
                            { ...draft.style.dotsGradient!.colorStops[1], color: event.target.value }
                          ]
                        }
                      })
                    }
                  />
                </label>
              </>
            )}

            <label className="panel__field">
              <span>Стиль точек</span>
              <select
                value={draft.style.dotStyle}
                onChange={(event) => updateStyle({ dotStyle: event.target.value as DotStyle })}
              >
                <option value="square">Classic (квадрат)</option>
                <option value="rounded">Rounded (скруглённый)</option>
                <option value="dots">Circles (круги)</option>
                <option value="classy">Smooth (сглаженный)</option>
                <option value="extra-rounded">Thin (тонкий)</option>
                <option value="classy-rounded">Classy Rounded</option>
              </select>
            </label>

            <label className="panel__field">
              <span>Внешние глазки</span>
              <select
                value={draft.style.eyeOuter}
                onChange={(event) => updateStyle({ eyeOuter: event.target.value as EyeStyle })}
              >
                <option value="square">Квадрат</option>
                <option value="extra-rounded">Скруглённый</option>
                <option value="dot">Точка</option>
              </select>
            </label>

            <label className="panel__field">
              <span>Внутренние глазки</span>
              <select
                value={draft.style.eyeInner}
                onChange={(event) => updateStyle({ eyeInner: event.target.value as EyeDotStyle })}
              >
                <option value="square">Квадрат</option>
                <option value="dot">Точка</option>
              </select>
            </label>

            <label className="panel__field">
              <span>Логотип</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/svg+xml"
                onChange={(event) => handleFileUpload(event.target.files?.[0] ?? null)}
              />
              {draft.style.logoDataUrl ? (
                <div className="panel__thumb">
                  <img src={draft.style.logoDataUrl} alt="Логотип" />
                  <button
                    type="button"
                    onClick={() => handleFileUpload(null)}
                    className="text"
                  >
                    Удалить
                  </button>
                </div>
              ) : null}
            </label>

            {draft.style.logoDataUrl ? (
              <>
                <label className="panel__field">
                  <span>Размер логотипа, % (макс. {maxLogoSize}% для уровня {draft.style.errorCorrection})</span>
                  <input
                    type="range"
                    min={10}
                    max={maxLogoSize}
                    value={Math.min(draft.style.logoSize, maxLogoSize)}
                    onChange={(event) => updateStyle({ logoSize: Number(event.target.value) })}
                  />
                  <strong>{Math.min(draft.style.logoSize, maxLogoSize)}</strong>
                </label>

                {logoSizeExceedsLimit && (
                  <div style={{
                    padding: '12px',
                    background: 'rgba(255, 193, 7, 0.1)',
                    border: '1px solid rgba(255, 193, 7, 0.3)',
                    borderRadius: '8px',
                    fontSize: '14px',
                    color: 'var(--text)'
                  }}>
                    ⚠️ Логотип автоматически уменьшен до {maxLogoSize}% из-за низкого уровня коррекции ошибок. Увеличьте уровень коррекции для больших логотипов.
                  </div>
                )}

                <label className="panel__field">
                  <span>Скрыть точки под логотипом</span>
                  <input
                    type="checkbox"
                    checked={draft.style.hideBackgroundDots}
                    onChange={(event) => updateStyle({ hideBackgroundDots: event.target.checked })}
                  />
                </label>
              </>
            ) : null}

            <label className="panel__field">
              <span>Форма QR-кода</span>
              <select
                value={draft.style.shape}
                onChange={(event) => updateStyle({ shape: event.target.value as ShapeType })}
              >
                <option value="square">Квадрат</option>
                <option value="circle">Круг</option>
              </select>
            </label>

            <label className="panel__field">
              <span>Градиент фона</span>
              <input
                type="checkbox"
                checked={draft.style.useBackgroundGradient}
                onChange={(event) => updateStyle({ useBackgroundGradient: event.target.checked })}
              />
            </label>

            {draft.style.useBackgroundGradient && draft.style.backgroundGradient ? (
              <>
                <label className="panel__field">
                  <span>Тип градиента фона</span>
                  <select
                    value={draft.style.backgroundGradient.type}
                    onChange={(event) => updateStyle({
                      backgroundGradient: {
                        ...draft.style.backgroundGradient!,
                        type: event.target.value as GradientType
                      }
                    })}
                  >
                    <option value="linear">Линейный</option>
                    <option value="radial">Радиальный</option>
                  </select>
                </label>

                {draft.style.backgroundGradient.type === "linear" ? (
                  <label className="panel__field">
                    <span>Угол поворота, °</span>
                    <input
                      type="range"
                      min={0}
                      max={360}
                      value={radiansToDegrees(draft.style.backgroundGradient.rotation)}
                      onChange={(event) => updateStyle({
                        backgroundGradient: {
                          ...draft.style.backgroundGradient!,
                          rotation: degreesToRadians(Number(event.target.value))
                        }
                      })}
                    />
                    <strong>{radiansToDegrees(draft.style.backgroundGradient.rotation)}</strong>
                  </label>
                ) : null}

                <label className="panel__field">
                  <span>Начальный цвет фона</span>
                  <input
                    type="color"
                    value={draft.style.backgroundGradient.colorStops[0]?.color || "#ffffff"}
                    onChange={(event) => {
                      const newStops = [...draft.style.backgroundGradient!.colorStops];
                      newStops[0] = { ...newStops[0], color: event.target.value };
                      updateStyle({ backgroundGradient: { ...draft.style.backgroundGradient!, colorStops: newStops } });
                    }}
                  />
                </label>

                <label className="panel__field">
                  <span>Конечный цвет фона</span>
                  <input
                    type="color"
                    value={draft.style.backgroundGradient.colorStops[1]?.color || "#ffffff"}
                    onChange={(event) => {
                      const newStops = [...draft.style.backgroundGradient!.colorStops];
                      newStops[1] = { ...newStops[1], color: event.target.value };
                      updateStyle({ backgroundGradient: { ...draft.style.backgroundGradient!, colorStops: newStops } });
                    }}
                  />
                </label>
              </>
            ) : null}

            <label className="panel__field">
              <span>Градиент углов</span>
              <input
                type="checkbox"
                checked={draft.style.useCornersGradient}
                onChange={(event) => updateStyle({ useCornersGradient: event.target.checked })}
              />
            </label>

            {draft.style.useCornersGradient && draft.style.cornersGradient ? (
              <>
                <label className="panel__field">
                  <span>Тип градиента углов</span>
                  <select
                    value={draft.style.cornersGradient.type}
                    onChange={(event) => updateStyle({
                      cornersGradient: {
                        ...draft.style.cornersGradient!,
                        type: event.target.value as GradientType
                      }
                    })}
                  >
                    <option value="linear">Линейный</option>
                    <option value="radial">Радиальный</option>
                  </select>
                </label>

                {draft.style.cornersGradient.type === "linear" ? (
                  <label className="panel__field">
                    <span>Угол поворота, °</span>
                    <input
                      type="range"
                      min={0}
                      max={360}
                      value={radiansToDegrees(draft.style.cornersGradient.rotation)}
                      onChange={(event) => updateStyle({
                        cornersGradient: {
                          ...draft.style.cornersGradient!,
                          rotation: degreesToRadians(Number(event.target.value))
                        }
                      })}
                    />
                    <strong>{radiansToDegrees(draft.style.cornersGradient.rotation)}</strong>
                  </label>
                ) : null}

                <label className="panel__field">
                  <span>Начальный цвет углов</span>
                  <input
                    type="color"
                    value={draft.style.cornersGradient.colorStops[0]?.color || "#000000"}
                    onChange={(event) => {
                      const newStops = [...draft.style.cornersGradient!.colorStops];
                      newStops[0] = { ...newStops[0], color: event.target.value };
                      updateStyle({ cornersGradient: { ...draft.style.cornersGradient!, colorStops: newStops } });
                    }}
                  />
                </label>

                <label className="panel__field">
                  <span>Конечный цвет углов</span>
                  <input
                    type="color"
                    value={draft.style.cornersGradient.colorStops[1]?.color || "#000000"}
                    onChange={(event) => {
                      const newStops = [...draft.style.cornersGradient!.colorStops];
                      newStops[1] = { ...newStops[1], color: event.target.value };
                      updateStyle({ cornersGradient: { ...draft.style.cornersGradient!, colorStops: newStops } });
                    }}
                  />
                </label>
              </>
            ) : null}
          </div>

          <div className="preview" aria-live="polite" ref={previewRef}>
            <div ref={containerRef} className="preview__canvas" />
            <div className="preview__actions">
              <button type="button" onClick={scrollToQR} className="secondary" title="Центрировать QR код">
                📍 Показать
              </button>
              <button
                type="button"
                onClick={() => openExportDialog("png")}
                className="primary"
                disabled={Object.keys(errors).length > 0 || Object.keys(hexErrors).length > 0}
              >
                Скачать PNG
              </button>
              <button
                type="button"
                onClick={() => openExportDialog("svg")}
                className="secondary"
                disabled={Object.keys(errors).length > 0 || Object.keys(hexErrors).length > 0}
              >
                Скачать SVG
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Export size dialog */}
      {showExportDialog && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '16px'
          }}
          onClick={() => setShowExportDialog(false)}
        >
          <div
            style={{
              background: 'var(--surface)',
              borderRadius: '16px',
              padding: '24px',
              maxWidth: '400px',
              width: '100%',
              boxShadow: 'var(--shadow-lg)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 16px', fontSize: '20px', fontWeight: 700 }}>
              Экспорт {exportFormat.toUpperCase()}
            </h3>
            <p style={{ margin: '0 0 16px', color: 'var(--hint)', fontSize: '14px' }}>
              Выберите размер для экспорта:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
              {[100, 200, 1000, 2000].map((size) => (
                <label
                  key={size}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '12px',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    background: exportSize === size ? 'rgba(51, 144, 236, 0.1)' : 'transparent'
                  }}
                >
                  <input
                    type="radio"
                    name="export-size"
                    value={size}
                    checked={exportSize === size}
                    onChange={(e) => setExportSize(Number(e.target.value))}
                    style={{ marginRight: '12px' }}
                  />
                  <span style={{ fontWeight: exportSize === size ? 600 : 400 }}>
                    {size} × {size} px
                  </span>
                </label>
              ))}

              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '12px',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                  gap: '12px'
                }}
              >
                <span>Custom:</span>
                <input
                  type="number"
                  min={100}
                  max={5000}
                  value={exportSize}
                  onChange={(e) => setExportSize(Number(e.target.value))}
                  style={{ flex: 1, padding: '8px' }}
                />
                <span>px</span>
              </label>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setShowExportDialog(false)}
                className="secondary"
                style={{ flex: 1 }}
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={exportBlob}
                className="primary"
                style={{ flex: 1 }}
              >
                Скачать
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Type switch confirmation dialog */}
      {showTypeSwitch && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '16px'
          }}
          onClick={() => setShowTypeSwitch(null)}
        >
          <div
            style={{
              background: 'var(--surface)',
              borderRadius: '16px',
              padding: '24px',
              maxWidth: '400px',
              width: '100%',
              boxShadow: 'var(--shadow-lg)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 16px', fontSize: '20px', fontWeight: 700 }}>
              Discard changes?
            </h3>
            <p style={{ margin: '0 0 24px', color: 'var(--hint)', fontSize: '14px' }}>
              Вы ввели данные в текущую форму. При переключении типа данные сохранятся, но будут недоступны для нового типа QR-кода.
            </p>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setShowTypeSwitch(null)}
                className="secondary"
                style={{ flex: 1 }}
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={() => showTypeSwitch && confirmTypeSwitch(showTypeSwitch)}
                className="primary"
                style={{ flex: 1 }}
              >
                Продолжить
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
