import { useCallback, useRef, useState } from "react";
import { type useApp } from "./AppContext";
import { analyze } from "./worker-client";
import type { AnalysisResult, StandardVersion } from "../core/types";
import { DocxLimitsError } from "../core/docx/limits";

export interface RunParams {
  kind: "docx" | "text";
  bytes?: Uint8Array;
  text?: string;
  fileName: string;
  version: StandardVersion;
}

/** Maps thrown errors to (messageKey, params) for UI display. */
export function errorToKey(err: unknown): { key: Parameters<ReturnType<typeof useApp>["tr"]>[0]; params?: Record<string, string> } {
  const e = err as Error & { code?: string };
  switch (e?.code) {
    case "empty-file":
      return { key: "error.emptyFile" };
    case "not-docx":
      return { key: "error.notDocx" };
    case "legacy-doc":
      return { key: "error.legacyDoc" };
    case "too-large":
    case "entry-too-large":
    case "total-too-large":
      return { key: "error.tooLarge" };
    case "encrypted":
      return { key: "error.encrypted" };
    case "corrupt-zip":
    case "zip-bomb":
      return { key: "error.corruptZip" };
    case "bad-entry-name":
      return { key: "error.badEntryName" };
    case "missing-document-xml":
      return { key: "error.missingDocumentXml" };
    case "xml-too-large":
      return { key: "error.xmlTooLarge" };
    default:
      return { key: "error.parseFailed", params: { message: e?.message ?? String(err) } };
  }
}

export interface AnalysisRunner {
  running: boolean;
  error: { key: Parameters<ReturnType<typeof useApp>["tr"]>[0]; params?: Record<string, string> } | null;
  setError: (e: null) => void;
  run: (params: RunParams) => Promise<AnalysisResult | null>;
}

export function useAnalysisRunner(): AnalysisRunner {
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<AnalysisRunner["error"]>(null);
  const seq = useRef(0);

  const run = useCallback(async (params: RunParams): Promise<AnalysisResult | null> => {
    const id = ++seq.current;
    setRunning(true);
    setError(null);
    try {
      const result = await analyze(params);
      if (id === seq.current) return result;
      return null;
    } catch (err) {
      if (id === seq.current) setError(errorToKey(err));
      return null;
    } finally {
      if (id === seq.current) setRunning(false);
    }
  }, []);

  return { running, error, setError, run };
}

export { DocxLimitsError };
