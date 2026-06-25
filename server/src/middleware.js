import jwt from "jsonwebtoken";
import { prisma } from "./db.js";

export function createToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role, email: user.email },
    process.env.JWT_SECRET || "change-this-secret-before-live",
    { expiresIn: "7d" }
  );
}

export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return res.status(401).json({ message: "Authentication required" });

    const payload = jwt.verify(token, process.env.JWT_SECRET || "change-this-secret-before-live");
    const user = await prisma.user.findUnique({ where: { id: payload.id } });
    if (!user) return res.status(401).json({ message: "User not found" });

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== "ADMIN") {
    return res.status(403).json({ message: "Admin access required" });
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
