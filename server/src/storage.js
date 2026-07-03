import crypto from "crypto";
import path from "path";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";

export const MAX_VIDEO_BYTES = 500 * 1024 * 1024;
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

const VIDEO_TYPES = new Map([
  [".mp4", ["video/mp4"]],
  [".mov", ["video/quicktime", "video/mov"]],
  [".avi", ["video/x-msvideo", "video/avi"]],
  [".webm", ["video/webm"]]
]);

const DOCUMENT_TYPES = new Map([
  [".pdf", ["application/pdf"]],
  [".docx", ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"]],
  [".jpg", ["image/jpeg"]],
  [".jpeg", ["image/jpeg"]],
  [".png", ["image/png"]]
]);

export function normalizeExt(fileName = "") {
  return path.extname(String(fileName || "")).toLowerCase();
}

export function isAllowedVideo(file = {}) {
  const ext = normalizeExt(file.originalname);
  return VIDEO_TYPES.has(ext) && (!file.mimetype || VIDEO_TYPES.get(ext).includes(file.mimetype));
}

export function isAllowedDocument(file = {}) {
  const ext = normalizeExt(file.originalname);
  return DOCUMENT_TYPES.has(ext) && (!file.mimetype || DOCUMENT_TYPES.get(ext).includes(file.mimetype));
}

export function makeStorageName(originalName = "file") {
  const ext = normalizeExt(originalName);
  return `${uuidv4()}${ext}`;
}

export const videoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_VIDEO_BYTES, files: 1 },
  fileFilter(_req, file, cb) {
    if (!isAllowedVideo(file)) return cb(new Error("Only MP4, MOV, AVI and WEBM video files are allowed."));
    return cb(null, true);
  }
});

export const documentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_DOCUMENT_BYTES, files: 1 },
  fileFilter(_req, file, cb) {
    if (!isAllowedDocument(file)) return cb(new Error("Only PDF, DOCX, JPG and PNG document files are allowed."));
    return cb(null, true);
  }
});

function bunnyStorageBaseUrl() {
  const zone = process.env.BUNNY_STORAGE_ZONE;
  if (!zone) throw new Error("BUNNY_STORAGE_ZONE is not configured.");
  const region = String(process.env.BUNNY_STORAGE_REGION || "").trim().toLowerCase();
  const host = region ? `${region}.storage.bunnycdn.com` : "storage.bunnycdn.com";
  return `https://${host}/${zone}`;
}

function bunnyAccessKey() {
  const key = process.env.BUNNY_STORAGE_ACCESS_KEY;
  if (!key) throw new Error("BUNNY_STORAGE_ACCESS_KEY is not configured.");
  return key;
}

export function bunnyCdnBaseUrl() {
  const base = process.env.BUNNY_CDN_BASE_URL;
  if (!base) throw new Error("BUNNY_CDN_BASE_URL is not configured.");
  return base.replace(/\/$/, "");
}

export async function uploadToBunny({ folder, fileName, buffer, contentType }) {
  const cleanFolder = String(folder || "uploads").replace(/^\/+|\/+$/g, "");
  const cleanName = String(fileName || makeStorageName("file")).replace(/[^\w.\-]/g, "_");
  const filePath = `${cleanFolder}/${cleanName}`;
  const url = `${bunnyStorageBaseUrl()}/${filePath}`;

  const response = await fetch(url, {
    method: "PUT",
    headers: {
      AccessKey: bunnyAccessKey(),
      "Content-Type": contentType || "application/octet-stream"
    },
    body: buffer
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Bunny upload failed (${response.status}). ${text}`.trim());
  }

  return {
    filePath,
    cdnUrl: `${bunnyCdnBaseUrl()}/${filePath}`
  };
}

export async function deleteFromBunny(filePath) {
  if (!filePath) return { skipped: true };
  const url = `${bunnyStorageBaseUrl()}/${String(filePath).replace(/^\/+/, "")}`;
  const response = await fetch(url, {
    method: "DELETE",
    headers: { AccessKey: bunnyAccessKey() }
  });
  if (!response.ok && response.status !== 404) {
    const text = await response.text().catch(() => "");
    throw new Error(`Bunny delete failed (${response.status}). ${text}`.trim());
  }
  return { deleted: true };
}

function base64Url(input) {
  return Buffer.from(input).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function createBunnySignedUrl({ filePath, expiresInSeconds = 7200, userIp = "", requireToken = true }) {
  const cdnBase = bunnyCdnBaseUrl();
  const cleanPath = `/${String(filePath || "").replace(/^\/+/, "")}`;
  const expires = Math.floor(Date.now() / 1000) + Number(expiresInSeconds || 7200);
  const securityKey = process.env.BUNNY_TOKEN_AUTH_KEY;

  if (!requireToken || !securityKey) return `${cdnBase}${cleanPath}`;

  const tokenPath = cleanPath;
  const raw = `${securityKey}${tokenPath}${expires}${userIp || ""}`;
  const token = base64Url(crypto.createHash("sha256").update(raw).digest());
  const separator = cleanPath.includes("?") ? "&" : "?";
  return `${cdnBase}${cleanPath}${separator}token=${token}&expires=${expires}`;
}

export function publicBaseUrl(req) {
  const envUrl = process.env.PUBLIC_API_URL || process.env.API_PUBLIC_URL;
  if (envUrl) return envUrl.replace(/\/$/, "");
  return `${req.protocol}://${req.get("host")}`;
}
