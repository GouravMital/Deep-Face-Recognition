import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import facesRouter from "./faces";
import recognitionRouter from "./recognition";
import attendanceRouter from "./attendance";
import csvRouter from "./csv";
import moodRouter from "./mood";
import lfwRouter from "./lfw";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(facesRouter);
router.use(recognitionRouter);
router.use(attendanceRouter);
router.use(csvRouter);
router.use(moodRouter);
router.use(lfwRouter);

export default router;
