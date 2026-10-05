import { chromium } from "@playwright/test";
import { readdir, writeFile, mkdir } from "node:fs/promises";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
page.on("pageerror", (e) => console.log("PAGE ERROR:", e.message));
const results = [];
try {
  await page.goto("http://127.0.0.1:5173/");
  for (const name of (await readdir("sample")).filter((x) =>
    x.endsWith(".png"),
  )) {
    await page
      .locator("input[type=file]")
      .first()
      .setInputFiles(`sample/${name}`);
    const result = await page.evaluate(async () => {
      const { Scanner, DEFAULT_REGION } = await import("/src/ocr.ts");
      const file = document.querySelector("input[type=file]").files?.[0];
      return !!file;
    });
    // The app clears its file input; use the selected modal and its real OCR workflow.
    await page
      .getByRole("button", { name: "画像を読み取る", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "読み取り結果を確認" })
      .waitFor({ timeout: 180000 });
    const rows = await page.locator(".scan-row").evaluateAll((rs) =>
      rs.map((r) => ({
        role: r.querySelector("select").value,
        name: r.querySelector('input[placeholder="名前を確認"]')?.value,
        elapsed: r.querySelector("input[type=number]")?.value,
        unit: r.querySelector(".row-elapsed select")?.value,
        note: r.querySelector(".scan-row-note")?.textContent,
      })),
    );
    console.log(name, JSON.stringify(rows));
    results.push({ name, rows });
    await page.screenshot({
      path: `.runtime/ocr-${name.slice(-12, -4)}.png`,
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "閉じる", exact: true })
      .last()
      .click();
  }
  await mkdir(".runtime", { recursive: true });
  await writeFile(
    ".runtime/ocr-results.json",
    JSON.stringify(results, null, 2),
  );
} finally {
  await browser.close();
}
