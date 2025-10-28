import { Router } from "express";
import authRoutes from "./auth.routes";
import subjectRoutes from "./subject.routes";
import batchRoutes from "./batch.routes";
import enrollmentRoutes from "./subjectEnrollment.routes";
import timetableRoutes from "./timetable.routes";
import studentRoutes from "./student.routes";
import attendanceRoutes from './attendance.routes'; 
import dashboardRoutes from './dashboard.routes'; 

const router = Router();

// Mount routes
router.use("/auth", authRoutes);
router.use("/subjects", subjectRoutes);
router.use("/batches", batchRoutes);
router.use("/enrollments", enrollmentRoutes); 
router.use("/timetable", timetableRoutes);
router.use("/students", studentRoutes);
router.use('/attendance', attendanceRoutes); 
router.use('/dashboard', dashboardRoutes); 

export default router;
