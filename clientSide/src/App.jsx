import { useState, useRef, useEffect } from "react";
import "./App.css";

const API = "http://localhost:3001";

const fmt = (s) => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
    : `${m}:${String(sec).padStart(2, "0")}`;
};

function Logo({ size = 30 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="8" style={{ fill: "var(--ink)" }} />
      <rect x="6" y="11" width="5" height="10" rx="1.5" fill="#fff" opacity=".5" />
      <rect x="13.5" y="11" width="5" height="10" rx="1.5" fill="#fff" opacity=".78" />
      <rect x="21" y="11" width="5" height="10" rx="1.5" fill="#fff" />
      <rect x="15.4" y="5.5" width="1.8" height="21" rx=".9" style={{ fill: "var(--playhead)" }} />
    </svg>
  );
}

const SAMPLE_HUES = [212, 168, 262, 28, 190, 330, 96, 232];

const FEATURES = [
  {
    title: "Exact timestamps",
    text: "Every image is labeled with its position in the video, so you can jump back to the moment it came from.",
  },
  {
    title: "Your interval",
    text: "Capture a frame every 2, 5, 10, or 30 seconds, depending on how fast the video changes.",
  },
  {
    title: "One-click download",
    text: "Get the whole set as a single ZIP, or open any frame full size to check the detail.",
  },
];

const STEPS = [
  { title: "Paste a link", text: "Any public YouTube video up to 30 minutes." },
  { title: "Choose an interval", text: "Pick how often Snapline should take a frame." },
  { title: "Download your frames", text: "Browse the timeline, then save everything as a ZIP." },
];

const FAQ = [
  {
    q: "Which videos work?",
    a: "Public YouTube videos up to 30 minutes long. Live streams aren't supported.",
  },
  {
    q: "What quality are the frames?",
    a: "Frames are captured at up to 720p as JPG images.",
  },
  {
    q: "How long are my frames kept?",
    a: "Frames are deleted from the server one hour after they're created, so download your ZIP before then.",
  },
  {
    q: "Can I use any video?",
    a: "Use Snapline with videos you own or have permission to use. Downloading YouTube content can go against YouTube's terms.",
  },
];

