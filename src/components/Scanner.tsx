"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import type { TelegramWebApp } from "@/types/telegram";

interface ScanResult {
  text: string;
  timestamp: number;
  source: "camera" | "file";
}

export function Scanner() {
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const [active, setActive] = useState(false);
  const [results, setResults] = useState<ScanResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [hasCamera, setHasCamera] = useState<boolean | null>(null);

  const isMobile = useMemo(() => {
    if (typeof window === "undefined") return false;
    const tgPlatform = window.Telegram?.WebApp?.platform;
    if (tgPlatform && ["ios", "android", "android_x"].includes(tgPlatform)) {
      return true;
    }
    const ua = window.navigator?.userAgent ?? "";
    return /iphone|ipad|ipod|android/i.test(ua);
  }, []);

  const stopCamera = useCallback(() => {
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach((track) => track.stop());
    }
    videoRef.current && (videoRef.current.srcObject = null);
    setActive(false);
  }, []);

  useEffect(() => {
    readerRef.current = new BrowserMultiFormatReader();
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  useEffect(() => {
    let cancelled = false;
    async function checkCamera() {
      if (typeof navigator === "undefined" || !navigator.mediaDevices?.enumerateDevices) {
        setHasCamera(false);
        return;
      }
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        if (!cancelled) {
          setHasCamera(devices.some((device) => device.kind === "videoinput"));
        }
      } catch {
        if (!cancelled) {
          setHasCamera(false);
        }
      }
    }
    void checkCamera();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleFile = useCallback(async (file: File, source: ScanResult["source"] = "file") => {
    if (!readerRef.current) return;
    setError(null);
    const url = URL.createObjectURL(file);
    try {
      const result = await readerRef.current.decodeFromImageUrl(url);
      setResults((prev) => [
        { text: result.getText(), timestamp: Date.now(), source },
        ...prev
      ].slice(0, 20));
    } catch (err: any) {
      setError(err?.message ?? "Файл не содержит QR-код");
    } finally {
      URL.revokeObjectURL(url);
    }
  }, []);

  const startCamera = useCallback(async () => {
    if (isMobile) {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";
      input.setAttribute("capture", "environment");
      input.style.display = "none";

      const cleanup = () => {
        input.value = "";
        if (input.parentNode) {
          input.parentNode.removeChild(input);
        }
      };

      input.addEventListener("change", (event) => {
        const file = (event.target as HTMLInputElement).files?.[0];
        if (file) {
          void handleFile(file, "camera");
        }
        cleanup();
      });

      document.body.appendChild(input);
      input.click();
      return;
    }
    if (!readerRef.current) return;
    if (!videoRef.current) return;
    if (hasCamera === false) {
      setError("Камера не найдена. Загрузите изображение.");
      fileInputRef.current?.click();
      return;
    }
    setError(null);
    try {
      const devices = await BrowserMultiFormatReader.listVideoInputDevices();
      const first = devices[0]?.deviceId ?? undefined;
      setActive(true);
      await readerRef.current.decodeFromVideoDevice(first, videoRef.current, (result, error) => {
        if (result) {
          setResults((prev) => [
            { text: result.getText(), timestamp: Date.now(), source: "camera" as const },
            ...prev
          ].slice(0, 20));
        }
        if (error && error.name !== "NotFoundException") {
          setError(error.message ?? "Ошибка сканирования");
        }
      });
    } catch (err: any) {
      setError(err?.message ?? "Не удалось получить доступ к камере");
      setActive(false);
    }
  }, [handleFile, hasCamera, isMobile]);

  return (
    <section className="card">
      <header className="card__header">
        <div>
          <h2>Клиентский сканер</h2>
          <p>Камера или изображение, всё локально.</p>
        </div>
      </header>

      <div className="scanner">
        <div className="scanner__video">
          <video ref={videoRef} playsInline muted autoPlay className={active ? "active" : ""} />
          <div className="scanner__controls">
            {active ? (
              <button type="button" onClick={stopCamera} className="secondary">
                Остановить
              </button>
            ) : (
              <button type="button" onClick={startCamera} className="primary">
                Включить камеру
              </button>
            )}
            <label className="upload">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) {
                    void handleFile(file);
                  }
                }}
              />
              <span>Загрузить изображение</span>
            </label>
          </div>
          {error ? <p className="error-text">{error}</p> : null}
        </div>

        <div className="scanner__results">
          <h3>Последние результаты</h3>
          {results.length === 0 ? (
            <p className="hint">Пока нет данных</p>
          ) : (
            <ul>
              {results.map((item) => (
                <li key={item.timestamp + item.text}>
                  <span className="pill pill__small">{item.source === "camera" ? "📷" : "🖼️"}</span>
                  <code>{item.text}</code>
                  <small>{new Date(item.timestamp).toLocaleTimeString()}</small>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
