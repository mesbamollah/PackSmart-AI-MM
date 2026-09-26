import { Router, type IRouter } from "express";
import healthRouter from "./health";
import catalogRouter from "./catalog";
import profileRouter from "./profile";
import dashboardRouter from "./dashboard";
import recommendationsRouter from "./recommendations";

const router: IRouter = Router();

router.use(healthRouter);
router.use(catalogRouter);
router.use(profileRouter);
router.use(dashboardRouter);
router.use(recommendationsRouter);

export default router;
