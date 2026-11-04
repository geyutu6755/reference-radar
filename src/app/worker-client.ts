/**
 * Main-thread client for the analysis worker.
 *
 * Reliability contract (V1.1.2):
 * - Every request carries a correlation id, so a shared worker can never
 *   resolve one call with another call's result.
 * - A hung or crashed worker is terminated and the analysis is retried ONCE
 *   on the main thread — the user sees a result (or a real error), never an
 *   endless spinner.
 */
import type { AnalysisResult, StandardVersion } from "../core/types";

export interface AnalyzeParams {
  kind: "docx" | "text";
  bytes?: Uint8Array;
  text?: string;
  fileName: string;
  version: StandardVersion;
}

/** Generous: the 1200-paragraph stress corpus analyzes in ~200 ms. */
const WORKER_TIMEOUT_MS = 120_000;

let worker: Worker | null = null;
let workerHealthy = true;
let seq = 0;

function getWorker(): Worker | null {
  if (!workerHealthy) return null;
  if (worker) return worker;
  try {
    worker = new Worker(new URL("./analysis-worker.ts", import.meta.url), { type: "module" });
  } catch {
    worker = null;
    workerHealthy = false;
  }
  return worker;
}

async function analyzeOnMainThread(params: AnalyzeParams): Promise<AnalysisResult> {
  const { analyzeDocx } = await import("../core/pipeline");
  const { analyzeText } = await import("../core/text-analysis");
  return params.kind === "docx"
    ? analyzeDocx(params.bytes!, params.fileName, { version: params.version })
    : analyzeText(params.text!, params.fileName, { version: params.version });
}

export async function analyze(params: AnalyzeParams): Promise<AnalysisResult> {
  const w = getWorker();
  if (!w) return analyzeOnMainThread(params);
  const id = ++seq;
  try {
    return await Promise.race([
      askWorker(w, params, id),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`worker timeout after ${WORKER_TIMEOUT_MS} ms`)), WORKER_TIMEOUT_MS)
      ),
    ]);
  } catch {
    // One retry on the main thread: real analysis, real error — never a stuck UI.
    terminateWorker();
    return analyzeOnMainThread(params);
  }
}

function askWorker(w: Worker, params: AnalyzeParams, id: number): Promise<AnalysisResult> {
  return new Promise<AnalysisResult>((resolve, reject) => {
    const onMessage = (e: MessageEvent): void => {
      const data = e.data as {
        id?: number;
        ok: boolean;
        result?: AnalysisResult;
        error?: { message: string; code?: string; name?: string };
      };
      if (data.id !== undefined && data.id !== id) return; // another call's reply
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
    w.postMessage({ ...params, id });
  });
}

export function terminateWorker(): void {
  worker?.terminate();
  worker = null;
}
