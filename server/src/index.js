import "dotenv/config";
import express from "express";
import cors from "cors";
import morgan from "morgan";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import { prisma, seedDatabase, checkDatabaseConnection, closeDatabaseConnections } from "./db.js";
import {
  createToken,
  requireAuth,
  requireAdmin,
  requireSuperAdmin,
  requireActiveStudent,
  isAdminRole,
  isSuperAdminRole,
  setAuthCookies,
  clearAuthCookies,
  refreshAccessToken,
  refreshTokenHash
} from "./middleware.js";
import { applySecurity, strictCorsOptions, loginLimiter, registerLimiter, otpLimiter, validators, validateRequest, productionErrorHandler, sanitizeRequestBody } from "./security.js";
import { documentUpload, makeStorageName, uploadToBunny } from "./storage.js";
import {
  sendTransactionalEmail as sendIntegrationTransactionalEmail,
  sendOneSignalNotification,
  goLiveEmailHtml,
  classEndedEmailHtml,
  recordingAvailableEmailHtml,
  createDailyRoom,
  createDailyMeetingToken,
  deleteDailyRoom,
  appBaseUrl
} from "./integrations.js";
import { initSentry, sentryErrorHandler } from "./sentry.js";

const app = express();
const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";
const UPLOAD_ROOT = path.join(process.cwd(), "uploads");
const PAYMENT_PROOF_DIR = path.join(UPLOAD_ROOT, "payment-proofs");
const CERTIFICATE_ASSET_DIR = path.join(UPLOAD_ROOT, "certificate-assets");
const ASSIGNMENT_FILE_DIR = path.join(UPLOAD_ROOT, "assignment-files");
const BROCHURE_DIR = path.join(UPLOAD_ROOT, "brochures");

initSentry(app);
applySecurity(app);
app.use(cors(strictCorsOptions()));
app.use("/uploads", express.static(UPLOAD_ROOT, { fallthrough: false }));
app.use(express.json({ limit: "12mb" }));
app.use(express.urlencoded({ extended: false, limit: "12mb" }));
app.use(sanitizeRequestBody);
app.use(morgan(process.env.NODE_ENV === "production" ? ":remote-addr :method :url :status :response-time ms" : "dev", {
  skip: (req) => req.path.includes("/health")
}));

if ((process.env.JWT_SECRET || "change-this-secret-before-live") === "change-this-secret-before-live") {
  console.warn("SECURITY WARNING: JWT_SECRET is still using the default value. Change it before going live.");
}

function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    country: user.country,
    role: user.role,
    status: user.status,
    createdAt: user.createdAt
  };
}

function amountToKobo(amount) {
  return Number(amount) * 100;
}

function getCertificateSettingDefaults() {
  return {
    certificate_rector_name: "Joshua Iginla",
    certificate_rector_title: "Rector / President",
    certificate_footer_text: "Raising world class ministers",
    certificate_signature_url: "",
    certificate_seal_url: "/crobic-images/cra-logo.png",
    certificate_show_qr: "true"
  };
}

async function getCertificateSettings() {
  const rows = await prisma.setting.findMany({
    where: { key: { startsWith: "certificate_" } }
  });
  return { ...getCertificateSettingDefaults(), ...Object.fromEntries(rows.map((row) => [row.key, row.value])) };
}


function getEmailSettingDefaults() {
  return {
    email_notifications_enabled: "false",
    email_school_name: "Champion International Bible Institute",
    email_from_name: process.env.EMAIL_FROM_NAME || "CIBI",
    email_from_address: process.env.EMAIL_FROM_ADDRESS || "noreply@cibionline.org",
    email_reply_to: process.env.EMAIL_REPLY_TO || "support@cibionline.org",
    email_admin_recipients: "",
    email_smtp_host: "",
    email_smtp_port: "587",
    email_smtp_user: "",
    email_smtp_password: "",
    email_smtp_secure: "false",
    email_base_url: CLIENT_URL,
    email_footer_text: "Raising world class ministers"
  };
}

async function getEmailSettings() {
  const rows = await prisma.setting.findMany({ where: { key: { startsWith: "email_" } } });
  return { ...getEmailSettingDefaults(), ...Object.fromEntries(rows.map((row) => [row.key, row.value])) };
}

