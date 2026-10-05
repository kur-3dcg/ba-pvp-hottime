import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
});
const page = await context.newPage();
const errors = [];
const baseUrl = process.env.HOTTIME_TEST_URL || 'http://127.0.0.1:5173/';
page.on("pageerror", (e) => errors.push(e.message));
async function scan(name) {
  await page
    .locator("input[type=file]")
    .first()
    .setInputFiles(`sample/${name}`);
  await page
    .getByRole("button", { name: "画像を読み取る", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "読み取り結果を確認" })
    .waitFor({ timeout: 120000 });
}
async function data() {
  return page.evaluate(() =>
    JSON.parse(localStorage.getItem("ba-pvp-hottime.v1")),
  );
}
try {
  await page.goto(baseUrl);
  await scan("BlueArchive 2026-10-04 101805_1.png");
  assert.equal(await page.locator(".scan-row").count(), 3);
  assert(
    await page
      .getByText("画像に作成日時がないため、現在時刻を基準に記録します。", {
        exact: true,
      })
      .isVisible(),
  );
  await page.locator(".reference-time input").fill("2026-10-04T10:18");
  await page.getByRole("textbox", { name: "1行目の名前" }).fill("芹沢");
  await page.getByRole("textbox", { name: "2行目の名前" }).fill("芹沢");
  await page.getByRole("button", { name: "選択した防御を保存" }).click();
  let s = await data();
  assert.equal(s.records.length, 3);
  assert.equal(s.players.length, 2);
  assert.equal(s.corrections.length, 1);
  assert.equal(s.records[0].at, Date.parse("2026-10-03T16:18:00+09:00"));
  await scan("BlueArchive 2026-10-04 101805_1.png");
  assert.equal(
    await page
      .locator(".scan-row")
      .first()
      .locator("select")
      .nth(1)
      .inputValue(),
    s.players[0].id,
  );
  await page.getByRole("button", { name: "選択した防御を保存" }).click();
  assert.equal((await data()).records.length, 3);
  await scan("BlueArchive 2026-10-04 101810_1.png");
  assert.equal(
    await page.locator(".scan-row input[type=checkbox]:checked").count(),
    1,
  );
  await page.locator(".reference-time input").fill("");
  await page.getByRole("button", { name: "選択した防御を保存" }).click();
  assert(
    await page
      .locator(".modal-notice")
      .getByText("日時を入力してください。", { exact: true })
      .isVisible(),
  );
  await page.locator(".reference-time input").fill("2026-10-04T10:18");
  await page.getByRole("button", { name: "選択した防御を保存" }).click();
  s = await data();
  assert.equal(s.records.length, 4);
  assert.equal(s.players.length, 3);
  await page.getByRole("button", { name: "複数人比較", exact: true }).click();
  await page.getByRole("button", { name: "棒グラフ", exact: true }).click();
  assert.equal(await page.locator(".legend span").count(), 2);
  await page.getByRole("button", { name: /記録一覧/ }).click();
  await page.getByRole("button", { name: "スロウの記録を編集" }).click();
  await page.getByLabel("防御した日時（日本時間）").fill("2026-10-03T22:30");
  await page.getByRole("button", { name: "変更を保存", exact: true }).click();
  assert(
    (await data()).records.some(
      (r) => r.at === Date.parse("2026-10-03T22:30:00+09:00") && r.edited,
    ),
  );
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "バックアップ", exact: true }).click();
  const download = await downloadPromise;
  await download.saveAs(".runtime/backup.json");
  assert.equal(
    JSON.parse(await readFile(".runtime/backup.json", "utf8")).records.length,
    4,
  );
  const fresh = await browser.newContext();
  const restored = await fresh.newPage();
  await restored.goto(baseUrl);
  await restored
    .locator("input[type=file]")
    .nth(1)
    .setInputFiles(".runtime/backup.json");
  await restored.getByRole("button", { name: "取り込む", exact: true }).click();
  const imported = await restored.evaluate(() =>
    JSON.parse(localStorage.getItem("ba-pvp-hottime.v1")),
  );
  assert.equal(imported.records.length, 4);
  assert.equal(imported.corrections.length, 1);
  await fresh.close();
  // Cancellation must release the UI immediately, including initialization.
  await page
    .locator("input[type=file]")
    .first()
    .setInputFiles("sample/BlueArchive 2026-10-04 101801_1.png");
  await page
    .getByRole("button", { name: "画像を読み取る", exact: true })
    .click();
  await page.getByRole("button", { name: "中止", exact: true }).click();
  await page
    .getByRole("button", { name: "画像を読み取る", exact: true })
    .waitFor();
  await page.getByRole("button", { name: "閉じる", exact: true }).click();
  await page.screenshot({
    path: ".runtime/populated-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "散布図", exact: true }).click();
  await page.screenshot({
    path: ".runtime/populated-mobile.png",
    fullPage: true,
  });
  assert.deepEqual(errors, []);
  console.log(
    "PASS: real screenshot confirmation, missing metadata warning, corrected names, same-name grouping, duplicate suppression, attack exclusion, modal validation, comparison, record edit, backup export/restore, cancellation.",
  );
} finally {
  await browser.close();
}
