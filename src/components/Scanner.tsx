"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader, NotFoundException } from "@zxing/browser";

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

  useEffect(() => {
    readerRef.current = new BrowserMultiFormatReader();
    return () => {
      readerRef.current?.reset();
    };
  }, []);

  const startCamera = useCallback(async () => {
    if (!readerRef.current) return;
    if (!videoRef.current) return;
    setError(null);
    try {
      const devices = await BrowserMultiFormatReader.listVideoInputDevices();
      const first = devices[0]?.deviceId ?? undefined;
      setActive(true);
      await readerRef.current.decodeFromVideoDevice(first, videoRef.current, (result, error) => {
        if (result) {
          setResults((prev) => [
            { text: result.getText(), timestamp: Date.now(), source: "camera" },
            ...prev
          ].slice(0, 20));
        }
        if (error && !(error instanceof NotFoundException)) {
          setError(error.message ?? "Ошибка сканирования");
        }
      });
    } catch (err: any) {
      setError(err?.message ?? "Не удалось получить доступ к камере");
      setActive(false);
    }
  }, []);

  const stopCamera = useCallback(() => {
    readerRef.current?.reset();
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach((track) => track.stop());
    }
    videoRef.current && (videoRef.current.srcObject = null);
    setActive(false);
  }, []);

  const handleFile = useCallback(async (file: File) => {
    if (!readerRef.current) return;
    setError(null);
    const url = URL.createObjectURL(file);
    try {
      const result = await readerRef.current.decodeFromImageUrl(url);
      setResults((prev) => [
        { text: result.getText(), timestamp: Date.now(), source: "file" },
        ...prev
      ].slice(0, 20));
    } catch (err: any) {
      setError(err?.message ?? "Файл не содержит QR-код");
    } finally {
      URL.revokeObjectURL(url);
    }
  }, []);

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
