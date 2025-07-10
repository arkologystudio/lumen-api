// src/routes/auth.ts
import { Router } from "express";
import { generateToken } from "../controllers/authController";
import {
  registerUser,
  loginUserController,
} from "../controllers/userController";

const router = Router();

// Authentication endpoints
router.post("/register", registerUser);
router.post("/login", loginUserController);

// Legacy token generation endpoint
router.post("/token", generateToken);

export default router;
