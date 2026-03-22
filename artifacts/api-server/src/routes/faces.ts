import { Router, type IRouter } from "express";
import { db, facesTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";

const router: IRouter = Router();

router.get("/faces", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const faces = await db.select().from(facesTable).orderBy(desc(facesTable.createdAt));
    res.json(faces);
  } catch (err) {
    req.log.error({ err }, "Failed to list faces");
    res.status(500).json({ error: "Failed to list faces" });
  }
});

router.post("/faces", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const { personName, label, descriptor, imageDataUrl } = req.body;
    if (!personName || !label || !descriptor) {
      res.status(400).json({ error: "personName, label, and descriptor are required" });
      return;
    }
    const [face] = await db
      .insert(facesTable)
      .values({
        personName,
        label,
        descriptor,
        imageDataUrl: imageDataUrl || null,
        registeredById: req.user?.id || null,
      })
      .returning();
    res.status(201).json(face);
  } catch (err) {
    req.log.error({ err }, "Failed to register face");
    res.status(500).json({ error: "Failed to register face" });
  }
});

router.delete("/faces/:id", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const id = parseInt(req.params.id, 10);
    await db.delete(facesTable).where(eq(facesTable.id, id));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to delete face");
    res.status(500).json({ error: "Failed to delete face" });
  }
});

export default router;
