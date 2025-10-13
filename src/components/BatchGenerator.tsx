"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import { read, utils } from "xlsx";
import classNames from "classnames";
import BatchWorker from "@/workers/batchGenerator.worker.ts";
import { QRType, QR_TYPES, getTypeDefinition } from "@/lib/qrTypes";
import { useDraft } from "@/hooks/useDraft";

interface BatchDraft {
  format: "png" | "svg";
  size: number;
  errorCorrection: "L" | "M" | "Q" | "H";
  margin: number;
  foreground: string;
  background: string;
  chunk: number;
}

interface ParsedRow {
  index: number;
  type: QRType | null;
  slug: string;
  payload: string;
  errors: string[];
  raw: Record<string, string>;
}

interface WorkerProgress {
  processed: number;
  total: number;
  progress: number;
}

const defaultDraft: BatchDraft = {
  format: "png",
  size: 600,
  errorCorrection: "H",
  margin: 4,
  foreground: "#0b1220",
  background: "#ffffff",
  chunk: 250
};

function slugify(value: string) {
  return value
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "entry";
}

async function parseCsv(file: File): Promise<Record<string, string>[]> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false,
      complete: (result) => {
        resolve(result.data.filter(Boolean));
      },
      error: reject
    });
  });
}

async function parseXlsx(file: File): Promise<Record<string, string>[]> {
  const buffer = await file.arrayBuffer();
  const workbook = read(buffer, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return utils.sheet_to_json(sheet, { raw: false, defval: "" }) as Record<string, string>[];
}

function isQRType(value: string): value is QRType {
  return QR_TYPES.some((def) => def.type === value);
}

export function BatchGenerator() {
  const workerRef = useRef<Worker | null>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [progress, setProgress] = useState<WorkerProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const { value: draft, setValue: setDraft } = useDraft<BatchDraft>("batch", defaultDraft);

  useEffect(() => {
    const instance = new BatchWorker();
    workerRef.current = instance;
    instance.onmessage = (event: MessageEvent<any>) => {
      const payload = event.data;
      if (payload.error) {
        setError(payload.error);
        setProgress(null);
        return;
      }
      if (payload.progress !== undefined) {
        setProgress({
          processed: payload.processed,
          total: payload.total,
          progress: payload.progress
        });
      }
      if (payload.done) {
        const blob = new Blob([payload.buffer], { type: "application/zip" });
        const url = URL.createObjectURL(blob);
        setDownloadUrl((prev) => {
          if (prev) {
            URL.revokeObjectURL(prev);
          }
          return url;
        });
        setProgress(null);
      }
    };
    return () => {
      instance.terminate();
    };
  }, []);

  useEffect(() => {
    return () => {
      if (downloadUrl) {
        URL.revokeObjectURL(downloadUrl);
      }
    };
  }, [downloadUrl]);

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    setDownloadUrl(null);
    setProgress(null);
    setFileName(file.name);

    let rowsData: Record<string, string>[] = [];
    try {
      if (file.name.toLowerCase().endsWith(".csv")) {
        rowsData = await parseCsv(file);
      } else {
        rowsData = await parseXlsx(file);
      }
    } catch (err: any) {
      setError(err?.message ?? "Не удалось прочитать файл");
      setRows([]);
      return;
    }

    const parsed: ParsedRow[] = rowsData.map((raw, index) => {
      const typeValue = (raw.type ?? raw.Type ?? "text").toString().trim().toLowerCase();
      const type = isQRType(typeValue) ? typeValue : null;
      const errors: string[] = [];
      let payload = "";

      if (!type) {
        errors.push(`Неизвестный тип: ${raw.type}`);
      } else {
        const def = getTypeDefinition(type);
        const scoped: Record<string, string> = {};
        for (const field of def.fields) {
          const columnValue = raw[field.name] ?? raw[field.name.toUpperCase()] ?? raw[field.label] ?? "";
          scoped[field.name] = columnValue?.toString() ?? "";
          if (field.required && !scoped[field.name].trim()) {
            errors.push(`Поле ${field.label} обязательно`);
          }
          if (field.validate) {
            const errorMessage = field.validate(scoped[field.name], scoped);
            if (errorMessage) {
              errors.push(`${field.label}: ${errorMessage}`);
            }
          }
        }
        payload = def.buildPayload(scoped);
        if (!payload) {
          errors.push("Не удалось построить полезную нагрузку");
        }
        if (new TextEncoder().encode(payload).length > 2953) {
          errors.push("Превышен лимит байт");
        }
      }

      const slugCandidate =
        raw.slug || raw.SLUG || raw.filename || raw.name || Object.values(raw)[1] || `row-${index + 1}`;
      const slug = slugify(slugCandidate ?? `row-${index + 1}`);

      return {
        index: index + 1,
        type,
        slug,
        payload,
        errors,
        raw
      };
    });

    setRows(parsed);
  }, []);

  const preview = useMemo(() => rows.slice(0, 20), [rows]);
  const validRows = useMemo(() => rows.filter((row) => row.errors.length === 0 && row.type), [rows]);

  const generate = useCallback(() => {
    if (!workerRef.current) return;
    if (validRows.length === 0) {
      setError("Нет валидных строк для генерации");
      return;
    }

    const jobId = crypto.randomUUID();
    workerRef.current.postMessage({
      id: jobId,
      items: validRows.map((row) => ({
        index: row.index,
        type: row.type!,
        payload: row.payload,
        slug: row.slug
      })),
      format: draft.format,
      options: {
        errorCorrection: draft.errorCorrection,
        margin: draft.margin,
        size: draft.size,
        foreground: draft.foreground,
        background: draft.background,
        chunk: draft.chunk
      }
    });
    setProgress({ processed: 0, total: validRows.length, progress: 0 });
  }, [draft, validRows]);

  const download = useCallback(() => {
    if (!downloadUrl) return;
    const a = document.createElement("a");
    a.href = downloadUrl;
    const stamp = new Date().toISOString().slice(0, 10);
    const base = fileName ? slugify(fileName.replace(/\.[^.]+$/, "")) : "qr-batch";
    a.download = `${base}-${stamp}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [downloadUrl, fileName]);

  const updateDraft = useCallback(
    (next: Partial<BatchDraft>) => {
      setDraft((prev) => ({ ...prev, ...next }));
    },
    [setDraft]
  );

  return (
    <section className="card">
      <header className="card__header">
        <div>
          <h2>Массовая генерация</h2>
          <p>Импорт CSV/XLSX, предпросмотр и ZIP c PNG/SVG.</p>
        </div>
        <span className="badge">10k строк, чанки {draft.chunk}</span>
      </header>

      <div className="batch">
        <div className="batch__left">
          <label className="dropzone">
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                void handleFile(file);
              }}
            />
            <strong>Загрузите CSV или XLSX</strong>
            <span>Столбцы: type, поля формы, slug (опционально)</span>
            {fileName ? <em>{fileName}</em> : null}
          </label>

          <div className="batch__options">
            <label>
              Формат
              <select
                value={draft.format}
                onChange={(event) => updateDraft({ format: event.target.value as "png" | "svg" })}
              >
                <option value="png">PNG</option>
                <option value="svg">SVG</option>
              </select>
            </label>

            <label>
              Размер
              <input
                type="number"
                min={256}
                max={1024}
                value={draft.size}
                onChange={(event) => updateDraft({ size: Number(event.target.value) })}
              />
            </label>

            <label>
              Коррекция
              <select
                value={draft.errorCorrection}
                onChange={(event) => updateDraft({ errorCorrection: event.target.value as BatchDraft["errorCorrection"] })}
              >
                <option value="L">L</option>
                <option value="M">M</option>
                <option value="Q">Q</option>
                <option value="H">H</option>
              </select>
            </label>

            <label>
              Отступ (модули)
              <input
                type="number"
                min={0}
                max={8}
                value={draft.margin}
                onChange={(event) => updateDraft({ margin: Number(event.target.value) })}
              />
            </label>

            <label>
              Цвет точек
              <input
                type="color"
                value={draft.foreground}
                onChange={(event) => updateDraft({ foreground: event.target.value })}
              />
            </label>

            <label>
              Цвет фона
              <input
                type="color"
                value={draft.background}
                onChange={(event) => updateDraft({ background: event.target.value })}
              />
            </label>

            <label>
              Размер чанка
              <input
                type="number"
                min={50}
                max={1000}
                value={draft.chunk}
                onChange={(event) => updateDraft({ chunk: Number(event.target.value) })}
              />
            </label>
          </div>

          <button type="button" className="primary" onClick={generate} disabled={progress !== null}>
            Сформировать ZIP ({validRows.length})
          </button>
          {progress ? (
            <p className="progress">
              Обработано {progress.processed}/{progress.total} ({Math.round(progress.progress * 100)}%)
            </p>
          ) : null}
          {downloadUrl ? (
            <button type="button" className="secondary" onClick={download}>
              Скачать ZIP
            </button>
          ) : null}
          {error ? <p className="error-text">{error}</p> : null}
        </div>

        <div className="batch__preview">
          <h3>Предпросмотр первых {preview.length} строк</h3>
          {preview.length === 0 ? (
            <p className="hint">Загрузите файл чтобы увидеть содержимое</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Тип</th>
                  <th>Slug</th>
                  <th>Ошибки</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((row) => (
                  <tr key={row.index} className={classNames({ error: row.errors.length > 0 })}>
                    <td>{row.index}</td>
                    <td>{row.type ?? row.raw.type}</td>
                    <td>{row.slug}</td>
                    <td>
                      {row.errors.length > 0 ? row.errors.join(", ") : <span className="ok">Готово</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </section>
  );
}
