import { Router } from "express";
import authRoutes from "./auth.routes";
import subjectRoutes from "./subject.routes";
import batchRoutes from "./batch.routes";
import timetableRoutes from "./timetable.routes";
import studentRoutes from "./student.routes";

const router = Router();

// Mount routes
router.use("/auth", authRoutes);
router.use("/subjects", subjectRoutes);
router.use("/batches", batchRoutes);
router.use("/timetable", timetableRoutes);
router.use("/students", studentRoutes);

export default router;
