import { Router, type IRouter } from "express";
import { db, facesTable, recognitionLogsTable, attendanceTable } from "@workspace/db";
import { desc, sql } from "drizzle-orm";

const router: IRouter = Router();

function euclideanDistance(a: number[], b: number[]): number {
  if (a.length !== b.length) return Infinity;
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += (a[i] - b[i]) ** 2;
  }
  return Math.sqrt(sum);
}

function distanceToConfidence(distance: number): number {
  return Math.max(0, Math.min(100, (1 - distance / 1.0) * 100));
}

router.post("/recognition/identify", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const { descriptor } = req.body;
    if (!descriptor) {
      res.status(400).json({ error: "descriptor is required" });
      return;
    }

    let inputDesc: number[];
    try {
      inputDesc = JSON.parse(descriptor);
    } catch {
      res.status(400).json({ error: "descriptor must be a valid JSON array" });
      return;
    }

    const allFaces = await db.select().from(facesTable);

    if (allFaces.length === 0) {
      res.json({ matches: [], recognized: false });
      return;
    }

    const RECOGNITION_THRESHOLD = 0.6;

    const distances = allFaces
      .map((face) => {
        let storedDesc: number[];
        try {
          storedDesc = JSON.parse(face.descriptor);
        } catch {
          return null;
        }
        const distance = euclideanDistance(inputDesc, storedDesc);
        const confidence = distanceToConfidence(distance);
        return {
          faceId: face.id,
          personName: face.personName,
          label: face.label,
          distance,
          confidence,
        };
      })
      .filter(Boolean)
      .sort((a, b) => a!.distance - b!.distance);

    const matches = distances
      .filter((d) => d!.distance < RECOGNITION_THRESHOLD)
      .slice(0, 3) as {
      faceId: number;
      personName: string;
      label: string;
      distance: number;
      confidence: number;
    }[];

    res.json({
      matches,
      recognized: matches.length > 0,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to identify face");
    res.status(500).json({ error: "Failed to identify face" });
  }
});

router.get("/recognition/log", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const limit = parseInt(String(req.query.limit || "50"), 10);
    const offset = parseInt(String(req.query.offset || "0"), 10);
    const logs = await db
      .select()
      .from(recognitionLogsTable)
      .orderBy(desc(recognitionLogsTable.timestamp))
      .limit(limit)
      .offset(offset);
    res.json(logs);
  } catch (err) {
    req.log.error({ err }, "Failed to list recognition logs");
    res.status(500).json({ error: "Failed to list recognition logs" });
  }
});

router.post("/recognition/log", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const { faceId, personName, confidence, imageDataUrl, sessionId } = req.body;
    if (!personName || confidence === undefined) {
      res.status(400).json({ error: "personName and confidence are required" });
      return;
    }
    const [log] = await db
      .insert(recognitionLogsTable)
      .values({
        faceId: faceId || null,
        personName,
        confidence,
        imageDataUrl: imageDataUrl || null,
        sessionId: sessionId || null,
        userId: req.user?.id || null,
      })
      .returning();
    res.status(201).json(log);
  } catch (err) {
    req.log.error({ err }, "Failed to create recognition log");
    res.status(500).json({ error: "Failed to create recognition log" });
  }
});

router.get("/stats", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const [facesCount] = await db.select({ count: sql<number>`count(*)::int` }).from(facesTable);
    const [logsCount] = await db.select({ count: sql<number>`count(*)::int` }).from(recognitionLogsTable);
    const [attendanceCount] = await db.select({ count: sql<number>`count(*)::int` }).from(attendanceTable);

    const recentRecognitions = await db
      .select()
      .from(recognitionLogsTable)
      .orderBy(desc(recognitionLogsTable.timestamp))
      .limit(10);

    res.json({
      totalFaces: facesCount.count,
      totalRecognitions: logsCount.count,
      totalAttendance: attendanceCount.count,
      recentRecognitions,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get stats");
    res.status(500).json({ error: "Failed to get stats" });
  }
});

export default router;
