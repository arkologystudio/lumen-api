import { RequestHandler } from "express";
import { createUser, loginUser, updateUser } from "../services/userService";
import { getSitesForUser } from "../services/siteService";
import {
  CreateUserRequest,
  LoginRequest,
  UpdateUserRequest,
} from "../types/index";
import { AuthenticatedRequest } from "../middleware/auth";
import {
  logActivityWithRequest,
  ACTIVITY_TYPES,
} from "../services/activityLogService";

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
 * Register a new user
 */
export const registerUser: RequestHandler = async (req, res) => {
  try {
    const userData: CreateUserRequest = req.body;

    if (!userData.email || !userData.password || !userData.name) {
      res.status(400).json({
        success: false,
        error: "Email, password, and name are required",
      });
      return;
    }

    const { user, token } = await createUser(userData);

    // Log user registration activity
    try {
      await logActivityWithRequest(
        req,
        user.id,
        ACTIVITY_TYPES.USER_REGISTERED,
        `New user registered: ${user.name}`,
        {
          description: `User ${user.name} (${user.email}) registered with ${user.subscription_tier} tier`,
          metadata: {
            subscription_tier: user.subscription_tier,
            email: user.email,
          },
        }
      );
    } catch (activityError) {
      console.error("Failed to log user registration activity:", activityError);
    }

    res.status(201).json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          is_active: user.is_active,
          subscription_tier: user.subscription_tier,
        },
        token,
        expires_in: parseJwtTtl(process.env.JWT_TTL || "3600"),
      },
      message: "User registered successfully",
    });
  } catch (error) {
    console.error("Error registering user:", error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : "Registration failed",
    });
  }
};

/**
 * Login user
 */
export const loginUserController: RequestHandler = async (req, res) => {
  try {
    const loginData: LoginRequest = req.body;

    if (!loginData.email || !loginData.password) {
      res.status(400).json({
        success: false,
        error: "Email and password are required",
      });
      return;
    }

    const { user, token } = await loginUser(loginData);

    // Log user login activity
    try {
      await logActivityWithRequest(
        req,
        user.id,
        ACTIVITY_TYPES.USER_LOGIN,
        `User logged in: ${user.name}`,
        {
          description: `User ${user.name} (${user.email}) logged in successfully`,
          metadata: {
            email: user.email,
            subscription_tier: user.subscription_tier,
          },
        }
      );
    } catch (activityError) {
      console.error("Failed to log user login activity:", activityError);
    }

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          is_active: user.is_active,
          subscription_tier: user.subscription_tier,
        },
        token,
        expires_in: parseJwtTtl(process.env.JWT_TTL || "3600"),
      },
      message: "Login successful",
    });
  } catch (error) {
    console.error("Error logging in user:", error);
    res.status(401).json({
      success: false,
      error: error instanceof Error ? error.message : "Login failed",
    });
  }
};

/**
 * Get user profile
 */
export const getUserProfile = async (req: AuthenticatedRequest, res: any) => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: "Authentication required",
      });
      return;
    }

    res.json({
      success: true,
      data: {
        id: req.user.id,
        email: req.user.email,
        name: req.user.name,
        is_active: req.user.is_active,
        subscription_tier: req.user.subscription_tier,
        created_at: req.user.created_at,
        updated_at: req.user.updated_at,
      },
    });
  } catch (error) {
    console.error("Error getting user profile:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get user profile",
    });
  }
};

/**
 * Update user profile
 */
export const updateUserProfile = async (
  req: AuthenticatedRequest,
  res: any
) => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: "Authentication required",
      });
      return;
    }

    const updateData: UpdateUserRequest = req.body;
    const updatedUser = await updateUser(req.user.id, updateData);

    // Log user profile update activity
    try {
      const changedFields = Object.keys(updateData).filter(
        (key) => updateData[key as keyof UpdateUserRequest] !== undefined
      );

      await logActivityWithRequest(
        req,
        req.user.id,
        ACTIVITY_TYPES.USER_PROFILE_UPDATED,
        `Profile updated: ${updatedUser.name}`,
        {
          description: `User ${
            updatedUser.name
          } updated their profile (${changedFields.join(", ")})`,
          metadata: {
            changed_fields: changedFields,
            previous_name: req.user.name,
            updated_name: updatedUser.name,
          },
        }
      );
    } catch (activityError) {
      console.error(
        "Failed to log user profile update activity:",
        activityError
      );
    }

    res.json({
      success: true,
      data: {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        is_active: updatedUser.is_active,
        subscription_tier: updatedUser.subscription_tier,
        updated_at: updatedUser.updated_at,
      },
      message: "Profile updated successfully",
    });
  } catch (error) {
    console.error("Error updating user profile:", error);
    res.status(400).json({
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to update profile",
    });
  }
};

/**
 * Get user's sites
 */
export const getUserSites = async (req: AuthenticatedRequest, res: any) => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: "Authentication required",
      });
      return;
    }

    const sites = await getSitesForUser(req.user.id);

    res.json({
      success: true,
      data: sites,
      message: `Found ${sites.length} sites`,
    });
  } catch (error) {
    console.error("Error getting user sites:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get user sites",
    });
  }
};
