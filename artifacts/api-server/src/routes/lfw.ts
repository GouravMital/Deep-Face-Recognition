import { Router, type Request, type Response } from "express";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";
import { authMiddleware } from "../middlewares/authMiddleware";

const execAsync = promisify(exec);
const router = Router();

const LFW_DIR = "/tmp/lfw_dataset";
const LFW_URL = "http://vis-www.cs.umass.edu/lfw/lfw.tgz";
const LFW_TGZ = "/tmp/lfw.tgz";

let downloadState: "idle" | "downloading" | "extracting" | "ready" | "error" = "idle";
let downloadProgress = 0;
let downloadError = "";
let totalPersons = 0;
let totalImages = 0;

function getLFWPersons(): { personName: string; images: string[] }[] {
  if (!fs.existsSync(LFW_DIR)) return [];
  const persons = fs.readdirSync(LFW_DIR).filter(f => {
    return fs.statSync(path.join(LFW_DIR, f)).isDirectory();
  });
  return persons.map(p => ({
    personName: p.replace(/_/g, " "),
    images: fs.readdirSync(path.join(LFW_DIR, p))
      .filter(f => f.match(/\.(jpg|jpeg|png)$/i))
      .map(f => `${p}/${f}`)
  })).filter(p => p.images.length > 0);
}

router.get("/lfw/status", authMiddleware, (req, res) => {
  const persons = getLFWPersons();
  res.json({
    state: downloadState,
    progress: downloadProgress,
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
  downloadProgress = 0;
  downloadError = "";
  res.json({ message: "Download started" });

  (async () => {
    try {
      await execAsync(
        `wget -q --show-progress -O ${LFW_TGZ} ${LFW_URL} 2>&1 || curl -L --progress-bar -o ${LFW_TGZ} ${LFW_URL}`,
        { timeout: 600_000 }
      );
      downloadState = "extracting";
      downloadProgress = 50;

      fs.mkdirSync(LFW_DIR, { recursive: true });
      await execAsync(`tar -xzf ${LFW_TGZ} -C ${LFW_DIR} --strip-components=1`, { timeout: 120_000 });
      downloadProgress = 100;
      downloadState = "ready";
    } catch (err) {
      downloadState = "error";
      downloadError = String(err);
    }
  })();
});

router.get("/lfw/persons", authMiddleware, (req, res) => {
  const persons = getLFWPersons();
  res.json({ persons, total: persons.length });
});

router.get("/lfw/batch", authMiddleware, (req, res) => {
  const offset = parseInt(String(req.query.offset ?? "0"));
  const limit = parseInt(String(req.query.limit ?? "50"));
  const all = getLFWPersons();
  const batch = all.slice(offset, offset + limit);
  res.json({ batch, total: all.length, offset, limit });
});

router.get("/lfw/image/:person/:filename", authMiddleware, (req, res) => {
  const { person, filename } = req.params;
  const safe = (s: string) => s.replace(/[^a-zA-Z0-9_\-\.]/g, "");
  const filePath = path.join(LFW_DIR, safe(person), safe(filename));
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: "Image not found" });
    return;
  }
  res.sendFile(filePath);
});

export default router;
