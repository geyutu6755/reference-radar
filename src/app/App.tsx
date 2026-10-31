import { useState } from "react";
import { AppProvider } from "./AppContext";
import Home from "./Home";
import Workbench from "./Workbench";
import type { AnalysisResult } from "../core/types";

export default function App(): React.ReactNode {
  const [session, setSession] = useState<{
    result: AnalysisResult;
    fileName: string;
    bytes?: Uint8Array;
  } | null>(null);

  return (
    <AppProvider>
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
