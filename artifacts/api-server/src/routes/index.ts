import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import currenciesRouter from "./currencies";
import transactionsRouter from "./transactions";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/currencies", currenciesRouter);
router.use("/transactions", transactionsRouter);

export default router;
