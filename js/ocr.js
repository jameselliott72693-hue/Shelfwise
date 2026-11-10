const TESSERACT = "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.esm.min.js";

/** Lazy-loaded on-device OCR. The photo is not uploaded. */
export async function readReceiptImage(file, onProgress) {
  if (!file) throw new Error("Choose a photo first.");
  if (file.size > 12 * 1024 * 1024) throw new Error("That photo is over 12 MB. Try a smaller one.");
  onProgress?.("Downloading the on-phone reader…");
  const { createWorker } = await import(TESSERACT);
  onProgress?.("Reading the receipt on this phone…");
  const worker = await createWorker("eng", 1, {
    workerPath: "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/worker.min.js",
    corePath: "https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1/tesseract-core.wasm.js",
    langPath: "https://tessdata.projectnaptha.com/4.0.0",
  });
  try {
    const result = await worker.recognize(file);
    return result?.data?.text || "";
  } finally {
    await worker.terminate();
  }
}
