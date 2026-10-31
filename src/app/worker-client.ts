/**
 * Main-thread client for the analysis worker, with a synchronous fallback
 * (e.g. when workers are unavailable in the test environment).
 */
import type { AnalysisResult, StandardVersion } from "../core/types";

export interface AnalyzeParams {
  kind: "docx" | "text";
  bytes?: Uint8Array;
  text?: string;
  fileName: string;
  version: StandardVersion;
}

let worker: Worker | null = null;

function getWorker(): Worker | null {
  if (worker) return worker;
  try {
    worker = new Worker(new URL("./analysis-worker.ts", import.meta.url), { type: "module" });
  } catch {
    worker = null;
  }
  return worker;
}

export async function analyze(params: AnalyzeParams): Promise<AnalysisResult> {
  const w = getWorker();
  if (!w) {
    // Fallback: run on the main thread (still a real analysis).
    const { analyzeDocx } = await import("../core/pipeline");
    const { analyzeText } = await import("../core/text-analysis");
    return params.kind === "docx"
      ? analyzeDocx(params.bytes!, params.fileName, { version: params.version })
      : analyzeText(params.text!, params.fileName, { version: params.version });
  }
  return new Promise<AnalysisResult>((resolve, reject) => {
    const onMessage = (e: MessageEvent): void => {
      const data = e.data as { ok: boolean; result?: AnalysisResult; error?: { message: string; code?: string; name?: string } };
      cleanup();
      if (data.ok && data.result) resolve(data.result);
      else {
        const err = new Error(data.error?.message ?? "analysis failed") as Error & { code?: string; name?: string };
        err.code = data.error?.code;
        err.name = data.error?.name ?? "AnalysisError";
        reject(err);
      }
    };
    const onError = (e: ErrorEvent): void => {
      cleanup();
      reject(new Error(e.message || "worker crashed"));
    };
    const cleanup = (): void => {
      w.removeEventListener("message", onMessage);
      w.removeEventListener("error", onError);
    };
    w.addEventListener("message", onMessage);
    w.addEventListener("error", onError);
    w.postMessage(params);
  });
}

export function terminateWorker(): void {
  worker?.terminate();
  worker = null;
}