function splitEmailList(value = "") {
  return String(value || "")
    .split(/[;,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function emailTemplate({ heading, body, ctaText, ctaUrl, settings }) {
  const safeHeading = String(heading || "CIBI Notification");
  const safeBody = String(body || "").replace(/\n/g, "<br />");
  const footer = String(settings.email_footer_text || "Raising world class ministers");
  const school = String(settings.email_school_name || "Champion International Bible Institute");
  const button = ctaText && ctaUrl
    ? `<p style="margin:28px 0"><a href="${ctaUrl}" style="background:#c49f64;color:#070b18;padding:14px 22px;text-decoration:none;font-weight:800;letter-spacing:.08em;text-transform:uppercase;font-size:12px;display:inline-block">${ctaText}</a></p>`
    : "";

  return `
  <div style="margin:0;padding:0;background:#f8f3e9;font-family:Inter,Arial,sans-serif;color:#111827">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8f3e9;padding:28px 14px">
      <tr><td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#ffffff;border:1px solid rgba(17,24,39,.1)">
          <tr><td style="background:#070b18;padding:28px 30px;border-bottom:3px solid #c49f64">
            <div style="color:#c49f64;font-size:11px;letter-spacing:.22em;text-transform:uppercase;font-weight:800">${school}</div>
            <h1 style="margin:12px 0 0;color:#ffffff;font-size:28px;line-height:1.15;font-family:Georgia,serif">${safeHeading}</h1>
          </td></tr>
          <tr><td style="padding:32px 30px">
            <div style="font-size:15px;line-height:1.75;color:#374151">${safeBody}</div>
            ${button}
          </td></tr>
          <tr><td style="padding:20px 30px;background:#fbf7ef;border-top:1px solid rgba(17,24,39,.08)">
            <p style="margin:0;color:#6b7280;font-size:12px;line-height:1.6">${footer}</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </div>`;
}

async function sendEmailNotification({ to, subject, heading, body, ctaText, ctaUrl }) {
  const settings = await getEmailSettings();
  const recipients = Array.isArray(to) ? to.filter(Boolean) : splitEmailList(to);
  if (!recipients.length) return { skipped: true, reason: "No recipient" };

  if (process.env.RESEND_API_KEY) {
    return sendTransactionalEmail({
      to: recipients,
      subject,
      title: heading || subject,
      text: body,
      buttonText: ctaText,
      buttonUrl: ctaUrl ? (String(ctaUrl).startsWith("http") ? ctaUrl : `${CLIENT_URL.replace(/\/$/, "")}${ctaUrl.startsWith("/") ? "" : "/"}${ctaUrl}`) : undefined
    });
  }

  if (String(settings.email_notifications_enabled || "false") !== "true") return { skipped: true, reason: "Email notifications disabled" };

  const host = String(settings.email_smtp_host || "").trim();
  const user = String(settings.email_smtp_user || "").trim();
  const pass = String(settings.email_smtp_password || "").trim();
  const fromAddress = String(settings.email_from_address || user || "").trim();
  if (!host || !user || !pass || !fromAddress) return { skipped: true, reason: "SMTP settings incomplete" };

  const { default: nodemailer } = await import("nodemailer");
  const transporter = nodemailer.createTransport({
    host,
    port: Number(settings.email_smtp_port || 587),
    secure: String(settings.email_smtp_secure || "false") === "true",
    auth: { user, pass }
  });

  const baseUrl = String(settings.email_base_url || CLIENT_URL).replace(/\/$/, "");
  const finalCtaUrl = ctaUrl ? (String(ctaUrl).startsWith("http") ? ctaUrl : `${baseUrl}${ctaUrl.startsWith("/") ? "" : "/"}${ctaUrl}`) : "";
  const html = emailTemplate({ heading: heading || subject, body, ctaText, ctaUrl: finalCtaUrl, settings });
  const fromName = String(settings.email_from_name || settings.email_school_name || "CIBI");

  return transporter.sendMail({
    from: `"${fromName.replace(/"/g, "")}" <${fromAddress}>`,
    to: recipients.join(", "),
    replyTo: settings.email_reply_to || fromAddress,
    subject,
    text: `${heading || subject}\n\n${body}\n\n${finalCtaUrl || ""}`,
    html
  });
}

function queueEmailNotification(payload) {
  sendEmailNotification(payload).catch((error) => {
    console.error("Email notification failed:", error.message);
  });
}

async function queueAdminEmail({ subject, heading, body, ctaText = "Open Admin Dashboard", ctaUrl = "/admin" }) {
  const settings = await getEmailSettings();
  const recipients = splitEmailList(settings.email_admin_recipients);
  if (!recipients.length) return;
  queueEmailNotification({ to: recipients, subject, heading, body, ctaText, ctaUrl });
}

function requestMeta(req) {
  return {
    ipAddress: req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.ip || req.socket?.remoteAddress || "",
    userAgent: String(req.headers["user-agent"] || "").slice(0, 500)
  };
}

async function logAdminActivity(req, { action, entityType = "SYSTEM", entityId = null, details = {} } = {}) {
  try {
    if (!req.user || req.user.role !== "ADMIN" || !action) return;
    const meta = requestMeta(req);
    await prisma.adminActivityLog.create({
      data: {
        adminId: req.user.id,
        action: String(action).slice(0, 120),
        entityType: entityType ? String(entityType).slice(0, 80) : null,
        entityId: entityId === null || entityId === undefined ? null : String(entityId).slice(0, 80),
        details: JSON.stringify(details || {}).slice(0, 4000),
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent
      }
    });
  } catch (error) {
    console.error("Admin activity log failed:", error.message);
  }
}




function isLecturerOnly(user) {
  return user?.role === "LECTURER";
}

function staffCanSeeAllCourses(user) {
  return isAdminRole(user?.role);
}

function courseAccessWhereForUser(user) {
  if (staffCanSeeAllCourses(user)) return {};
  if (isLecturerOnly(user)) return { lecturerAccesses: { some: { lecturerId: user.id } } };
  return { id: -1 };
}

async function canManageCourse(req, courseId) {
  if (!courseId) return false;
  if (staffCanSeeAllCourses(req.user)) return true;
  if (!isLecturerOnly(req.user)) return false;
  const access = await prisma.courseLecturerAccess.findUnique({
    where: { courseId_lecturerId: { courseId: courseId ? Number(courseId) : null, lecturerId: req.user.id } }
  });
  return Boolean(access);
}

async function requireCourseAccess(req, res, courseId) {
  const allowed = await canManageCourse(req, Number(courseId));
  if (!allowed) {
    res.status(403).json({ message: "You do not have access to this course." });
    return false;
  }
  return true;
}


function isPowerAdmin(user) {
  return isSuperAdminRole(user?.role);
}

async function isAssignedLecturer(user, courseId) {
  if (user?.role !== "LECTURER") return false;
  const access = await prisma.courseLecturerAccess.findUnique({
    where: { courseId_lecturerId: { courseId: courseId ? Number(courseId) : null, lecturerId: user.id } }
  });
  return Boolean(access);
}

async function canManageCourseContent(user, courseId) {
  if (isPowerAdmin(user)) return true;
  return isAssignedLecturer(user, courseId);
}

async function canAccessCourseContent(user, courseId) {
  if (!user) return false;
  const id = Number(courseId);
  if (isPowerAdmin(user)) return true;
  if (await isAssignedLecturer(user, id)) return true;
  if (user.role === "STUDENT") {
    const course = await prisma.course.findUnique({ where: { id }, select: { id: true, programmeId: true, generalForAllProgrammes: true, levelStage: true } });
    if (!course) return false;
    const enrollment = await prisma.enrollment.findFirst({
      where: {
        userId: user.id,
        admissionStatus: { in: ["APPROVED", "GRADUATED"] },
        accessStatus: { not: "BLOCKED" },
        OR: [
          { courseId: id },
          course.generalForAllProgrammes ? { admissionStatus: { in: ["APPROVED", "GRADUATED"] } } : { id: -1 },
          course.programmeId ? { programmeId: course.programmeId } : { id: -1 }
        ]
      }
    });
    return canEnrollmentUseCourse(enrollment, course);
  }
  return false;
}

function validateLivePlatformUrl(value = "") {
  try {
    const url = new URL(String(value));
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    return host.includes("zoom.us") || host === "youtube.com" || host === "youtu.be" || host.endsWith(".youtube.com");
  } catch {
    return false;
  }
}

function clientCourseUrl(courseId) {
  return `${appBaseUrl()}/student?tab=live&courseId=${encodeURIComponent(courseId)}`;
}

async function enrolledStudentsForCourse(courseId) {
  const id = Number(courseId || 0);
  if (!id) {
    return prisma.user.findMany({
      where: { role: "STUDENT", enrollments: { some: { admissionStatus: { in: ["APPROVED", "GRADUATED"] }, accessStatus: { not: "BLOCKED" } } } },
      select: { id: true, name: true, email: true }
    });
  }

  const course = await prisma.course.findUnique({ where: { id }, select: { id: true, programmeId: true, generalForAllProgrammes: true, levelStage: true } });
  if (!course) return [];

  const users = await prisma.user.findMany({
    where: {
      role: "STUDENT",
      enrollments: {
        some: {
          admissionStatus: { in: ["APPROVED", "GRADUATED"] },
          accessStatus: { not: "BLOCKED" },
          OR: [
            { courseId: id },
            course.generalForAllProgrammes ? { admissionStatus: { in: ["APPROVED", "GRADUATED"] } } : { id: -1 },
            course.programmeId ? { programmeId: course.programmeId } : { id: -1 }
          ]
        }
      }
    },
    include: { enrollments: true }
  });

  return users
    .filter((user) => user.enrollments.some((enrollment) => canEnrollmentUseCourse(enrollment, course)))
    .map((user) => ({ id: user.id, name: user.name, email: user.email }));
}

async function createCourseNotifications({ courseId, users, title, message, url, type = "INFO" }) {
  if (!users?.length) return [];
  return prisma.notification.createMany({
    data: users.map((user) => ({
      userId: user.id,
      courseId: courseId ? Number(courseId) : null,
      title,
      message,
      url,
      type
    }))
  });
}

function uniqueUsersById(users = []) {
  return Array.from(new Map((users || []).filter((user) => user?.id).map((user) => [user.id, user])).values());
}

function canStartGeneralLive(user) {
  return ["SUPER_ADMIN", "RECTOR", "ADMIN"].includes(user?.role);
}

function studentLiveUrl() {
  return `${appBaseUrl()}/student?tab=live`;
}

function adminLiveUrl() {
  return `${appBaseUrl()}/admin?tab=live`;
}

async function staffRecipientsForGeneralLive() {
  return prisma.user.findMany({
    where: {
      role: { in: ["SUPER_ADMIN", "RECTOR", "ADMIN", "LECTURER"] },
      status: { in: ["ACTIVE", "PAYMENT_CONFIRMED", "GRADUATED"] }
    },
    select: { id: true, name: true, email: true, role: true }
  });
}


function normaliseProgrammePayload(body = {}) {
  const paymentPlan = String(body.paymentPlan || "ONE_TIME").trim().toUpperCase() || "ONE_TIME";
  return {
    title: String(body.title || "").trim(),
    level: String(body.level || "Programme").trim(),
    duration: body.duration ? String(body.duration).trim() : null,
    description: String(body.description || "").trim(),
    imageUrl: body.imageUrl ? String(body.imageUrl).trim() : null,
    fee: Math.max(0, Number(body.fee || 0)),
    feeUsd: Math.max(0, Number(body.feeUsd || 0)),
    currency: String(body.currency || "USD").trim() || "USD",
    certification: body.certification ? String(body.certification).trim() : null,
    paymentPlan,
    paymentCycleMonths: body.paymentCycleMonths ? Number(body.paymentCycleMonths) : null,
    defaultLevelStage: body.defaultLevelStage ? String(body.defaultLevelStage).trim() : null,
    published: body.published === undefined ? true : body.published === true || body.published === "true" || body.published === "on"
  };
}

function normaliseCoursePayload(body = {}) {
  return {
    programmeId: body.programmeId ? Number(body.programmeId) : null,
    title: String(body.title || "").trim(),
    level: String(body.level || "Course").trim(),
    duration: body.duration ? String(body.duration).trim() : null,
    description: String(body.description || "").trim(),
    imageUrl: body.imageUrl ? String(body.imageUrl).trim() : null,
    fee: Math.max(0, Number(body.fee || 0)),
    feeUsd: Math.max(0, Number(body.feeUsd || 0)),
    currency: String(body.currency || "USD").trim() || "USD",
    generalForAllProgrammes: body.generalForAllProgrammes === true || body.generalForAllProgrammes === "true" || body.generalForAllProgrammes === "on",
    levelStage: body.levelStage ? String(body.levelStage).trim() : null,
    published: body.published === undefined ? true : body.published === true || body.published === "true" || body.published === "on"
  };
}

function programmeFeeAmount(programmeOrCourse = {}) {
  const local = Number(programmeOrCourse.fee || 0);
  if (local > 0) return local;
  return Math.round(Number(programmeOrCourse.feeUsd || 0));
}

function programmeDisplayTitle(enrollment = {}) {
  return enrollment.programme?.title || enrollment.course?.programme?.title || enrollment.course?.title || "Selected programme";
}

function canEnrollmentUseCourse(enrollment = {}, course = {}) {
  if (!enrollment || !course) return false;
  if (enrollment.accessStatus === "BLOCKED") return false;
  if (course.generalForAllProgrammes) return true;
  if (enrollment.courseId && course.id === enrollment.courseId) return true;
  if (enrollment.programmeId && course.programmeId === enrollment.programmeId) {
    const enrollmentStage = String(enrollment.currentLevelStage || "").trim().toLowerCase();
    const courseStage = String(course.levelStage || "").trim().toLowerCase();
    return !courseStage || courseStage === "general" || !enrollmentStage || courseStage === enrollmentStage;
  }
  return false;
}

function defaultEnrollmentAccessData(programme = {}, now = new Date()) {
  const cycle = Number(programme?.paymentCycleMonths || 0) || null;
  const paidUntil = cycle ? new Date(now.getTime() + cycle * 30 * 24 * 60 * 60 * 1000) : null;
  return {
    currentLevelStage: programme?.defaultLevelStage || "100 Level",
    accessStatus: "ACTIVE",
    paymentPlan: programme?.paymentPlan || (cycle ? "YEARLY" : "ONE_TIME"),
    paymentCycleMonths: cycle,
    paidUntil,
    nextPaymentDueAt: paidUntil
  };
}

const DEFAULT_CIBI_PROGRAMMES = [
  {
    title: "Foundation Certificate Program",
    level: "Foundation",
    duration: "6 Months",
    description: "Foundational biblical training covering prophetic ministry, evangelism, digital literacy, and minister character development.",
    feeUsd: 59,
    fee: 0,
    currency: "USD",
    certification: "Foundation Certificate",
    paymentPlan: "ONE_TIME",
    paymentCycleMonths: null,
    defaultLevelStage: "Foundation"
  },
  {
    title: "Diploma Certificate Program in Theology and Leadership",
    level: "Diploma",
    duration: "24 Months",
    description: "Comprehensive theological training for pastors, evangelists, prophets, and Bible teachers.",
    feeUsd: 190,
    fee: 0,
    currency: "USD",
    certification: "Diploma Certificate in Theology and Leadership",
    paymentPlan: "YEARLY",
    paymentCycleMonths: 12,
    defaultLevelStage: "100 Level"
  },
  {
    title: "Advanced Diploma Certificate Program in Theology and Leadership",
    level: "Advanced",
    duration: "12 Months",
    description: "Advanced study in deliverance, prophetic ministry, biblical business, and principles of raising leaders.",
    feeUsd: 198,
    fee: 0,
    currency: "USD",
    certification: "Advanced Diploma Certificate in Theology and Leadership",
    paymentPlan: "ONE_TIME",
    paymentCycleMonths: null,
    defaultLevelStage: "Advanced"
  },
  {
    title: "Workers and Leadership Training Program",
    level: "Corporate",
    duration: "Flexible",
    description: "Churches and organizations training their workers and leaders.",
    feeUsd: 0,
    fee: 0,
    currency: "USD",
    certification: "Workers and Leadership Training Certificate",
    paymentPlan: "CONTACT_ADMIN",
    paymentCycleMonths: null,
    defaultLevelStage: "General"
  }
];

async function ensureDefaultProgrammes() {
  const count = await prisma.programme.count();
  if (count > 0) return;
  await prisma.programme.createMany({
    data: DEFAULT_CIBI_PROGRAMMES.map((programme) => ({ ...programme, published: true }))
  });
  console.log("Default CIBI programmes created.");
}

function parseApplicationJson(value = "") {
  try { return value ? JSON.parse(value) : {}; } catch { return {}; }
}

function studentCourseInclude(userId) {
  return {
    programme: true,
    modules: {
      where: { published: true },
      include: {
        lessons: {
          where: { published: true },
          include: { progress: { where: { userId } } },
          orderBy: { lessonOrder: "asc" }
        }
      },
      orderBy: { moduleOrder: "asc" }
    },
    lessons: {
      where: { published: true },
      include: { progress: { where: { userId } } },
      orderBy: { lessonOrder: "asc" }
    },
    assignments: {
      where: { published: true },
      include: { submissions: { where: { userId } } },
      orderBy: { createdAt: "asc" }
    },
    quizzes: {
      where: { published: true },
      include: {
        questions: { orderBy: { questionOrder: "asc" } },
        attempts: { where: { userId }, orderBy: { createdAt: "desc" } }
      },
      orderBy: { createdAt: "asc" }
    }
  };
}

function adminCourseInclude() {
  return {
    programme: true,
    modules: { include: { lessons: { include: { progress: true }, orderBy: { lessonOrder: "asc" } } }, orderBy: { moduleOrder: "asc" } },
    lessons: { include: { progress: true }, orderBy: { lessonOrder: "asc" } },
    assignments: { include: { submissions: true }, orderBy: { createdAt: "asc" } },
    quizzes: { include: { questions: { orderBy: { questionOrder: "asc" } }, attempts: true }, orderBy: { createdAt: "asc" } }
  };
}

function expandProgrammeCourseEnrollments(enrollments = []) {
  const rows = [];
  for (const enrollment of enrollments || []) {
    const programmeCourses = enrollment.programme?.courses || [];
    if (enrollment.programmeId && programmeCourses.length) {
      for (const course of programmeCourses) {
        if (!canEnrollmentUseCourse(enrollment, course)) continue;
        rows.push({
          ...enrollment,
          courseId: course.id,
          course,
          programmeTitle: enrollment.programme.title
        });
      }
    } else if (enrollment.course && canEnrollmentUseCourse(enrollment, enrollment.course)) {
      rows.push({ ...enrollment, programmeTitle: programmeDisplayTitle(enrollment) });
    }
  }
  return rows;
}

function parseCurrencyRates(value = "") {
  return String(value || "")
    .split(/\n|,/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [code = "", rate = ""] = line.split("|").map((item) => item.trim());
      return { code: code.toUpperCase(), rate: Number(rate || 0) };
    })
    .filter((item) => item.code && item.rate > 0);
}


function safeUploadExtension(fileName = "", contentType = "") {
  const name = String(fileName || "").toLowerCase();
  const type = String(contentType || "").toLowerCase();
  if (type.includes("pdf") || name.endsWith(".pdf")) return ".pdf";
  if (type.includes("png") || name.endsWith(".png")) return ".png";
  if (type.includes("webp") || name.endsWith(".webp")) return ".webp";
  if (type.includes("jpg") || type.includes("jpeg") || name.endsWith(".jpg") || name.endsWith(".jpeg")) return ".jpg";
  return null;
}

async function saveBase64PaymentProof({ fileName, contentType, dataUrl }) {
  const ext = safeUploadExtension(fileName, contentType);
  if (!ext) {
    const error = new Error("Only JPG, PNG, WEBP or PDF payment receipts are allowed.");
    error.statusCode = 400;
    throw error;
  }

  const raw = String(dataUrl || "");
  const base64 = raw.includes(",") ? raw.split(",").pop() : raw;
  if (!base64) {
    const error = new Error("Payment receipt file is required.");
    error.statusCode = 400;
    throw error;
  }

  const buffer = Buffer.from(base64, "base64");
  const maxBytes = 6 * 1024 * 1024;
  if (!buffer.length || buffer.length > maxBytes) {
    const error = new Error("Receipt file must not be more than 6MB.");
    error.statusCode = 400;
    throw error;
  }

  await fs.mkdir(PAYMENT_PROOF_DIR, { recursive: true });
  const savedName = `${Date.now()}-${crypto.randomUUID()}${ext}`;
  const savedPath = path.join(PAYMENT_PROOF_DIR, savedName);
  await fs.writeFile(savedPath, buffer);
  return `/uploads/payment-proofs/${savedName}`;
}


async function saveBase64CertificateAsset({ fileName, contentType, dataUrl }) {
  const ext = safeUploadExtension(fileName, contentType);
  if (!ext || ext === ".pdf") {
    const error = new Error("Only JPG, PNG or WEBP certificate images are allowed.");
    error.statusCode = 400;
    throw error;
  }

  const raw = String(dataUrl || "");
  const base64 = raw.includes(",") ? raw.split(",").pop() : raw;
  if (!base64) {
    const error = new Error("Certificate image file is required.");
    error.statusCode = 400;
    throw error;
  }

  const buffer = Buffer.from(base64, "base64");
  const maxBytes = 4 * 1024 * 1024;
  if (!buffer.length || buffer.length > maxBytes) {
    const error = new Error("Certificate image must not be more than 4MB.");
    error.statusCode = 400;
    throw error;
  }

  await fs.mkdir(CERTIFICATE_ASSET_DIR, { recursive: true });
  const savedName = `${Date.now()}-${crypto.randomUUID()}${ext}`;
  const savedPath = path.join(CERTIFICATE_ASSET_DIR, savedName);
  await fs.writeFile(savedPath, buffer);
  return `/uploads/certificate-assets/${savedName}`;
}


function safeAssignmentUploadExtension(fileName = "", contentType = "") {
  const name = String(fileName || "").toLowerCase();
  const type = String(contentType || "").toLowerCase();
  if (type.includes("pdf") || name.endsWith(".pdf")) return ".pdf";
  if (type.includes("png") || name.endsWith(".png")) return ".png";
  if (type.includes("webp") || name.endsWith(".webp")) return ".webp";
  if (type.includes("jpg") || type.includes("jpeg") || name.endsWith(".jpg") || name.endsWith(".jpeg")) return ".jpg";
  if (type.includes("wordprocessingml") || name.endsWith(".docx")) return ".docx";
  if (type.includes("msword") || name.endsWith(".doc")) return ".doc";
  return null;
}

async function saveBase64AssignmentFile({ fileName, contentType, dataUrl }) {
  const ext = safeAssignmentUploadExtension(fileName, contentType);
  if (!ext) {
    const error = new Error("Only JPG, PNG, WEBP, PDF, DOC or DOCX assignment files are allowed.");
    error.statusCode = 400;
    throw error;
  }

  const raw = String(dataUrl || "");
  const base64 = raw.includes(",") ? raw.split(",").pop() : raw;
  if (!base64) {
    const error = new Error("Assignment file is required.");
    error.statusCode = 400;
    throw error;
  }

  const buffer = Buffer.from(base64, "base64");
  const maxBytes = 10 * 1024 * 1024;
  if (!buffer.length || buffer.length > maxBytes) {
    const error = new Error("Assignment file must not be more than 10MB.");
    error.statusCode = 400;
    throw error;
  }

  await fs.mkdir(ASSIGNMENT_FILE_DIR, { recursive: true });
  const savedName = `${Date.now()}-${crypto.randomUUID()}${ext}`;
  const savedPath = path.join(ASSIGNMENT_FILE_DIR, savedName);
  await fs.writeFile(savedPath, buffer);
  return `/uploads/assignment-files/${savedName}`;
}

function assignmentPassed(assignment, userId) {
  if (assignment.required === false || assignment.published === false) return true;
  const submissions = Array.isArray(assignment.submissions) ? assignment.submissions : [];
  return submissions.some((submission) => {
    if (submission.userId !== userId) return false;
    if (["PASSED", "APPROVED"].includes(submission.status)) return true;
    if (submission.score === null || submission.score === undefined) return false;
    return Number(submission.score) >= Number(assignment.passScore || 50);
  });
}

function quizPassed(quiz, userId) {
  if (quiz.required === false || quiz.published === false) return true;
  const attempts = Array.isArray(quiz.attempts) ? quiz.attempts : [];
  return attempts.some((attempt) => attempt.userId === userId && attempt.passed);
}

function calculateCourseCompletionForUser(course, userId) {
  const lessonSummary = calculateCourseProgressForUser(course, userId);
  const assignments = (course.assignments || []).filter((item) => item.published !== false);
  const quizzes = (course.quizzes || []).filter((item) => item.published !== false);
  const requiredAssignments = assignments.filter((item) => item.required !== false);
  const requiredQuizzes = quizzes.filter((item) => item.required !== false);
  const completedAssignments = requiredAssignments.filter((item) => assignmentPassed(item, userId)).length;
  const completedQuizzes = requiredQuizzes.filter((item) => quizPassed(item, userId)).length;
  const completedRequirements = lessonSummary.completedRequired + completedAssignments + completedQuizzes;
  const totalRequirements = lessonSummary.totalRequired + requiredAssignments.length + requiredQuizzes.length;
  const percent = totalRequirements ? Math.round((completedRequirements / totalRequirements) * 100) : lessonSummary.percent;
  return {
    ...lessonSummary,
    lessonPercent: lessonSummary.percent,
    completedAssignments,
    totalAssignments: requiredAssignments.length,
    completedQuizzes,
    totalQuizzes: requiredQuizzes.length,
    completedRequirements,
    totalRequirements,
    percent
  };
}



function latestAssignmentSubmissionForUser(assignment, userId) {
  const submissions = Array.isArray(assignment.submissions) ? assignment.submissions : [];
  return submissions.find((submission) => submission.userId === userId) || null;
}

function bestQuizAttemptForUser(quiz, userId) {
  const attempts = (Array.isArray(quiz.attempts) ? quiz.attempts : []).filter((attempt) => attempt.userId === userId);
  return attempts.sort((a, b) => Number(b.score || 0) - Number(a.score || 0) || new Date(b.createdAt) - new Date(a.createdAt))[0] || null;
}

function assignmentResultStatus(assignment, userId) {
  if (assignment.published === false) return "HIDDEN";
  if (assignment.required === false) return "OPTIONAL";
  const submission = latestAssignmentSubmissionForUser(assignment, userId);
  if (!submission) return "PENDING_SUBMISSION";
  if (submission.status === "PASSED" || submission.status === "APPROVED") return "PASSED";
  if (submission.status === "NEEDS_REVISION") return "NEEDS_REVISION";
  if (submission.score === null || submission.score === undefined) return "PENDING_GRADE";
  return Number(submission.score) >= Number(assignment.passScore || 50) ? "PASSED" : "NEEDS_REVISION";
}

function quizResultStatus(quiz, userId) {
  if (quiz.published === false) return "HIDDEN";
  if (quiz.required === false) return "OPTIONAL";
  const attempt = bestQuizAttemptForUser(quiz, userId);
  if (!attempt) return "PENDING_ATTEMPT";
  return attempt.passed ? "PASSED" : "NOT_PASSED";
}

function average(numbers) {
  const clean = numbers.filter((value) => value !== null && value !== undefined && !Number.isNaN(Number(value))).map(Number);
  if (!clean.length) return null;
  return Math.round(clean.reduce((sum, value) => sum + value, 0) / clean.length);
}

function buildGradebookRow(enrollment) {
  const userId = enrollment.userId;
  const course = enrollment.course;
  const summary = calculateCourseCompletionForUser(course, userId);
  const assignments = (course.assignments || []).filter((item) => item.published !== false).map((assignment) => {
    const submission = latestAssignmentSubmissionForUser(assignment, userId);
    const status = assignmentResultStatus(assignment, userId);
    return {
      id: assignment.id,
      title: assignment.title,
      required: assignment.required,
      maxScore: assignment.maxScore || 100,
      passScore: assignment.passScore || 50,
      status,
      score: submission?.score ?? null,
      feedback: submission?.feedback || "",
      answer: submission?.answer || "",
      fileUrl: submission?.fileUrl || "",
      videoUrl: submission?.videoUrl || "",
      studentSubmittedAt: submission?.submittedAt || null,
      gradedAt: submission?.gradedAt || null
    };
  });
  const quizzes = (course.quizzes || []).filter((item) => item.published !== false).map((quiz) => {
    const bestAttempt = bestQuizAttemptForUser(quiz, userId);
    const attempts = (quiz.attempts || []).filter((attempt) => attempt.userId === userId);
    return {
      id: quiz.id,
      title: quiz.title,
      required: quiz.required,
      passScore: quiz.passScore || 70,
      status: quizResultStatus(quiz, userId),
      bestScore: bestAttempt?.score ?? null,
      passed: Boolean(bestAttempt?.passed),
      attemptCount: attempts.length,
      questionCount: (quiz.questions || []).length,
      lastAttemptAt: bestAttempt?.createdAt || null
    };
  });

  const assignmentPercentScores = assignments
    .map((item) => item.score === null || item.score === undefined ? null : Math.round((Number(item.score) / Number(item.maxScore || 100)) * 100));
  const quizScores = quizzes.map((item) => item.bestScore);
  const overallScore = average([summary.lessonPercent, average(assignmentPercentScores), average(quizScores)]);
  const requiredAssignments = assignments.filter((item) => item.required !== false);
  const requiredQuizzes = quizzes.filter((item) => item.required !== false);
  const pendingRequired = (summary.totalRequired - summary.completedRequired) + (requiredAssignments.length - summary.completedAssignments) + (requiredQuizzes.length - summary.completedQuizzes);
  const hasNeedsAttention = assignments.some((item) => item.required !== false && ["NEEDS_REVISION"].includes(item.status)) || quizzes.some((item) => item.required !== false && ["NOT_PASSED"].includes(item.status));
  const status = enrollment.certificate?.status === "ISSUED"
    ? "CERTIFICATE_ISSUED"
    : summary.percent >= 100
      ? "CERTIFICATE_READY"
      : hasNeedsAttention
        ? "NEEDS_ATTENTION"
        : pendingRequired > 0
          ? "IN_PROGRESS"
          : "PENDING_REQUIREMENTS";

  return {
    enrollmentId: enrollment.id,
    student: enrollment.user ? publicUser(enrollment.user) : null,
    course: { id: course.id, title: course.title, level: course.level, duration: course.duration },
    certificate: enrollment.certificate,
    completedRequirements: summary.completedRequirements,
    totalRequirements: summary.totalRequirements,
    pendingRequired,
    percent: summary.percent,
    lessonPercent: summary.lessonPercent,
    completedLessons: summary.completedRequired,
    totalLessons: summary.totalRequired,
    passedAssignments: summary.completedAssignments,
    totalAssignments: summary.totalAssignments,
    passedQuizzes: summary.completedQuizzes,
    totalQuizzes: summary.totalQuizzes,
    overallScore,
    status,
    assignments,
    quizzes
  };
}

function sanitizeLessonPayload(body = {}) {
  const required = body.required === undefined ? true : body.required === true || body.required === "true" || body.required === "on";
  return {
    courseId: Number(body.courseId),
    moduleId: body.moduleId ? Number(body.moduleId) : null,
    title: String(body.title || "").trim(),
    videoUrl: body.videoUrl ? String(body.videoUrl).trim() : null,
    notesUrl: body.notesUrl ? String(body.notesUrl).trim() : null,
    duration: body.duration ? String(body.duration).trim() : null,
    lessonOrder: Number(body.lessonOrder || 1),
    required,
    completionPercentRequired: Math.max(1, Math.min(100, Number(body.completionPercentRequired || 90))),
    published: body.published === undefined ? true : body.published === true || body.published === "true" || body.published === "on"
  };
}

function flattenCourseLessons(course) {
  const modules = [...(course.modules || [])].sort((a, b) => Number(a.moduleOrder || 0) - Number(b.moduleOrder || 0));
  const ordered = [];
  const seen = new Set();

  for (const module of modules) {
    const lessons = [...(module.lessons || [])].sort((a, b) => Number(a.lessonOrder || 0) - Number(b.lessonOrder || 0));
    for (const lesson of lessons) {
      ordered.push({ ...lesson, moduleTitle: module.title, moduleOrder: module.moduleOrder });
      seen.add(lesson.id);
    }
  }

  const legacyLessons = [...(course.lessons || [])]
    .filter((lesson) => !seen.has(lesson.id))
    .sort((a, b) => Number(a.lessonOrder || 0) - Number(b.lessonOrder || 0));

  for (const lesson of legacyLessons) {
    ordered.push({ ...lesson, moduleTitle: "General Lessons", moduleOrder: 9999 });
  }

  return ordered;
}

function lessonProgressItem(lesson) {
  return Array.isArray(lesson.progress) ? lesson.progress[0] : null;
}

function calculateCourseProgress(course) {
  const lessons = flattenCourseLessons(course).filter((lesson) => lesson.published !== false);
  const requiredLessons = lessons.filter((lesson) => lesson.required !== false);
  const completedRequired = requiredLessons.filter((lesson) => lessonProgressItem(lesson)?.completed).length;
  const totalRequired = requiredLessons.length;
  const percent = totalRequired ? Math.round((completedRequired / totalRequired) * 100) : 0;
  return { lessons, requiredLessons, completedRequired, totalRequired, percent };
}

function calculateCourseProgressForUser(course, userId) {
  const lessons = flattenCourseLessons(course).filter((lesson) => lesson.published !== false);
  const requiredLessons = lessons.filter((lesson) => lesson.required !== false);
  const completedRequired = requiredLessons.filter((lesson) => {
    const progressItems = Array.isArray(lesson.progress) ? lesson.progress : [];
    return progressItems.some((item) => item.userId === userId && item.completed);
  }).length;
  const totalRequired = requiredLessons.length;
  const percent = totalRequired ? Math.round((completedRequired / totalRequired) * 100) : 0;
  return { lessons, requiredLessons, completedRequired, totalRequired, percent };
}

function makeCertificateNumber(enrollment) {
  const year = new Date().getFullYear();
  const random = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `CIBI-${year}-${String(enrollment.courseId).padStart(3, "0")}-${String(enrollment.userId).padStart(4, "0")}-${random}`;
}

function isLessonUnlocked(course, targetLessonId) {
  const { lessons } = calculateCourseProgress(course);
  for (const lesson of lessons) {
    if (lesson.id === targetLessonId) return true;
    if (lesson.required !== false && !lessonProgressItem(lesson)?.completed) return false;
  }
  return false;
}

async function getStudentLearningCourse(userId, courseId) {
  const id = Number(courseId);
  const course = await prisma.course.findUnique({ where: { id }, select: { id: true, programmeId: true, generalForAllProgrammes: true, levelStage: true } });
  if (!course) return null;

  const enrollment = await prisma.enrollment.findFirst({
    where: {
      userId,
      admissionStatus: { in: ["APPROVED", "GRADUATED"] },
      accessStatus: { not: "BLOCKED" },
      OR: [
        { courseId: id },
        course.generalForAllProgrammes ? { admissionStatus: { in: ["APPROVED", "GRADUATED"] } } : { id: -1 },
        course.programmeId ? { programmeId: course.programmeId } : { id: -1 }
      ]
    },
    include: {
      certificate: true,
      programme: true,
      course: true
    }
  });

  if (!enrollment || !canEnrollmentUseCourse(enrollment, course)) return null;

  const learningCourse = await prisma.course.findUnique({
    where: { id },
    include: {
      programme: true,
      modules: {
        where: { published: true },
        include: {
          lessons: {
            where: { published: true },
            include: { progress: { where: { userId } } },
            orderBy: { lessonOrder: "asc" }
          }
        },
        orderBy: { moduleOrder: "asc" }
      },
      lessons: {
        where: { published: true },
        include: { progress: { where: { userId } } },
        orderBy: { lessonOrder: "asc" }
      },
      assignments: {
        where: { published: true },
        include: { submissions: { where: { userId } } },
        orderBy: { createdAt: "asc" }
      },
      quizzes: {
        where: { published: true },
        include: {
          questions: { orderBy: { questionOrder: "asc" } },
          attempts: { where: { userId }, orderBy: { createdAt: "desc" } }
        },
        orderBy: { createdAt: "asc" }
      },
      videos: {
        include: {
          uploadedBy: { select: { id: true, name: true, role: true } },
          progresses: { where: { userId } }
        },
        orderBy: [{ sortOrder: "asc" }, { chapter: "asc" }, { createdAt: "asc" }]
      },
      liveSessions: {
        where: { status: { in: ["live", "ended"] } },
        include: { startedBy: { select: { id: true, name: true, role: true } } },
        orderBy: { createdAt: "desc" }
      }
    }
  });

  return { ...enrollment, courseId: id, course: learningCourse, programme: enrollment.programme || learningCourse?.programme || null };
}

app.get("/api/health", async (req, res) => {
  const database = await checkDatabaseConnection();
  res.status(database ? 200 : 503).json({
    ok: database,
    status: database ? "healthy" : "degraded",
    uptime: process.uptime(),
    database,
    timestamp: new Date().toISOString()
  });
});

app.post(
  "/api/auth/register",
  registerLimiter,
  [
    validators.safeText("name", 120),
    validators.email,
    validators.password,
    validators.safeText("phone", 60, true),
    validators.safeText("country", 80, true)
  ],
  validateRequest,
  async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      country,
      password,
      programmeId,
      courseId,
      learningStream,
      applicationSource,
      ministryRole,
      yearsInMinistry,
      currentChurch,
      educationalBackground,
      previousMinistryExperience,
      howDidYouHear,
      personalStatement,
      additionalQuestions
    } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "Name, email and password are required" });
    }

    const selectedProgrammeId = Number(programmeId || 0);
    const selectedCourseId = Number(courseId || 0);
    let programme = null;
    let course = null;

    if (selectedProgrammeId) {
      programme = await prisma.programme.findFirst({ where: { id: selectedProgrammeId, published: true }, include: { courses: { where: { published: true }, orderBy: { title: "asc" } } } });
    }

    if (!programme && selectedCourseId) {
      course = await prisma.course.findFirst({ where: { id: selectedCourseId, published: true }, include: { programme: true } });
      programme = course?.programme || null;
    }

    if (!programme && !course) {
      return res.status(400).json({ message: "Please select the programme you are applying for." });
    }

    const selectedLearningStream = String(learningStream || "").trim();
    if (!selectedLearningStream) {
      return res.status(400).json({ message: "Please select your learning stream." });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ message: "Email already exists. Please login." });

    const hashed = await bcrypt.hash(password, 12);
    const applicationDetails = {
      applicationSource: String(applicationSource || "ADMISSION_PAGE").slice(0, 80),
      programmeId: programme?.id || null,
      programmeTitle: programme?.title || course?.title || "Selected programme",
      firstCourseId: course?.id || null,
      learningStream: selectedLearningStream,
      ministryRole: String(ministryRole || "").trim(),
      yearsInMinistry: String(yearsInMinistry || "").trim(),
      currentChurch: String(currentChurch || "").trim(),
      educationalBackground: String(educationalBackground || "").trim(),
      previousMinistryExperience: String(previousMinistryExperience || "").trim(),
      howDidYouHear: String(howDidYouHear || "").trim(),
      personalStatement: String(personalStatement || "").trim(),
      additionalQuestions: String(additionalQuestions || "").trim()
    };

    const { user, enrollment } = await prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          name,
          email,
          phone,
          country,
          password: hashed,
          role: "STUDENT",
          status: "PENDING_PAYMENT"
        }
      });

      const accessData = defaultEnrollmentAccessData(programme || course);
      const createdEnrollment = await tx.enrollment.create({
        data: {
          userId: createdUser.id,
          programmeId: programme?.id || null,
          courseId: programme ? null : course?.id,
          amount: programmeFeeAmount(programme || course),
          paymentStatus: "PENDING_PAYMENT",
          admissionStatus: "AWAITING_PAYMENT",
          paymentMethod: "NONE",
          learningStream: selectedLearningStream,
          ...accessData,
          applicationJson: JSON.stringify(applicationDetails),
          applicationSubmittedAt: new Date()
        },
        include: { programme: true, course: { include: { programme: true } } }
      });

      return { user: createdUser, enrollment: createdEnrollment };
    });

    queueEmailNotification({
      to: user.email,
      subject: "Welcome to CIBI",
      heading: "Your CIBI Application Has Started",
      body: `Dear ${user.name},

Your CIBI student account has been created.

Programme: ${programmeDisplayTitle(enrollment)}
Learning Stream: ${selectedLearningStream}

Please continue to payment. Portal access opens only after payment confirmation and admin approval.`,
      ctaText: "Continue Application",
      ctaUrl: "/admission"
    });
    queueAdminEmail({
      subject: "New CIBI student application",
      heading: "New Student Application",
      body: `${user.name} (${user.email}) applied for ${programmeDisplayTitle(enrollment)}.

Learning Stream: ${selectedLearningStream}

The student may proceed to payment.`,
      ctaUrl: "/admin"
    }).catch((error) => console.error("Admin registration email failed:", error.message));

    await setAuthCookies(res, user);
    res.status(201).json({
      message: "Application submitted. Please complete payment to continue.",
      user: publicUser(user),
      enrollment
    });
  } catch (error) {
    res.status(500).json({ message: "Registration failed", error: error.message });
  }
});

