import { useEffect, useState } from "react";
import { AppProvider, useApp } from "./AppContext";
import Home from "./Home";
import Workbench from "./Workbench";
import { registerServiceWorker, type SwUpdate } from "./sw-register";
import type { AnalysisResult } from "../core/types";

function SwBanner(): React.ReactNode {
  const { tr } = useApp();
  const [update, setUpdate] = useState<SwUpdate | null>(null);
  useEffect(() => {
    registerServiceWorker((u) => setUpdate(u));
  }, []);
  if (!update) return null;
  return (
    <button
      className="rr-btn rr-btn--primary rr-btn--sm"
      style={{ position: "fixed", right: 16, bottom: 16, zIndex: 50, boxShadow: "var(--rr-shadow-2)" }}
      onClick={() => {
        void update.apply();
        setUpdate(null);
      }}
    >
      {tr(update.key)}
    </button>
  );
}

export default function App(): React.ReactNode {
  const [session, setSession] = useState<{
    result: AnalysisResult;
    fileName: string;
    bytes?: Uint8Array;
  } | null>(null);

  return (
    <AppProvider>
      <SwBanner />
      {session === null ? (
        <Home onResult={(result, fileName, bytes) => setSession({ result, fileName, bytes })} />
      ) : (
        <Workbench
          key={`${session.fileName}-${session.result.analyzedAt}`}
          result={session.result}
          fileName={session.fileName}
          sourceBytes={session.bytes}
          onHome={() => setSession(null)}
          onResult={(result, fileName) => setSession((s) => ({ ...s!, result, fileName }))}
        />
      )}
    </AppProvider>
  );
}
