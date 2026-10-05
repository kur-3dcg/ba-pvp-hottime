export type Precision = "minute" | "hour" | "day";
export interface Player {
  id: string;
  name: string;
  iconId: string | null;
}
export interface RecordEntry {
  id: string;
  playerId: string;
  at: number;
  baseAt: number;
  elapsedMinutes: number;
  precision: Precision;
  source: "manual" | "image";
  imageKey?: string;
  rowKey?: string;
  edited?: boolean;
}
export interface Store {
  version: 1;
  players: Player[];
  records: RecordEntry[];
  corrections?: { from: string; to: string }[];
}
export interface Student {
  id: string;
  image: string;
  name: string;
  aliases: string[];
  group: string;
}
export const EMPTY: Store = { version: 1, players: [], records: [] };
export const STORAGE_KEY = "ba-pvp-hottime.v1";
export const COLORS = [
  "#1687ed",
  "#f08b43",
  "#8564d8",
  "#29a6a1",
  "#df648c",
  "#91a338",
  "#4176a8",
  "#b27d58",
  "#7b859e",
  "#bf5ac3",
];
export const uid = () => crypto.randomUUID();
export const normalize = (s: string) =>
  s.normalize("NFKC").toLocaleLowerCase().replace(/\s+/g, "");
export function parseElapsed(
  raw: string,
): { minutes: number; precision: Precision } | null {
  const s = normalize(raw).replace(/[〇○]/g, "0");
  const day = s.match(/(\d+)日/);
  if (day) return { minutes: Number(day[1]) * 1440, precision: "day" };
  const hour = s.match(/(\d+)(?:時間|時聞|時問)/);
  if (hour) return { minutes: Number(hour[1]) * 60, precision: "hour" };
  const min = s.match(/(\d+)分/);
  if (min) return { minutes: Number(min[1]), precision: "minute" };
  if (/たった今|今すぐ/.test(s)) return { minutes: 0, precision: "minute" };
  return null;
}
export function manualElapsed(hours: number, minutes: number) {
  if (
    !Number.isInteger(hours) ||
    hours < 0 ||
    hours > 23 ||
    !Number.isInteger(minutes) ||
    minutes < 0 ||
    minutes > 59
  )
    throw Error("時間は0〜23、分は0〜59で入力してください。");
  return {
    minutes: hours > 0 ? hours * 60 : minutes,
    precision: (hours > 0 ? "hour" : "minute") as Precision,
  };
}
export const dateKey = (at: number) =>
  new Date(at + 9 * 3600000).toISOString().slice(0, 10);
export const hourOf = (at: number) => new Date(at + 9 * 3600000).getUTCHours();
export const minuteOf = (at: number) =>
  new Date(at + 9 * 3600000).getUTCMinutes();
export const inputDate = (at: number) =>
  new Date(at + 9 * 3600000).toISOString().slice(0, 16);
export function fromInput(value: string) {
  const n = Date.parse(value + ":00+09:00");
  if (!Number.isFinite(n)) throw Error("日時を入力してください。");
  return n;
}
export function fmt(at: number, date = true) {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    ...(date ? { month: "2-digit", day: "2-digit" } : {}),
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(at);
}
export const elapsedLabel = (n: number, p: Precision) =>
  p === "day"
    ? `${n / 1440}日前`
    : p === "hour"
      ? `${n / 60}時間前`
      : `${n}分前`;