app.post(
  "/api/auth/login",
  loginLimiter,
  [validators.email, validators.password],
  validateRequest,
  async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ message: "Invalid login details" });

    if (user.lockedUntil && new Date(user.lockedUntil).getTime() > Date.now()) {
      return res.status(423).json({ message: "Account temporarily locked after too many failed login attempts. Please try again later." });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      const attempts = Number(user.failedLoginAttempts || 0) + 1;
      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: attempts,
          lockedUntil: attempts >= 5 ? new Date(Date.now() + 30 * 60 * 1000) : null
        }
      });
      return res.status(401).json({ message: "Invalid login details" });
    }

    await prisma.user.update({ where: { id: user.id }, data: { failedLoginAttempts: 0, lockedUntil: null } });
    await setAuthCookies(res, user);
    res.json({ user: publicUser(user) });
  } catch (error) {
    res.status(500).json({ message: "Login failed", error: error.message });
  }
});

app.post("/api/auth/refresh", otpLimiter, refreshAccessToken);

app.post("/api/auth/logout", requireAuth, async (req, res) => {
  await prisma.user.update({ where: { id: req.user.id }, data: { refreshTokenHash: null } });
  clearAuthCookies(res);
  res.json({ message: "Logged out successfully" });
});

app.get("/api/auth/me", requireAuth, async (req, res) => {
  res.json({ user: publicUser(req.user) });
});


app.patch("/api/student/profile", requireAuth, async (req, res) => {
  try {
    const name = String(req.body?.name || "").trim();
    const email = String(req.body?.email || "").trim().toLowerCase();
    const phone = req.body?.phone === undefined ? undefined : String(req.body.phone || "").trim();
    const country = req.body?.country === undefined ? undefined : String(req.body.country || "").trim();

    if (!name || name.split(/\s+/).length < 2) {
      return res.status(400).json({ message: "Please enter your full name." });
    }
    if (!email) return res.status(400).json({ message: "Email address is required." });

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing && existing.id !== req.user.id) {
      return res.status(409).json({ message: "This email address is already used by another account." });
    }

    const updated = await prisma.user.update({
      where: { id: req.user.id },
      data: { name, email, phone, country }
    });

    res.json({ message: "Profile updated successfully.", user: publicUser(updated) });
  } catch (error) {
    res.status(500).json({ message: "Profile update failed", error: error.message });
  }
});


app.post("/api/admin/email/test", requireAuth, requireAdmin, async (req, res) => {
  try {
    const settings = await getEmailSettings();
    const to = req.body?.to || req.user.email || settings.email_admin_recipients;
    const result = await sendEmailNotification({
      to,
      subject: "CIBI email notification test",
      heading: "Email Notifications Are Working",
      body: "This is a test email from your CIBI platform. If you received this, your SMTP settings are correct.",
      ctaText: "Open CIBI",
      ctaUrl: "/admin"
    });
    res.json({ message: result?.skipped ? `Email not sent: ${result.reason}` : "Test email sent successfully.", result: result?.skipped ? result : { accepted: result.accepted, rejected: result.rejected } });
  } catch (error) {
    res.status(500).json({ message: "Could not send test email", error: error.message });
  }
});

app.get("/api/public/bootstrap", async (req, res) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  const [slides, books, programmes, courses, announcements, liveSession, settingsRows, testimonials, faqs, gallery] = await Promise.all([
    prisma.slide.findMany({ where: { active: true }, orderBy: { slideOrder: "asc" } }),
    prisma.book.findMany({ where: { published: true }, orderBy: { createdAt: "desc" } }),
    prisma.programme.findMany({ where: { published: true }, include: { courses: { where: { published: true }, orderBy: { title: "asc" } } }, orderBy: { createdAt: "desc" } }),
    prisma.course.findMany({
      where: { published: true },
      include: {
        programme: true,
        modules: { where: { published: true }, include: { lessons: { where: { published: true }, orderBy: { lessonOrder: "asc" } } }, orderBy: { moduleOrder: "asc" } },
        lessons: { where: { published: true }, orderBy: { lessonOrder: "asc" } }
      },
      orderBy: { createdAt: "desc" }
    }),
    prisma.announcement.findMany({ where: { published: true }, orderBy: { createdAt: "desc" } }),
    prisma.liveSession.findFirst({ where: { active: true }, orderBy: { updatedAt: "desc" } }),
    prisma.setting.findMany(),
    prisma.testimonial.findMany({ where: { published: true }, orderBy: { createdAt: "desc" } }),
    prisma.faq.findMany({ where: { published: true }, orderBy: { createdAt: "desc" } }),
    prisma.gallery.findMany({ where: { published: true }, orderBy: { createdAt: "desc" } })
  ]);

  const settings = Object.fromEntries(settingsRows.map((row) => [row.key, row.value]));
  res.json({ slides, books, programmes, courses, announcements, liveSession, settings, testimonials, faqs, gallery });
});

app.get("/api/student/dashboard", requireAuth, requireActiveStudent, async (req, res) => {
  const [enrollments, generalCourses, announcements, liveSession, settingsRows] = await Promise.all([
    prisma.enrollment.findMany({
      where: { userId: req.user.id, admissionStatus: { in: ["APPROVED", "GRADUATED"] }, accessStatus: { not: "BLOCKED" } },
      include: {
        certificate: true,
        programme: {
          include: { courses: { where: { published: true }, include: studentCourseInclude(req.user.id), orderBy: { title: "asc" } } }
        },
        course: { include: studentCourseInclude(req.user.id) }
      },
      orderBy: { createdAt: "desc" }
    }),
    prisma.course.findMany({ where: { published: true, generalForAllProgrammes: true }, include: studentCourseInclude(req.user.id), orderBy: { title: "asc" } }),
    prisma.announcement.findMany({ where: { published: true }, orderBy: { createdAt: "desc" } }),
    prisma.liveSession.findFirst({ where: { active: true }, orderBy: { updatedAt: "desc" } }),
    prisma.setting.findMany()
  ]);

  const expandedEnrollments = [];
  for (const enrollment of enrollments) {
    const programmeCourses = enrollment.programme?.courses || [];
    if (enrollment.programmeId && programmeCourses.length) {
      const allowedCourses = [...programmeCourses, ...generalCourses.filter((course) => !programmeCourses.some((item) => item.id === course.id))].filter((course) => canEnrollmentUseCourse(enrollment, course));
      for (const course of allowedCourses) {
        const summary = calculateCourseCompletionForUser(course, enrollment.userId);
        expandedEnrollments.push({
          ...enrollment,
          virtualEnrollmentId: `${enrollment.id}-${course.id}`,
          course,
          courseId: course.id,
          programmeTitle: enrollment.programme.title,
          course: { ...course, learningSummary: { percent: summary.percent, completedRequired: summary.completedRequired, totalRequired: summary.totalRequired } }
        });
      }
    } else if (enrollment.course) {
      const summary = calculateCourseCompletionForUser(enrollment.course, enrollment.userId);
      expandedEnrollments.push({
        ...enrollment,
        virtualEnrollmentId: String(enrollment.id),
        programmeTitle: programmeDisplayTitle(enrollment),
        course: {
          ...enrollment.course,
          learningSummary: { percent: summary.percent, completedRequired: summary.completedRequired, totalRequired: summary.totalRequired }
        }
      });
    }
  }

  const settings = Object.fromEntries(settingsRows.map((row) => [row.key, row.value]));
  res.json({ enrollments: expandedEnrollments, announcements, liveSession, settings });
});

app.get("/api/student/courses/:courseId/learning", requireAuth, requireActiveStudent, async (req, res) => {
  const enrollment = await getStudentLearningCourse(req.user.id, req.params.courseId);
  if (!enrollment) return res.status(404).json({ message: "Course not found for this student." });

  const summary = calculateCourseCompletionForUser(enrollment.course, enrollment.userId);
  const safeCourse = sanitizeCourseVideosForClient(enrollment.course, false);
  res.json({ enrollment: { ...enrollment, course: { ...safeCourse, learningSummary: summary } } });
});

app.post("/api/student/lessons/:lessonId/progress", requireAuth, requireActiveStudent, async (req, res) => {
  try {
    const lesson = await prisma.lesson.findUnique({ where: { id: Number(req.params.lessonId) } });
    if (!lesson) return res.status(404).json({ message: "Lesson not found." });

    const enrollment = await getStudentLearningCourse(req.user.id, lesson.courseId);
    if (!enrollment) return res.status(403).json({ message: "You are not approved for this course." });

    if (!isLessonUnlocked(enrollment.course, lesson.id)) {
      return res.status(403).json({ message: "Complete the previous required lesson before opening this one." });
    }

    const currentProgress = Math.max(0, Math.min(100, Number(req.body?.progressPercent || 0)));
    const threshold = Math.max(1, Math.min(100, Number(lesson.completionPercentRequired || 90)));
    const completed = Boolean(req.body?.completed) || currentProgress >= threshold;

    const progress = await prisma.lessonProgress.upsert({
      where: { userId_lessonId: { userId: req.user.id, lessonId: lesson.id } },
      update: {
        progressPercent: completed ? Math.max(currentProgress, threshold) : currentProgress,
        completed,
        completedAt: completed ? new Date() : null
      },
      create: {
        userId: req.user.id,
        lessonId: lesson.id,
        progressPercent: completed ? Math.max(currentProgress, threshold) : currentProgress,
        completed,
        completedAt: completed ? new Date() : null
      }
    });

    const updatedEnrollment = await getStudentLearningCourse(req.user.id, lesson.courseId);
    const summary = calculateCourseProgress(updatedEnrollment.course);
    if (completed && summary.percent >= 100) {
      queueAdminEmail({
        subject: "CIBI student completed required lessons",
        heading: "Student May Be Ready for Review",
        body: `${req.user.name} (${req.user.email}) has completed all required lessons for ${updatedEnrollment.course?.title || "a CIBI course"}. Check Gradebook and certificate eligibility, including assignments and quizzes.`,
        ctaText: "Open Gradebook",
        ctaUrl: "/admin"
      }).catch((error) => console.error("Admin completion email failed:", error.message));
    }
    res.json({ progress, learningSummary: summary });
  } catch (error) {
    res.status(400).json({ message: "Could not save lesson progress", error: error.message });
  }
});

app.get("/api/student/payment-status", requireAuth, async (req, res) => {
  const enrollments = await prisma.enrollment.findMany({
    where: { userId: req.user.id },
    include: { programme: true, course: { include: { programme: true } } },
    orderBy: { createdAt: "desc" }
  });
  res.json({ user: publicUser(req.user), enrollments });
});


async function studentCanSeeLiveCourse(userId, courseId) {
  const id = Number(courseId || 0);
  if (!userId || !id) return false;
  const course = await prisma.course.findUnique({
    where: { id },
    select: { id: true, programmeId: true, generalForAllProgrammes: true, levelStage: true }
  });
  if (!course) return false;

  const enrollment = await prisma.enrollment.findFirst({
    where: {
      userId,
      admissionStatus: { in: ["APPROVED", "GRADUATED"] },
      accessStatus: { not: "BLOCKED" },
      OR: [
        { courseId: id },
        course.generalForAllProgrammes ? { admissionStatus: { in: ["APPROVED", "GRADUATED"] } } : { id: -1 },
        course.programmeId ? { programmeId: course.programmeId } : { id: -1 }
      ]
    }
  });

  return canEnrollmentUseCourse(enrollment, course);
}

async function findAllowedLiveSessionForStudent({ userId, activeOnly = true } = {}) {
  const sessions = await prisma.liveSession.findMany({
    where: activeOnly ? { active: true } : {},
    include: { course: { select: { id: true, title: true } }, startedBy: { select: { id: true, name: true, role: true } } },
    orderBy: { updatedAt: "desc" },
    take: 25
  });

  for (const session of sessions) {
    if (!session.courseId) return session;
    if (await studentCanSeeLiveCourse(userId, session.courseId)) return session;
  }

  return null;
}

async function staffCanSeeLiveSession(user, session) {
  if (!user || !session || !isAdminRole(user.role)) return false;
  if (session.startedById && Number(session.startedById) === Number(user.id)) return true;
  if (!session.courseId) return true;
  return canManageCourse({ user }, session.courseId);
}

async function findAllowedLiveSessionForStaff({ user, activeOnly = true } = {}) {
  const sessions = await prisma.liveSession.findMany({
    where: activeOnly ? { active: true } : {},
    include: {
      course: { select: { id: true, title: true } },
      startedBy: { select: { id: true, name: true, role: true } }
    },
    orderBy: [{ active: "desc" }, { updatedAt: "desc" }],
    take: 50
  });

  for (const session of sessions) {
    if (await staffCanSeeLiveSession(user, session)) return session;
  }

  return null;
}

async function getLiveSessionForClassroom(includeInactiveLatest = false, viewerUserId = null) {
  if (viewerUserId) {
    const active = await findAllowedLiveSessionForStudent({ userId: viewerUserId, activeOnly: true });
    if (active || !includeInactiveLatest) return active;
    return findAllowedLiveSessionForStudent({ userId: viewerUserId, activeOnly: false });
  }

  const active = await prisma.liveSession.findFirst({
    where: { active: true },
    include: { course: { select: { id: true, title: true } }, startedBy: { select: { id: true, name: true, role: true } } },
    orderBy: { updatedAt: "desc" }
  });
  if (active || !includeInactiveLatest) return active;
  return prisma.liveSession.findFirst({ include: { course: { select: { id: true, title: true } }, startedBy: { select: { id: true, name: true, role: true } } }, orderBy: { updatedAt: "desc" } });
}

async function buildLiveClassroomPayload(liveSession, viewerUserId = null) {
  if (!liveSession) {
    return { liveSession: null, chatMessages: [], questions: [], attendances: [], attendance: null, attendanceCount: 0 };
  }

  const [chatMessages, questions, attendances, attendance] = await Promise.all([
    prisma.liveChatMessage.findMany({
      where: { liveSessionId: liveSession.id },
      include: { user: { select: { id: true, name: true, role: true } } },
      orderBy: { createdAt: "asc" },
      take: 120
    }),
    prisma.liveQuestion.findMany({
      where: { liveSessionId: liveSession.id },
      include: { user: { select: { id: true, name: true, role: true } } },
      orderBy: { createdAt: "desc" },
      take: 120
    }),
    prisma.liveAttendance.findMany({
      where: { liveSessionId: liveSession.id },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { joinedAt: "asc" }
    }),
    viewerUserId
      ? prisma.liveAttendance.findUnique({ where: { liveSessionId_userId: { liveSessionId: liveSession.id, userId: viewerUserId } } })
      : null
  ]);

  return { liveSession, chatMessages, questions, attendances, attendance, attendanceCount: attendances.length };
}

app.get("/api/student/live/classroom", requireAuth, requireActiveStudent, async (req, res) => {
  const liveSession = await getLiveSessionForClassroom(false, req.user.id);
  if (!liveSession) return res.json(await buildLiveClassroomPayload(null, req.user.id));

  await prisma.liveAttendance.upsert({
    where: { liveSessionId_userId: { liveSessionId: liveSession.id, userId: req.user.id } },
    update: { lastSeenAt: new Date() },
    create: { liveSessionId: liveSession.id, userId: req.user.id }
  });

  res.json(await buildLiveClassroomPayload(liveSession, req.user.id));
});

app.post("/api/student/live/attendance", requireAuth, requireActiveStudent, async (req, res) => {
  const liveSession = await getLiveSessionForClassroom(false, req.user.id);
  if (!liveSession) return res.status(404).json({ message: "No active live class currently." });

  const attendance = await prisma.liveAttendance.upsert({
    where: { liveSessionId_userId: { liveSessionId: liveSession.id, userId: req.user.id } },
    update: { lastSeenAt: new Date() },
    create: { liveSessionId: liveSession.id, userId: req.user.id }
  });

  res.json({ message: "Attendance marked", attendance });
});

app.post("/api/student/live/chat", requireAuth, requireActiveStudent, async (req, res) => {
  const liveSession = await getLiveSessionForClassroom(false, req.user.id);
  if (!liveSession) return res.status(404).json({ message: "No active live class currently." });
  if (liveSession.chatEnabled === false) return res.status(403).json({ message: "Live chat is currently turned off by the lecturer." });

  const message = String(req.body?.message || "").trim();
  if (!message) return res.status(400).json({ message: "Chat message is required." });
  if (message.length > 500) return res.status(400).json({ message: "Chat message is too long. Keep it under 500 characters." });

  await prisma.liveAttendance.upsert({
    where: { liveSessionId_userId: { liveSessionId: liveSession.id, userId: req.user.id } },
    update: { lastSeenAt: new Date() },
    create: { liveSessionId: liveSession.id, userId: req.user.id }
  });

  const chat = await prisma.liveChatMessage.create({
    data: { liveSessionId: liveSession.id, userId: req.user.id, message },
    include: { user: { select: { id: true, name: true, role: true } } }
  });

  res.status(201).json(chat);
});

app.post("/api/student/live/questions", requireAuth, requireActiveStudent, async (req, res) => {
  const liveSession = await getLiveSessionForClassroom(false, req.user.id);
  if (!liveSession) return res.status(404).json({ message: "No active live class currently." });

  const question = String(req.body?.question || "").trim();
  if (!question) return res.status(400).json({ message: "Question is required." });
  if (question.length > 1000) return res.status(400).json({ message: "Question is too long. Keep it under 1000 characters." });

  await prisma.liveAttendance.upsert({
    where: { liveSessionId_userId: { liveSessionId: liveSession.id, userId: req.user.id } },
    update: { lastSeenAt: new Date() },
    create: { liveSessionId: liveSession.id, userId: req.user.id }
  });

  const created = await prisma.liveQuestion.create({
    data: { liveSessionId: liveSession.id, userId: req.user.id, question },
    include: { user: { select: { id: true, name: true, role: true } } }
  });

  res.status(201).json(created);
});


app.post("/api/uploads/payment-proof", requireAuth, async (req, res) => {
  try {
    const { fileName, contentType, dataUrl } = req.body || {};
    const relativeUrl = await saveBase64PaymentProof({ fileName, contentType, dataUrl });
    const absoluteUrl = `${req.protocol}://${req.get("host")}${relativeUrl}`;
    res.status(201).json({ url: absoluteUrl, relativeUrl });
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message || "Could not upload payment receipt" });
  }
});

app.get("/api/certificates/settings", async (req, res) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.json(await getCertificateSettings());
});

app.post("/api/uploads/certificate-asset", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { fileName, contentType, dataUrl } = req.body || {};
    const relativeUrl = await saveBase64CertificateAsset({ fileName, contentType, dataUrl });
    const absoluteUrl = `${req.protocol}://${req.get("host")}${relativeUrl}`;
    res.status(201).json({ url: absoluteUrl, relativeUrl });
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message || "Could not upload certificate image" });
  }
});

app.post("/api/uploads/assignment-file", requireAuth, requireActiveStudent, async (req, res) => {
  try {
    const { fileName, contentType, dataUrl } = req.body || {};
    const relativeUrl = await saveBase64AssignmentFile({ fileName, contentType, dataUrl });
    const absoluteUrl = `${req.protocol}://${req.get("host")}${relativeUrl}`;
    res.status(201).json({ url: absoluteUrl, relativeUrl });
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message || "Could not upload assignment file" });
  }
});