export default function App() {
  const [url, setUrl] = useState("");
  const [interval, setIntervalSec] = useState(5);
  const [job, setJob] = useState(null);
  const [error, setError] = useState("");
  const [active, setActive] = useState(null); // index of the frame open in the viewer
  const timer = useRef(null);
  const resultsRef = useRef(null);

  const frames = job?.frames ?? [];
  const processing = job?.status === "processing";
  const expected = job?.duration ? Math.floor(job.duration / interval) + 1 : null;
  const progress =
    expected && job?.framesSoFar ? Math.min(100, Math.round((job.framesSoFar / expected) * 100)) : 4;

  useEffect(() => () => clearInterval(timer.current), []);

  // Keyboard controls for the frame viewer
  useEffect(() => {
    if (active === null) return;
    const onKey = (e) => {
      if (e.key === "Escape") setActive(null);
      if (e.key === "ArrowRight") setActive((i) => Math.min(i + 1, frames.length - 1));
      if (e.key === "ArrowLeft") setActive((i) => Math.max(i - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, frames.length]);

  async function start() {
    setError("");
    setJob(null);
    setActive(null);
    clearInterval(timer.current);

    try {
      const res = await fetch(`${API}/api/jobs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), interval }),
      });
      const data = await res.json();
      if (!res.ok) return setError(data.error);

      setJob({ id: data.id, status: "processing", frames: [], framesSoFar: 0 });
      poll(data.id);
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
    } catch {
      setError("Can't reach the server. Check that the backend is running on port 3001.");
    }
  }

  function poll(id) {
    timer.current = setInterval(async () => {
      try {
        const res = await fetch(`${API}/api/jobs/${id}`);
        const data = await res.json();
        setJob(data);
        if (data.status !== "processing") clearInterval(timer.current);
      } catch {
        clearInterval(timer.current);
        setError("Lost connection to the server. Try again.");
      }
    }, 1500);
  }

  return (
    <div className="page">
      {/* ---------- Navigation ---------- */}
      <header className="nav">
        <div className="wrap nav-inner">
          <a className="brand" href="#top" aria-label="Snapline home">
            <Logo />
            <span>Snapline</span>
          </a>
          <nav className="nav-links" aria-label="Main">
            <a href="#features">Features</a>
            <a href="#how">How it works</a>
            <a href="#faq">FAQ</a>
          </nav>
          <a className="btn btn-small" href="#top">
            Try Snapline
          </a>
        </div>
      </header>

      <main id="top">
        {/* ---------- Hero ---------- */}
        <section className="hero wrap">
          <h1>Turn any YouTube video into a timeline of frames</h1>
          <p className="lede">
            Paste a link, choose an interval, and get a timestamped screenshot at every step.
            Download the whole set as a ZIP.
          </p>

          <div className="console">
            <form
              className="console-form"
              onSubmit={(e) => {
                e.preventDefault();
                if (url && !processing) start();
              }}
            >
              <label className="field field-url">
                <span>YouTube link</span>
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                  autoComplete="off"
                />
              </label>
              <label className="field field-interval">
                <span>Capture a frame</span>
                <select value={interval} onChange={(e) => setIntervalSec(Number(e.target.value))}>
                  <option value={2}>every 2 seconds</option>
                  <option value={5}>every 5 seconds</option>
                  <option value={10}>every 10 seconds</option>
                  <option value={30}>every 30 seconds</option>
                </select>
              </label>
              <button className="btn btn-primary" type="submit" disabled={!url || processing}>
                {processing ? "Capturing…" : "Capture frames"}
              </button>
            </form>

            {error && (
              <p className="notice notice-error" role="alert">
                {error}
              </p>
            )}

            {/* Sample timeline: shows the idea before any video is processed */}
            <div className="strip-wrap" aria-hidden="true">
              <div className="strip">
                {SAMPLE_HUES.map((h, i) => (
                  <div className="tile" style={{ "--h": h }} key={i} />
                ))}
                <div className="playhead sweep">
                  <span>0:25</span>
                </div>
              </div>
              <div className="ticks">
                {SAMPLE_HUES.map((_, i) => (
                  <span key={i}>{fmt(i * 5)}</span>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ---------- Results ---------- */}
        {(job || error === "") && job && (
          <section className="results wrap" ref={resultsRef} aria-live="polite">
            {processing && (
              <div className="progress-panel">
                <div className="progress-head">
                  <strong>{job.title ? job.title : "Reading the video…"}</strong>
                  <span>
                    {job.framesSoFar > 0
                      ? `${job.framesSoFar}${expected ? ` of about ${expected}` : ""} frames`
                      : "Getting ready"}
                  </span>
                </div>
                <div
                  className="bar"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={progress}
                >
                  <div className="bar-fill" style={{ width: `${progress}%` }} />
                </div>
                <p className="muted">Longer videos take a little longer. Keep this tab open.</p>
              </div>
            )}

            {job.status === "error" && (
              <p className="notice notice-error" role="alert">
                Couldn't capture this video: {job.error}
              </p>
            )}

            {job.status === "done" && (
              <>
                <div className="results-head">
                  <div>
                    <h2>{job.title}</h2>
                    <p className="muted">
                      {frames.length} frames, one every {job.interval} seconds
                    </p>
                  </div>
                  <a className="btn btn-primary" href={`${API}/api/jobs/${job.id}/zip`}>
                    Download ZIP
                  </a>
                </div>

                <div className="frames">
                  {frames.map((f, i) => (
                    <button
                      type="button"
                      className="frame"
                      key={f.url}
                      onClick={() => setActive(i)}
                      aria-label={`Open frame at ${fmt(f.time)}`}
                    >
                      <img src={`${API}${f.url}`} loading="lazy" alt="" />
                      <span className="stamp">
                        <i />
                        {fmt(f.time)}
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </section>
        )}

        {/* ---------- Features ---------- */}
        <section className="section wrap" id="features">
          <h2 className="section-title">Everything you need from a video, frame by frame</h2>
          <dl className="rows">
            {FEATURES.map((f) => (
              <div className="row" key={f.title}>
                <dt>{f.title}</dt>
                <dd>{f.text}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* ---------- How it works ---------- */}
        <section className="section wrap" id="how">
          <h2 className="section-title">How it works</h2>
          <ol className="steps">
            {STEPS.map((s, i) => (
              <li key={s.title}>
                <span className="step-dot">{i + 1}</span>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* ---------- FAQ ---------- */}
        <section className="section wrap faq" id="faq">
          <h2 className="section-title">Questions</h2>
          <div className="faq-list">
            {FAQ.map((item) => (
              <details key={item.q}>
                <summary>{item.q}</summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>
        </section>
      </main>

      {/* ---------- Footer ---------- */}
      <footer className="footer">
        <div className="wrap footer-inner">
          <a className="brand" href="#top" aria-label="Snapline home">
            <Logo size={24} />
            <span>Snapline</span>
          </a>
          <p>Use Snapline only with videos you own or have permission to use.</p>
        </div>
      </footer>

      {/* ---------- Frame viewer ---------- */}
      {active !== null && frames[active] && (
        <div className="viewer" role="dialog" aria-modal="true" aria-label="Frame viewer" onClick={() => setActive(null)}>
          <div className="viewer-inner" onClick={(e) => e.stopPropagation()}>
            <img src={`${API}${frames[active].url}`} alt={`Frame at ${fmt(frames[active].time)}`} />
            <div className="viewer-bar">
              <span className="stamp stamp-light">
                <i />
                {fmt(frames[active].time)}
              </span>
              <span className="viewer-count">
                {active + 1} of {frames.length}
              </span>
              <div className="viewer-actions">
                <button type="button" onClick={() => setActive((i) => Math.max(i - 1, 0))} disabled={active === 0}>
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => setActive((i) => Math.min(i + 1, frames.length - 1))}
                  disabled={active === frames.length - 1}
                >
                  Next
                </button>
                <button type="button" onClick={() => setActive(null)} autoFocus>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}