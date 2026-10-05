import type { Worker } from "tesseract.js";
import { referenceTime, type TimeSource } from "./metadata";
import { parseElapsed, uid, type Precision } from "./model";
export interface Region {
  x: number;
  y: number;
  width: number;
  height: number;
}
export const DEFAULT_REGION: Region = {
  x: 19.5,
  y: 29,
  width: 61,
  height: 49.3,
};
export interface Candidate {
  id: string;
  name: string;
  rawName: string;
  playerId: string;
  minutes: number | null;
  precision: Precision;
  role: "defense" | "attack" | "unknown";
  selected: boolean;
  confidence: number;
  thumbnail: string;
  rowKey: string;
  rawTime: string;
}
export interface ScanResult {
  rows: Candidate[];
  baseAt: number;
  timeSource: TimeSource;
  imageKey: string;
  skipped: number;
}
export interface Band {
  top: number;
  bottom: number;
}
export function rowBands(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): Band[] {
  const bright: boolean[] = [];
  // A narrow blank column just before the history buttons avoids text and avatars.
  for (let y = 0; y < height; y++) {
    let sum = 0,
      n = 0;
    for (let x = Math.floor(width * 0.786); x < Math.ceil(width * 0.802); x++) {
      const i = (y * width + x) * 4;
      sum += (data[i] + data[i + 1] + data[i + 2]) / 3;
      n++;
    }
    bright.push(sum / Math.max(n, 1) > 232);
  }
  // Join tiny antialiased interruptions, but keep the gray card separators.
  for (let y = 1; y < height - 1; y++)
    if (bright[y - 1] && bright[y + 1]) bright[y] = true;
  const bands: Band[] = [];
  let start = -1;
  for (let y = 0; y <= height; y++) {
    if (bright[y] && start < 0) start = y;
    if (!bright[y] && start >= 0) {
      if (y - start > height * 0.065) bands.push({ top: start, bottom: y });
      start = -1;
    }
  }
  return bands;
}
export function shieldScore(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): number {
  const points: number[][] = [];
  let minX = width,
    maxX = 0,
    minY = height,
    maxY = 0;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
      if (b - r > 60 && g - r > 45 && b > 140) {
        points.push([x, y]);
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
    }
  if (points.length < width * height * 0.025) return 0;
  const bins = new Set(
    points.map(
      ([x, y]) =>
        `${Math.round(((x - minX) / Math.max(1, maxX - minX)) * 15)},${Math.round(((y - minY) / Math.max(1, maxY - minY)) * 23)}`,
    ),
  );
  let matched = 0;
  for (const key of bins) {
    const [x, y] = key.split(",").map(Number);
    if (bins.has(`${15 - x},${y}`)) matched++;
  }
  return matched / bins.size;
}
function crop(
  canvas: HTMLCanvasElement,
  x: number,
  y: number,
  w: number,
  h: number,
  scale = 1,
): HTMLCanvasElement {
  const out = document.createElement("canvas");
  out.width = Math.max(1, Math.round(w * scale));
  out.height = Math.max(1, Math.round(h * scale));
  const ctx = out.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.drawImage(canvas, x, y, w, h, 0, 0, out.width, out.height);
  return out;
}
function clean(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const ctx = canvas.getContext("2d")!;
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = (img.data[i] + img.data[i + 1] + img.data[i + 2]) / 3;
    const b = v < 155 ? Math.max(0, (v - 45) * 1.2) : 255;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = b;
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}
export class Scanner {
  worker: Worker | null = null;
  cancelled = false;
  async cancel() {
    this.cancelled = true;
    const w = this.worker;
    this.worker = null;
    if (w) await w.terminate();
  }
  async scan(
    file: File,
    region: Region,
    onProgress: (message: string) => void,
  ): Promise<ScanResult> {
    this.cancelled = false;
    const referenceNow = Date.now();
    const capture = await referenceTime(file, referenceNow);
    const bytes = await file.arrayBuffer();
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    const imageKey = Array.from(new Uint8Array(digest), (x) =>
      x.toString(16).padStart(2, "0"),
    ).join("");
    const bitmap = await createImageBitmap(file);
    const image = document.createElement("canvas");
    image.width = Math.min(bitmap.width, 4096);
    image.height = Math.round((bitmap.height * image.width) / bitmap.width);
    image.getContext("2d")!.drawImage(bitmap, 0, 0, image.width, image.height);
    bitmap.close();
    const body = crop(
      image,
      (image.width * region.x) / 100,
      (image.height * region.y) / 100,
      (image.width * region.width) / 100,
      (image.height * region.height) / 100,
    );
    const bands = rowBands(
      body.getContext("2d")!.getImageData(0, 0, body.width, body.height).data,
      body.width,
      body.height,
    );
    if (!bands.length)
      throw Error(
        "履歴の行を見つけられませんでした。「読み取り範囲」で履歴一覧の位置を調整してください。",
      );
    const fullHeight = Math.max(...bands.map((b) => b.bottom - b.top));
    const complete = bands.filter((b) => b.bottom - b.top >= fullHeight * 0.88);
    onProgress("文字認識を準備しています。初回は少し時間がかかります…");
    const { createWorker, PSM } = await import("tesseract.js");
    if (this.cancelled) throw Error("読み取りを中止しました。");
    const worker = await createWorker(["jpn", "eng"], 1, {
      workerPath: `${import.meta.env.BASE_URL}ocr/worker.min.js`,
      corePath: `${import.meta.env.BASE_URL}ocr/core`,
      langPath: `${import.meta.env.BASE_URL}ocr/lang`,
      logger: (m) => {
        if (m.status === "loading language traineddata")
          onProgress(
            `文字認識データを読み込み中… ${Math.round(m.progress * 100)}%`,
          );
      },
    });
    if (this.cancelled) {
      await worker.terminate();
      throw Error("読み取りを中止しました。");
    }
    this.worker = worker;
    const rows: Candidate[] = [];
    try {
      await worker.setParameters({
        tessedit_pageseg_mode: PSM.SINGLE_LINE,
        preserve_interword_spaces: "1",
        user_defined_dpi: "150",
      });
      for (let i = 0; i < complete.length; i++) {
        if (this.cancelled) throw Error("読み取りを中止しました。");
        onProgress(`${i + 1} / ${complete.length} 行目を読み取り中…`);
        const band = complete[i];
        const h = band.bottom - band.top,
          w = body.width;
        const row = crop(body, 0, band.top, w, h);
        const nameImage = clean(
          crop(row, w * 0.575, h * 0.055, w * 0.235, h * 0.34, 1.4),
        );
        const timeImage = clean(
          crop(row, w * 0.034, h * 0.65, w * 0.128, h * 0.31, 1.7),
        );
        const roleImage = clean(
          crop(row, w * 0.262, h * 0.32, w * 0.07, h * 0.36, 1.7),
        );
        const iconImage = crop(row, w * 0.197, h * 0.14, w * 0.071, h * 0.69);
        const score = shieldScore(
          iconImage
            .getContext("2d")!
            .getImageData(0, 0, iconImage.width, iconImage.height).data,
          iconImage.width,
          iconImage.height,
        );
        const roleResult = await worker.recognize(roleImage);
        const roleText = roleResult.data.text.replace(/\s/g, "");
        const role: Candidate["role"] = /攻/.test(roleText)
          ? "attack"
          : /防/.test(roleText)
            ? "defense"
            : score > 0.78
              ? "defense"
              : "unknown";
        const nameResult = await worker.recognize(nameImage);
        const timeResult = await worker.recognize(timeImage);
        const elapsed = parseElapsed(timeResult.data.text);
        const name = nameResult.data.text
          .trim()
          .replace(/^Lv\.?\s*\d+\s*/i, "")
          .replace(/[\r\n]/g, " ")
          .replace(
            /([\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}])\s+(?=[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}])/gu,
            "$1",
          )
          .trim();
        rows.push({
          id: uid(),
          name,
          rawName: name,
          playerId: "",
          minutes: elapsed?.minutes ?? null,
          precision: elapsed?.precision ?? "minute",
          role,
          selected: role === "defense",
          confidence: Math.min(
            nameResult.data.confidence,
            timeResult.data.confidence,
          ),
          thumbnail: crop(row, 0, 0, w, h, Math.min(1, 1000 / w)).toDataURL(
            "image/jpeg",
            0.85,
          ),
          rowKey: `${Math.round(band.top)}-${Math.round(band.bottom)}`,
          rawTime: timeResult.data.text.trim(),
        });
      }
    } finally {
      if (this.worker) {
        await this.worker.terminate();
        this.worker = null;
      }
    }
    return {
      rows,
      baseAt: capture.at,
      timeSource: capture.source,
      imageKey,
      skipped: bands.length - complete.length,
    };
  }
}
