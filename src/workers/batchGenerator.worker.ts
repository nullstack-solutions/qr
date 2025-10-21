import QRCode from "qrcode";
import JSZip from "jszip";

interface BatchItem {
  index: number;
  type: string;
  payload: string;
  slug: string;
}

interface BatchJob {
  id: string;
  items: BatchItem[];
  format: "png" | "svg";
  options: {
    errorCorrection: "L" | "M" | "Q" | "H";
    margin: number;
    size: number;
    foreground: string;
    background: string;
    chunk: number;
  };
}

type WorkerResponse =
  | { id: string; progress: number; processed: number; total: number }
  | { id: string; error: string }
  | { id: string; done: true; buffer: ArrayBuffer };

export const createSegments = (value: string) => [
  { data: new TextEncoder().encode(value), mode: "byte" as const }
];

const ctx = self as any;

ctx.onmessage = async (event: MessageEvent<BatchJob>) => {
  const job = event.data;
  try {
    const total = job.items.length;
    const chunk = Math.max(1, job.options.chunk || 250);
    let processed = 0;
    const zip = new JSZip();

    for (const item of job.items) {
      const filename = `${String(item.index).padStart(4, "0")}_${item.type}_${item.slug}.${job.format}`;
      if (job.format === "svg") {
        const svg = await QRCode.toString(createSegments(item.payload), {
          type: "svg",
          width: job.options.size,
          errorCorrectionLevel: job.options.errorCorrection,
          margin: job.options.margin,
          color: {
            dark: job.options.foreground,
            light: job.options.background
          }
        });
        zip.file(filename, svg);
      } else {
        const dataUrl = await QRCode.toDataURL(createSegments(item.payload), {
          width: job.options.size,
          errorCorrectionLevel: job.options.errorCorrection,
          margin: job.options.margin,
          color: {
            dark: job.options.foreground,
            light: job.options.background
          }
        });
        const base64 = dataUrl.split(",")[1];
        zip.file(filename, base64, { base64: true });
      }

      processed += 1;
      if (processed % chunk === 0 || processed === total) {
        ctx.postMessage({
          id: job.id,
          progress: processed / total,
          processed,
          total
        } as WorkerResponse);
      }
    }

    const buffer = await zip.generateAsync({
      type: "arraybuffer",
      streamFiles: true,
      compression: "DEFLATE",
      compressionOptions: { level: 7 }
    });

    ctx.postMessage({ id: job.id, done: true, buffer } as WorkerResponse, [buffer]);
  } catch (error: any) {
    ctx.postMessage({ id: job.id, error: error?.message ?? "Ошибка генерации" } as WorkerResponse);
  }
};
