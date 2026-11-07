import { useCallback, useRef, useState } from "react";
import { useApp } from "./AppContext";
import { useAnalysisRunner } from "./use-analysis";
import { buildSampleDocx, buildErrorSampleDocx, buildFormatSampleDocx, SAMPLE_FILE_NAME, SAMPLE_ERROR_FILE_NAME, SAMPLE_FORMAT_FILE_NAME } from "./sample-doc";
import type { AnalysisResult } from "../core/types";
import { GithubIcon, RadarLogo, ShieldIcon } from "./icons";

interface HomeProps {
  onResult: (r: AnalysisResult, fileName: string, bytes: Uint8Array | undefined) => void;
}

export default function Home({ onResult }: HomeProps): React.ReactNode {
  const { tr, locale, setLocale, theme, toggleTheme } = useApp();
  const { running, error, setError, run } = useAnalysisRunner();
  const [version, setVersion] = useState<"2015" | "2025">("2025");
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const finish = useCallback(
    async (p: Parameters<typeof run>[0]) => {
      const r = await run(p);
      if (r) onResult(r, p.fileName, p.bytes);
    },
    [run, onResult]
  );

  const onFiles = useCallback(
    (files: FileList | null) => {
      const f = files?.[0];
      if (!f) return;
      setError(null);
      void f.arrayBuffer().then((buf) =>
        finish({ kind: "docx", bytes: new Uint8Array(buf), fileName: f.name, version })
      );
    },
    [finish, setError, version]
  );

  const sample = useCallback(() => {
    setError(null);
    void finish({ kind: "docx", bytes: buildSampleDocx(), fileName: SAMPLE_FILE_NAME, version });
  }, [finish, setError, version]);

  const paste = useCallback(() => {
    if (!pasteText.trim()) return;
    setError(null);
    void finish({ kind: "text", text: pasteText, fileName: tr("home.paste"), version });
  }, [pasteText, finish, setError, tr, version]);

  return (
    <div className="rr-home">
      <nav className="rr-home__nav" aria-label="main">
        <a className="rr-brand" href="./" onClick={(e) => e.preventDefault()}>
          <RadarLogo className="rr-brand__logo" />
          <span>{tr("app.name")}</span>
          <span className="rr-brand__sub">Reference Radar</span>
        </a>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <select
            className="rr-select"
            aria-label={tr("workbench.versionLabel")}
            value={version}
            onChange={(e) => setVersion(e.target.value as "2015" | "2025")}
          >
            <option value="2025">GB/T 7714—2025（现行）</option>
            <option value="2015">GB/T 7714—2015</option>
          </select>
          <button className="rr-btn rr-btn--ghost rr-btn--sm" onClick={() => setLocale(locale === "zh-CN" ? "en" : "zh-CN")} aria-label="language">
            {locale === "zh-CN" ? "EN" : "中文"}
          </button>
          <button className="rr-btn rr-btn--ghost rr-btn--sm" onClick={toggleTheme} aria-label="theme">
            {theme === "dark" ? "☀" : "☾"}
          </button>
          <a
            className="rr-btn rr-btn--sm"
            href="https://github.com/geyutu6755/reference-radar"
            target="_blank"
            rel="noreferrer noopener"
          >
            <GithubIcon width={15} height={15} /> GitHub
          </a>
        </div>
      </nav>

      <main className="rr-home__main">
        <section className="rr-hero">
          <h1>{tr("home.heroTitle")}</h1>
          <p>{tr("home.heroBody")}</p>
          <div className="rr-hero__badges">
            <span className="rr-badge rr-badge--primary">GB/T 7714—2015 / 2025</span>
            <span className="rr-badge rr-badge--info">{tr("app.subtitle")}</span>
          </div>
        </section>

        <div
          className={`rr-uploader${dragging ? " rr-uploader--drag" : ""}`}
          role="button"
          tabIndex={0}
          aria-label={tr("home.drop")}
          onClick={() => fileInput.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") fileInput.current?.click();
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            onFiles(e.dataTransfer.files);
          }}
        >
          <div className="rr-uploader__title">{tr("home.drop")}</div>
          <div className="rr-uploader__hint">{tr("home.dropHint")} · {tr("home.limit")}</div>
          <input
            ref={fileInput}
            type="file"
            accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            style={{ display: "none" }}
            onChange={(e) => {
              onFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>

        {running && (
          <div className="rr-progress" role="status">
            {tr("workbench.analyzing")}
            <div className="rr-progress__bar">
              <i />
            </div>
          </div>
        )}

        {error && (
          <div className="rr-alert rr-alert--error" role="alert">
            {tr(error.key, error.params)}
          </div>
        )}

        <div className="rr-alt-actions">
          <button className="rr-btn" onClick={sample} disabled={running}>
            {tr("home.trySample")}
          </button>
          <button
            className="rr-btn"
            onClick={() => {
              setError(null);
              void finish({ kind: "docx", bytes: buildErrorSampleDocx(), fileName: SAMPLE_ERROR_FILE_NAME, version });
            }}
            disabled={running}
          >
            体验含错误示例
          </button>
          <button
            className="rr-btn"
            onClick={() => {
              setError(null);
              void finish({ kind: "docx", bytes: buildFormatSampleDocx(), fileName: SAMPLE_FORMAT_FILE_NAME, version });
            }}
            disabled={running}
          >
            体验格式修正示例
          </button>
          <button className="rr-btn" onClick={() => setPasteOpen((v) => !v)} disabled={running} aria-expanded={pasteOpen}>
            {tr("home.paste")}
          </button>
        </div>

        {pasteOpen && (
          <div className="rr-paste-panel">
            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder={tr("home.pastePlaceholder")}
              aria-label={tr("home.paste")}
            />
            <button className="rr-btn rr-btn--primary" onClick={paste} disabled={running || !pasteText.trim()}>
              {tr("home.pasteBtn")}
            </button>
          </div>
        )}

        <section className="rr-features" aria-label={tr("home.features")}>
          <div className="rr-feature">
            <h3>{tr("home.feature1Title")}</h3>
            <p>{tr("home.feature1Body")}</p>
          </div>
          <div className="rr-feature">
            <h3>{tr("home.feature2Title")}</h3>
            <p>{tr("home.feature2Body")}</p>
          </div>
          <div className="rr-feature">
            <h3>{tr("home.feature3Title")}</h3>
            <p>{tr("home.feature3Body")}</p>
          </div>
          <div className="rr-feature">
            <h3>{tr("home.feature4Title")}</h3>
            <p>{tr("home.feature4Body")}</p>
          </div>
        </section>

        <section className="rr-privacy">
          <ShieldIcon width={26} height={26} />
          <div>
            <h3>{tr("home.privacyTitle")}</h3>
            <p>{tr("home.privacyBody")}</p>
            <p style={{ margin: "8px 0 0" }}>
              <span className="rr-badge rr-badge--primary" style={{ verticalAlign: "middle" }}>PWA</span>{" "}
              {tr("pwa.installHint")}
            </p>
          </div>
        </section>
      </main>

      <footer className="rr-footer">
        <span>{tr("footer.madeWith")}</span>
        {" · "}
        <a href="https://github.com/geyutu6755/reference-radar" target="_blank" rel="noreferrer noopener">
          {tr("home.openSource")}
        </a>
      </footer>
    </div>
  );
}
