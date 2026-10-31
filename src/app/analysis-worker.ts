/**
 * Analysis Web Worker: keeps parsing + rule checking off the main thread.
 */
import { analyzeDocx } from "../core/pipeline";
import { analyzeText } from "../core/text-analysis";
import type { AnalysisResult, StandardVersion } from "../core/types";

export interface AnalyzeRequest {
  kind: "docx" | "text";
  bytes?: Uint8Array;
  text?: string;
  fileName: string;
  version: StandardVersion;
}

export interface AnalyzeResponse {
  ok: boolean;
  result?: AnalysisResult;
  error?: { message: string; code?: string; name?: string };
}

self.onmessage = (e: MessageEvent<AnalyzeRequest>): void => {
  const req = e.data;
  try {
    const result =
      req.kind === "docx"
        ? analyzeDocx(req.bytes!, req.fileName, { version: req.version })
        : analyzeText(req.text!, req.fileName, { version: req.version });
    const resp: AnalyzeResponse = { ok: true, result };
    (self as unknown as Worker).postMessage(resp);
  } catch (err) {
    const error = err as Error & { code?: string };
    const resp: AnalyzeResponse = {
      ok: false,
      error: { message: error.message ?? String(err), code: error.code, name: error.name },
    };
    (self as unknown as Worker).postMessage(resp);
  }
};