app.post("/api/admin/brochure/upload", requireAuth, requireAdmin, async (req, res) => {
  try {
    const fileNameInput = String(req.body?.fileName || "CIBI-Brochure.pdf");
    const contentType = String(req.body?.contentType || "application/pdf").toLowerCase();
    const dataUrl = String(req.body?.dataUrl || "");

    if (!dataUrl) return res.status(400).json({ message: "Brochure PDF file is required." });

    const ext = path.extname(fileNameInput).toLowerCase();
    if (ext !== ".pdf" || (contentType && contentType !== "application/pdf")) {
      return res.status(400).json({ message: "Only PDF brochure files are allowed." });
    }

    const base64 = dataUrl.includes(",") ? dataUrl.split(",").pop() : dataUrl;
    const buffer = Buffer.from(base64 || "", "base64");
    if (!buffer.length) return res.status(400).json({ message: "The selected brochure file is empty." });
    if (buffer.length > 8 * 1024 * 1024) {
      return res.status(400).json({ message: "Brochure PDF must not be more than 8MB." });
    }

    await fs.mkdir(BROCHURE_DIR, { recursive: true });

    const safeOriginalName = fileNameInput
      .replace(/[\\/\"]/g, "")
      .slice(0, 180) || "CIBI-Brochure.pdf";
    const fileName = `${Date.now()}-${crypto.randomUUID()}.pdf`;
    const savedPath = path.join(BROCHURE_DIR, fileName);

    await fs.writeFile(savedPath, buffer);

    const relativePath = `uploads/brochures/${fileName}`;
    const publicUrl = `${req.protocol}://${req.get("host")}/uploads/brochures/${fileName}`;
    const rows = [
      ["brochure_pdf_url", publicUrl],
      ["brochure_pdf_path", relativePath],
      ["brochure_original_name", safeOriginalName],
      ["brochure_uploaded_at", new Date().toISOString()]
    ];

    await prisma.$transaction(rows.map(([key, value]) => (
      prisma.setting.upsert({
        where: { key },
        update: { value },
        create: { key, value }
      })
    )));

    await logAdminActivity(req, {
      action: "UPLOADED_BROCHURE",
      entityType: "Setting",
      details: { fileName: safeOriginalName, brochureUrl: publicUrl }
    });

    res.status(201).json({
      message: "Brochure uploaded successfully.",
      brochureUrl: publicUrl,
      downloadUrl: "/api/public/brochure/download",
      originalName: safeOriginalName
    });
  } catch (error) {
    res.status(500).json({ message: "Could not upload brochure", error: error.message });
  }
});

app.get("/api/public/brochure/download", async (req, res) => {
  try {
    const rows = await prisma.setting.findMany({
      where: { key: { in: ["brochure_pdf_url", "brochure_pdf_path", "brochure_original_name"] } }
    });
    const settings = Object.fromEntries(rows.map((row) => [row.key, row.value]));
    const brochurePath = String(settings.brochure_pdf_path || "").replace(/^\/+/, "");
    const brochureUrl = String(settings.brochure_pdf_url || "").trim();

    if (!brochurePath && !brochureUrl) return res.status(404).send("CIBI brochure has not been uploaded yet.");

    const fileName = String(settings.brochure_original_name || "CIBI-Brochure.pdf")
      .replace(/[\\/\"]/g, "")
      .slice(0, 160) || "CIBI-Brochure.pdf";

    res.set("Cache-Control", "no-store");
    res.set("Content-Type", "application/pdf");
    res.set("Content-Disposition", `attachment; filename="${fileName}"`);

    if (brochurePath.startsWith("uploads/brochures/")) {
      const localPath = path.join(process.cwd(), brochurePath);
      return res.sendFile(localPath, (error) => {
        if (error && !res.headersSent) res.status(404).send("Brochure file not found on server. Please upload it again.");
      });
    }

    if (brochureUrl) return res.redirect(brochureUrl);
    return res.status(404).send("Brochure file not found. Please upload it again.");
  } catch (error) {
    res.status(500).send("Could not download brochure.");
  }
});


async function getStudentApplicationEnrollment(userId, requestedCourseId = null) {
  const courseId = requestedCourseId ? Number(requestedCourseId) : null;
  const where = courseId ? { userId, courseId } : { userId };
  return prisma.enrollment.findFirst({
    where,
    include: { course: true },
    orderBy: { createdAt: "desc" }
  });
}

app.post("/api/payments/manual", requireAuth, async (req, res) => {
  try {
    const { programmeId, courseId, manualReference, paymentProofUrl } = req.body;
    if (!paymentProofUrl) return res.status(400).json({ message: "Payment receipt is required for bank transfer." });

    const selectedProgrammeId = Number(programmeId || 0);
    const selectedCourseId = Number(courseId || 0);
    let programme = selectedProgrammeId ? await prisma.programme.findFirst({ where: { id: selectedProgrammeId, published: true } }) : null;
    let course = null;
    if (!programme && selectedCourseId) {
      course = await prisma.course.findFirst({ where: { id: selectedCourseId, published: true }, include: { programme: true } });
      programme = course?.programme || null;
    }
    if (!programme && !course) return res.status(404).json({ message: "Programme not found" });

    const amount = programmeFeeAmount(programme || course);
    const accessData = defaultEnrollmentAccessData(programme || course);
    const enrollment = programme
      ? await prisma.enrollment.upsert({
          where: { userId_programmeId: { userId: req.user.id, programmeId: programme.id } },
          create: {
            userId: req.user.id,
            programmeId: programme.id,
            amount,
            paymentStatus: "MANUAL_PAYMENT_PENDING",
            admissionStatus: "AWAITING_ADMIN_APPROVAL",
            paymentMethod: "BANK_TRANSFER",
            manualReference,
            paymentProofUrl,
            ...accessData
          },
          update: {
            amount,
            paymentStatus: "MANUAL_PAYMENT_PENDING",
            admissionStatus: "AWAITING_ADMIN_APPROVAL",
            paymentMethod: "BANK_TRANSFER",
            manualReference,
            paymentProofUrl
          },
          include: { programme: true, course: true }
        })
      : await prisma.enrollment.upsert({
          where: { userId_courseId: { userId: req.user.id, courseId: course.id } },
          create: {
            userId: req.user.id,
            courseId: course.id,
            amount,
            paymentStatus: "MANUAL_PAYMENT_PENDING",
            admissionStatus: "AWAITING_ADMIN_APPROVAL",
            paymentMethod: "BANK_TRANSFER",
            manualReference,
            paymentProofUrl,
            ...accessData
          },
          update: {
            amount,
            paymentStatus: "MANUAL_PAYMENT_PENDING",
            admissionStatus: "AWAITING_ADMIN_APPROVAL",
            paymentMethod: "BANK_TRANSFER",
            manualReference,
            paymentProofUrl
          },
          include: { programme: true, course: true }
        });

    await prisma.user.update({ where: { id: req.user.id }, data: { status: "MANUAL_PAYMENT_PENDING" } });
    const title = programmeDisplayTitle(enrollment);

    queueEmailNotification({
      to: req.user.email,
      subject: "CIBI payment receipt received",
      heading: "Payment Receipt Submitted",
      body: `Dear ${req.user.name},

Your bank transfer receipt for ${title} has been submitted. CIBI admin will verify your payment and approve portal access after confirmation.`,
      ctaText: "Check Portal Status",
      ctaUrl: "/student"
    });
    queueAdminEmail({
      subject: "New CIBI bank transfer receipt",
      heading: "Payment Receipt Uploaded",
      body: `${req.user.name} (${req.user.email}) submitted a bank transfer receipt for ${title}. Please verify and approve if payment is confirmed.`,
      ctaText: "Review Student Payment",
      ctaUrl: "/admin"
    }).catch((error) => console.error("Admin payment email failed:", error.message));

    res.json({ message: "Manual payment submitted. Admin will verify and approve.", enrollment });
  } catch (error) {
    res.status(500).json({ message: "Manual payment submission failed", error: error.message });
  }
});

app.post("/api/payments/paystack/initialize", requireAuth, async (req, res) => {
  try {
    const { programmeId, courseId } = req.body;
    const selectedProgrammeId = Number(programmeId || 0);
    const selectedCourseId = Number(courseId || 0);
    let programme = selectedProgrammeId ? await prisma.programme.findFirst({ where: { id: selectedProgrammeId, published: true } }) : null;
    let course = null;
    if (!programme && selectedCourseId) {
      course = await prisma.course.findFirst({ where: { id: selectedCourseId, published: true }, include: { programme: true } });
      programme = course?.programme || null;
    }
    if (!programme && !course) return res.status(404).json({ message: "Programme not found" });
    if (!process.env.PAYSTACK_SECRET_KEY) return res.status(500).json({ message: "Paystack secret key is missing" });

    const targetId = programme?.id || course.id;
    const targetPrefix = programme ? "P" : "C";
    const reference = `CIBI-${req.user.id}-${targetPrefix}${targetId}-${Date.now()}`;
    const amount = programmeFeeAmount(programme || course);
    const accessData = defaultEnrollmentAccessData(programme || course);

    const enrollment = programme
      ? await prisma.enrollment.upsert({
          where: { userId_programmeId: { userId: req.user.id, programmeId: programme.id } },
          create: {
            userId: req.user.id,
            programmeId: programme.id,
            amount,
            paymentStatus: "PENDING_PAYMENT",
            admissionStatus: "AWAITING_PAYMENT",
            paymentMethod: "PAYSTACK",
            paystackReference: reference,
            ...accessData
          },
          update: {
            amount,
            paymentStatus: "PENDING_PAYMENT",
            admissionStatus: "AWAITING_PAYMENT",
            paymentMethod: "PAYSTACK",
            paystackReference: reference
          }
        })
      : await prisma.enrollment.upsert({
          where: { userId_courseId: { userId: req.user.id, courseId: course.id } },
          create: {
            userId: req.user.id,
            courseId: course.id,
            amount,
            paymentStatus: "PENDING_PAYMENT",
            admissionStatus: "AWAITING_PAYMENT",
            paymentMethod: "PAYSTACK",
            paystackReference: reference,
            ...accessData
          },
          update: {
            amount,
            paymentStatus: "PENDING_PAYMENT",
            admissionStatus: "AWAITING_PAYMENT",
            paymentMethod: "PAYSTACK",
            paystackReference: reference
          }
        });

    const response = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        email: req.user.email,
        amount: amountToKobo(amount),
        reference,
        callback_url: process.env.PAYSTACK_CALLBACK_URL || `${CLIENT_URL}/payment-callback`,
        metadata: {
          userId: req.user.id,
          programmeId: programme?.id || null,
          courseId: course?.id || null,
          programmeTitle: programme?.title || course?.title || "CIBI programme"
        }
      })
    });

    const data = await response.json();
    if (!response.ok || !data.status) {
      return res.status(400).json({ message: "Could not initialize Paystack payment", data });
    }

    res.json({ authorizationUrl: data.data.authorization_url, reference, enrollment });
  } catch (error) {
    res.status(500).json({ message: "Paystack initialization failed", error: error.message });
  }
});

