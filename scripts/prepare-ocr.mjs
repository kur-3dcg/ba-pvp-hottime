import { mkdir, copyFile, readdir } from "node:fs/promises";
import path from "node:path";
const root = process.cwd();
await mkdir(path.join(root, "public/ocr/core"), { recursive: true });
await mkdir(path.join(root, "public/ocr/lang"), { recursive: true });
await copyFile(
  path.join(root, "node_modules/tesseract.js/LICENSE.md"),
  path.join(root, "public/ocr/TESSERACT-LICENSE.txt"),
);
await copyFile(
  path.join(root, "node_modules/tesseract.js-core/LICENSE"),
  path.join(root, "public/ocr/TESSERACT-CORE-LICENSE.txt"),
);
await copyFile(
  path.join(root, "node_modules/tesseract.js/dist/worker.min.js"),
  path.join(root, "public/ocr/worker.min.js"),
);
for (const file of await readdir(
  path.join(root, "node_modules/tesseract.js-core"),
)) {
  if (/^tesseract-core.*lstm\.wasm(\.js)?$/.test(file))
    await copyFile(
      path.join(root, "node_modules/tesseract.js-core", file),
      path.join(root, "public/ocr/core", file),
    );
}
for (const lang of ["jpn", "eng"]) {
  const folder = path.join(
    root,
    `node_modules/@tesseract.js-data/${lang}/4.0.0_best_int`,
  );
  await copyFile(
    path.join(folder, `${lang}.traineddata.gz`),
    path.join(root, `public/ocr/lang/${lang}.traineddata.gz`),
  );
}
console.log(
  "OCR assets prepared (local worker, WASM and Japanese/English models).",
);
