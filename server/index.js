import express from "express";
import cors from "cors";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import ffmpegPath from "ffmpeg-static";
import youtubedl from "youtube-dl-exec";
import archiver from "archiver";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FRAMES_DIR = path.join(__dirname, "frames");
const PORT = 3001;
const MAX_DURATION = 30 * 60; // reject videos longer than 30 min
const MAX_CONCURRENT = 2;     // ffmpeg is CPU heavy
const KEEP_MS = 60 * 60 * 1000; // delete jobs after 1 hour

fs.mkdirSync(FRAMES_DIR, { recursive: true });

const app = express();
app.use(cors());
app.use(express.json());
app.use("/frames", express.static(FRAMES_DIR));

const jobs = new Map();

function isYouTubeUrl(u) {
  try {
    const host = new URL(u).hostname.replace(/^www\./, "");
    return ["youtube.com", "m.youtube.com", "youtu.be"].includes(host);
  } catch {
    return false;
  }
}

function listFrames(id) {
  const dir = path.join(FRAMES_DIR, id);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith(".jpg")).sort();
}

// ---------- Routes ----------

app.post("/api/jobs", (req, res) => {
  const { url } = req.body;
  const interval = Math.min(Math.max(Number(req.body.interval) || 5, 1), 60);

  if (!isYouTubeUrl(url)) {
    return res.status(400).json({ error: "Please enter a valid YouTube link." });
  }

  const running = [...jobs.values()].filter((j) => j.status === "processing").length;
  if (running >= MAX_CONCURRENT) {
    return res.status(429).json({ error: "Server is busy. Try again in a minute." });
  }

  const id = randomUUID();
  jobs.set(id, {
    id,
    url,
    interval,
    status: "processing",
    title: null,
    duration: null,
    frames: [],
    framesSoFar: 0,
    error: null,
    createdAt: Date.now(),
  });

  processJob(id).catch(() => {});
  res.json({ id });
});

app.get("/api/jobs/:id", (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).json({ error: "Job not found." });

  if (job.status === "processing") {
    job.framesSoFar = listFrames(job.id).length;
  }
  res.json(job);
});

app.get("/api/jobs/:id/zip", (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job || job.status !== "done") return res.status(404).end();

  res.attachment(`frames-${job.id.slice(0, 8)}.zip`);
  const archive = archiver("zip", { zlib: { level: 1 } });
  archive.on("error", () => res.status(500).end());
  archive.pipe(res);
  archive.directory(path.join(FRAMES_DIR, job.id), false);
  archive.finalize();
});

// ---------- Processing ----------

function runFfmpeg(streamUrl, dir, interval) {
  return new Promise((resolve, reject) => {
    const ff = spawn(ffmpegPath, [
      "-y",
      "-reconnect", "1",
      "-reconnect_streamed", "1",
      "-reconnect_delay_max", "5",
      "-i", streamUrl,
      "-an",                          // skip audio, faster
      "-vf", `fps=1/${interval}`,     // one frame every N seconds
      "-q:v", "3",                    // JPEG quality (2 = best, 31 = worst)
      path.join(dir, "frame_%04d.jpg"),
    ]);

    let stderr = "";
    ff.stderr.on("data", (d) => (stderr = (stderr + d).slice(-2000)));
    ff.on("error", reject);
    ff.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error("ffmpeg failed: " + stderr.split("\n").slice(-3).join(" ")))
    );
  });
}

async function processJob(id) {
  const job = jobs.get(id);
  const dir = path.join(FRAMES_DIR, id);
  fs.mkdirSync(dir, { recursive: true });

  try {
    const info = await youtubedl(job.url, {
        dumpSingleJson: true,
        noPlaylist: true,
        noWarnings: true,
        jsRuntimes: "node",
        format: "bestvideo[height<=720][protocol^=https]/bestvideo[height<=720]/bestvideo",
      });

    if (info.is_live) throw new Error("Live streams are not supported.");
    if (info.duration > MAX_DURATION) {
      throw new Error(`Video is too long (max ${MAX_DURATION / 60} minutes).`);
    }
    if (!info.url) throw new Error("Could not get a direct stream for this video.");

    job.title = info.title;
    job.duration = info.duration;

    await runFfmpeg(info.url, dir, job.interval);

    job.frames = listFrames(id).map((f, i) => ({
      url: `/frames/${id}/${f}`,
      time: i * job.interval, // seconds into the video
    }));
    job.framesSoFar = job.frames.length;
    job.status = "done";
  } catch (e) {
    job.status = "error";
    job.error = e.message || "Something went wrong.";
  }
}

// ---------- Cleanup old jobs ----------

setInterval(() => {
  const now = Date.now();
  for (const [id, job] of jobs) {
    if (now - job.createdAt > KEEP_MS && job.status !== "processing") {
      fs.rmSync(path.join(FRAMES_DIR, id), { recursive: true, force: true });
      jobs.delete(id);
    }
  }
}, 10 * 60 * 1000);

app.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`));