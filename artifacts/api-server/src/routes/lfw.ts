import { Router } from "express";
import fs from "fs";
import path from "path";
import { createWriteStream } from "fs";
import { pipeline } from "stream/promises";
import { Readable } from "stream";
import { authMiddleware } from "../middlewares/authMiddleware";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);
const router = Router();

const LFW_DIR = "/tmp/lfw_dataset";
const LFW_TGZ = "/tmp/lfw.tgz";
const LFW_URL = "http://vis-www.cs.umass.edu/lfw/lfw.tgz";

type DownloadState = "idle" | "downloading" | "extracting" | "ready" | "error";
let downloadState: DownloadState = "idle";
let downloadError = "";

// Check if dataset already exists on startup
if (fs.existsSync(LFW_DIR) && fs.readdirSync(LFW_DIR).some(f => fs.statSync(path.join(LFW_DIR, f)).isDirectory())) {
  downloadState = "ready";
}

function getLFWPersons(): { personName: string; images: string[] }[] {
  if (!fs.existsSync(LFW_DIR)) return [];
  try {
    return fs.readdirSync(LFW_DIR)
      .filter(f => fs.statSync(path.join(LFW_DIR, f)).isDirectory())
      .map(p => ({
        personName: p.replace(/_/g, " "),
        images: fs.readdirSync(path.join(LFW_DIR, p))
          .filter(f => /\.(jpg|jpeg|png)$/i.test(f))
          .map(f => `${p}/${f}`)
      }))
      .filter(p => p.images.length > 0);
  } catch {
    return [];
  }
}

router.get("/lfw/status", authMiddleware, (_req, res) => {
  const persons = getLFWPersons();
  res.json({
    state: downloadState,
    error: downloadError,
    totalPersons: persons.length,
    totalImages: persons.reduce((acc, p) => acc + p.images.length, 0),
    isReady: downloadState === "ready" || persons.length > 0,
  });
});

router.post("/lfw/download", authMiddleware, async (req, res) => {
  if (downloadState === "downloading" || downloadState === "extracting") {
    res.json({ message: "Download already in progress" });
    return;
  }

  downloadState = "downloading";
  downloadError = "";
  res.json({ message: "Download started" });

  (async () => {
    try {
      // Use Node.js fetch to stream the file
      const response = await fetch(LFW_URL);
      if (!response.ok || !response.body) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const writer = createWriteStream(LFW_TGZ);
      // @ts-ignore — response.body is a Web ReadableStream, cast to node Readable
      await pipeline(Readable.fromWeb(response.body as Parameters<typeof Readable.fromWeb>[0]), writer);

      downloadState = "extracting";
      fs.mkdirSync(LFW_DIR, { recursive: true });
      await execAsync(`tar -xzf "${LFW_TGZ}" -C "${LFW_DIR}" --strip-components=1`, { timeout: 300_000 });

      downloadState = "ready";
    } catch (err) {
      downloadState = "error";
      downloadError = String(err);
      console.error("LFW download error:", err);
    }
  })();
});

router.get("/lfw/batch", authMiddleware, (req, res) => {
  const offset = parseInt(String(req.query.offset ?? "0"));
  const limit = parseInt(String(req.query.limit ?? "500"));
  const all = getLFWPersons();
  res.json({ batch: all.slice(offset, offset + limit), total: all.length, offset, limit });
});

router.get("/lfw/image/:person/:filename", authMiddleware, (req, res) => {
  const safe = (s: string) => path.basename(s).replace(/[^a-zA-Z0-9_\-\.]/g, "");
  const filePath = path.join(LFW_DIR, safe(req.params.person), safe(req.params.filename));
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: "Image not found" });
    return;
  }
  res.sendFile(filePath);
});

export default router;
