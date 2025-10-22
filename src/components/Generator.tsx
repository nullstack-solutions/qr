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

  const exportBlob = useCallback(
    async (format: "png" | "svg") => {
      if (!qrRef.current) return;
      const ok = regenerate();
      if (!ok) return;
      triggerHaptic('heavy');
      const payload = qrPayload || activeDefinition.buildPayload(formValues);
      const blob = await qrRef.current.getRawData(format);
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const slug = payload.slice(0, 32).replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "qr";
      link.href = url;
      link.download = `${slug}.${format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    },
    [regenerate, qrPayload, activeDefinition, formValues]
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
                <option value="H">H — до 30%</option>
              </select>
            </label>

            <label className="panel__field">
              <span>Цвет точек</span>
              <input
                type="color"
                value={draft.style.foreground}
                onChange={(event) => updateStyle({ foreground: event.target.value })}
              />
            </label>

            <label className="panel__field">
              <span>Цвет фона</span>
              <input
                type="color"
                value={draft.style.background}
                onChange={(event) => updateStyle({ background: event.target.value })}
              />
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
                <option value="square">Квадрат</option>
                <option value="rounded">Скруглённый</option>
                <option value="extra-rounded">Очень скруглённый</option>
                <option value="dots">Точки</option>
                <option value="classy">Classy</option>
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
                  <span>Размер логотипа, %</span>
                  <input
                    type="range"
                    min={10}
                    max={30}
                    value={draft.style.logoSize}
                    onChange={(event) => updateStyle({ logoSize: Number(event.target.value) })}
                  />
                  <strong>{draft.style.logoSize}</strong>
                </label>

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
              <button type="button" onClick={() => exportBlob("png")} className="primary">
                Скачать PNG
              </button>
              <button type="button" onClick={() => exportBlob("svg")} className="secondary">
                Скачать SVG
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