export function hotTime(records: RecordEntry[]) {
  if (records.length < 2) return "データ不足";
  const bins = Array(24).fill(0);
  records.forEach((r) => bins[hourOf(r.at)]++);
  const max = Math.max(...bins);
  return bins.flatMap((n, i) => (n === max ? [`${i}時台`] : [])).join("・");
}
export function validateStore(data: unknown): Store {
  if (!data || typeof data !== "object")
    throw Error("バックアップの形式が正しくありません。");
  const d = data as Store;
  if (
    d.version !== 1 ||
    !Array.isArray(d.players) ||
    !Array.isArray(d.records) ||
    d.players.length > 20000 ||
    d.records.length > 200000
  )
    throw Error("対応していないバックアップ形式です。");
  const ids = new Set<string>();
  if (
    d.corrections !== undefined &&
    (!Array.isArray(d.corrections) ||
      d.corrections.length > 10000 ||
      d.corrections.some(
        (c) =>
          !c ||
          typeof c.from !== "string" ||
          typeof c.to !== "string" ||
          !c.from.trim() ||
          !c.to.trim() ||
          c.from.length > 100 ||
          c.to.length > 100,
      ))
  )
    throw Error("名前補正データが不正です。");
  for (const p of d.players) {
    if (
      !p ||
      typeof p.id !== "string" ||
      !p.id ||
      ids.has(p.id) ||
      typeof p.name !== "string" ||
      !p.name.trim() ||
      p.name.length > 100 ||
      (p.iconId !== null && typeof p.iconId !== "string")
    )
      throw Error("プレイヤーデータが不正です。");
    ids.add(p.id);
  }
  const recordIds = new Set<string>();
  for (const r of d.records) {
    if (
      !r ||
      typeof r.id !== "string" ||
      !r.id ||
      recordIds.has(r.id) ||
      (r.playerId !== "" && !ids.has(r.playerId)) ||
      !Number.isFinite(r.at) ||
      !Number.isFinite(r.baseAt) ||
      Math.abs(r.at) > 8640000000000000 ||
      Math.abs(r.baseAt) > 8640000000000000 ||
      !Number.isInteger(r.elapsedMinutes) ||
      r.elapsedMinutes < 0 ||
      !["minute", "hour", "day"].includes(r.precision) ||
      !["manual", "image"].includes(r.source) ||
      (r.imageKey !== undefined && typeof r.imageKey !== "string") ||
      (r.rowKey !== undefined && typeof r.rowKey !== "string") ||
      (r.edited !== undefined && typeof r.edited !== "boolean")
    )
      throw Error("記録データが不正です。");
    recordIds.add(r.id);
  }
  return {
    version: 1,
    players: d.players.map((p) => ({
      id: p.id,
      name: p.name,
      iconId: p.iconId,
    })),
    records: d.records.map((r) => ({
      id: r.id,
      playerId: r.playerId,
      at: r.at,
      baseAt: r.baseAt,
      elapsedMinutes: r.elapsedMinutes,
      precision: r.precision,
      source: r.source,
      ...(r.imageKey ? { imageKey: r.imageKey } : {}),
      ...(r.rowKey ? { rowKey: r.rowKey } : {}),
      ...(r.edited ? { edited: true } : {}),
    })),
    corrections: d.corrections ?? [],
  };
}
export function loadStore(): { store: Store; error: string | null } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return {
      store: raw ? validateStore(JSON.parse(raw)) : structuredClone(EMPTY),
      error: null,
    };
  } catch {
    return {
      store: structuredClone(EMPTY),
      error:
        "保存データを読み込めませんでした。既存データを保護するため、この画面では保存を停止しています。ブラウザーの保存設定を確認してください。",
    };
  }
}
export function saveStore(store: Store) {
  validateStore(store);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}
export function mergeStores(a: Store, b: Store): Store {
  return {
    version: 1,
    corrections: [
      ...(a.corrections ?? []),
      ...(b.corrections ?? []).filter(
        (c) => !a.corrections?.some((v) => v.from === c.from),
      ),
    ],
    players: [
      ...a.players,
      ...b.players.filter((p) => !a.players.some((q) => q.id === p.id)),
    ],
    records: [
      ...a.records,
      ...b.records.filter((r) => !a.records.some((q) => q.id === r.id)),
    ],
  };
}

/** Explicitly confirmed player merge: keep every event, retain the target identity. */
export function mergePlayers(
  store: Store,
  sourceId: string,
  targetId: string,
  sourceIcon?: string | null,
): Store {
  const source = store.players.find((p) => p.id === sourceId);
  const target = store.players.find((p) => p.id === targetId);
  if (!source || !target || sourceId === targetId)
    throw Error("統合するプレイヤーを確認してください。");
  const players = store.players
    .filter((p) => p.id !== sourceId)
    .map((p) =>
      p.id === targetId
        ? { ...p, iconId: p.iconId ?? sourceIcon ?? source.iconId }
        : p,
    );
  let corrections = [...(store.corrections ?? [])];
  if (
    source.name !== "匿名" &&
    source.name !== target.name &&
    !players.some((p) => p.name === source.name)
  ) {
    corrections = corrections
      .filter((c) => c.from !== source.name)
      .map((c) => (c.to === source.name ? { ...c, to: target.name } : c));
    corrections = corrections.filter((c) => c.from !== c.to);
  }
  return {
    ...store,
    players,
    corrections,
    records: store.records.map((r) =>
      r.playerId === sourceId ? { ...r, playerId: targetId } : r,
    ),
  };
}
