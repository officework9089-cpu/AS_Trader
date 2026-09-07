import { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import { User, UserRole } from "../types";

// 1. Fail fast if JWT_SECRET is missing in production environments
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET && process.env.NODE_ENV === "production") {
  throw new Error("FATAL: JWT_SECRET environment variable is not defined.");
}
const FALLBACK_SECRET = JWT_SECRET || "ascomm-secret-key-12345-navy-glow";

// 2. Extend Express Request globally so you don't need manual casting everywhere
export interface AuthUserPayload extends JwtPayload {
  id: string;
  username: string;
  role: UserRole;
  customer_name?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUserPayload;
    }
  }
}

export type AuthenticatedRequest = Request & { user: AuthUserPayload };

/**
 * Generates a signed JWT token containing user identity and role.
 */
export function generateToken(user: Omit<User, "password">): string {
  const payload: AuthUserPayload = {
    id: user.id,
    username: user.username,
    role: user.role,
    ...(user.customer_name && { customerName: user.customer_name }),
  };

  return jwt.sign(payload, FALLBACK_SECRET, { expiresIn: "8h" });
}

/**
 * Middleware to authenticate requests via Bearer JWT.
 */
export function authenticateJWT(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Authorization header is missing or malformed." });
    return;
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, FALLBACK_SECRET) as AuthUserPayload;
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: "Invalid or expired authorization token." });
  }
}

/**
 * Middleware to enforce role-based access control (RBAC).
 */
export function requireRole(allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: "User is not authenticated." });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        error: "Access Denied: Insufficient permissions for this resource.",
      });
      return;
    }

    next();
  };
}