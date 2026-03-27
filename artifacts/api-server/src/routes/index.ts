import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import currenciesRouter from "./currencies";
import transactionsRouter from "./transactions";
import analyticsRouter from "./analytics";
import userRouter from "./user";
import exportRouter from "./exportRoutes";
import notificationsRouter from "./notifications";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/currencies", currenciesRouter);
router.use("/transactions", transactionsRouter);
router.use("/analytics", analyticsRouter);
router.use("/user", userRouter);
router.use("/export", exportRouter);
router.use("/notifications", notificationsRouter);

export default router;
