import { Router } from "express";
import fs from "fs";
import path from "path";
import { promisify } from "util";
import { exec } from "child_process";
import multer from "multer";
import unzipper from "unzipper";
import { authMiddleware } from "../middlewares/authMiddleware";

const execAsync = promisify(exec);
const router = Router();

const LFW_DIR = "/tmp/lfw_dataset";
const UPLOAD_TMP = "/tmp/lfw_upload.zip";

type State = "idle" | "extracting" | "ready" | "error";
let state: State = "idle";
let stateError = "";

// Persist across restarts if already extracted
if (fs.existsSync(LFW_DIR) && fs.readdirSync(LFW_DIR).some(f =>
  fs.statSync(path.join(LFW_DIR, f)).isDirectory()
)) {
  state = "ready";
}

const upload = multer({
  dest: "/tmp/",
  limits: { fileSize: 600 * 1024 * 1024 }, // 600 MB
});

function getPersons(): { personName: string; images: string[] }[] {
  if (!fs.existsSync(LFW_DIR)) return [];
  try {
    return fs.readdirSync(LFW_DIR)
      .filter(f => {
        try { return fs.statSync(path.join(LFW_DIR, f)).isDirectory(); } catch { return false; }
      })
      .map(p => ({
        personName: p.replace(/_/g, " "),
        images: fs.readdirSync(path.join(LFW_DIR, p))
          .filter(f => /\.(jpg|jpeg|png)$/i.test(f))
          .map(f => `${p}/${f}`)
      }))
      .filter(p => p.images.length > 0);
  } catch { return []; }
}

router.get("/lfw/status", authMiddleware, (_req, res) => {
  const persons = getPersons();
  res.json({
    state,
    error: stateError,
    totalPersons: persons.length,
    totalImages: persons.reduce((a, p) => a + p.images.length, 0),
    isReady: state === "ready" || persons.length > 0,
  });
});

// Upload endpoint — accepts a multipart zip/tgz from the client
router.post("/lfw/upload", authMiddleware, upload.single("file"), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: "No file uploaded" });
    return;
  }

  state = "extracting";
  stateError = "";
  res.json({ message: "File received, extracting..." });

  const tmpPath = req.file.path;
  const origName = req.file.originalname?.toLowerCase() ?? "";

  setImmediate(async () => {
    try {
      fs.mkdirSync(LFW_DIR, { recursive: true });

      if (origName.endsWith(".zip")) {
        // Use unzipper to extract — auto-strips one level if all files are in a common root dir
        await new Promise<void>((resolve, reject) => {
          fs.createReadStream(tmpPath)
            .pipe(unzipper.Parse())
            .on("entry", (entry: unzipper.Entry) => {
              const filePath: string = (entry as unknown as { path: string }).path;
              const parts = filePath.split("/");
              // Strip leading directory and handle both lfw/ and lfw-deepfunneled/ prefixes
              const stripped = parts.length > 2 ? parts.slice(2).join("/")
                : parts.length > 1 ? parts.slice(1).join("/")
                : filePath;

              const type = entry.type;
              if (!stripped || stripped.endsWith("/")) { entry.autodrain(); return; }

              if (type === "File" && /\.(jpg|jpeg|png)$/i.test(stripped)) {
                const dest = path.join(LFW_DIR, stripped);
                fs.mkdirSync(path.dirname(dest), { recursive: true });
                entry.pipe(fs.createWriteStream(dest));
              } else {
                entry.autodrain();
              }
            })
            .on("close", resolve)
            .on("error", reject);
        });
      } else if (origName.endsWith(".tgz") || origName.endsWith(".tar.gz") || origName.endsWith(".gz")) {
        await execAsync(`tar -xzf "${tmpPath}" -C "${LFW_DIR}" --strip-components=1`, { timeout: 300_000 });
      } else {
        throw new Error("Unsupported file format. Please upload a .zip or .tar.gz file.");
      }

      // Clean up temp upload file
      try { fs.unlinkSync(tmpPath); } catch { /* ignore */ }
      state = "ready";
    } catch (err) {
      state = "error";
      stateError = String(err);
      try { fs.unlinkSync(tmpPath); } catch { /* ignore */ }
    }
  });
});

// Serve image batches for client-side processing
router.get("/lfw/batch", authMiddleware, (req, res) => {
  const offset = parseInt(String(req.query.offset ?? "0"));
  const limit = parseInt(String(req.query.limit ?? "500"));
  const all = getPersons();
  res.json({ batch: all.slice(offset, offset + limit), total: all.length });
});

// Serve individual images
router.get("/lfw/image/:person/:filename", authMiddleware, (req, res) => {
  const safeName = (s: string) => path.basename(s).replace(/[^a-zA-Z0-9_\-\.]/g, "");
  const filePath = path.join(LFW_DIR, safeName(req.params.person), safeName(req.params.filename));
  if (!fs.existsSync(filePath)) { res.status(404).json({ error: "Not found" }); return; }
  res.sendFile(filePath);
});

// Clear dataset
router.delete("/lfw/reset", authMiddleware, (_req, res) => {
  try {
    if (fs.existsSync(LFW_DIR)) fs.rmSync(LFW_DIR, { recursive: true, force: true });
    state = "idle";
    stateError = "";
    res.json({ message: "Dataset cleared" });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
