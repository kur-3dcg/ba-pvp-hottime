import { it, expect } from "vitest";
import { creationTime, metadataDate } from "../src/metadata";
function png(type: string, value: string) {
  const data = new TextEncoder().encode(value);
  const result = new Uint8Array(8 + 12 + data.length);
  result.set([137, 80, 78, 71, 13, 10, 26, 10]);
  new DataView(result.buffer).setUint32(8, data.length);
  result.set(new TextEncoder().encode(type), 12);
  result.set(data, 16);
  return new Blob([result]);
}
it("PNGの作成日時を読み、変更日時は採用しない", async () => {
  expect(
    await creationTime(
      png("tEXt", "Creation Time\u00002026-10-04T10:18:01+09:00"),
    ),
  ).toBe(Date.parse("2026-10-04T01:18:01Z"));
  expect(
    await creationTime(
      png("tEXt", "date:modify\u00002026-10-04T10:18:01+09:00"),
    ),
  ).toBeNull();
});
it("iTXtとEXIFのタイムゾーンを扱う", async () => {
  expect(
    await creationTime(
      png(
        "iTXt",
        "Creation Time\u0000\u0000\u0000\u0000\u00002026-10-04T10:18:01+09:00",
      ),
    ),
  ).toBe(Date.parse("2026-10-04T01:18:01Z"));
  expect(metadataDate("2026:10:04 10:18:01", "+02:00")).toBe(
    Date.parse("2026-10-04T08:18:01Z"),
  );
});
