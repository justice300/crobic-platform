import jwt from "jsonwebtoken";
import crypto from "crypto";
import { prisma } from "./db.js";

export const ADMIN_ROLES = ["SUPER_ADMIN", "RECTOR", "ADMIN"];
export const STAFF_ROLES = ["SUPER_ADMIN", "RECTOR", "ADMIN", "LECTURER"];

const ACCESS_TOKEN_COOKIE = "crobic_access";
const REFRESH_TOKEN_COOKIE = "crobic_refresh";

export function isAdminRole(role) {
  return ADMIN_ROLES.includes(role);
}

export function isStaffRole(role) {
  return STAFF_ROLES.includes(role);
}

export function isSuperAdminRole(role) {
  return ["SUPER_ADMIN", "RECTOR"].includes(role);
}

export function accessCookieName() {
  return ACCESS_TOKEN_COOKIE;
}

export function refreshCookieName() {
  return REFRESH_TOKEN_COOKIE;
}

export function refreshTokenHash(token) {
  return crypto.createHash("sha256").update(String(token || "")).digest("hex");
}

export function cookieOptions(maxAgeMs) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: maxAgeMs
  };
}

export function clearAuthCookies(res) {
  res.clearCookie(ACCESS_TOKEN_COOKIE, { ...cookieOptions(0), maxAge: undefined });
  res.clearCookie(REFRESH_TOKEN_COOKIE, { ...cookieOptions(0), maxAge: undefined });
}

export function createAccessToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role, email: user.email, type: "access" },
    process.env.JWT_SECRET || "change-this-secret-before-live",
    { expiresIn: "15m" }
  );
}

export function createRefreshToken(user) {
  return jwt.sign(
    {
      id: user.id,
      role: user.role,
      email: user.email,
      type: "refresh",
      nonce: crypto.randomUUID()
    },
    process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || "change-this-secret-before-live",
    { expiresIn: "7d" }
  );
}

// Backward-compatible name for older code paths.
export function createToken(user) {
  return createAccessToken(user);
}

export async function setAuthCookies(res, user) {
  const accessToken = createAccessToken(user);
  const refreshToken = createRefreshToken(user);
  await prisma.user.update({
    where: { id: user.id },
    data: { refreshTokenHash: refreshTokenHash(refreshToken) }
  });
  res.cookie(ACCESS_TOKEN_COOKIE, accessToken, cookieOptions(15 * 60 * 1000));
  res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, cookieOptions(7 * 24 * 60 * 60 * 1000));
  return { accessToken, refreshToken };
}

function getAccessToken(req) {
  const header = req.headers.authorization || "";
  if (header.startsWith("Bearer ")) return header.slice(7);
  return req.cookies?.[ACCESS_TOKEN_COOKIE] || null;
}

export async function requireAuth(req, res, next) {
  try {
    const token = getAccessToken(req);
    if (!token) return res.status(401).json({ message: "Authentication required" });

    const payload = jwt.verify(token, process.env.JWT_SECRET || "change-this-secret-before-live");
    if (payload.type && payload.type !== "access") return res.status(401).json({ message: "Invalid token type" });

    const user = await prisma.user.findUnique({ where: { id: payload.id } });
    if (!user) return res.status(401).json({ message: "User not found" });

    if (user.lockedUntil && new Date(user.lockedUntil).getTime() > Date.now()) {
      return res.status(423).json({ message: "Account temporarily locked. Please try again later." });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}

export async function refreshAccessToken(req, res) {
  const token = req.cookies?.[REFRESH_TOKEN_COOKIE];
  if (!token) return res.status(401).json({ message: "Refresh token required" });

  try {
    const payload = jwt.verify(token, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || "change-this-secret-before-live");
    if (payload.type !== "refresh") return res.status(401).json({ message: "Invalid refresh token" });

    const user = await prisma.user.findUnique({ where: { id: payload.id } });
    if (!user || !user.refreshTokenHash || user.refreshTokenHash !== refreshTokenHash(token)) {
      clearAuthCookies(res);
      return res.status(401).json({ message: "Refresh token is no longer valid" });
    }

    await setAuthCookies(res, user);
    return res.json({
      message: "Session refreshed",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        country: user.country,
        role: user.role,
        status: user.status,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    clearAuthCookies(res);
    return res.status(401).json({ message: "Invalid or expired refresh token" });
  }
}

export function requireAdmin(req, res, next) {
  if (!isStaffRole(req.user?.role)) {
    return res.status(403).json({ message: "Staff access required" });
  }
  next();
}

export function requireSuperAdmin(req, res, next) {
  if (!isSuperAdminRole(req.user?.role)) {
    return res.status(403).json({ message: "Super Admin access required" });
  }
  next();
}

export function requireActiveStudent(req, res, next) {
  if (req.user?.role !== "STUDENT") {
    return res.status(403).json({ message: "Student access required" });
  }
  if (!["ACTIVE", "GRADUATED"].includes(req.user.status)) {
    return res.status(403).json({
      message: "Your registration is being reviewed. You will receive access once your payment and admission are approved.",
      status: req.user.status
    });
  }
  next();
}