app.get("/api/payments/paystack/verify/:reference", requireAuth, async (req, res) => {
  try {
    const { reference } = req.params;
    if (!process.env.PAYSTACK_SECRET_KEY) return res.status(500).json({ message: "Paystack secret key is missing" });

    const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` }
    });

    const data = await response.json();
    if (!response.ok || !data.status) return res.status(400).json({ message: "Could not verify payment", data });

    const paid = data.data.status === "success";
    const enrollment = await prisma.enrollment.findFirst({
      where: { paystackReference: reference },
      include: { programme: true, course: { include: { programme: true } } }
    });
    if (!enrollment) return res.status(404).json({ message: "Enrollment not found" });

    if (paid) {
      await prisma.enrollment.update({
        where: { id: enrollment.id },
        data: { paymentStatus: "PAYMENT_CONFIRMED", admissionStatus: "AWAITING_ADMIN_APPROVAL", paymentMethod: "PAYSTACK" }
      });
      const paidUser = await prisma.user.update({ where: { id: enrollment.userId }, data: { status: "PAYMENT_CONFIRMED" } });
      const title = programmeDisplayTitle(enrollment);
      queueEmailNotification({
        to: paidUser.email,
        subject: "CIBI payment confirmed",
        heading: "Payment Confirmed",
        body: `Dear ${paidUser.name},

Your Paystack payment for ${title} has been confirmed. CIBI admin will complete admission approval before portal access opens.`,
        ctaText: "Check Portal Status",
        ctaUrl: "/student"
      });
      queueAdminEmail({
        subject: "CIBI Paystack payment confirmed",
        heading: "Payment Confirmed",
        body: `${paidUser.name} (${paidUser.email}) completed Paystack payment for ${title}. Please review admission approval.`,
        ctaUrl: "/admin"
      }).catch((error) => console.error("Admin Paystack email failed:", error.message));
    }

    res.json({ paid, paystack: data.data });
  } catch (error) {
    res.status(500).json({ message: "Paystack verification failed", error: error.message });
  }
});


app.get("/api/student/support/cases", requireAuth, async (req, res) => {
  const cases = await prisma.appeal.findMany({
    where: { userId: req.user.id },
    include: {
      enrollment: { include: { course: true } },
      messages: { include: { sender: { select: { id: true, name: true, role: true } } }, orderBy: { createdAt: "asc" } }
    },
    orderBy: { updatedAt: "desc" }
  });
  res.json(cases);
});

app.post("/api/student/support/cases", requireAuth, async (req, res) => {
  try {
    const subject = String(req.body?.subject || "Support Request").trim();
    const message = String(req.body?.message || "").trim();
    const category = String(req.body?.category || "GENERAL_SUPPORT").trim();
    const enrollmentId = req.body?.enrollmentId ? Number(req.body.enrollmentId) : null;

    if (!message) return res.status(400).json({ message: "Support message is required." });
    if (message.length > 2000) return res.status(400).json({ message: "Support message is too long. Keep it under 2000 characters." });

    if (enrollmentId) {
      const enrollment = await prisma.enrollment.findFirst({ where: { id: enrollmentId, userId: req.user.id } });
      if (!enrollment) return res.status(403).json({ message: "You cannot attach this enrollment to your case." });
    }

    const created = await prisma.appeal.create({
      data: {
        userId: req.user.id,
        enrollmentId,
        category,
        subject,
        status: "OPEN",
        messages: { create: { senderId: req.user.id, message } }
      },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true, status: true } },
        enrollment: { include: { course: true } },
        messages: { include: { sender: { select: { id: true, name: true, role: true } } }, orderBy: { createdAt: "asc" } }
      }
    });

    queueAdminEmail({
      subject: "New CIBI support / appeal case",
      heading: "New Support Case",
      body: `${req.user.name} (${req.user.email}) opened a support case: ${subject}.

Message: ${message}`,
      ctaText: "Open Support Inbox",
      ctaUrl: "/admin"
    }).catch((error) => console.error("Admin support email failed:", error.message));

    res.status(201).json(created);
  } catch (error) {
    res.status(500).json({ message: "Could not create support case", error: error.message });
  }
});

app.post("/api/student/support/cases/:id/messages", requireAuth, async (req, res) => {
  try {
    const appeal = await prisma.appeal.findFirst({ where: { id: Number(req.params.id), userId: req.user.id } });
    if (!appeal) return res.status(404).json({ message: "Support case not found." });

    const message = String(req.body?.message || "").trim();
    if (!message) return res.status(400).json({ message: "Message is required." });
    if (message.length > 2000) return res.status(400).json({ message: "Message is too long. Keep it under 2000 characters." });

    const created = await prisma.supportMessage.create({
      data: { appealId: appeal.id, senderId: req.user.id, message },
      include: { sender: { select: { id: true, name: true, role: true } } }
    });

    await prisma.appeal.update({ where: { id: appeal.id }, data: { status: appeal.status === "CLOSED" ? "OPEN" : "WAITING_ADMIN" } });
    queueAdminEmail({
      subject: "CIBI student replied to support",
      heading: "Student Support Reply",
      body: `${req.user.name} replied to a support case.

Message: ${message}`,
      ctaText: "Open Support Inbox",
      ctaUrl: "/admin"
    }).catch((error) => console.error("Admin support reply email failed:", error.message));
    res.status(201).json(created);
  } catch (error) {
    res.status(500).json({ message: "Could not send support message", error: error.message });
  }
});

app.get("/api/admin/support/cases", requireAuth, requireAdmin, async (req, res) => {
  const cases = await prisma.appeal.findMany({
    include: {
      user: { select: { id: true, name: true, email: true, phone: true, status: true } },
      enrollment: { include: { course: true } },
      messages: { include: { sender: { select: { id: true, name: true, role: true } } }, orderBy: { createdAt: "asc" } }
    },
    orderBy: { updatedAt: "desc" }
  });
  res.json(cases);
});

app.patch("/api/admin/support/cases/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const status = req.body?.status ? String(req.body.status) : undefined;
    const priority = req.body?.priority ? String(req.body.priority) : undefined;
    const updated = await prisma.appeal.update({
      where: { id: Number(req.params.id) },
      data: {
        status,
        priority,
        closedAt: status === "CLOSED" || status === "RESOLVED" ? new Date() : null
      },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true, status: true } },
        enrollment: { include: { course: true } },
        messages: { include: { sender: { select: { id: true, name: true, role: true } } }, orderBy: { createdAt: "asc" } }
      }
    });
    res.json(updated);
  } catch (error) {
    res.status(400).json({ message: "Could not update support case", error: error.message });
  }
});

app.post("/api/admin/support/cases/:id/restore-access", requireAuth, requireAdmin, async (req, res) => {
  try {
    const appeal = await prisma.appeal.findUnique({
      where: { id: Number(req.params.id) },
      include: { enrollment: true, user: true }
    });
    if (!appeal) return res.status(404).json({ message: "Support case not found." });

    let enrollment = appeal.enrollment;
    if (!enrollment) {
      enrollment = await prisma.enrollment.findFirst({
        where: { userId: appeal.userId },
        orderBy: { createdAt: "desc" }
      });
    }

    if (!enrollment) {
      return res.status(400).json({ message: "No programme enrollment found for this student. Ask the student to select a programme first." });
    }

    const note = String(req.body?.message || "Your appeal has been reviewed. Your portal access has been restored.").trim();
    const now = new Date();

    await prisma.$transaction([
      prisma.enrollment.update({
        where: { id: enrollment.id },
        data: {
          paymentStatus: "PAYMENT_CONFIRMED",
          admissionStatus: "APPROVED",
          approvedAt: now
        }
      }),
      prisma.user.update({
        where: { id: appeal.userId },
        data: { status: "ACTIVE" }
      }),
      prisma.supportMessage.create({
        data: { appealId: appeal.id, senderId: req.user.id, message: note }
      }),
      prisma.appeal.update({
        where: { id: appeal.id },
        data: { status: "RESOLVED", closedAt: now }
      })
    ]);

    const updated = await prisma.appeal.findUnique({
      where: { id: appeal.id },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true, status: true } },
        enrollment: { include: { course: true } },
        messages: { include: { sender: { select: { id: true, name: true, role: true } } }, orderBy: { createdAt: "asc" } }
      }
    });

    if (updated?.user?.email) {
      queueEmailNotification({
        to: updated.user.email,
        subject: "CIBI portal access restored",
        heading: "Portal Access Restored",
        body: `Dear ${updated.user.name},

Your appeal has been reviewed. Your payment and admission have been approved, and your CIBI portal access has been restored.`,
        ctaText: "Open Student Portal",
        ctaUrl: "/student"
      });
    }

    res.json({ message: "Student access restored. Payment confirmed, admission approved and support case resolved.", case: updated });
  } catch (error) {
    res.status(500).json({ message: "Could not restore student access", error: error.message });
  }
});

app.post("/api/admin/support/cases/:id/messages", requireAuth, requireAdmin, async (req, res) => {
  try {
    const appeal = await prisma.appeal.findUnique({ where: { id: Number(req.params.id) }, include: { user: true } });
    if (!appeal) return res.status(404).json({ message: "Support case not found." });

    const message = String(req.body?.message || "").trim();
    if (!message) return res.status(400).json({ message: "Reply message is required." });
    if (message.length > 2000) return res.status(400).json({ message: "Reply is too long. Keep it under 2000 characters." });

    const created = await prisma.supportMessage.create({
      data: { appealId: appeal.id, senderId: req.user.id, message },
      include: { sender: { select: { id: true, name: true, role: true } } }
    });

    await prisma.appeal.update({ where: { id: appeal.id }, data: { status: "WAITING_STUDENT" } });
    if (appeal.user?.email) {
      queueEmailNotification({
        to: appeal.user.email,
        subject: "CIBI support replied to your case",
        heading: "Support Reply Received",
        body: `Dear ${appeal.user.name},

CIBI Support replied to your case.

Reply: ${message}`,
        ctaText: "Open Support Case",
        ctaUrl: "/student"
      });
    }
    res.status(201).json(created);
  } catch (error) {
    res.status(500).json({ message: "Could not send support reply", error: error.message });
  }
});


async function ensureStudentCanAccessCourse(userId, courseId) {
  const course = await prisma.course.findUnique({ where: { id: Number(courseId) }, select: { id: true, programmeId: true } });
  if (!course) return null;
  const enrollment = await prisma.enrollment.findFirst({
    where: {
      userId,
      admissionStatus: { in: ["APPROVED", "GRADUATED"] },
      OR: [
        { courseId: Number(courseId) },
        course.programmeId ? { programmeId: course.programmeId } : { id: -1 }
      ]
    }
  });
  return enrollment;
}

app.post("/api/student/assignments/:id/submit", requireAuth, requireActiveStudent, async (req, res) => {
  try {
    const assignment = await prisma.assignment.findUnique({ where: { id: Number(req.params.id) } });
    if (!assignment || assignment.published === false) return res.status(404).json({ message: "Assignment not found." });

    const enrollment = await ensureStudentCanAccessCourse(req.user.id, assignment.courseId);
    if (!enrollment) return res.status(403).json({ message: "You are not approved for this course." });

    const answer = String(req.body?.answer || "").trim();
    const fileUrl = req.body?.fileUrl ? String(req.body.fileUrl).trim() : null;
    const videoUrl = req.body?.videoUrl ? String(req.body.videoUrl).trim() : null;
    if (!answer && !fileUrl && !videoUrl) return res.status(400).json({ message: "Please type an answer, upload a file, or paste a video assignment link." });

    const submission = await prisma.assignmentSubmission.upsert({
      where: { assignmentId_userId: { assignmentId: assignment.id, userId: req.user.id } },
      update: { answer, fileUrl, videoUrl, status: "SUBMITTED", score: null, feedback: null, submittedAt: new Date(), gradedAt: null },
      create: { assignmentId: assignment.id, userId: req.user.id, answer, fileUrl, videoUrl, status: "SUBMITTED" }
    });

    queueEmailNotification({
      to: req.user.email,
      subject: "CIBI assignment submitted",
      heading: "Assignment Submitted",
      body: `Dear ${req.user.name},

Your assignment "${assignment.title}" has been submitted. Admin will review and grade it.`,
      ctaText: "View My Results",
      ctaUrl: "/student"
    });
    queueAdminEmail({
      subject: "New CIBI assignment submission",
      heading: "Assignment Submitted",
      body: `${req.user.name} (${req.user.email}) submitted assignment: ${assignment.title}.`,
      ctaText: "Open Gradebook",
      ctaUrl: "/admin"
    }).catch((error) => console.error("Admin assignment email failed:", error.message));

    res.status(201).json({ message: "Assignment submitted. Admin will review and grade it.", submission });
  } catch (error) {
    res.status(500).json({ message: "Could not submit assignment", error: error.message });
  }
});

app.post("/api/student/quizzes/:id/attempt", requireAuth, requireActiveStudent, async (req, res) => {
  try {
    const quiz = await prisma.quiz.findUnique({
      where: { id: Number(req.params.id) },
      include: { questions: { orderBy: { questionOrder: "asc" } } }
    });
    if (!quiz || quiz.published === false) return res.status(404).json({ message: "Quiz not found." });

    const enrollment = await ensureStudentCanAccessCourse(req.user.id, quiz.courseId);
    if (!enrollment) return res.status(403).json({ message: "You are not approved for this course." });
    if (!quiz.questions.length) return res.status(400).json({ message: "This quiz has no questions yet." });

    const answers = req.body?.answers || {};
    let correct = 0;
    for (const question of quiz.questions) {
      const answer = String(answers[question.id] || "").toUpperCase();
      if (answer && answer === String(question.correctOption || "").toUpperCase()) correct += 1;
    }
    const score = Math.round((correct / quiz.questions.length) * 100);
    const passed = score >= Number(quiz.passScore || 70);

    const attempt = await prisma.quizAttempt.create({
      data: { quizId: quiz.id, userId: req.user.id, score, passed, answersJson: JSON.stringify(answers) }
    });

    queueEmailNotification({
      to: req.user.email,
      subject: "CIBI quiz result",
      heading: passed ? "Quiz Passed" : "Quiz Submitted",
      body: `Dear ${req.user.name},

You scored ${score}% on "${quiz.title}". Pass mark: ${quiz.passScore || 70}%. ${passed ? "You passed this quiz." : "You did not reach the pass mark yet."}`,
      ctaText: "View My Results",
      ctaUrl: "/student"
    });
    queueAdminEmail({
      subject: "CIBI quiz attempt submitted",
      heading: "Quiz Attempt Submitted",
      body: `${req.user.name} (${req.user.email}) scored ${score}% on quiz: ${quiz.title}.`,
      ctaText: "Open Gradebook",
      ctaUrl: "/admin"
    }).catch((error) => console.error("Admin quiz email failed:", error.message));

    res.status(201).json({ message: passed ? "Quiz passed." : "Quiz submitted. You did not reach the pass mark yet.", attempt, correct, total: quiz.questions.length });
  } catch (error) {
    res.status(500).json({ message: "Could not submit quiz", error: error.message });
  }
});

function sanitizeAssignmentPayload(body = {}) {
  return {
    courseId: Number(body.courseId),
    moduleId: body.moduleId ? Number(body.moduleId) : null,
    lessonId: body.lessonId ? Number(body.lessonId) : null,
    title: String(body.title || "").trim(),
    instructions: String(body.instructions || "").trim(),
    dueDate: body.dueDate ? new Date(body.dueDate) : null,
    required: body.required === undefined ? true : body.required === true || body.required === "true" || body.required === "on",
    published: body.published === undefined ? true : body.published === true || body.published === "true" || body.published === "on",
    maxScore: Math.max(1, Number(body.maxScore || 100)),
    passScore: Math.max(1, Math.min(100, Number(body.passScore || 50)))
  };
}

function sanitizeQuizPayload(body = {}) {
  return {
    courseId: Number(body.courseId),
    moduleId: body.moduleId ? Number(body.moduleId) : null,
    lessonId: body.lessonId ? Number(body.lessonId) : null,
    title: String(body.title || "").trim(),
    description: body.description ? String(body.description).trim() : null,
    passScore: Math.max(1, Math.min(100, Number(body.passScore || 70))),
    required: body.required === undefined ? true : body.required === true || body.required === "true" || body.required === "on",
    published: body.published === undefined ? true : body.published === true || body.published === "true" || body.published === "on"
  };
}

app.get("/api/admin/assessments", requireAuth, requireAdmin, async (req, res) => {
  const courseWhere = courseAccessWhereForUser(req.user);
  const courses = await prisma.course.findMany({
    where: courseWhere,
    include: {
      modules: { orderBy: { moduleOrder: "asc" }, include: { lessons: { orderBy: { lessonOrder: "asc" } } } },
      lessons: { orderBy: { lessonOrder: "asc" } }
    },
    orderBy: { createdAt: "desc" }
  });
  const courseIds = courses.map((course) => course.id);
  const whereByCourse = staffCanSeeAllCourses(req.user) ? {} : { courseId: { in: courseIds } };
  const [assignments, quizzes] = await Promise.all([
    prisma.assignment.findMany({
      where: whereByCourse,
      include: {
        course: { select: { id: true, title: true } },
        module: { select: { id: true, title: true } },
        lesson: { select: { id: true, title: true } },
        submissions: { include: { user: { select: { id: true, name: true, email: true } } }, orderBy: { submittedAt: "desc" } }
      },
      orderBy: { createdAt: "desc" }
    }),
    prisma.quiz.findMany({
      where: whereByCourse,
      include: {
        course: { select: { id: true, title: true } },
        module: { select: { id: true, title: true } },
        lesson: { select: { id: true, title: true } },
        questions: { orderBy: { questionOrder: "asc" } },
        attempts: { include: { user: { select: { id: true, name: true, email: true } } }, orderBy: { createdAt: "desc" } }
      },
      orderBy: { createdAt: "desc" }
    })
  ]);
  res.json({ courses, assignments, quizzes });
});

app.post("/api/admin/assignments", requireAuth, requireAdmin, async (req, res) => {
  try {
    const payload = sanitizeAssignmentPayload(req.body);
    if (!payload.courseId || !payload.title || !payload.instructions) return res.status(400).json({ message: "Course, assignment title and instructions are required." });
    if (!(await canManageCourse(req, payload.courseId))) return res.status(403).json({ message: "You do not have access to this course." });
    const created = await prisma.assignment.create({ data: payload });
    await logAdminActivity(req, { action: "CREATED_ASSIGNMENT", entityType: "Assignment", entityId: created.id, details: { title: created.title, courseId: created.courseId } });
    res.status(201).json(created);
  } catch (error) {
    res.status(400).json({ message: "Could not create assignment", error: error.message });
  }
});

app.patch("/api/admin/assignments/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const payload = sanitizeAssignmentPayload(req.body);
    const existing = await prisma.assignment.findUnique({ where: { id: Number(req.params.id) } });
    if (!existing) return res.status(404).json({ message: "Assignment not found." });
    if (!(await canManageCourse(req, existing.courseId))) return res.status(403).json({ message: "You do not have access to this course." });
    const updated = await prisma.assignment.update({ where: { id: Number(req.params.id) }, data: payload });
    await logAdminActivity(req, { action: "UPDATED_ASSIGNMENT", entityType: "Assignment", entityId: updated.id, details: { title: updated.title, courseId: updated.courseId } });
    res.json(updated);
  } catch (error) {
    res.status(400).json({ message: "Could not update assignment", error: error.message });
  }
});

app.delete("/api/admin/assignments/:id", requireAuth, requireAdmin, async (req, res) => {
  const existing = await prisma.assignment.findUnique({ where: { id: Number(req.params.id) } });
  if (!existing) return res.status(404).json({ message: "Assignment not found." });
  if (!(await canManageCourse(req, existing.courseId))) return res.status(403).json({ message: "You do not have access to this course." });
  await prisma.assignment.delete({ where: { id: Number(req.params.id) } });
  await logAdminActivity(req, { action: "DELETED_ASSIGNMENT", entityType: "Assignment", entityId: req.params.id });
  res.json({ message: "Assignment deleted" });
});

app.patch("/api/admin/assignment-submissions/:id/grade", requireAuth, requireAdmin, async (req, res) => {
  try {
    const submission = await prisma.assignmentSubmission.findUnique({
      where: { id: Number(req.params.id) },
      include: { assignment: true }
    });
    if (!submission) return res.status(404).json({ message: "Submission not found." });
    const score = Math.max(0, Math.min(Number(submission.assignment.maxScore || 100), Number(req.body?.score || 0)));
    const passed = score >= Number(submission.assignment.passScore || 50);
    const updated = await prisma.assignmentSubmission.update({
      where: { id: submission.id },
      data: {
        score,
        feedback: req.body?.feedback ? String(req.body.feedback) : null,
        status: req.body?.status ? String(req.body.status) : passed ? "PASSED" : "NEEDS_REVISION",
        gradedAt: new Date()
      },
      include: { user: { select: { id: true, name: true, email: true } }, assignment: true }
    });
    await logAdminActivity(req, { action: "GRADED_ASSIGNMENT", entityType: "AssignmentSubmission", entityId: updated.id, details: { student: updated.user?.email, assignment: updated.assignment?.title, score, status: updated.status } });
    if (updated.user?.email) {
      queueEmailNotification({
        to: updated.user.email,
        subject: "CIBI assignment graded",
        heading: passed ? "Assignment Passed" : "Assignment Feedback Available",
        body: `Dear ${updated.user.name},

Your assignment "${updated.assignment.title}" has been graded. Score: ${score}/${updated.assignment.maxScore || 100}. Status: ${updated.status}.${updated.feedback ? `

Feedback: ${updated.feedback}` : ""}`,
        ctaText: "View My Results",
        ctaUrl: "/student"
      });
    }
    res.json({ message: passed ? "Assignment graded as passed." : "Assignment graded. Student needs revision or did not pass yet.", submission: updated });
  } catch (error) {
    res.status(400).json({ message: "Could not grade assignment", error: error.message });
  }
});

app.post("/api/admin/quizzes", requireAuth, requireAdmin, async (req, res) => {
  try {
    const payload = sanitizeQuizPayload(req.body);
    if (!payload.courseId || !payload.title) return res.status(400).json({ message: "Course and quiz title are required." });
    const created = await prisma.quiz.create({ data: payload });
    await logAdminActivity(req, { action: "CREATED_QUIZ", entityType: "Quiz", entityId: created.id, details: { title: created.title, courseId: created.courseId } });
    res.status(201).json(created);
  } catch (error) {
    res.status(400).json({ message: "Could not create quiz", error: error.message });
  }
});

app.patch("/api/admin/quizzes/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const payload = sanitizeQuizPayload(req.body);
    const existing = await prisma.quiz.findUnique({ where: { id: Number(req.params.id) } });
    if (!existing) return res.status(404).json({ message: "Quiz not found." });
    if (!(await canManageCourse(req, existing.courseId))) return res.status(403).json({ message: "You do not have access to this course." });
    const updated = await prisma.quiz.update({ where: { id: Number(req.params.id) }, data: payload });
    await logAdminActivity(req, { action: "UPDATED_QUIZ", entityType: "Quiz", entityId: updated.id, details: { title: updated.title, courseId: updated.courseId } });
    res.json(updated);
  } catch (error) {
    res.status(400).json({ message: "Could not update quiz", error: error.message });
  }
});

app.delete("/api/admin/quizzes/:id", requireAuth, requireAdmin, async (req, res) => {
  const existing = await prisma.quiz.findUnique({ where: { id: Number(req.params.id) } });
  if (!existing) return res.status(404).json({ message: "Quiz not found." });
  if (!(await canManageCourse(req, existing.courseId))) return res.status(403).json({ message: "You do not have access to this course." });
  await prisma.quiz.delete({ where: { id: Number(req.params.id) } });
  await logAdminActivity(req, { action: "DELETED_QUIZ", entityType: "Quiz", entityId: req.params.id });
  res.json({ message: "Quiz deleted" });
});

app.post("/api/admin/quizzes/:id/questions", requireAuth, requireAdmin, async (req, res) => {
  try {
    const quizId = Number(req.params.id);
    const payload = {
      quizId,
      question: String(req.body?.question || "").trim(),
      optionA: String(req.body?.optionA || "").trim(),
      optionB: String(req.body?.optionB || "").trim(),
      optionC: String(req.body?.optionC || "").trim(),
      optionD: String(req.body?.optionD || "").trim(),
      correctOption: String(req.body?.correctOption || "A").toUpperCase(),
      questionOrder: Number(req.body?.questionOrder || 1)
    };
    if (!payload.question || !payload.optionA || !payload.optionB || !payload.optionC || !payload.optionD) return res.status(400).json({ message: "Question and all four options are required." });
    if (!["A", "B", "C", "D"].includes(payload.correctOption)) return res.status(400).json({ message: "Correct option must be A, B, C or D." });
    const created = await prisma.quizQuestion.create({ data: payload });
    await logAdminActivity(req, { action: "ADDED_QUIZ_QUESTION", entityType: "QuizQuestion", entityId: created.id, details: { quizId } });
    res.status(201).json(created);
  } catch (error) {
    res.status(400).json({ message: "Could not add quiz question", error: error.message });
  }
});

app.delete("/api/admin/quiz-questions/:id", requireAuth, requireAdmin, async (req, res) => {
  await prisma.quizQuestion.delete({ where: { id: Number(req.params.id) } });
  res.json({ message: "Question deleted" });
});


app.get("/api/admin/gradebook", requireAuth, requireAdmin, async (req, res) => {
  const activeEnrollmentWhere = {
    OR: [
      { admissionStatus: { in: ["APPROVED", "GRADUATED"] } },
      { paymentStatus: "PAYMENT_CONFIRMED" },
      { user: { status: { in: ["ACTIVE", "GRADUATED"] } } }
    ]
  };

  const enrollments = await prisma.enrollment.findMany({
    where: activeEnrollmentWhere,
    include: {
      certificate: true,
      programme: { include: { courses: { include: adminCourseInclude(), orderBy: { title: "asc" } } } },
      user: { select: { id: true, name: true, email: true, phone: true, country: true, role: true, status: true, createdAt: true } },
      course: { include: adminCourseInclude() }
    },
    orderBy: { updatedAt: "desc" }
  });

  res.json(expandProgrammeCourseEnrollments(enrollments).map(buildGradebookRow));
});

app.get("/api/student/results", requireAuth, requireActiveStudent, async (req, res) => {
  const enrollments = await prisma.enrollment.findMany({
    where: { userId: req.user.id, admissionStatus: { in: ["APPROVED", "GRADUATED"] } },
    include: {
      certificate: true,
      programme: { include: { courses: { where: { published: true }, include: studentCourseInclude(req.user.id), orderBy: { title: "asc" } } } },
      user: { select: { id: true, name: true, email: true, phone: true, country: true, role: true, status: true, createdAt: true } },
      course: { include: studentCourseInclude(req.user.id) }
    },
    orderBy: { updatedAt: "desc" }
  });

  res.json(expandProgrammeCourseEnrollments(enrollments).map(buildGradebookRow));
});


app.get("/api/admin/activity-logs", requireAuth, requireAdmin, async (req, res) => {
  try {
    const logs = await prisma.adminActivityLog.findMany({
      include: { admin: { select: { id: true, name: true, email: true, role: true } } },
      orderBy: { createdAt: "desc" },
      take: 250
    });
    res.json(logs);
  } catch (error) {
    res.status(500).json({ message: "Could not load admin activity logs", error: error.message });
  }
});

app.get("/api/admin/attendance-records", requireAuth, requireAdmin, async (req, res) => {
  try {
    const records = await prisma.liveAttendance.findMany({
      include: {
        liveSession: true,
        user: { select: { id: true, name: true, email: true, phone: true, country: true, status: true } }
      },
      orderBy: { lastSeenAt: "desc" },
      take: 500
    });
    const grouped = records.reduce((acc, record) => {
      const key = record.liveSessionId;
      if (!acc[key]) {
        acc[key] = {
          liveSession: record.liveSession,
          count: 0,
          students: []
        };
      }
      acc[key].count += 1;
      acc[key].students.push({
        id: record.id,
        student: record.user,
        joinedAt: record.joinedAt,
        lastSeenAt: record.lastSeenAt
      });
      return acc;
    }, {});
    res.json({ records, grouped: Object.values(grouped) });
  } catch (error) {
    res.status(500).json({ message: "Could not load attendance records", error: error.message });
  }
});

app.get("/api/student/attendance-history", requireAuth, requireActiveStudent, async (req, res) => {
  try {
    const records = await prisma.liveAttendance.findMany({
      where: { userId: req.user.id },
      include: { liveSession: true },
      orderBy: { lastSeenAt: "desc" },
      take: 200
    });
    res.json(records);
  } catch (error) {
    res.status(500).json({ message: "Could not load attendance history", error: error.message });
  }
});

app.get("/api/student/courses/:courseId/discussions", requireAuth, requireActiveStudent, async (req, res) => {
  try {
    const enrollment = await prisma.enrollment.findFirst({
      where: { userId: req.user.id, courseId: Number(req.params.courseId), admissionStatus: { in: ["APPROVED", "GRADUATED"] } }
    });
    if (!enrollment) return res.status(403).json({ message: "You are not approved for this course." });

    const discussions = await prisma.courseDiscussion.findMany({
      where: { courseId: Number(req.params.courseId), status: { not: "DELETED" } },
      include: {
        author: { select: { id: true, name: true, role: true } },
        replies: { include: { author: { select: { id: true, name: true, role: true } } }, orderBy: { createdAt: "asc" } }
      },
      orderBy: { updatedAt: "desc" },
      take: 100
    });
    res.json(discussions);
  } catch (error) {
    res.status(500).json({ message: "Could not load course discussions", error: error.message });
  }
});

app.post("/api/student/courses/:courseId/discussions", requireAuth, requireActiveStudent, async (req, res) => {
  try {
    const courseId = Number(req.params.courseId);
    const enrollment = await prisma.enrollment.findFirst({
      where: { userId: req.user.id, courseId, admissionStatus: { in: ["APPROVED", "GRADUATED"] } },
      include: { course: true }
    });
    if (!enrollment) return res.status(403).json({ message: "You are not approved for this course." });

    const title = String(req.body?.title || "Course Question").trim();
    const message = String(req.body?.message || "").trim();
    if (!message) return res.status(400).json({ message: "Discussion message is required." });
    if (message.length > 2000) return res.status(400).json({ message: "Message is too long. Keep it under 2000 characters." });

    const created = await prisma.courseDiscussion.create({
      data: { courseId, userId: req.user.id, title: title || "Course Question", message },
      include: {
        author: { select: { id: true, name: true, role: true } },
        replies: { include: { author: { select: { id: true, name: true, role: true } } }, orderBy: { createdAt: "asc" } }
      }
    });

    queueAdminEmail({
      subject: "New CIBI course discussion",
      heading: "Student Posted a Course Question",
      body: `${req.user.name} posted a discussion under ${enrollment.course?.title || "a CIBI course"}:\n\n${message}`,
      ctaText: "Open Course Discussions",
      ctaUrl: "/admin"
    }).catch((error) => console.error("Admin discussion email failed:", error.message));

    res.status(201).json(created);
  } catch (error) {
    res.status(500).json({ message: "Could not create discussion", error: error.message });
  }
});

app.post("/api/student/course-discussions/:id/replies", requireAuth, requireActiveStudent, async (req, res) => {
  try {
    const discussion = await prisma.courseDiscussion.findUnique({ where: { id: Number(req.params.id) } });
    if (!discussion || discussion.status === "DELETED") return res.status(404).json({ message: "Discussion not found." });
    const enrollment = await prisma.enrollment.findFirst({ where: { userId: req.user.id, courseId: discussion.courseId, admissionStatus: { in: ["APPROVED", "GRADUATED"] } } });
    if (!enrollment) return res.status(403).json({ message: "You are not approved for this course." });

    const message = String(req.body?.message || "").trim();
    if (!message) return res.status(400).json({ message: "Reply message is required." });
    if (message.length > 2000) return res.status(400).json({ message: "Reply is too long. Keep it under 2000 characters." });

    const created = await prisma.courseDiscussionReply.create({
      data: { discussionId: discussion.id, userId: req.user.id, message },
      include: { author: { select: { id: true, name: true, role: true } } }
    });
    await prisma.courseDiscussion.update({ where: { id: discussion.id }, data: { updatedAt: new Date() } });
    res.status(201).json(created);
  } catch (error) {
    res.status(500).json({ message: "Could not send discussion reply", error: error.message });
  }
});

app.get("/api/admin/course-discussions", requireAuth, requireAdmin, async (req, res) => {
  try {
    const discussions = await prisma.courseDiscussion.findMany({
      where: { status: { not: "DELETED" } },
      include: {
        course: { select: { id: true, title: true, level: true } },
        author: { select: { id: true, name: true, email: true, role: true } },
        replies: { include: { author: { select: { id: true, name: true, email: true, role: true } } }, orderBy: { createdAt: "asc" } }
      },
      orderBy: { updatedAt: "desc" },
      take: 250
    });
    res.json(discussions);
  } catch (error) {
    res.status(500).json({ message: "Could not load course discussions", error: error.message });
  }
});

app.post("/api/admin/course-discussions/:id/replies", requireAuth, requireAdmin, async (req, res) => {
  try {
    const discussion = await prisma.courseDiscussion.findUnique({
      where: { id: Number(req.params.id) },
      include: { author: true, course: true }
    });
    if (!discussion || discussion.status === "DELETED") return res.status(404).json({ message: "Discussion not found." });
    const message = String(req.body?.message || "").trim();
    if (!message) return res.status(400).json({ message: "Reply message is required." });

    const created = await prisma.courseDiscussionReply.create({
      data: { discussionId: discussion.id, userId: req.user.id, message },
      include: { author: { select: { id: true, name: true, email: true, role: true } } }
    });
    await prisma.courseDiscussion.update({ where: { id: discussion.id }, data: { status: "ANSWERED", updatedAt: new Date() } });
    await logAdminActivity(req, { action: "REPLIED_COURSE_DISCUSSION", entityType: "CourseDiscussion", entityId: discussion.id, details: { course: discussion.course?.title, student: discussion.author?.email } });

    if (discussion.author?.email) {
      queueEmailNotification({
        to: discussion.author.email,
        subject: "CIBI course discussion reply",
        heading: "Your Course Question Has a Reply",
        body: `Dear ${discussion.author.name},\n\nCIBI has replied to your discussion under ${discussion.course?.title || "your course"}.\n\nReply: ${message}`,
        ctaText: "Open Student Portal",
        ctaUrl: "/student"
      });
    }

    res.status(201).json(created);
  } catch (error) {
    res.status(500).json({ message: "Could not reply to course discussion", error: error.message });
  }
});

app.patch("/api/admin/course-discussions/:id/status", requireAuth, requireAdmin, async (req, res) => {
  try {
    const status = String(req.body?.status || "OPEN").toUpperCase();
    if (!["OPEN", "ANSWERED", "CLOSED"].includes(status)) return res.status(400).json({ message: "Invalid discussion status." });
    const updated = await prisma.courseDiscussion.update({ where: { id: Number(req.params.id) }, data: { status } });
    await logAdminActivity(req, { action: "UPDATED_COURSE_DISCUSSION_STATUS", entityType: "CourseDiscussion", entityId: updated.id, details: { status } });
    res.json(updated);
  } catch (error) {
    res.status(400).json({ message: "Could not update discussion status", error: error.message });
  }
});

app.delete("/api/admin/course-discussions/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const updated = await prisma.courseDiscussion.update({ where: { id: Number(req.params.id) }, data: { status: "DELETED" } });
    await logAdminActivity(req, { action: "DELETED_COURSE_DISCUSSION", entityType: "CourseDiscussion", entityId: updated.id });
    res.json({ message: "Discussion removed", discussion: updated });
  } catch (error) {
    res.status(400).json({ message: "Could not delete discussion", error: error.message });
  }
});


app.get("/api/admin/users-roles", requireAuth, requireAdmin, async (req, res) => {
  try {
    if (!isSuperAdminRole(req.user.role)) return res.status(403).json({ message: "Super Admin access required" });
    const users = await prisma.user.findMany({
      where: { role: { in: ["SUPER_ADMIN", "RECTOR", "ADMIN", "LECTURER"] } },
      include: {
        lecturerCourseAccesses: { include: { course: { select: { id: true, title: true, level: true } } } }
      },
      orderBy: { createdAt: "desc" }
    });
    const courses = await prisma.course.findMany({ orderBy: { title: "asc" } });
    res.json({ users: users.map(publicUser), rawUsers: users, courses });
  } catch (error) {
    res.status(500).json({ message: "Could not load users and roles", error: error.message });
  }
});

app.post("/api/admin/users-roles", requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const name = String(req.body?.name || "").trim();
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "").trim();
    const role = String(req.body?.role || "LECTURER").toUpperCase();
    if (!name || !email || !password) return res.status(400).json({ message: "Name, email and password are required." });
    if (!["SUPER_ADMIN", "RECTOR", "ADMIN", "LECTURER"].includes(role)) return res.status(400).json({ message: "Invalid staff role." });
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ message: "Email already exists." });
    const hashed = await bcrypt.hash(password, 12);
    const created = await prisma.user.create({
      data: { name, email, password: hashed, role, status: "ACTIVE" }
    });
    await logAdminActivity(req, { action: "CREATED_STAFF_ACCOUNT", entityType: "User", entityId: created.id, details: { email, role } });
    res.status(201).json({ message: "Staff account created.", user: publicUser(created) });
  } catch (error) {
    res.status(400).json({ message: "Could not create staff account", error: error.message });
  }
});

app.patch("/api/admin/users-roles/:id", requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const userId = Number(req.params.id);
    if (userId === req.user.id && req.body?.role && String(req.body.role).toUpperCase() !== req.user.role) {
      return res.status(400).json({ message: "You cannot downgrade your own role." });
    }
    const data = {};
    if (req.body?.name !== undefined) data.name = String(req.body.name || "").trim();
    if (req.body?.email !== undefined) data.email = String(req.body.email || "").trim().toLowerCase();
    if (req.body?.role !== undefined) {
      const role = String(req.body.role || "").toUpperCase();
      if (!["SUPER_ADMIN", "RECTOR", "ADMIN", "LECTURER"].includes(role)) return res.status(400).json({ message: "Invalid staff role." });
      data.role = role;
    }
    if (req.body?.password) data.password = await bcrypt.hash(String(req.body.password), 10);
    const updated = await prisma.user.update({ where: { id: userId }, data });
    await logAdminActivity(req, { action: "UPDATED_STAFF_ACCOUNT", entityType: "User", entityId: updated.id, details: { email: updated.email, role: updated.role } });
    res.json({ message: "Staff account updated.", user: publicUser(updated) });
  } catch (error) {
    res.status(400).json({ message: "Could not update staff account", error: error.message });
  }
});

app.post("/api/admin/lecturer-course-access", requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const lecturerId = Number(req.body?.lecturerId);
    const courseId = Number(req.body?.courseId);
    if (!lecturerId || !courseId) return res.status(400).json({ message: "Lecturer and course are required." });
    const lecturer = await prisma.user.findUnique({ where: { id: lecturerId } });
    if (!lecturer || !["LECTURER", "ADMIN", "RECTOR", "SUPER_ADMIN"].includes(lecturer.role)) return res.status(404).json({ message: "Lecturer/staff user not found." });
    const created = await prisma.courseLecturerAccess.upsert({
      where: { courseId_lecturerId: { courseId, lecturerId } },
      update: { accessLevel: String(req.body?.accessLevel || "LECTURER"), grantedById: req.user.id },
      create: { courseId, lecturerId, accessLevel: String(req.body?.accessLevel || "LECTURER"), grantedById: req.user.id },
      include: { lecturer: { select: { id: true, name: true, email: true, role: true } }, course: { select: { id: true, title: true } } }
    });
    await logAdminActivity(req, { action: "ASSIGNED_COURSE_ACCESS", entityType: "CourseLecturerAccess", entityId: created.id, details: { lecturerId, courseId } });
    res.status(201).json(created);
  } catch (error) {
    res.status(400).json({ message: "Could not assign course access", error: error.message });
  }
});

app.delete("/api/admin/lecturer-course-access/:id", requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    await prisma.courseLecturerAccess.delete({ where: { id: Number(req.params.id) } });
    await logAdminActivity(req, { action: "REMOVED_COURSE_ACCESS", entityType: "CourseLecturerAccess", entityId: req.params.id });
    res.json({ message: "Course access removed." });
  } catch (error) {
    res.status(400).json({ message: "Could not remove course access", error: error.message });
  }
});

app.get("/api/admin/currency-settings", requireAuth, requireAdmin, async (req, res) => {
  const settings = await prisma.setting.findMany({ where: { key: { in: ["base_currency", "currency_rates", "currency_converter_note"] } } });
  res.json(Object.fromEntries(settings.map((row) => [row.key, row.value])));
});

app.patch("/api/admin/currency-settings", requireAuth, requireSuperAdmin, async (req, res) => {
  const allowed = ["base_currency", "currency_rates", "currency_converter_note"];
  for (const key of allowed) {
    if (req.body?.[key] !== undefined) {
      await prisma.setting.upsert({ where: { key }, update: { value: String(req.body[key]) }, create: { key, value: String(req.body[key]) } });
    }
  }
  await logAdminActivity(req, { action: "UPDATED_CURRENCY_SETTINGS", entityType: "Setting", details: req.body });
  const rows = await prisma.setting.findMany({ where: { key: { in: allowed } } });
  res.json(Object.fromEntries(rows.map((row) => [row.key, row.value])));
});

app.get("/api/admin/student-groups", requireAuth, requireAdmin, async (req, res) => {
  try {
    const courseId = req.query.courseId ? Number(req.query.courseId) : null;
    const courseWhere = courseAccessWhereForUser(req.user);
    const courses = await prisma.course.findMany({ where: courseWhere, orderBy: { title: "asc" } });
    const accessibleCourseIds = courses.map((course) => course.id);
    const where = courseId ? { courseId } : { courseId: { in: accessibleCourseIds } };
    if (courseId && !(await canManageCourse(req, courseId))) return res.status(403).json({ message: "You do not have access to this course." });
    const groups = await prisma.studentGroup.findMany({
      where,
      include: {
        course: { select: { id: true, title: true } },
        lecturer: { select: { id: true, name: true, email: true, role: true } },
        members: { include: { student: { select: { id: true, name: true, email: true, phone: true, country: true } } } }
      },
      orderBy: { createdAt: "desc" }
    });
    const enrollments = courseId ? await prisma.enrollment.findMany({
      where: { courseId, admissionStatus: { in: ["APPROVED", "GRADUATED"] } },
      include: { user: { select: { id: true, name: true, email: true, phone: true, country: true } } },
      orderBy: { createdAt: "asc" }
    }) : [];
    res.json({ courses, groups, students: enrollments.map((item) => item.user) });
  } catch (error) {
    res.status(500).json({ message: "Could not load student groups", error: error.message });
  }
});

app.post("/api/admin/student-groups/auto", requireAuth, requireAdmin, async (req, res) => {
  try {
    const courseId = Number(req.body?.courseId);
    const groupSize = Math.max(1, Number(req.body?.groupSize || 10));
    const taskTitle = String(req.body?.taskTitle || "").trim();
    const instructions = String(req.body?.instructions || "").trim();
    if (!courseId) return res.status(400).json({ message: "Course is required." });
    if (!(await canManageCourse(req, courseId))) return res.status(403).json({ message: "You do not have access to this course." });

    const enrollments = await prisma.enrollment.findMany({
      where: { courseId, admissionStatus: { in: ["APPROVED", "GRADUATED"] } },
      include: { user: true },
      orderBy: { createdAt: "asc" }
    });
    if (!enrollments.length) return res.status(400).json({ message: "No approved students found for this course." });

    await prisma.studentGroup.deleteMany({ where: { courseId } });
    const groups = [];
    for (let i = 0; i < enrollments.length; i += groupSize) {
      const chunk = enrollments.slice(i, i + groupSize);
      const group = await prisma.studentGroup.create({
        data: {
          courseId,
          lecturerId: req.user.id,
          name: `Group ${groups.length + 1}`,
          taskTitle,
          instructions,
          members: { create: chunk.map((item) => ({ userId: item.userId })) }
        },
        include: { members: { include: { student: { select: { id: true, name: true, email: true } } } } }
      });
      groups.push(group);
    }
    await logAdminActivity(req, { action: "AUTO_CREATED_STUDENT_GROUPS", entityType: "StudentGroup", details: { courseId, groupSize, groups: groups.length } });
    res.status(201).json({ message: `${groups.length} groups created.`, groups });
  } catch (error) {
    res.status(400).json({ message: "Could not create groups", error: error.message });
  }
});

app.delete("/api/admin/student-groups/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const group = await prisma.studentGroup.findUnique({ where: { id: Number(req.params.id) } });
    if (!group) return res.status(404).json({ message: "Group not found." });
    if (!(await canManageCourse(req, group.courseId))) return res.status(403).json({ message: "You do not have access to this group." });
    await prisma.studentGroup.delete({ where: { id: group.id } });
    await logAdminActivity(req, { action: "DELETED_STUDENT_GROUP", entityType: "StudentGroup", entityId: group.id });
    res.json({ message: "Group deleted." });
  } catch (error) {
    res.status(400).json({ message: "Could not delete group", error: error.message });
  }
});


app.get("/api/admin/overview", requireAuth, requireAdmin, async (req, res) => {
  const courseWhere = courseAccessWhereForUser(req.user);
  const courseRows = await prisma.course.findMany({ where: courseWhere, select: { id: true } });
  const courseIds = courseRows.map((course) => course.id);
  const enrollmentWhere = staffCanSeeAllCourses(req.user) ? {} : { OR: [{ courseId: { in: courseIds } }, { programme: { courses: { some: { id: { in: courseIds } } } } }] };
  const [students, books, pendingEnrollments, openSupport, certificates, paymentDue] = await Promise.all([
    prisma.user.count({ where: { role: "STUDENT", enrollments: staffCanSeeAllCourses(req.user) ? undefined : { some: { courseId: { in: courseIds } } } } }),
    prisma.book.count(),
    prisma.enrollment.count({ where: { ...enrollmentWhere, admissionStatus: "AWAITING_ADMIN_APPROVAL" } }),
    prisma.appeal.count({ where: { status: { in: ["OPEN", "WAITING_ADMIN", "UNDER_REVIEW"] } } }),
    prisma.certificate.count({ where: staffCanSeeAllCourses(req.user) ? { status: "ISSUED" } : { status: "ISSUED", courseId: { in: courseIds } } }),
    prisma.enrollment.count({ where: { ...enrollmentWhere, OR: [{ accessStatus: "PAYMENT_DUE" }, { nextPaymentDueAt: { lte: new Date() } }] } })
  ]);
  res.json({ students, books, courses: courseRows.length, pendingEnrollments, openSupport, certificates, paymentDue });
});

app.get("/api/admin/students", requireAuth, requireAdmin, async (req, res) => {
  const courseRows = await prisma.course.findMany({ where: courseAccessWhereForUser(req.user), select: { id: true } });
  const courseIds = courseRows.map((course) => course.id);
  const students = await prisma.user.findMany({
    where: staffCanSeeAllCourses(req.user) ? { role: "STUDENT" } : { role: "STUDENT", enrollments: { some: { courseId: { in: courseIds } } } },
    include: { enrollments: { where: staffCanSeeAllCourses(req.user) ? {} : { OR: [{ courseId: { in: courseIds } }, { programme: { courses: { some: { id: { in: courseIds } } } } }] }, include: { programme: true, course: { include: { programme: true } } } } },
    orderBy: { createdAt: "desc" }
  });
  res.json(students.map((student) => ({ ...publicUser(student), enrollments: student.enrollments })));
});

app.patch("/api/admin/students/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const studentId = Number(req.params.id);
    const student = await prisma.user.findUnique({ where: { id: studentId } });
    if (!student || student.role !== "STUDENT") return res.status(404).json({ message: "Student not found." });

    const name = String(req.body?.name || "").trim();
    const email = String(req.body?.email || "").trim().toLowerCase();
    const phone = req.body?.phone === undefined ? undefined : String(req.body.phone || "").trim();
    const country = req.body?.country === undefined ? undefined : String(req.body.country || "").trim();

    if (!name || name.split(/\s+/).length < 2) {
      return res.status(400).json({ message: "Please enter the student's full name." });
    }
    if (!email) return res.status(400).json({ message: "Email address is required." });

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing && existing.id !== studentId) {
      return res.status(409).json({ message: "This email address is already used by another account." });
    }

    const updated = await prisma.user.update({
      where: { id: studentId },
      data: { name, email, phone, country }
    });

    res.json({ message: "Student details updated successfully.", student: publicUser(updated) });
  } catch (error) {
    res.status(500).json({ message: "Student update failed", error: error.message });
  }
});

app.patch("/api/admin/enrollments/:id/status", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { action } = req.body;
    const enrollment = await prisma.enrollment.findUnique({ where: { id: Number(req.params.id) }, include: { user: true, course: true } });
    if (!enrollment) return res.status(404).json({ message: "Enrollment not found" });

    const now = new Date();
    const statusMap = {
      approve: {
        admissionStatus: "APPROVED",
        userStatus: "ACTIVE",
        paymentStatus: "PAYMENT_CONFIRMED",
        approvedAt: now,
        message: "Student approved. Payment confirmed and portal access is now active."
      },
      reject: {
        admissionStatus: "REJECTED",
        userStatus: "REJECTED",
        approvedAt: null,
        message: "Admission rejected."
      },
      suspend: {
        admissionStatus: "SUSPENDED",
        userStatus: "SUSPENDED",
        approvedAt: null,
        message: "Student suspended. Portal access has been blocked."
      },
      graduate: {
        admissionStatus: "GRADUATED",
        userStatus: "GRADUATED",
        approvedAt: enrollment.approvedAt || now,
        message: "Student marked as graduated."
      }
    };

    const next = statusMap[action];
    if (!next) return res.status(400).json({ message: "Invalid action" });

    const updateData = {
      admissionStatus: next.admissionStatus,
      approvedAt: next.approvedAt
    };

    if (next.paymentStatus) {
      updateData.paymentStatus = next.paymentStatus;
    }

    const updated = await prisma.enrollment.update({
      where: { id: enrollment.id },
      data: updateData,
      include: { course: true }
    });

    await prisma.user.update({ where: { id: enrollment.userId }, data: { status: next.userStatus } });
    await logAdminActivity(req, { action: `ENROLLMENT_${String(action).toUpperCase()}`, entityType: "Enrollment", entityId: enrollment.id, details: { student: enrollment.user?.email, course: enrollment.course?.title, admissionStatus: next.admissionStatus, userStatus: next.userStatus } });
    if (enrollment.user?.email) {
      const statusHeading = action === "approve" ? "Admission Approved" : action === "reject" ? "Admission Decision" : action === "suspend" ? "Account Suspended" : "Programme Status Updated";
      queueEmailNotification({
        to: enrollment.user.email,
        subject: `CIBI: ${statusHeading}`,
        heading: statusHeading,
        body: `Dear ${enrollment.user.name},

${next.message}

Programme: ${programmeDisplayTitle({ ...enrollment, ...updated })}`,
        ctaText: "Open Student Portal",
        ctaUrl: "/student"
      });
    }
    res.json({ ...updated, message: next.message });
  } catch (error) {
    res.status(500).json({ message: "Status update failed", error: error.message });
  }
});


app.patch("/api/admin/enrollments/:id/access", requireAuth, requireAdmin, async (req, res) => {
  try {
    const enrollment = await prisma.enrollment.findUnique({
      where: { id: Number(req.params.id) },
      include: { user: true, programme: true, course: true }
    });
    if (!enrollment) return res.status(404).json({ message: "Enrollment not found" });

    const action = String(req.body?.action || "").trim();
    const data = {};
    let message = "Enrollment access updated.";

    if (action === "send-payment-notice") {
      data.studentPaymentNotice = true;
      data.studentPaymentNoticeMessage = String(req.body?.message || "Your next programme payment is due. Please contact CIBI admin for payment instructions.").trim();
      data.studentPaymentNoticeSentAt = new Date();
      data.accessStatus = enrollment.accessStatus === "BLOCKED" ? "BLOCKED" : "PAYMENT_DUE";
      message = "Payment notice sent to student portal.";
    } else if (action === "hide-payment-notice") {
      data.studentPaymentNotice = false;
      data.studentPaymentNoticeMessage = null;
      data.studentPaymentNoticeSentAt = null;
      message = "Payment notice hidden from student.";
    } else if (action === "mark-payment-due") {
      data.accessStatus = "PAYMENT_DUE";
      data.nextPaymentDueAt = req.body?.nextPaymentDueAt ? new Date(req.body.nextPaymentDueAt) : enrollment.nextPaymentDueAt || new Date();
      message = "Student marked as payment due. Student notice is still hidden until admin sends it.";
    } else if (action === "block-access") {
      data.accessStatus = "BLOCKED";
      data.studentPaymentNotice = true;
      data.studentPaymentNoticeMessage = String(req.body?.message || "Your programme access is currently on hold. Please contact CIBI admin.").trim();
      data.studentPaymentNoticeSentAt = new Date();
      message = "Student access blocked and notice shown.";
    } else if (action === "restore-access") {
      data.accessStatus = "ACTIVE";
      data.studentPaymentNotice = false;
      data.studentPaymentNoticeMessage = null;
      data.studentPaymentNoticeSentAt = null;
      message = "Student access restored.";
    } else if (action === "promote-level") {
      const nextLevel = String(req.body?.currentLevelStage || "").trim();
      if (!nextLevel) return res.status(400).json({ message: "Next level/stage is required." });
      data.currentLevelStage = nextLevel;
      data.accessStatus = "ACTIVE";
      message = `Student promoted to ${nextLevel}.`;
    } else if (action === "confirm-next-payment") {
      const cycle = Number(req.body?.paymentCycleMonths || enrollment.paymentCycleMonths || enrollment.programme?.paymentCycleMonths || 0);
      const paidUntil = req.body?.paidUntil
        ? new Date(req.body.paidUntil)
        : cycle
          ? new Date(Date.now() + cycle * 30 * 24 * 60 * 60 * 1000)
          : enrollment.paidUntil;
      data.accessStatus = "ACTIVE";
      data.paymentStatus = "PAYMENT_CONFIRMED";
      data.paidUntil = paidUntil || null;
      data.nextPaymentDueAt = paidUntil || null;
      data.studentPaymentNotice = false;
      data.studentPaymentNoticeMessage = null;
      data.studentPaymentNoticeSentAt = null;
      message = "Next payment confirmed and access is active.";
    } else {
      return res.status(400).json({ message: "Invalid enrollment access action." });
    }

    const updated = await prisma.enrollment.update({
      where: { id: enrollment.id },
      data,
      include: { user: true, programme: true, course: { include: { programme: true } } }
    });

    if (["send-payment-notice", "block-access", "promote-level", "confirm-next-payment"].includes(action) && updated.user?.email) {
      queueEmailNotification({
        to: updated.user.email,
        subject: "CIBI programme access update",
        heading: "Programme Access Update",
        body: `Dear ${updated.user.name},

${message}

Programme: ${programmeDisplayTitle(updated)}
Current Level/Stage: ${updated.currentLevelStage || "Not set"}`,
        ctaText: "Open Student Portal",
        ctaUrl: "/student"
      });
    }

    await logAdminActivity(req, { action: `ENROLLMENT_ACCESS_${action.toUpperCase().replace(/-/g, "_")}`, entityType: "Enrollment", entityId: enrollment.id, details: { student: enrollment.user?.email, programme: programmeDisplayTitle(updated), currentLevelStage: updated.currentLevelStage, accessStatus: updated.accessStatus } });
    res.json({ message, enrollment: updated });
  } catch (error) {
    res.status(500).json({ message: "Enrollment access update failed", error: error.message });
  }
});

function crudPayload(routeName, body = {}) {
  if (routeName === "programmes") return normaliseProgrammePayload(body);
  if (routeName === "courses") return normaliseCoursePayload(body);
  return body;
}

function crudRoutes(modelName, routeName) {
  app.get(`/api/admin/${routeName}`, requireAuth, requireAdmin, async (req, res) => {
    const where = routeName === "courses" ? courseAccessWhereForUser(req.user) : {};
    const include = routeName === "courses" ? { programme: true } : routeName === "programmes" ? { courses: { orderBy: { title: "asc" } } } : undefined;
    const data = await prisma[modelName].findMany({ where, include, orderBy: { createdAt: "desc" } });
    res.json(data);
  });

  app.post(`/api/admin/${routeName}`, requireAuth, requireAdmin, async (req, res) => {
    try {
      if (["courses", "programmes"].includes(routeName) && !staffCanSeeAllCourses(req.user)) return res.status(403).json({ message: "Only Super Admin/Admin can create programmes and courses." });
      const payload = crudPayload(routeName, req.body);
      const created = await prisma[modelName].create({ data: payload });
      await logAdminActivity(req, { action: `CREATED_${routeName.toUpperCase()}`, entityType: routeName, entityId: created.id, details: { title: created.title || created.name || created.key || null } });
      res.status(201).json(created);
    } catch (error) {
      res.status(400).json({ message: `Could not create ${routeName}`, error: error.message });
    }
  });

  app.patch(`/api/admin/${routeName}/:id`, requireAuth, requireAdmin, async (req, res) => {
    try {
      if (routeName === "courses" && !(await canManageCourse(req, Number(req.params.id)))) return res.status(403).json({ message: "You do not have access to this course." });
      const payload = crudPayload(routeName, req.body);
      const updated = await prisma[modelName].update({ where: { id: Number(req.params.id) }, data: payload });
      await logAdminActivity(req, { action: `UPDATED_${routeName.toUpperCase()}`, entityType: routeName, entityId: updated.id, details: { title: updated.title || updated.name || updated.key || null } });
      res.json(updated);
    } catch (error) {
      res.status(400).json({ message: `Could not update ${routeName}`, error: error.message });
    }
  });

  app.delete(`/api/admin/${routeName}/:id`, requireAuth, requireAdmin, async (req, res) => {
    try {
      if (["courses", "programmes"].includes(routeName) && !staffCanSeeAllCourses(req.user)) return res.status(403).json({ message: "Only Super Admin/Admin can delete programmes and courses." });
      await prisma[modelName].delete({ where: { id: Number(req.params.id) } });
      await logAdminActivity(req, { action: `DELETED_${routeName.toUpperCase()}`, entityType: routeName, entityId: req.params.id });
      res.json({ message: "Deleted" });
    } catch (error) {
      res.status(400).json({ message: `Could not delete ${routeName}`, error: error.message });
    }
  });
}

crudRoutes("programme", "programmes");
crudRoutes("book", "books");
crudRoutes("course", "courses");
crudRoutes("slide", "slides");
crudRoutes("gallery", "gallery");
crudRoutes("announcement", "announcements");
crudRoutes("testimonial", "testimonials");
crudRoutes("faq", "faqs");
crudRoutes("liveSession", "live-sessions");

app.get("/api/admin/course-builder", requireAuth, requireAdmin, async (req, res) => {
  const courses = await prisma.course.findMany({
    where: courseAccessWhereForUser(req.user),
    include: {
      programme: true,
      modules: { include: { lessons: { orderBy: { lessonOrder: "asc" } } }, orderBy: { moduleOrder: "asc" } },
      lessons: { include: { module: true }, orderBy: { lessonOrder: "asc" } },
      videos: {
        include: { uploadedBy: { select: { id: true, name: true, role: true } } },
        orderBy: [{ sortOrder: "asc" }, { chapter: "asc" }, { createdAt: "asc" }]
      },
      liveSessions: {
        include: { startedBy: { select: { id: true, name: true, role: true } } },
        orderBy: { createdAt: "desc" }
      },
      lecturerAccesses: { include: { lecturer: { select: { id: true, name: true, email: true, role: true } } } }
    },
    orderBy: { createdAt: "desc" }
  });
  res.json(courses);
});

app.post("/api/admin/modules", requireAuth, requireAdmin, async (req, res) => {
  try {
    if (!(await canManageCourse(req, Number(req.body.courseId)))) return res.status(403).json({ message: "You do not have access to this course." });
    const created = await prisma.courseModule.create({
      data: {
        courseId: Number(req.body.courseId),
        title: String(req.body.title || "").trim(),
        description: req.body.description ? String(req.body.description) : null,
        moduleOrder: Number(req.body.moduleOrder || 1),
        published: req.body.published === undefined ? true : req.body.published === true || req.body.published === "true" || req.body.published === "on"
      }
    });
    await logAdminActivity(req, { action: "CREATED_MODULE", entityType: "CourseModule", entityId: created.id, details: { title: created.title, courseId: created.courseId } });
    res.status(201).json(created);
  } catch (error) {
    res.status(400).json({ message: "Could not create module", error: error.message });
  }
});

app.patch("/api/admin/modules/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const updated = await prisma.courseModule.update({
      where: { id: Number(req.params.id) },
      data: {
        courseId: req.body.courseId ? Number(req.body.courseId) : undefined,
        title: req.body.title === undefined ? undefined : String(req.body.title || "").trim(),
        description: req.body.description === undefined ? undefined : String(req.body.description || ""),
        moduleOrder: req.body.moduleOrder === undefined ? undefined : Number(req.body.moduleOrder || 1),
        published: req.body.published === undefined ? undefined : req.body.published === true || req.body.published === "true" || req.body.published === "on"
      }
    });
    await logAdminActivity(req, { action: "UPDATED_MODULE", entityType: "CourseModule", entityId: updated.id, details: { title: updated.title, courseId: updated.courseId } });
    res.json(updated);
  } catch (error) {
    res.status(400).json({ message: "Could not update module", error: error.message });
  }
});

app.delete("/api/admin/modules/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    await prisma.courseModule.delete({ where: { id: Number(req.params.id) } });
    await logAdminActivity(req, { action: "DELETED_MODULE", entityType: "CourseModule", entityId: req.params.id });
    res.json({ message: "Module deleted" });
  } catch (error) {
    res.status(400).json({ message: "Could not delete module", error: error.message });
  }
});

app.get("/api/admin/lessons", requireAuth, requireAdmin, async (req, res) => {
  const lessons = await prisma.lesson.findMany({ include: { course: true, module: true }, orderBy: { createdAt: "desc" } });
  res.json(lessons);
});

app.post("/api/admin/lessons", requireAuth, requireAdmin, async (req, res) => {
  try {
    const payload = sanitizeLessonPayload(req.body);
    if (!payload.courseId || !payload.title) return res.status(400).json({ message: "Course and lesson title are required." });
    if (!(await canManageCourse(req, payload.courseId))) return res.status(403).json({ message: "You do not have access to this course." });
    const created = await prisma.lesson.create({ data: payload });
    await logAdminActivity(req, { action: "CREATED_LESSON", entityType: "Lesson", entityId: created.id, details: { title: created.title, courseId: created.courseId } });
    res.status(201).json(created);
  } catch (error) {
    res.status(400).json({ message: "Could not create lesson", error: error.message });
  }
});

app.patch("/api/admin/lessons/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const payload = sanitizeLessonPayload(req.body);
    const updated = await prisma.lesson.update({ where: { id: Number(req.params.id) }, data: payload });
    await logAdminActivity(req, { action: "UPDATED_LESSON", entityType: "Lesson", entityId: updated.id, details: { title: updated.title, courseId: updated.courseId } });
    res.json(updated);
  } catch (error) {
    res.status(400).json({ message: "Could not update lesson", error: error.message });
  }
});

app.delete("/api/admin/lessons/:id", requireAuth, requireAdmin, async (req, res) => {
  await prisma.lesson.delete({ where: { id: Number(req.params.id) } });
  await logAdminActivity(req, { action: "DELETED_LESSON", entityType: "Lesson", entityId: req.params.id });
  res.json({ message: "Deleted" });
});

app.get("/api/admin/student-progress", requireAuth, requireAdmin, async (req, res) => {
  const activeEnrollmentWhere = {
    OR: [
      { admissionStatus: { in: ["APPROVED", "GRADUATED"] } },
      { paymentStatus: "PAYMENT_CONFIRMED" },
      { user: { status: { in: ["ACTIVE", "GRADUATED"] } } }
    ]
  };

  const enrollments = await prisma.enrollment.findMany({
    where: activeEnrollmentWhere,
    include: {
      certificate: true,
      programme: { include: { courses: { include: adminCourseInclude(), orderBy: { title: "asc" } } } },
      user: { select: { id: true, name: true, email: true, status: true } },
      course: { include: adminCourseInclude() }
    },
    orderBy: { updatedAt: "desc" }
  });

  const rows = expandProgrammeCourseEnrollments(enrollments).map((enrollment) => {
    const summary = calculateCourseCompletionForUser(enrollment.course, enrollment.userId);
    return {
      enrollmentId: enrollment.id,
      student: enrollment.user,
      programmeTitle: enrollment.programmeTitle || programmeDisplayTitle(enrollment),
      course: { id: enrollment.course.id, title: enrollment.course.title, level: enrollment.course.level },
      certificate: enrollment.certificate,
      completedRequired: summary.completedRequirements,
      totalRequired: summary.totalRequirements,
      completedLessons: summary.completedRequired,
      totalLessons: summary.totalRequired,
      completedAssignments: summary.completedAssignments,
      totalAssignments: summary.totalAssignments,
      completedQuizzes: summary.completedQuizzes,
      totalQuizzes: summary.totalQuizzes,
      percent: summary.percent
    };
  });

  res.json(rows);
});

app.get("/api/student/certificates", requireAuth, async (req, res) => {
  if (req.user?.role !== "STUDENT") return res.status(403).json({ message: "Student access required" });

  const enrollments = await prisma.enrollment.findMany({
    where: { userId: req.user.id, admissionStatus: { in: ["APPROVED", "GRADUATED"] } },
    include: {
      certificate: true,
      programme: { include: { courses: { where: { published: true }, include: studentCourseInclude(req.user.id), orderBy: { title: "asc" } } } },
      course: { include: studentCourseInclude(req.user.id) }
    },
    orderBy: { updatedAt: "desc" }
  });

  const rows = expandProgrammeCourseEnrollments(enrollments).map((enrollment) => {
    const summary = calculateCourseCompletionForUser(enrollment.course, enrollment.userId);
    return { ...enrollment, student: publicUser(req.user), programmeTitle: enrollment.programmeTitle || programmeDisplayTitle(enrollment), learningSummary: summary };
  });

  res.json(rows);
});

app.get("/api/certificates/verify/:certificateNumber", async (req, res) => {
  const certificate = await prisma.certificate.findUnique({
    where: { certificateNumber: req.params.certificateNumber },
    include: {
      user: { select: { id: true, name: true, email: true } },
      course: { select: { id: true, title: true, level: true, duration: true } },
      programme: { select: { id: true, title: true, level: true, duration: true, certification: true } }
    }
  });

  if (!certificate || certificate.status !== "ISSUED") {
    return res.status(404).json({ valid: false, message: "Certificate not found or no longer valid." });
  }

  const settings = await getCertificateSettings();
  res.json({ valid: true, certificate, settings });
});

app.get("/api/admin/certificates", requireAuth, requireAdmin, async (req, res) => {
  const activeEnrollmentWhere = {
    OR: [
      { admissionStatus: { in: ["APPROVED", "GRADUATED"] } },
      { paymentStatus: "PAYMENT_CONFIRMED" },
      { user: { status: { in: ["ACTIVE", "GRADUATED"] } } }
    ]
  };

  const enrollments = await prisma.enrollment.findMany({
    where: activeEnrollmentWhere,
    include: {
      certificate: true,
      programme: { include: { courses: { include: adminCourseInclude(), orderBy: { title: "asc" } } } },
      user: { select: { id: true, name: true, email: true, phone: true, status: true } },
      course: { include: adminCourseInclude() }
    },
    orderBy: { updatedAt: "desc" }
  });

  const rows = expandProgrammeCourseEnrollments(enrollments).map((enrollment) => {
    const summary = calculateCourseCompletionForUser(enrollment.course, enrollment.userId);
    return { ...enrollment, programmeTitle: enrollment.programmeTitle || programmeDisplayTitle(enrollment), learningSummary: summary };
  });

  res.json(rows);
});

app.post("/api/admin/enrollments/:id/certificate", requireAuth, requireAdmin, async (req, res) => {
  try {
    const enrollment = await prisma.enrollment.findUnique({
      where: { id: Number(req.params.id) },
      include: {
        certificate: true,
        user: true,
        programme: { include: { courses: { include: adminCourseInclude(), orderBy: { title: "asc" } } } },
        course: { include: adminCourseInclude() }
      }
    });

    if (!enrollment) return res.status(404).json({ message: "Enrollment not found." });
    if (enrollment.paymentStatus !== "PAYMENT_CONFIRMED") return res.status(400).json({ message: "Payment must be confirmed before certificate can be issued." });
    if (!["APPROVED", "GRADUATED"].includes(enrollment.admissionStatus) && !["ACTIVE", "GRADUATED"].includes(enrollment.user?.status)) {
      return res.status(400).json({ message: "Admission must be approved before certificate can be issued." });
    }

    const programmeCourses = enrollment.programme?.courses || [];
    const completionCourses = programmeCourses.length ? programmeCourses : enrollment.course ? [enrollment.course] : [];
    if (!completionCourses.length) return res.status(400).json({ message: "No course has been attached to this programme yet." });

    const incomplete = completionCourses.find((course) => calculateCourseCompletionForUser(course, enrollment.userId).percent < 100);
    if (incomplete) return res.status(400).json({ message: `Student has not completed all required lessons, assignments and quizzes for ${incomplete.title} yet.` });

    if (enrollment.certificate) {
      return res.json({ message: "Certificate already exists for this enrollment.", certificate: enrollment.certificate });
    }

    const primaryCourse = enrollment.course || completionCourses[0];
    const certificate = await prisma.certificate.create({
      data: {
        userId: enrollment.userId,
        courseId: primaryCourse.id,
        programmeId: enrollment.programmeId || primaryCourse.programmeId || null,
        enrollmentId: enrollment.id,
        certificateNumber: makeCertificateNumber({ ...enrollment, courseId: primaryCourse.id }),
        notes: req.body?.notes ? String(req.body.notes) : null
      }
    });

    await prisma.enrollment.update({ where: { id: enrollment.id }, data: { admissionStatus: "GRADUATED" } });
    const title = programmeDisplayTitle(enrollment);
    await logAdminActivity(req, { action: "ISSUED_CERTIFICATE", entityType: "Certificate", entityId: certificate.id, details: { certificateNumber: certificate.certificateNumber, student: enrollment.user?.email, programme: title } });

    queueEmailNotification({
      to: enrollment.user.email,
      subject: "CIBI certificate issued",
      heading: "Your Certificate Has Been Issued",
      body: `Dear ${enrollment.user.name},

Your certificate for ${title} has been issued. Certificate Number: ${certificate.certificateNumber}.`,
      ctaText: "View Certificate",
      ctaUrl: "/student"
    });

    res.status(201).json({ message: "Certificate issued successfully.", certificate });
  } catch (error) {
    res.status(500).json({ message: "Could not issue certificate", error: error.message });
  }
});

app.patch("/api/admin/certificates/:id/revoke", requireAuth, requireAdmin, async (req, res) => {
  try {
    const certificate = await prisma.certificate.update({
      where: { id: Number(req.params.id) },
      data: { status: "REVOKED", revokedAt: new Date(), notes: req.body?.notes ? String(req.body.notes) : undefined }
    });
    await logAdminActivity(req, { action: "REVOKED_CERTIFICATE", entityType: "Certificate", entityId: certificate.id, details: { certificateNumber: certificate.certificateNumber } });
    res.json({ message: "Certificate revoked.", certificate });
  } catch (error) {
    res.status(400).json({ message: "Could not revoke certificate", error: error.message });
  }
});

app.get("/api/admin/settings", requireAuth, requireAdmin, async (req, res) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  const rows = await prisma.setting.findMany();
  res.json(Object.fromEntries(rows.map((row) => [row.key, row.value])));
});

app.patch("/api/admin/settings", requireAuth, requireAdmin, async (req, res) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  const entries = Object.entries(req.body || {});
  for (const [key, value] of entries) {
    await prisma.setting.upsert({ where: { key }, update: { value: String(value) }, create: { key, value: String(value) } });
  }
  await logAdminActivity(req, { action: "UPDATED_SETTINGS", entityType: "Setting", details: { keys: entries.map(([key]) => key) } });
  const rows = await prisma.setting.findMany();
  res.json(Object.fromEntries(rows.map((row) => [row.key, row.value])));
});



function extractYouTubeVideoId(input = "") {
  const raw = String(input || "").trim();
  if (!raw) return "";
  const iframeMatch = raw.match(/src=["']([^"']+)["']/i);
  const value = iframeMatch?.[1] || raw;

  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\./, "").replace(/^m\./, "");
    const parts = url.pathname.split("/").filter(Boolean);

    if (host === "youtu.be") return parts[0] || "";
    if (host.includes("youtube.com") || host.includes("youtube-nocookie.com")) {
      if (url.searchParams.get("v")) return url.searchParams.get("v") || "";
      const embedIndex = parts.findIndex((part) => part === "embed" || part === "live" || part === "shorts");
      if (embedIndex >= 0 && parts[embedIndex + 1]) return parts[embedIndex + 1];
      return parts.pop() || "";
    }
  } catch {
    const fallback = value.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|live\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/i);
    return fallback?.[1] || "";
  }

  return "";
}

function buildPlatformYouTubeEmbedUrl(videoId) {
  const origin = process.env.CLIENT_URL || process.env.FRONTEND_URL || "";
  const params = new URLSearchParams({
    enablejsapi: "1",
    controls: "0",
    modestbranding: "1",
    rel: "0",
    disablekb: "1",
    fs: "0",
    iv_load_policy: "3",
    playsinline: "1"
  });
  if (origin) params.set("origin", origin);
  return `https://www.youtube-nocookie.com/embed/${videoId}?${params.toString()}`;
}

function normalizeCourseVideoLink(rawUrl = "") {
  const videoUrl = String(rawUrl || "").trim();
  const externalVideoId = extractYouTubeVideoId(videoUrl);
  if (!externalVideoId || !/^[A-Za-z0-9_-]{6,}$/.test(externalVideoId)) {
    const error = new Error("Please paste a valid YouTube video, YouTube Live, Shorts, or embed link.");
    error.statusCode = 400;
    throw error;
  }
  return {
    provider: "YOUTUBE",
    externalVideoId,
    videoUrl,
    embedUrl: buildPlatformYouTubeEmbedUrl(externalVideoId)
  };
}

function formatCourseVideo(video, includePrivate = false) {
  if (!video) return null;
  return {
    id: video.id,
    courseId: video.courseId,
    title: video.title,
    description: video.description,
    chapter: video.chapter,
    sortOrder: video.sortOrder,
    provider: video.provider || "YOUTUBE",
    externalVideoId: video.externalVideoId || null,
    uploadDate: video.createdAt,
    createdAt: video.createdAt,
    uploadedBy: video.uploadedBy ? { id: video.uploadedBy.id, name: video.uploadedBy.name, role: video.uploadedBy.role } : null,
    progress: Array.isArray(video.progresses) ? video.progresses[0] || null : undefined,
    ...(includePrivate ? { videoUrl: video.videoUrl, embedUrl: video.embedUrl, cdnUrl: video.cdnUrl, bunnyPath: video.bunnyPath } : {})
  };
}

function sanitizeCourseVideosForClient(course, includePrivateVideos = false) {
  if (!course) return course;
  return {
    ...course,
    videos: Array.isArray(course.videos)
      ? course.videos.map((video) => formatCourseVideo(video, includePrivateVideos))
      : course.videos
  };
}

app.get("/api/notifications", requireAuth, async (req, res) => {
  const notifications = await prisma.notification.findMany({
    where: { userId: req.user.id },
    orderBy: { createdAt: "desc" },
    take: 50
  });
  res.json(notifications);
});

app.patch("/api/notifications/:id/read", requireAuth, validators.idParam("id"), validateRequest, async (req, res) => {
  const notification = await prisma.notification.findFirst({ where: { id: Number(req.params.id), userId: req.user.id } });
  if (!notification) return res.status(404).json({ message: "Notification not found." });
  const updated = await prisma.notification.update({
    where: { id: notification.id },
    data: { readAt: new Date() }
  });
  res.json(updated);
});

app.get("/api/courses/:courseId/videos", requireAuth, validators.courseId, validateRequest, async (req, res) => {
  const courseId = Number(req.params.courseId);
  if (!(await canAccessCourseContent(req.user, courseId))) return res.status(403).json({ message: "You do not have access to this course." });
  const videos = await prisma.courseVideo.findMany({
    where: { courseId },
    include: {
      uploadedBy: { select: { id: true, name: true, role: true } },
      progresses: { where: { userId: req.user.id } }
    },
    orderBy: [{ sortOrder: "asc" }, { chapter: "asc" }, { createdAt: "asc" }]
  });
  res.json(videos.map((video) => formatCourseVideo(video, false)));
});

app.post(
  "/api/courses/:courseId/videos/upload",
  requireAuth,
  validators.courseId,
  validateRequest,
  async (req, res, next) => {
    try {
      const courseId = Number(req.params.courseId);
      if (!(await canManageCourseContent(req.user, courseId))) return res.status(403).json({ message: "Forbidden. You are not assigned to this course." });

      const title = String(req.body?.title || "").trim();
      if (!title) return res.status(400).json({ message: "Video title is required." });

      const normalized = normalizeCourseVideoLink(req.body?.videoUrl || req.body?.url || req.body?.link || "");
      const chapter = Math.max(1, Number(req.body?.chapter || req.body?.chapterNumber || 1));
      const lastVideo = await prisma.courseVideo.findFirst({ where: { courseId }, orderBy: { sortOrder: "desc" } });

      const video = await prisma.courseVideo.create({
        data: {
          courseId,
          title,
          description: req.body?.description ? String(req.body.description).trim() : null,
          videoUrl: normalized.videoUrl,
          provider: normalized.provider,
          externalVideoId: normalized.externalVideoId,
          embedUrl: normalized.embedUrl,
          bunnyPath: null,
          cdnUrl: null,
          fileName: null,
          mimeType: "text/youtube-url",
          fileSize: null,
          chapter,
          sortOrder: Number(req.body?.sortOrder || (lastVideo ? Number(lastVideo.sortOrder || 0) + 1 : chapter)),
          uploadedById: req.user.id
        },
        include: { uploadedBy: { select: { id: true, name: true, role: true } } }
      });

      res.status(201).json({ videoId: video.id, video: formatCourseVideo(video, true) });
    } catch (error) {
      next(error);
    }
  }
);

app.patch("/api/courses/:courseId/videos/reorder", requireAuth, validators.courseId, validateRequest, async (req, res) => {
  const courseId = Number(req.params.courseId);
  if (!(await canManageCourseContent(req.user, courseId))) return res.status(403).json({ message: "Forbidden." });
  const videoIds = Array.isArray(req.body?.videoIds) ? req.body.videoIds.map(Number).filter(Boolean) : [];
  if (!videoIds.length) return res.status(400).json({ message: "videoIds array is required." });

  await prisma.$transaction(videoIds.map((id, index) => prisma.courseVideo.updateMany({
    where: { id, courseId },
    data: { sortOrder: index + 1 }
  })));
  res.json({ message: "Video order updated." });
});

app.patch("/api/courses/:courseId/videos/:videoId", requireAuth, validators.courseId, validators.videoId, validateRequest, async (req, res, next) => {
  try {
    const courseId = Number(req.params.courseId);
    const videoId = Number(req.params.videoId);
    const video = await prisma.courseVideo.findFirst({ where: { id: videoId, courseId } });
    if (!video) return res.status(404).json({ message: "Video not found." });
    if (!(await canManageCourseContent(req.user, courseId))) return res.status(403).json({ message: "Forbidden." });

    const linkUpdate = req.body?.videoUrl === undefined ? {} : normalizeCourseVideoLink(req.body.videoUrl);
    const updated = await prisma.courseVideo.update({
      where: { id: video.id },
      data: {
        title: req.body?.title === undefined ? undefined : String(req.body.title).trim(),
        description: req.body?.description === undefined ? undefined : String(req.body.description || "").trim(),
        chapter: req.body?.chapter === undefined ? undefined : Math.max(1, Number(req.body.chapter || 1)),
        videoUrl: linkUpdate.videoUrl,
        provider: linkUpdate.provider,
        externalVideoId: linkUpdate.externalVideoId,
        embedUrl: linkUpdate.embedUrl
      },
      include: { uploadedBy: { select: { id: true, name: true, role: true } } }
    });
    res.json(formatCourseVideo(updated, true));
  } catch (error) {
    next(error);
  }
});

app.get("/api/courses/:courseId/videos/:videoId/stream-url", requireAuth, validators.courseId, validators.videoId, validateRequest, async (req, res) => {
  const courseId = Number(req.params.courseId);
  const videoId = Number(req.params.videoId);
  if (!(await canAccessCourseContent(req.user, courseId))) return res.status(403).json({ message: "You do not have access to this video." });
  const video = await prisma.courseVideo.findFirst({ where: { id: videoId, courseId }, include: { uploadedBy: { select: { id: true, name: true, role: true } } } });
  if (!video) return res.status(404).json({ message: "Video not found." });

  const externalVideoId = video.externalVideoId || extractYouTubeVideoId(video.videoUrl || video.cdnUrl || "");
  if (!externalVideoId) return res.status(400).json({ message: "This video link is not playable inside the platform." });

  res.json({
    provider: video.provider || "YOUTUBE",
    externalVideoId,
    embedUrl: video.embedUrl || buildPlatformYouTubeEmbedUrl(externalVideoId),
    video: formatCourseVideo({ ...video, externalVideoId }, false)
  });
});

app.delete("/api/courses/:courseId/videos/:videoId", requireAuth, validators.courseId, validators.videoId, validateRequest, async (req, res) => {
  const courseId = Number(req.params.courseId);
  const videoId = Number(req.params.videoId);
  const video = await prisma.courseVideo.findFirst({ where: { id: videoId, courseId } });
  if (!video) return res.status(404).json({ message: "Video not found." });
  const canDelete = isPowerAdmin(req.user) || (req.user.role === "LECTURER" && video.uploadedById === req.user.id);
  if (!canDelete) return res.status(403).json({ message: "Only Super Admin/Rector or the lecturer who added this video can delete it." });

  await prisma.courseVideo.delete({ where: { id: video.id } });
  res.json({ message: "Video link deleted successfully." });
});

app.post("/api/courses/:courseId/videos/:videoId/progress", requireAuth, validators.courseId, validators.videoId, validateRequest, async (req, res) => {
  const courseId = Number(req.params.courseId);
  const videoId = Number(req.params.videoId);
  if (!(await canAccessCourseContent(req.user, courseId))) return res.status(403).json({ message: "Forbidden." });
  const video = await prisma.courseVideo.findFirst({ where: { id: videoId, courseId } });
  if (!video) return res.status(404).json({ message: "Video not found." });
  const progressSecond = Math.max(0, Math.floor(Number(req.body?.progressSecond || req.body?.currentTime || 0)));
  const durationSecond = Math.max(0, Math.floor(Number(req.body?.durationSecond || req.body?.duration || 0)));
  const completed = Boolean(req.body?.completed) || (durationSecond > 0 && progressSecond / durationSecond >= 0.9);
  const progress = await prisma.courseVideoProgress.upsert({
    where: { userId_videoId: { userId: req.user.id, videoId } },
    update: { progressSecond, durationSecond, completed },
    create: { userId: req.user.id, videoId, progressSecond, durationSecond, completed }
  });
  res.json(progress);
});

app.post(
  "/api/courses/:courseId/documents/upload",
  requireAuth,
  validators.courseId,
  validateRequest,
  documentUpload.single("file"),
  async (req, res) => {
    const courseId = Number(req.params.courseId);
    if (!(await canManageCourseContent(req.user, courseId))) return res.status(403).json({ message: "Forbidden." });
    if (!req.file) return res.status(400).json({ message: "Document file is required." });
    const title = String(req.body?.title || req.file.originalname || "Course document").trim();
    const fileName = makeStorageName(req.file.originalname);
    const uploaded = await uploadToBunny({
      folder: `courses/${courseId}/documents`,
      fileName,
      buffer: req.file.buffer,
      contentType: req.file.mimetype
    });
    const document = await prisma.courseDocument.create({
      data: {
        courseId,
        title,
        description: req.body?.description ? String(req.body.description).trim() : null,
        bunnyPath: uploaded.filePath,
        cdnUrl: uploaded.cdnUrl,
        fileName: req.file.originalname,
        mimeType: req.file.mimetype,
        fileSize: req.file.size,
        uploadedById: req.user.id
      }
    });
    res.status(201).json({ documentId: document.id, cdnUrl: document.cdnUrl, document });
  }
);

app.post("/api/courses/:courseId/live/start", requireAuth, validators.courseId, validateRequest, async (req, res) => {
  const courseId = Number(req.params.courseId);
  if (!(await canManageCourseContent(req.user, courseId))) return res.status(403).json({ message: "Only Super Admin, Rector, or assigned lecturer can start this live class." });

  const title = String(req.body?.title || "").trim();
  const description = req.body?.description ? String(req.body.description).trim() : "";
  const liveUrl = String(req.body?.liveUrl || req.body?.liveURL || "").trim();
  const scheduledAt = req.body?.scheduledAt || req.body?.scheduledTime || null;
  if (!title || !liveUrl) return res.status(400).json({ message: "Title and Zoom/YouTube live link are required." });
  if (!validateLivePlatformUrl(liveUrl)) return res.status(400).json({ message: "Only valid Zoom or YouTube Live links are allowed." });

  await prisma.liveSession.updateMany({ where: { courseId, status: "live" }, data: { status: "ended", active: false, endedAt: new Date() } });

  const live = await prisma.liveSession.create({
    data: {
      courseId,
      startedById: req.user.id,
      title,
      description,
      liveUrl,
      active: true,
      status: "live",
      startedById: req.user.id,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null
    },
    include: {
      course: { select: { id: true, title: true } },
      startedBy: { select: { id: true, name: true, role: true } }
    }
  });

  const students = await enrolledStudentsForCourse(courseId);
  const notificationUrl = `${clientCourseUrl(courseId)}`;
  await createCourseNotifications({
    courseId,
    users: students,
    title: `${live.course?.title || "Course"} is live now`,
    message: `${title} has started. Join now.`,
    url: notificationUrl,
    type: "LIVE_CLASS"
  });

  sendTransactionalEmail({
    to: students.map((student) => student.email).filter(Boolean),
    subject: `${live.course?.title || "CIBI"} is live now`,
    title: "Your CIBI Class Is Live",
    html: goLiveEmailHtml({ course: live.course, lecturer: live.startedBy, title, description, liveUrl: notificationUrl, startedAt: live.createdAt }),
    buttonText: "JOIN NOW",
    buttonUrl: notificationUrl
  }).catch((error) => console.error("Go Live email failed:", error.message));

  sendOneSignalNotification({
    userIds: students.map((student) => student.id),
    title: `${live.course?.title || "CIBI"} is live now`,
    message: `${title} has started. Join now.`,
    url: notificationUrl
  }).catch((error) => console.error("OneSignal live notification failed:", error.message));

  res.status(201).json({ message: "Live class started and students notified.", liveSessionId: live.id, live });
});

app.patch("/api/courses/:courseId/live/:sessionId/end", requireAuth, validators.courseId, validators.sessionId, validateRequest, async (req, res) => {
  const courseId = Number(req.params.courseId);
  const sessionId = Number(req.params.sessionId);
  const live = await prisma.liveSession.findFirst({ where: { id: sessionId, courseId } });
  if (!live) return res.status(404).json({ message: "Live session not found." });
  const canEnd = isPowerAdmin(req.user) || live.startedById === req.user.id;
  if (!canEnd) return res.status(403).json({ message: "Only Super Admin, Rector, or the lecturer who started the session can end it." });

  const updated = await prisma.liveSession.update({
    where: { id: live.id },
    data: { status: "ended", active: false, endedAt: new Date() },
    include: { course: { select: { id: true, title: true } } }
  });

  const students = await enrolledStudentsForCourse(courseId);
  sendTransactionalEmail({
    to: students.map((student) => student.email).filter(Boolean),
    subject: "CIBI live class ended",
    title: "Live Class Ended",
    html: classEndedEmailHtml({ title: updated.title })
  }).catch((error) => console.error("Class ended email failed:", error.message));

  res.json({ message: "Live class ended.", live: updated });
});

app.get("/api/courses/:courseId/live/active", requireAuth, validators.courseId, validateRequest, async (req, res) => {
  const courseId = Number(req.params.courseId);
  if (!(await canAccessCourseContent(req.user, courseId))) return res.status(403).json({ message: "Forbidden." });
  const live = await prisma.liveSession.findFirst({
    where: { courseId, status: "live", active: true },
    include: {
      course: { select: { id: true, title: true } },
      startedBy: { select: { id: true, name: true, role: true } }
    },
    orderBy: { createdAt: "desc" }
  });
  res.json({ live });
});

app.get("/api/courses/:courseId/live/history", requireAuth, validators.courseId, validateRequest, async (req, res) => {
  const courseId = Number(req.params.courseId);
  if (!(await canAccessCourseContent(req.user, courseId))) return res.status(403).json({ message: "Forbidden." });
  const sessions = await prisma.liveSession.findMany({
    where: { courseId, status: { in: ["ended", "scheduled", "live"] } },
    include: { startedBy: { select: { id: true, name: true, role: true } } },
    orderBy: { createdAt: "desc" }
  });
  res.json(sessions.map((session) => ({
    ...session,
    durationSeconds: session.endedAt ? Math.max(0, Math.round((new Date(session.endedAt).getTime() - new Date(session.createdAt).getTime()) / 1000)) : null,
    recordingUrl: session.recordingUrl || session.replayUrl || null
  })));
});

app.patch("/api/courses/:courseId/live/:sessionId/recording", requireAuth, validators.courseId, validators.sessionId, validateRequest, async (req, res) => {
  const courseId = Number(req.params.courseId);
  const sessionId = Number(req.params.sessionId);
  if (!(await canManageCourseContent(req.user, courseId))) return res.status(403).json({ message: "Forbidden." });
  const recordingUrl = String(req.body?.recordingUrl || req.body?.replayUrl || "").trim();
  if (!validateLivePlatformUrl(recordingUrl) && !recordingUrl.startsWith("https://")) return res.status(400).json({ message: "A valid recording URL is required." });
  const existing = await prisma.liveSession.findFirst({ where: { id: sessionId, courseId } });
  if (!existing) return res.status(404).json({ message: "Live session not found." });

  const live = await prisma.liveSession.update({
    where: { id: existing.id },
    data: { recordingUrl, replayUrl: recordingUrl },
    include: { course: { select: { id: true, title: true } } }
  });

  const students = await enrolledStudentsForCourse(courseId);
  sendTransactionalEmail({
    to: students.map((student) => student.email).filter(Boolean),
    subject: `Recording available: ${live.title}`,
    title: "Recording Is Available",
    html: recordingAvailableEmailHtml({ title: live.title }),
    buttonText: "WATCH RECORDING",
    buttonUrl: recordingUrl
  }).catch((error) => console.error("Recording email failed:", error.message));

  res.json({ message: "Recording saved and students notified.", live });
});

app.post("/api/courses/:courseId/daily/room", requireAuth, validators.courseId, validateRequest, async (req, res) => {
  const courseId = Number(req.params.courseId);
  if (!(await canManageCourseContent(req.user, courseId))) return res.status(403).json({ message: "Forbidden." });
  const exp = Math.floor(Date.now() / 1000) + 4 * 60 * 60;
  const roomName = `crobic-course-${courseId}-${Date.now()}`;
  const room = await createDailyRoom({ name: roomName, exp });
  res.status(201).json(room);
});

app.post("/api/courses/:courseId/daily/join-token", requireAuth, validators.courseId, validateRequest, async (req, res) => {
  const courseId = Number(req.params.courseId);
  if (!(await canAccessCourseContent(req.user, courseId))) return res.status(403).json({ message: "Forbidden." });
  const roomName = String(req.body?.roomName || "").trim();
  if (!roomName) return res.status(400).json({ message: "Daily room name is required." });
  const token = await createDailyMeetingToken({
    roomName,
    userName: req.user.name,
    userId: req.user.id,
    isOwner: await canManageCourseContent(req.user, courseId),
    exp: Math.floor(Date.now() / 1000) + 2 * 60 * 60
  });
  res.json(token);
});

app.delete("/api/courses/:courseId/daily/room/:roomName", requireAuth, validators.courseId, validateRequest, async (req, res) => {
  const courseId = Number(req.params.courseId);
  if (!(await canManageCourseContent(req.user, courseId))) return res.status(403).json({ message: "Forbidden." });
  await deleteDailyRoom(req.params.roomName);
  res.json({ message: "Daily room destroyed." });
});


app.get("/api/admin/live/classroom", requireAuth, requireAdmin, async (req, res) => {
  let liveSession = await findAllowedLiveSessionForStaff({ user: req.user, activeOnly: true });
  if (!liveSession) liveSession = await findAllowedLiveSessionForStaff({ user: req.user, activeOnly: false });
  res.json(await buildLiveClassroomPayload(liveSession));
});

app.patch("/api/admin/live/questions/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { answer, status } = req.body;
    const updated = await prisma.liveQuestion.update({
      where: { id: Number(req.params.id) },
      data: {
        answer: answer === undefined ? undefined : String(answer),
        status: status || (answer ? "ANSWERED" : undefined)
      },
      include: { user: { select: { id: true, name: true, role: true } } }
    });
    res.json(updated);
  } catch (error) {
    res.status(400).json({ message: "Could not update question", error: error.message });
  }
});

