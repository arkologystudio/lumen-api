// src/routes/auth.ts
import { Router } from "express";
import { generateToken } from "../controllers/authController";

const router = Router();

router.post("/token", generateToken);

export default router;
