import { Router, type IRouter } from "express";
import { db, attendanceTable } from "@workspace/db";
import { eq, desc, and, sql } from "drizzle-orm";

const router: IRouter = Router();

router.get("/attendance", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const limit = parseInt(String(req.query.limit || "100"), 10);
    const { date, personName } = req.query;

    let conditions = [];
    if (date) {
      conditions.push(eq(attendanceTable.date, String(date)));
    }
    if (personName) {
      conditions.push(sql`${attendanceTable.personName} ILIKE ${"%" + personName + "%"}`);
    }

    const records = conditions.length > 0
      ? await db.select().from(attendanceTable).where(and(...conditions)).orderBy(desc(attendanceTable.checkInTime)).limit(limit)
      : await db.select().from(attendanceTable).orderBy(desc(attendanceTable.checkInTime)).limit(limit);

    res.json(records);
  } catch (err) {
    req.log.error({ err }, "Failed to list attendance");
    res.status(500).json({ error: "Failed to list attendance" });
  }
});

router.post("/attendance", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const { personName, faceId, status } = req.body;
    if (!personName || !status) {
      res.status(400).json({ error: "personName and status are required" });
      return;
    }

    const today = new Date().toISOString().split("T")[0];

    const [record] = await db
      .insert(attendanceTable)
      .values({
        personName,
        faceId: faceId || null,
        date: today,
        checkInTime: new Date(),
        status: status || "present",
        userId: req.user?.id || null,
      })
      .returning();
    res.status(201).json(record);
  } catch (err) {
    req.log.error({ err }, "Failed to mark attendance");
    res.status(500).json({ error: "Failed to mark attendance" });
  }
});

router.get("/attendance/export", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const { date } = req.query;

    const records = date
      ? await db.select().from(attendanceTable).where(eq(attendanceTable.date, String(date))).orderBy(desc(attendanceTable.checkInTime))
      : await db.select().from(attendanceTable).orderBy(desc(attendanceTable.checkInTime));

    const csvLines = [
      "ID,Person Name,Date,Check In,Status",
      ...records.map((r) =>
        [
          r.id,
          `"${r.personName}"`,
          r.date,
          new Date(r.checkInTime).toISOString(),
          r.status,
        ].join(",")
      ),
    ];

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="attendance-${date || "all"}.csv"`);
    res.send(csvLines.join("\n"));
  } catch (err) {
    req.log.error({ err }, "Failed to export attendance");
    res.status(500).json({ error: "Failed to export attendance" });
  }
});

export default router;
