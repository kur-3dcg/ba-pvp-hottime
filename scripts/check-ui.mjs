import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
await mkdir(".runtime", { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
try {
  await page.goto("http://127.0.0.1:5173/");
  await page
    .getByRole("heading", { name: "相手の動きが、見えてくる。" })
    .waitFor();
  await page.screenshot({ path: ".runtime/desktop-empty.png", fullPage: true });
  await page
    .getByRole("button", { name: "グラフの表示サンプルを見る" })
    .click();
  await page.screenshot({ path: ".runtime/desktop-demo.png", fullPage: true });
  await page.getByRole("button", { name: "棒グラフ", exact: true }).click();
  assert((await page.locator("svg rect").count()) > 10);
  await page.getByRole("button", { name: "自分の記録に戻る" }).click();
  await page.getByPlaceholder("相手のプレイヤー名").fill("テスト先生");
  await page.getByRole("spinbutton", { name: "何時間前" }).fill("2");
  assert(await page.getByRole("spinbutton", { name: "何分前" }).isDisabled());
  await page.getByRole("button", { name: "記録する", exact: true }).click();
  await page.getByRole("spinbutton", { name: "何分前" }).fill("12");
  await page.getByRole("button", { name: "記録する", exact: true }).click();
  let data = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("ba-pvp-hottime.v1")),
  );
  assert.equal(data.players.length, 1);
  assert.equal(data.records.length, 2);
  assert.equal(data.records[0].elapsedMinutes, 120);
  assert.equal(data.records[1].elapsedMinutes, 12);
  await page.reload();
  assert.equal(
    await page.getByRole("button", { name: "テスト先生を編集" }).count(),
    1,
  );
  await page.getByRole("button", { name: "テスト先生を編集" }).click();
  await page
    .getByRole("button", { name: "顔アイコンを選ぶ", exact: true })
    .click();
  await page.getByPlaceholder("例：ヒナ、ひな、Hina").fill("Hina");
  await page.getByRole("button", { name: "ヒナ ヒナ", exact: true }).click();
  await page.getByRole("button", { name: "変更を保存", exact: true }).click();
  await page.getByRole("textbox", { name: "プレイヤーを検索" }).fill("Hina");
  assert.equal(
    await page.getByRole("button", { name: "テスト先生を編集" }).count(),
    1,
  );
  await page.getByRole("button", { name: "検索をクリア" }).click();
  await page.getByRole("button", { name: /記録一覧/ }).click();
  await page
    .getByRole("button", { name: "テスト先生の記録を削除" })
    .first()
    .click();
  await page.getByRole("button", { name: "削除する", exact: true }).click();
  data = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("ba-pvp-hottime.v1")),
  );
  assert.equal(data.records.length, 1);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: ".runtime/mobile.png", fullPage: true });
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS: manual entry, hour/minute rules, persistence, icon selection/search, chart toggle, deletion, mobile layout; no page errors.",
  );
} finally {
  await browser.close();
}
