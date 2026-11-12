import { Worker } from "node:worker_threads";
/** Parse untrusted PDFs off the worker's main thread with memory and time limits. */
export function pdfText(bytes: Uint8Array): Promise<{ text: string; total: number; truncated: boolean }> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(`
      const { parentPort, workerData } = require('node:worker_threads');
      (async () => {
        const { PDFParse } = await import('pdf-parse');
        const parser = new PDFParse({ data: new Uint8Array(workerData) });
        try { const result = await parser.getText({ first: 20 }); parentPort.postMessage({text:result.text.slice(0,25000),total:result.total,truncated:result.text.length>25000}); }
        finally { await parser.destroy(); }
      })().catch(() => process.exit(1));
    `, { eval: true, workerData: bytes, resourceLimits: { maxOldGenerationSizeMb: 128, maxYoungGenerationSizeMb: 32 } });
    const timer = setTimeout(() => { void worker.terminate(); reject(new Error("PDF extraction deadline exceeded")); }, 20000);
    worker.once("message", (result) => { clearTimeout(timer); void worker.terminate(); resolve(result); });
    worker.once("error", () => { clearTimeout(timer); reject(new Error("PDF extraction failed")); });
    worker.once("exit", (code) => { clearTimeout(timer); if (code !== 0) reject(new Error("PDF extraction failed")); });
  });
}
