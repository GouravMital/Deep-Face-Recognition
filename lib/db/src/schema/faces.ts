import { pgTable, serial, text, doublePrecision, timestamp, integer, varchar, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./auth";

export const facesTable = pgTable("faces", {
  id: serial("id").primaryKey(),
  personName: text("person_name").notNull(),
  label: text("label").notNull(),
  descriptor: text("descriptor").notNull(),
  imageDataUrl: text("image_data_url"),
  registeredById: text("registered_by_id").references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const recognitionLogsTable = pgTable("recognition_logs", {
  id: serial("id").primaryKey(),
  faceId: integer("face_id").references(() => facesTable.id),
  personName: text("person_name").notNull(),
  confidence: doublePrecision("confidence").notNull(),
  imageDataUrl: text("image_data_url"),
  sessionId: text("session_id"),
  userId: text("user_id").references(() => usersTable.id),
  timestamp: timestamp("timestamp", { withTimezone: true }).defaultNow().notNull(),
});

export const attendanceTable = pgTable("attendance", {
  id: serial("id").primaryKey(),
  personName: text("person_name").notNull(),
  faceId: integer("face_id").references(() => facesTable.id),
  date: date("date").notNull(),
  checkInTime: timestamp("check_in_time", { withTimezone: true }).defaultNow().notNull(),
  checkOutTime: timestamp("check_out_time", { withTimezone: true }),
  status: varchar("status", { length: 20 }).notNull().default("present"),
  userId: text("user_id").references(() => usersTable.id),
});

export const insertFaceSchema = createInsertSchema(facesTable).omit({ id: true, createdAt: true });
export const insertRecognitionLogSchema = createInsertSchema(recognitionLogsTable).omit({ id: true, timestamp: true });
export const insertAttendanceSchema = createInsertSchema(attendanceTable).omit({ id: true });

export type InsertFace = z.infer<typeof insertFaceSchema>;
export type Face = typeof facesTable.$inferSelect;
export type InsertRecognitionLog = z.infer<typeof insertRecognitionLogSchema>;
export type RecognitionLog = typeof recognitionLogsTable.$inferSelect;
export type InsertAttendance = z.infer<typeof insertAttendanceSchema>;
export type Attendance = typeof attendanceTable.$inferSelect;
