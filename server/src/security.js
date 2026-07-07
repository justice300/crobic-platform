import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import slowDown from "express-slow-down";
import helmet from "helmet";
import { body, param, query, validationResult } from "express-validator";
import xss from "xss";

const isProduction = process.env.NODE_ENV === "production";

function allowedOrigins() {
  return [
    process.env.CLIENT_URL,
    process.env.VERCEL_FRONTEND_URL,
    process.env.FRONTEND_URL,
    "https://cibionline.org",
    "https://www.cibionline.org",
    "https://crobic-web.onrender.com",
    "http://localhost:5173",
    "http://127.0.0.1:5173"
  ]
    .filter(Boolean)
    .map((origin) => origin.replace(/\/$/, ""));
}


export function strictCorsOptions() {
  const allowed = allowedOrigins();
  return {
    origin(origin, callback) {
    // Allow direct browser visits, Render health checks, Postman, curl
    if (!origin) return callback(null, true);

    if (allowed.includes(origin.replace(/\/$/, ""))) {
      return callback(null, true);
    }

  return callback(new Error("CORS origin not allowed"));
},
    credentials: true,
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"]
  };
}

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many login attempts. Please try again later." }
});

export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many registration attempts. Please try again later." }
});

export const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many OTP or password reset attempts. Please try again later." }
});

export const apiSlowDown = slowDown({
  windowMs: 15 * 60 * 1000,
  delayAfter: 60,
  delayMs: (hits) => Math.min((hits - 60) * 100, 3000)
});

function sanitizeValue(value) {
  if (typeof value === "string") {
    return xss(value.trim(), {
      whiteList: {},
      stripIgnoreTag: true,
      stripIgnoreTagBody: ["script", "style"]
    });
  }
  if (Array.isArray(value)) return value.map(sanitizeValue);
  if (value && typeof value === "object") {
    const clean = {};
    for (const [key, item] of Object.entries(value)) {
      if (key.includes("$") || key.includes(".")) continue;
      clean[key] = sanitizeValue(item);
    }
    return clean;
  }
  return value;
}

export function sanitizeRequestBody(req, _res, next) {
  try {
    if (req.body && typeof req.body === "object") {
      req.body = sanitizeValue(req.body);
    }

    // Do not reassign req.query in Express 5 because it can be read-only.
    if (req.query && typeof req.query === "object") {
      const cleanQuery = sanitizeValue(req.query);
      for (const key of Object.keys(req.query)) {
        delete req.query[key];
      }
      Object.assign(req.query, cleanQuery);
    }

    if (req.params && typeof req.params === "object") {
      const cleanParams = sanitizeValue(req.params);
      Object.assign(req.params, cleanParams);
    }

    next();
  } catch (error) {
    next(error);
  }
}

export function validateRequest(req, res, next) {
  const errors = validationResult(req);
  if (errors.isEmpty()) return next();
  return res.status(400).json({
    message: "Invalid request data.",
    errors: errors.array().map((error) => ({ field: error.path, message: error.msg }))
  });
}

export const validators = {
  idParam: (name = "id") => param(name).isInt({ min: 1 }).toInt(),
  courseId: param("courseId").isInt({ min: 1 }).toInt(),
  videoId: param("videoId").isInt({ min: 1 }).toInt(),
  sessionId: param("sessionId").isInt({ min: 1 }).toInt(),
  email: body("email").isEmail().normalizeEmail(),
  password: body("password").isString().isLength({ min: 6, max: 128 }),
  safeText: (name, max = 1000, optional = false) => {
    const chain = body(name).trim().isLength({ max });
    return optional ? chain.optional({ nullable: true, checkFalsy: true }) : chain.notEmpty();
  },
  url: (name, optional = false) => {
    const chain = body(name).trim().isURL({ protocols: ["http", "https"], require_protocol: true });
    return optional ? chain.optional({ nullable: true, checkFalsy: true }) : chain.notEmpty();
  }
};

export function httpsRedirect(req, res, next) {
  if (!isProduction) return next();
  const proto = req.headers["x-forwarded-proto"] || req.protocol;
  if (proto === "https") return next();
  return res.redirect(301, `https://${req.headers.host}${req.originalUrl}`);
}

export function applySecurity(app) {
  app.disable("x-powered-by");
  app.disable("etag");
  app.set("trust proxy", 1);

  app.use(httpsRedirect);
  app.use(cookieParser());
  app.use(apiSlowDown);
  app.use(sanitizeRequestBody);

  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "https://www.youtube.com"],
          styleSrc: ["'self'", "https:", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'", process.env.CLIENT_URL || "", process.env.BUNNY_CDN_BASE_URL || "", "https://*.sentry.io"].filter(Boolean),
          mediaSrc: ["'self'", "https:", "blob:"],
          frameSrc: ["'self'", "https://www.youtube.com", "https://youtube.com", "https://www.youtube-nocookie.com", "https://*.daily.co", "https://*.zoom.us"],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          frameAncestors: ["'self'"],
          ...(isProduction ? { upgradeInsecureRequests: [] } : {})
        }
      },
      hsts: isProduction ? { maxAge: 31536000, includeSubDomains: true, preload: true } : false,
      referrerPolicy: { policy: "no-referrer" },
      xContentTypeOptions: true,
      xFrameOptions: { action: "sameorigin" },
      crossOriginResourcePolicy: { policy: "cross-origin" }
    })
  );

  app.use((_req, res, next) => {
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
    res.setHeader("X-Download-Options", "noopen");
    next();
  });
}

export function productionErrorHandler(error, req, res, _next) {
  const status = Number(error.statusCode || error.status || 500);
  if (process.env.NODE_ENV !== "test") {
    console.error("Request failed:", {
      method: req.method,
      path: req.originalUrl,
      status,
      message: error.message
    });
  }

  const safeMessage = status >= 500 && isProduction
    ? "Something went wrong. Please try again later."
    : error.message || "Request failed";

  res.status(status).json({ message: safeMessage });
}
