import bundled from "./data/catalog.json";
import { normalize, type Student } from "./model";
export const SHEET = "1E6r9NWBgPiSVLHKktbvS9X58PRamE6gJKgiE7gp4xZQ";
const KEY = "ba-pvp-hottime.catalog.v1";
export function canonicalIconId(id: string | null) {
  return id === "st/hoshino_rinsen_a" || id === "st/hoshino_rinsen_d"
    ? "st/hoshino_rinsen"
    : id;
}
function prepareItems(items: Student[]): Student[] {
  const combined = new Map<string, Student>();
  for (const item of items) {
    const id = canonicalIconId(item.id)!;
    const next =
      id === "st/hoshino_rinsen"
        ? {
            ...item,
            id,
            name: "ホシノ（臨戦）",
            image:
              "https://raw.githubusercontent.com/kur-3dcg/blue-archive-faceimage/main/images/st/hoshino_rinsen.png",
            aliases: [...item.aliases, item.name, "ほしの（りんせん）"],
          }
        : item;
    const existing = combined.get(id);
    combined.set(
      id,
      existing
        ? {
            ...next,
            aliases: [...new Set([...existing.aliases, ...next.aliases])],
          }
        : next,
    );
  }
  return [...combined.values()].sort(
    (a, b) => a.name.localeCompare(b.name, "ja") || a.id.localeCompare(b.id),
  );
}
export function initialCatalog(): { items: Student[]; updatedAt: string } {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "null");
    if (
      raw &&
      Date.parse(raw.updatedAt) >= Date.parse(bundled.updatedAt) &&
      Array.isArray(raw.items) &&
      raw.items.length &&
      raw.items.every(
        (s: Student) =>
          typeof s.id === "string" &&
          typeof s.name === "string" &&
          /^https:\/\//.test(s.image) &&
          Array.isArray(s.aliases),
      )
    )
      return { ...raw, items: prepareItems(raw.items) };
  } catch {
    /* bundled snapshot remains available */
  }
  return { ...bundled, items: prepareItems(bundled.items) };
}
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quote = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quote && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else quote = !quote;
    } else if (c === "," && !quote) {
      row.push(cell);
      cell = "";
    } else if ((c === "\n" || c === "\r") && !quote) {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}
export function catalogRows(rows: string[][], group: string): Student[] {
  const header = rows[0]?.map((x) => x.replace(/^\uFEFF/, "").trim());
  const fields = [
    "image",
    "名前",
    "English",
    "한국어",
    "中文（繁）",
    "中文（简）",
    "よみ",
  ];
  if (!header || fields.some((h) => !header.includes(h)))
    throw Error(
      `${group}の列見出しが変更されています。必要な7列を確認してください。`,
    );
  return rows.slice(1).flatMap((row) => {
    const image = row[header.indexOf("image")]?.trim();
    const name = row[header.indexOf("名前")]?.trim();
    if (!name || !image) return [];
    if (!/^https:\/\//.test(image)) return [];
    return [
      {
        id: image
          .split("/")
          .slice(-2)
          .join("/")
          .replace(/\.png$/, ""),
        image,
        name,
        group,
        aliases: fields
          .slice(2)
          .map((f) => row[header.indexOf(f)]?.trim())
          .filter(Boolean),
      },
    ];
  });
}
export async function refreshCatalog() {
  const groups = [
    ["STRIKER", "0"],
    ["SPECIAL", "755609047"],
  ];
  const parts = await Promise.all(
    groups.map(async ([group, gid]) => {
      const res = await fetch(
        `https://docs.google.com/spreadsheets/d/${SHEET}/gviz/tq?tqx=out:csv&gid=${gid}`,
        { signal: AbortSignal.timeout(20000), credentials: "omit" },
      );
      if (!res.ok)
        throw Error(
          "アイコン一覧を取得できません。通信状態とシートの公開設定を確認してください。",
        );
      const items = catalogRows(parseCsv(await res.text()), group);
      if (!items.length)
        throw Error(`${group}のアイコン一覧が空です。更新を中止しました。`);
      return items;
    }),
  );
  const items = parts.flat();
  if (new Set(items.map((s) => s.id)).size !== items.length)
    throw Error("アイコン一覧に重複した画像があります。更新を中止しました。");
  const result = {
    items: prepareItems(items),
    updatedAt: new Date().toISOString(),
  };
  localStorage.setItem(KEY, JSON.stringify(result));
  return result;
}
export function matchesStudent(student: Student, q: string) {
  return [student.name, ...student.aliases].some((s) =>
    normalize(s).includes(normalize(q)),
  );
}
