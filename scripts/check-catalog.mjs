import { chromium } from "@playwright/test";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage();
page.on("requestfailed", (req) =>
  console.log("FAILED", new URL(req.url()).hostname, req.failure()?.errorText),
);
try {
  await page.goto("http://127.0.0.1:5173/");
  await page
    .getByRole("button", { name: "アイコン一覧を更新", exact: true })
    .click();
  await page.getByRole("status").waitFor({ timeout: 30000 });
  const text = await page.getByRole("status").textContent();
  console.log(text);
  if (!text.includes("更新しました")) process.exitCode = 1;
} finally {
  await browser.close();
}
