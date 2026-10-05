import { describe, it, expect } from "vitest";
import {
  parseElapsed,
  manualElapsed,
  dateKey,
  hourOf,
  hotTime,
  validateStore,
  mergeStores,
  type Store,
} from "../src/model";
import { parseCsv, catalogRows } from "../src/catalog";
import { metadataDate } from "../src/metadata";
describe("防御の時刻計算", () => {
  it("1時間以上の分を無視し、分・時間・日を解析する", () => {
    expect(manualElapsed(2, 45)).toEqual({ minutes: 120, precision: "hour" });
    expect(manualElapsed(0, 45).minutes).toBe(45);
    expect(parseElapsed("１９ 時間前")).toEqual({
      minutes: 1140,
      precision: "hour",
    });
    expect(parseElapsed("12分前")?.minutes).toBe(12);
    expect(parseElapsed("1日前")?.minutes).toBe(1440);
    expect(parseElapsed("???")).toBeNull();
    expect(() => manualElapsed(24, 0)).toThrow();
  });
  it("日付境界とタイムゾーンを日本時間で統一する", () => {
    const at = Date.parse("2026-10-03T15:15:00Z");
    expect(dateKey(at)).toBe("2026-10-04");
    expect(hourOf(at)).toBe(0);
    expect(metadataDate("2026:10:04 10:18:01")).toBe(
      Date.parse("2026-10-04T01:18:01Z"),
    );
    expect(metadataDate("bad")).toBeNull();
  });
});
describe("バックアップの整合性", () => {
  const s: Store = {
    version: 1,
    players: [{ id: "p", name: "a", iconId: null }],
    records: [
      {
        id: "r",
        playerId: "p",
        at: 0,
        baseAt: 3600000,
        elapsedMinutes: 60,
        precision: "hour",
        source: "manual",
      },
    ],
  };
  it("外部参照・重複IDを拒否する", () => {
    expect(() =>
      validateStore({
        ...s,
        records: [{ ...s.records[0], playerId: "missing" }],
      }),
    ).toThrow();
    expect(() =>
      validateStore({ ...s, records: [...s.records, ...s.records] }),
    ).toThrow();
    expect(mergeStores(s, s).records).toHaveLength(1);
  });
  it("同率ホットタイムはすべて表示する", () => {
    expect(hotTime(s.records)).toBe("データ不足");
    expect(
      hotTime([...s.records, { ...s.records[0], id: "r2", at: 3600000 }]),
    ).toBe("9時台・10時台");
  });
});
describe("アイコンマスター", () => {
  it("改行・引用符を含むCSVと列順の変更に対応する", () => {
    expect(parseCsv('a,b\r\n"x,y","z""q"')).toEqual([
      ["a", "b"],
      ["x,y", 'z"q'],
    ]);
    const rows = [
      [
        "名前",
        "image",
        "よみ",
        "English",
        "한국어",
        "中文（繁）",
        "中文（简）",
      ],
      ["ヒナ", "https://example.org/st/hina.png", "ひな", "Hina", "", "", ""],
    ];
    expect(catalogRows(rows, "STRIKER")[0].aliases).toContain("ひな");
    expect(() => catalogRows([["名前"]], "STRIKER")).toThrow();
  });
});