app.delete("/api/admin/live/chat/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    await prisma.liveChatMessage.delete({ where: { id: Number(req.params.id) } });
    res.json({ message: "Chat message deleted" });
  } catch (error) {
    res.status(400).json({ message: "Could not delete chat message", error: error.message });
  }
});

app.post("/api/admin/live/start", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { title, description, liveUrl, scheduledAt, courseId, replayUrl, subtitleUrl, subtitleLanguage, chatEnabled, voiceEnabled } = req.body;
    const finalCourseId = courseId ? Number(courseId) : null;
    const safeTitle = String(title || "").trim();
    const safeDescription = description ? String(description).trim() : "";
    const safeLiveUrl = String(liveUrl || "").trim();

    if (!safeTitle || !safeLiveUrl) return res.status(400).json({ message: "Title and Zoom/YouTube live link are required." });
    if (!validateLivePlatformUrl(safeLiveUrl)) return res.status(400).json({ message: "Only valid Zoom or YouTube Live links are allowed." });

    if (finalCourseId) {
      if (!(await canManageCourse(req, finalCourseId))) return res.status(403).json({ message: "You do not have access to this course." });
    } else if (!canStartGeneralLive(req.user)) {
      return res.status(403).json({ message: "Only Super Admin, Rector, or Admin can start a general live class." });
    }

    await prisma.liveSession.updateMany({ data: { active: false, status: "ended", endedAt: new Date() } });

    const live = await prisma.liveSession.create({
      data: {
        courseId: finalCourseId,
        title: safeTitle,
        description: safeDescription,
        liveUrl: safeLiveUrl,
        replayUrl: replayUrl ? String(replayUrl) : null,
        subtitleUrl: subtitleUrl ? String(subtitleUrl) : null,
        subtitleLanguage: subtitleLanguage ? String(subtitleLanguage) : null,
        chatEnabled: chatEnabled === undefined ? true : chatEnabled === true || chatEnabled === "true" || chatEnabled === "on",
        voiceEnabled: voiceEnabled === true || voiceEnabled === "true" || voiceEnabled === "on",
        active: true,
        status: "live",
        startedById: req.user.id,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null
      },
      include: {
        course: { select: { id: true, title: true } },
        startedBy: { select: { id: true, name: true, role: true } }
      }
    });

    await logAdminActivity(req, { action: "STARTED_LIVE_CLASS", entityType: "LiveSession", entityId: live.id, details: { title: live.title, courseId: live.courseId, scope: finalCourseId ? "COURSE" : "GENERAL" } });

    const students = await enrolledStudentsForCourse(finalCourseId);
    const studentUrl = finalCourseId ? clientCourseUrl(finalCourseId) : studentLiveUrl();
    const liveTitle = finalCourseId ? `${live.course?.title || "Your CIBI class"} is live now` : "CIBI general live class is live now";
    const liveMessage = `${safeTitle} has started. Join now.`;

    await createCourseNotifications({
      courseId: finalCourseId,
      users: students,
      title: liveTitle,
      message: liveMessage,
      url: studentUrl,
      type: "LIVE_CLASS"
    });

    sendTransactionalEmail({
      to: students.map((student) => student.email).filter(Boolean),
      subject: liveTitle,
      title: "Your CIBI Class Is Live",
      html: goLiveEmailHtml({ course: live.course, lecturer: live.startedBy, title: safeTitle, description: safeDescription, liveUrl: studentUrl, startedAt: live.createdAt }),
      buttonText: "JOIN NOW",
      buttonUrl: studentUrl
    }).catch((error) => console.error("Admin live student email failed:", error.message));

    sendOneSignalNotification({
      userIds: students.map((student) => student.id),
      title: liveTitle,
      message: liveMessage,
      url: studentUrl
    }).catch((error) => console.error("Admin live student push failed:", error.message));

    if (!finalCourseId) {
      const staff = uniqueUsersById(await staffRecipientsForGeneralLive());
      await createCourseNotifications({
        courseId: null,
        users: staff,
        title: "CIBI general live class is live now",
        message: liveMessage,
        url: adminLiveUrl(),
        type: "LIVE_CLASS"
      });

      sendTransactionalEmail({
        to: staff.map((user) => user.email).filter(Boolean),
        subject: "CIBI general live class is live now",
        title: "CIBI General Live Class",
        html: goLiveEmailHtml({ course: null, lecturer: live.startedBy, title: safeTitle, description: safeDescription, liveUrl: adminLiveUrl(), startedAt: live.createdAt }),
        buttonText: "OPEN LIVE CLASS",
        buttonUrl: adminLiveUrl()
      }).catch((error) => console.error("Admin live staff email failed:", error.message));

      sendOneSignalNotification({
        userIds: staff.map((user) => user.id),
        title: "CIBI general live class is live now",
        message: liveMessage,
        url: adminLiveUrl()
      }).catch((error) => console.error("Admin live staff push failed:", error.message));
    }

    res.status(201).json({ message: finalCourseId ? "Course live class started and eligible students notified." : "General live class started and all approved students plus staff notified.", live });
  } catch (error) {
    res.status(500).json({ message: "Could not start live class", error: error.message });
  }
});

app.post("/api/admin/live/stop", requireAuth, requireAdmin, async (req, res) => {
  await prisma.liveSession.updateMany({ where: { active: true }, data: { active: false, status: "ended", endedAt: new Date() } });
  res.json({ message: "Live session stopped" });
});

app.use(sentryErrorHandler());
app.use(productionErrorHandler);

let server;
seedDatabase()
  .then(() => ensureDefaultProgrammes())
  .then(() => {
    server = app.listen(PORT, () => console.log(`CIBI API running on http://localhost:${PORT}`));
  })
  .catch((error) => {
    console.error("Failed to start CIBI API", error);
    process.exit(1);
  });

async function gracefulShutdown(signal) {
  console.log(`${signal} received. Closing CIBI API gracefully.`);
  if (server) {
    server.close(async () => {
      await closeDatabaseConnections();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  } else {
    await closeDatabaseConnections();
    process.exit(0);
  }
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));