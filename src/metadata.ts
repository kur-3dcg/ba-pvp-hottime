import exifr from "exifr";
export type TimeSource = "metadata" | "filename" | "modified" | "current";
export const TIME_SOURCE_LABELS: Record<TimeSource, string> = {
  metadata: "画像内の日時",
  filename: "ファイル名",
  modified: "ファイル更新日時",
  current: "現在時刻",
};
export function filenameTime(name: string): number | null {
  // Only the known screenshot naming scheme is accepted; arbitrary numbers are not dates.
  const match =
    /^BlueArchive (\d{4})-(\d{2})-(\d{2}) (\d{2})(\d{2})(\d{2})(?:_\d+)?\.(?:png|jpe?g|webp)$/i.exec(
      name,
    );
  if (!match) return null;
  const [year, month, day, hour, minute, second] = match.slice(1).map(Number);
  if (
    year < 1970 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    hour > 23 ||
    minute > 59 ||
    second > 59
  )
    return null;
  const utc = Date.UTC(year, month - 1, day, hour, minute, second);
  const date = new Date(utc);
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  )
    return null;
  return utc - 9 * 3600000;
}
export function selectReferenceTime(
  metadata: number | null,
  file: { name: string; lastModified?: number },
  now: number,
): { at: number; source: TimeSource } {
  if (metadata !== null && Number.isFinite(metadata))
    return { at: metadata, source: "metadata" };
  const named = filenameTime(file.name);
  if (named !== null) return { at: named, source: "filename" };
  if (
    typeof file.lastModified === "number" &&
    Number.isFinite(file.lastModified) &&
    file.lastModified > 0 &&
    file.lastModified < 8640000000000000
  )
    return { at: file.lastModified, source: "modified" };
  return { at: now, source: "current" };
}
export async function referenceTime(file: File, now = Date.now()) {
  return selectReferenceTime(await creationTime(file), file, now);
}
export function metadataDate(value: unknown, offset?: unknown): number | null {
  if (value instanceof Date)
    return Number.isFinite(value.getTime()) ? value.getTime() : null;
  if (typeof value !== "string") return null;
  let s = value
    .trim()
    .replace(/^(\d{4}):(\d{2}):(\d{2})/, "$1-$2-$3")
    .replace(/^(\d{4}-\d{2}-\d{2}) /, "$1T");
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(s))
    s +=
      typeof offset === "string" && /^[+-]\d{2}:\d{2}$/.test(offset)
        ? offset
        : "+09:00";
  const n = Date.parse(s);
  return Number.isFinite(n) ? n : null;
}
export async function creationTime(file: Blob): Promise<number | null> {
  try {
    const tags = await exifr.parse(file, {
      tiff: true,
      exif: true,
      xmp: true,
      translateValues: false,
      reviveValues: false,
    });
    for (const key of [
      "DateTimeOriginal",
      "CreateDate",
      "DateTimeDigitized",
      "DateCreated",
      "CreationDate",
    ]) {
      const offset =
        key === "DateTimeOriginal"
          ? tags?.OffsetTimeOriginal
          : key === "CreateDate" || key === "DateTimeDigitized"
            ? tags?.OffsetTimeDigitized
            : tags?.OffsetTime;
      const n = metadataDate(tags?.[key], offset);
      if (n !== null) return n;
    }
  } catch {
    /* PNG textual metadata is handled below. */
  }
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  if (
    bytes.length < 8 ||
    bytes[0] !== 137 ||
    bytes[1] !== 80 ||
    bytes[2] !== 78 ||
    bytes[3] !== 71
  )
    return null;
  const view = new DataView(buf);
  const dec = new TextDecoder();
  let pos = 8;
  while (pos + 12 <= bytes.length) {
    const len = view.getUint32(pos);
    if (pos + 12 + len > bytes.length) break;
    const type = dec.decode(bytes.slice(pos + 4, pos + 8));
    const data = bytes.slice(pos + 8, pos + 8 + len);
    if (type === "tEXt" || type === "iTXt") {
      const zero = data.indexOf(0);
      if (zero > 0) {
        const key = dec.decode(data.slice(0, zero));
        let value = "";
        if (type === "tEXt") value = dec.decode(data.slice(zero + 1));
        else if (data[zero + 1] === 0) {
          let start = zero + 3;
          start = data.indexOf(0, start) + 1;
          if (start > 0) start = data.indexOf(0, start) + 1;
          if (start > 0) value = dec.decode(data.slice(start));
        }
        if (
          /^(creation time|date:create|creationdate|createdate|datetimeoriginal)$/i.test(
            key,
          )
        ) {
          const n = metadataDate(value);
          if (n !== null) return n;
        }
      }
    }
    pos += len + 12;
  }
  return null;
}
