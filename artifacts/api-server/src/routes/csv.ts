import { Router, type IRouter } from "express";
import { db, facesTable } from "@workspace/db";

const router: IRouter = Router();

router.post("/csv/import", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const { csvContent, hasHeader = true } = req.body;
    if (!csvContent) {
      res.status(400).json({ error: "csvContent is required" });
      return;
    }

    const lines = String(csvContent).split("\n").filter((l) => l.trim());
    const dataLines = hasHeader ? lines.slice(1) : lines;

    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const line of dataLines) {
      const cols = line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
      const personName = cols[0];
      const label = cols[1] || personName;

      if (!personName) {
        skipped++;
        continue;
      }

      try {
        await db.insert(facesTable).values({
          personName,
          label,
          descriptor: "[]",
          registeredById: req.user?.id || null,
        });
        imported++;
      } catch (err) {
        errors.push(`Row "${personName}": ${String(err)}`);
        skipped++;
      }
    }

    res.json({ imported, skipped, errors });
  } catch (err) {
    req.log.error({ err }, "Failed to import CSV");
    res.status(500).json({ error: "Failed to import CSV" });
  }
});

export default router;
