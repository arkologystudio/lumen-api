import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { ENV } from "../config/env";
import { prisma } from "../config/database";
import {
  User,
  CreateUserRequest,
  LoginRequest,
  UpdateUserRequest,
  AuthPayload,
} from "../types/index";

const SALT_ROUNDS = 12;

/**
 * Hash password using bcrypt
 */
const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, SALT_ROUNDS);
};

/**
 * Verify password against hash
 */
const verifyPassword = async (
  password: string,
  hash: string
): Promise<boolean> => {
  return bcrypt.compare(password, hash);
};

/**
 * Parse JWT TTL string to seconds
 */
const parseJwtTtl = (ttl: string): number => {
  if (!ttl) return 3600; // 1 hour default

  // Handle time strings like "15m", "1h", "2d"
  const match = ttl.match(/^(\d+)([smhd]?)$/);
  if (!match) return 3600;

  const value = parseInt(match[1]);
  const unit = match[2] || "s";

  switch (unit) {
    case "s":
      return value;
    case "m":
      return value * 60;
    case "h":
      return value * 3600;
    case "d":
      return value * 86400;
    default:
      return value;
  }
};

/**
 * Generate JWT token for user
 */
const generateUserToken = (user: User): string => {
  const payload: AuthPayload = {
    jti: crypto.randomUUID(),
    user_id: user.id,
    email: user.email,
  };

  const ttlSeconds = parseJwtTtl(ENV.JWT_TTL);

  return jwt.sign(payload, ENV.JWT_SECRET, {
    expiresIn: ttlSeconds,
  });
};

/**
 * Convert Prisma user to our User type
 */
const mapPrismaUserToUser = (prismaUser: any): User => ({
  id: prismaUser.id,
  email: prismaUser.email,
  name: prismaUser.name,
  created_at: prismaUser.created_at.toISOString(),
  updated_at: prismaUser.updated_at.toISOString(),
  is_active: prismaUser.is_active,
  subscription_tier: prismaUser.subscription_tier as
    | "free"
    | "pro"
    | "enterprise",
});

/**
 * Validate email format
 */
const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validate password strength
 */
const isValidPassword = (
  password: string
): { valid: boolean; message?: string } => {
  if (password.length < 8) {
    return {
      valid: false,
      message: "Password must be at least 8 characters long",
    };
  }
  if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
    return {
      valid: false,
      message:
        "Password must contain at least one lowercase letter, one uppercase letter, and one number",
    };
  }
  return { valid: true };
};

/**
 * Create a new user
 */
export const createUser = async (
  userData: CreateUserRequest
): Promise<{ user: User; token: string }> => {
  const { email, password, name } = userData;

  // Validate input
  if (!isValidEmail(email)) {
    throw new Error("Invalid email format");
  }

  const passwordValidation = isValidPassword(password);
  if (!passwordValidation.valid) {
    throw new Error(passwordValidation.message!);
  }

  if (!name.trim()) {
    throw new Error("Name is required");
  }

  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });

  if (existingUser) {
    throw new Error("User with this email already exists");
  }

  // Hash password
  const passwordHash = await hashPassword(password);

  // Create user in database
  const prismaUser = await prisma.user.create({
    data: {
      email: email.toLowerCase(),
      name: name.trim(),
      password_hash: passwordHash,
      subscription_tier: "free",
    },
  });

  const user = mapPrismaUserToUser(prismaUser);
  const token = generateUserToken(user);

  return { user, token };
};

/**
 * Authenticate user login
 */
export const loginUser = async (
  loginData: LoginRequest
): Promise<{ user: User; token: string }> => {
  const { email, password } = loginData;

  // Find user
  const prismaUser = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });

  if (!prismaUser || !prismaUser.is_active) {
    throw new Error("Invalid email or password");
  }

  // Verify password
  const isPasswordValid = await verifyPassword(
    password,
    prismaUser.password_hash
  );
  if (!isPasswordValid) {
    throw new Error("Invalid email or password");
  }

  const user = mapPrismaUserToUser(prismaUser);
  const token = generateUserToken(user);

  return { user, token };
};

/**
 * Get user by ID
 */
export const getUserById = async (userId: string): Promise<User | null> => {
  const prismaUser = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!prismaUser) {
    return null;
  }

  return mapPrismaUserToUser(prismaUser);
};

/**
 * Get user by email
 */
export const getUserByEmail = async (email: string): Promise<User | null> => {
  const prismaUser = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });

  if (!prismaUser) {
    return null;
  }

  return mapPrismaUserToUser(prismaUser);
};

/**
 * Update user profile
 */
export const updateUser = async (
  userId: string,
  updateData: UpdateUserRequest
): Promise<User> => {
  // Check if user exists
  const existingUser = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!existingUser) {
    throw new Error("User not found");
  }

  // Validate email if provided
  if (updateData.email && !isValidEmail(updateData.email)) {
    throw new Error("Invalid email format");
  }

  // Check if new email is already taken
  if (
    updateData.email &&
    updateData.email.toLowerCase() !== existingUser.email
  ) {
    const emailTaken = await prisma.user.findUnique({
      where: { email: updateData.email.toLowerCase() },
    });

    if (emailTaken) {
      throw new Error("Email already in use");
    }
  }

  // Update user
  const updatedPrismaUser = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(updateData.email && { email: updateData.email.toLowerCase() }),
      ...(updateData.name && { name: updateData.name.trim() }),
    },
  });

  return mapPrismaUserToUser(updatedPrismaUser);
};

/**
 * Deactivate user account
 */
export const deactivateUser = async (userId: string): Promise<void> => {
  const existingUser = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!existingUser) {
    throw new Error("User not found");
  }

  await prisma.user.update({
    where: { id: userId },
    data: { is_active: false },
  });
};

/**
 * Get all users (admin function)
 */
export const getAllUsers = async (): Promise<User[]> => {
  const prismaUsers = await prisma.user.findMany({
    orderBy: { created_at: "desc" },
  });

  return prismaUsers.map(mapPrismaUserToUser);
};

/**
 * Verify JWT token and get user
 */
export const verifyUserToken = async (token: string): Promise<User> => {
  try {
    const payload = jwt.verify(token, ENV.JWT_SECRET) as AuthPayload;
    const user = await getUserById(payload.user_id);

    if (!user || !user.is_active) {
      throw new Error("Invalid token");
    }

    return user;
  } catch (error) {
    throw new Error("Invalid or expired token");
  }
};
