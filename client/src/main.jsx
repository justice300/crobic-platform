import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import * as Sentry from "@sentry/react";
import DOMPurify from "dompurify";
import {
  ArrowRight,
  Award,
  Bell,
  BookOpen,
  Briefcase,
  Camera,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  CreditCard,
  GraduationCap,
  Library,
  MapPin,
  Megaphone,
  MessageCircle,
  Menu,
  Phone,
  Radio,
  Search,
  ShieldCheck,
  ShoppingBag,
  Trash2,
  Users,
  Video,
  Send,
  X
} from "lucide-react";
import { api, clearToken, getToken, setToken } from "./api";
import "./styles.css";

const LOGO = "/crobic-images/cra-logo.png";

if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE,
    tracesSampleRate: Number(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE || 0.1),
    beforeSend(event) {
      if (event.request?.headers) {
        delete event.request.headers.Authorization;
        delete event.request.headers.Cookie;
      }
      return event;
    }
  });
}

function sanitizeHtml(value = "") {
  return DOMPurify.sanitize(String(value || ""), { USE_PROFILES: { html: true } });
}

const CIBI_IMAGES = {
  graduation: "/crobic-images/graduation-stage.jpg",
  handshake: "/crobic-images/convocation-handshake.jpg",
  classroom: "/crobic-images/classroom.jpg",
  logo: "/crobic-images/cra-logo.png"
};

const CIBI_PHONE_DISPLAY = "0812 130 0287";
const CIBI_PHONE_E164 = "2348121300287";
const CIBI_ADDRESS = "Champions Royal Assembly, Chikakore Kubwa, Abuja, Nigeria.";
const CIBI_MAP_QUERY = "Champions Royal Assembly, Chikakore Kubwa Abuja Nigeria";
const CIBI_WHATSAPP_LINK = `https://wa.me/${CIBI_PHONE_E164}?text=${encodeURIComponent("Hello CIBI, I need help with admission.")}`;

const DEFAULT_FAQS = [
  {
    question: "What is CIBI?",
    answer: "CIBI stands for Champion International Bible Institute, formerly CROBIC. It is the biblical training arm of Champions Royal Assembly."
  },
  {
    question: "Who can apply for admission?",
    answer: "Admission is open to pastors, evangelists, prophets, Bible teachers, associate ministers, church workers, academics, leaders and professionals."
  },
  {
    question: "What programmes does CIBI offer?",
    answer: "CIBI offers Foundation Certificate, Diploma Certificate, Advanced Diploma Certificate, and Workers and Leadership Training programmes."
  },
  {
    question: "How do I register?",
    answer: "Click Enroll Now, create your student account, choose your programme, complete payment, and wait for admin approval."
  },
  {
    question: "How can I contact CIBI?",
    answer: `You can contact CIBI on WhatsApp or phone through ${CIBI_PHONE_DISPLAY}.`
  }
];

const SLIDE_DURATION = 6500;
function fallbackCourses() { return []; }

const DEFAULT_SLIDES = [
  {
    eyebrow: "Flagship Program",
    title: "Certificate in Biblical Studies",
    description:
      "Build a solid foundation in Scripture and ministry over 12 intensive months of classroom instruction, practical assignments, and spiritual formation.",
    imageUrl: "https://media.base44.com/images/public/user_69b1494dcdfc0c8eaff727d9/83e981ce1_481473921_1244570630360710_3874837180479012159_n.jpg",
    ctaText: "Apply Now",
    ctaPage: "admissions"
  },
  {
    eyebrow: "Advanced Program",
    title: "Diploma in Theology",
    description:
      "Deepen your theological understanding and ministry competence through a comprehensive 24-month curriculum designed for active ministers and church workers.",
    imageUrl: CIBI_IMAGES.classroom,
    ctaText: "Apply Now",
    ctaPage: "admissions"
  },
  {
    eyebrow: "Degree Program",
    title: "B.A and B.Th in Theology",
    description:
      "Pursue academic excellence and spiritual depth with our degree programs, rigorous study, research and hands-on ministry training.",
    imageUrl: "https://media.base44.com/images/public/user_69b1494dcdfc0c8eaff727d9/8593979bf_120191079_3625958297424923_5496208248079105325_n.jpg",
    ctaText: "Apply Now",
    ctaPage: "admissions"
  },
  {
    eyebrow: "Executive Stream",
    title: "Executive Classes",
    description:
      "Designed for working-class pastors and professionals. Weekend and evening sessions that fit your schedule without compromising depth and quality.",
    imageUrl: CIBI_IMAGES.graduation,
    ctaText: "Apply Now",
    ctaPage: "admissions"
  }
];

const DEFAULT_GALLERY = [
  { title: "Graduation Ceremony", imageUrl: CIBI_IMAGES.graduation, category: "Graduation" },
  { title: "Certificate Presentation", imageUrl: CIBI_IMAGES.handshake, category: "Convocation" },
  { title: "Classroom Training", imageUrl: CIBI_IMAGES.classroom, category: "Training" }
];

const ADMIN_ROLES = ["SUPER_ADMIN", "RECTOR", "ADMIN", "LECTURER"];
const POWER_ADMIN_ROLES = ["SUPER_ADMIN", "RECTOR"];

function isStaffUser(user) {
  return ADMIN_ROLES.includes(user?.role);
}

function isPowerAdmin(user) {
  return POWER_ADMIN_ROLES.includes(user?.role);
}

function usdFee(course) {
  return Number(course?.feeUsd || 0) > 0 ? Number(course.feeUsd || 0) : Number(course?.fee || 0);
}

function formatUsd(amount) {
  return `$${Number(amount || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function isTwelveMonthDiplomaFee(course) {
  const title = String(course?.title || "").toLowerCase();
  const level = String(course?.level || "").toLowerCase();
  const fee = usdFee(course);
  return fee === 190 && (title.includes("diploma") || level.includes("diploma")) && !title.includes("advanced") && !level.includes("advanced");
}

function programmeFeeText(course) {
  const fee = usdFee(course);
  if (fee <= 0) return "Contact Us";
  return isTwelveMonthDiplomaFee(course) ? `${formatUsd(fee)} (12 months)` : formatUsd(fee);
}

function programmePaymentFeeText(course) {
  const fee = usdFee(course);
  if (fee <= 0) return "Contact Us";
  return isTwelveMonthDiplomaFee(course) ? `${formatUsd(fee)} (12-month payment)` : formatUsd(fee);
}

function parseRates(settings = {}) {
  return String(settings.currency_rates || "NGN|1500\nGHS|12\nKES|130\nZAR|18\nEUR|0.92\nGBP|0.78")
    .split(/\n|,/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [code = "", rate = ""] = line.split("|").map((item) => item.trim());
      return { code: code.toUpperCase(), rate: Number(rate || 0) };
    })
    .filter((item) => item.code && item.rate > 0);
}

function CurrencyConverter({ amountUsd = 0, settings = {}, editableAmount = false }) {
  const rates = parseRates(settings);
  const [currency, setCurrency] = useState(rates[0]?.code || "NGN");
  const [inputAmount, setInputAmount] = useState(amountUsd ? String(amountUsd) : "");
  const rate = rates.find((item) => item.code === currency)?.rate || 0;
  const activeAmount = editableAmount ? Number(inputAmount || 0) : Number(amountUsd || 0);
  const converted = activeAmount * rate;
  if (!editableAmount && !Number(amountUsd || 0)) return null;
  return (
    <div className={`currency-converter-box ${editableAmount ? "currency-converter-input-mode" : ""}`}>
      {editableAmount ? (
        <label className="currency-amount-field">
          <span>Enter amount in USD</span>
          <input
            type="number"
            min="0"
            inputMode="decimal"
            placeholder="e.g. 190"
            value={inputAmount}
            onChange={(e) => setInputAmount(e.target.value)}
          />
        </label>
      ) : (
        <strong>{formatUsd(amountUsd)}</strong>
      )}
      <span>Convert estimate</span>
      <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
        {rates.map((item) => <option key={item.code} value={item.code}>{item.code}</option>)}
      </select>
      {activeAmount > 0 ? <b>{currency} {converted.toLocaleString(undefined, { maximumFractionDigits: 2 })}</b> : <b className="converter-placeholder">Enter USD amount</b>}
      <small>{settings.currency_converter_note || "Approximate conversion. Final payment depends on school-approved exchange rate."}</small>
    </div>
  );
}


function getSetting(settings, key, fallback = "") {
  const value = settings?.[key];
  return value === undefined || value === null || value === "" ? fallback : value;
}

function settingLines(settings, key, fallback = []) {
  const value = getSetting(settings, key, "");
  if (!value) return fallback;
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function settingPipeList(settings, key, fallback = []) {
  return settingLines(settings, key, fallback.map((item) => Array.isArray(item) ? item.join("|") : String(item))).map((line) => {
    const [title = "", sub = "", extra = ""] = line.split("|").map((item) => item.trim());
    return { title, sub, desc: sub, value: sub, extra };
  });
}

function settingPoints(settings, key, fallback = []) {
  const value = getSetting(settings, key, "");
  return value ? value.split("|").map((item) => item.trim()).filter(Boolean) : fallback;
}

const CIBI_TOAST_EVENT = "crobic-toast";
const CIBI_CONFIRM_EVENT = "crobic-confirm";

function showToast(message, type = "info", title = "") {
  if (!message) return;
  window.dispatchEvent(new CustomEvent(CIBI_TOAST_EVENT, { detail: { message, type, title } }));
}

function showConfirm({
  title = "Please confirm",
  message = "Are you sure you want to continue?",
  confirmText = "Continue",
  cancelText = "Cancel",
  danger = false
} = {}) {
  return new Promise((resolve) => {
    window.dispatchEvent(new CustomEvent(CIBI_CONFIRM_EVENT, {
      detail: { title, message, confirmText, cancelText, danger, resolve }
    }));
  });
}

function NotificationCenter() {
  const [toasts, setToasts] = useState([]);
  const [confirmState, setConfirmState] = useState(null);

  useEffect(() => {
    function handleToast(event) {
      const toast = {
        id: `${Date.now()}-${Math.random()}`,
        type: event.detail?.type || "info",
        title: event.detail?.title || "",
        message: event.detail?.message || ""
      };

      setToasts((current) => [...current, toast].slice(-4));
      window.setTimeout(() => {
        setToasts((current) => current.filter((item) => item.id !== toast.id));
      }, toast.type === "error" ? 6500 : 4500);
    }

    function handleConfirm(event) {
      setConfirmState(event.detail || null);
    }

    window.addEventListener(CIBI_TOAST_EVENT, handleToast);
    window.addEventListener(CIBI_CONFIRM_EVENT, handleConfirm);

    return () => {
      window.removeEventListener(CIBI_TOAST_EVENT, handleToast);
      window.removeEventListener(CIBI_CONFIRM_EVENT, handleConfirm);
    };
  }, []);

  function resolveConfirm(answer) {
    if (confirmState?.resolve) confirmState.resolve(answer);
    setConfirmState(null);
  }

  return (
    <>
      <div className="crobic-toast-stack" aria-live="polite" aria-atomic="true">
        {toasts.map((toast) => (
          <div className={`crobic-toast crobic-toast-${toast.type}`} key={toast.id}>
            <button type="button" onClick={() => setToasts((current) => current.filter((item) => item.id !== toast.id))} aria-label="Dismiss notification">×</button>
            <strong>{toast.title || (toast.type === "success" ? "Success" : toast.type === "error" ? "Action needed" : "Notice")}</strong>
            <p>{toast.message}</p>
          </div>
        ))}
      </div>

      {confirmState && (
        <div className="crobic-confirm-backdrop" role="dialog" aria-modal="true">
          <div className="crobic-confirm-card">
            <span>{confirmState.danger ? "Confirm action" : "Confirmation"}</span>
            <h3>{confirmState.title}</h3>
            <p>{confirmState.message}</p>
            <div>
              <button type="button" className="ghost-btn admin-cancel-btn" onClick={() => resolveConfirm(false)}>{confirmState.cancelText || "Cancel"}</button>
              <button type="button" className={confirmState.danger ? "danger-action-btn" : "gold-btn"} onClick={() => resolveConfirm(true)}>{confirmState.confirmText || "Continue"}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}


function App() {
  const initialPage = window.location.pathname.replace("/", "") || "home";
  const [page, setPage] = useState(initialPage === "admission" ? "admissions" : initialPage);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState("login");
  const [user, setUser] = useState(null);
  const [data, setData] = useState({
    slides: [],
    books: [],
    courses: [],
    programmes: [],
    announcements: [],
    liveSession: null,
    settings: {},
    testimonials: [],
    faqs: [],
    gallery: []
  });
  const [loading, setLoading] = useState(true);

  async function loadPublicData() {
    const bootstrap = await api(`/public/bootstrap?_=${Date.now()}`);
    setData((current) => ({ ...current, ...bootstrap, settings: bootstrap.settings || {} }));
  }

  async function loadMe() {
    if (!getToken()) return;
    try {
      const result = await api("/auth/me");
      setUser(result.user);
    } catch {
      clearToken();
      setUser(null);
    }
  }

  useEffect(() => {
    Promise.all([loadPublicData(), loadMe()]).finally(() => setLoading(false));
  }, []);

  function goTo(nextPage) {
    const normalized = nextPage === "admission" ? "admissions" : nextPage;
    setPage(normalized);
    setMobileOpen(false);
    window.history.pushState({}, "", normalized === "home" ? "/" : `/${normalized === "admissions" ? "admission" : normalized}`);
    window.scrollTo(0, 0);
  }

  function openAuth(mode = "login") {
    setAuthMode(mode);
    setAuthOpen(true);
  }

  async function logout() {
    try {
      await api("/auth/logout", { method: "POST" });
    } catch {
      // Session may already be expired.
    }
    clearToken();
    setUser(null);
    goTo("home");
  }

  useEffect(() => {
    const handler = () => {
      setUser(null);
      goTo("home");
      showToast("Your session expired. Please login again.", "error");
    };
    window.addEventListener("crobic:auth-expired", handler);
    return () => window.removeEventListener("crobic:auth-expired", handler);
  }, []);

  if (loading) return <div className="loading-screen"><img src={LOGO} alt="CIBI" /> Loading CIBI...</div>;

  return (
    <>
      <Navbar
        page={page}
        goTo={goTo}
        user={user}
        logout={logout}
        openAuth={openAuth}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
      />

      {page === "home" && <Home data={data} goTo={goTo} openAuth={openAuth} />}
      {page === "about" && <About goTo={goTo} settings={data.settings} />}
      {page === "programs" && <Programs courses={data.courses} programmes={data.programmes || []} openAuth={openAuth} user={user} goTo={goTo} settings={data.settings} />}
      {page === "library" && <BookLibrary books={data.books} settings={data.settings} />}
      {page === "admissions" && <Admissions courses={data.courses} programmes={data.programmes || []} settings={data.settings} user={user} openAuth={openAuth} goTo={goTo} setUser={setUser} />}
      {page === "gallery" && <Gallery gallery={data.gallery} settings={data.settings} />}
      {page === "contact" && <Contact settings={data.settings} />}
      {page === "payment-callback" && <PaymentCallback user={user} goTo={goTo} />}
      {page === "certificate-verification" && <CertificateVerification />}

      {page === "student" && (
        user ? <StudentPortal user={user} setUser={setUser} goTo={goTo} /> : <AccessGate title="Student Portal" openAuth={() => openAuth("login")} />
      )}

      {page === "admin" && (
        isStaffUser(user) ? (
          <AdminDashboard reloadPublic={loadPublicData} currentUser={user} />
        ) : (
          <AccessGate title="Admin Dashboard" openAuth={() => openAuth("login")} />
        )
      )}

      {!['student', 'admin', 'payment-callback', 'certificate-verification'].includes(page) && (
        <SiteRegistrationCTA page={page} goTo={goTo} openAuth={openAuth} settings={data.settings} />
      )}
      {!['student', 'admin'].includes(page) && <Footer goTo={goTo} settings={data.settings} />}
      <FloatingWhatsApp settings={data.settings} />
      <NotificationCenter />

      {authOpen && (
        <AuthModal
          mode={authMode}
          setMode={setAuthMode}
          close={() => setAuthOpen(false)}
          setUser={setUser}
          goTo={goTo}
          courses={data.courses || []}
          programmes={data.programmes || []}
          settings={data.settings || {}}
        />
      )}
    </>
  );
}


function NotificationBell({ user }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);

  async function load() {
    if (!user) return;
    try {
      const result = await api("/notifications");
      setItems(result || []);
    } catch {
      setItems([]);
    }
  }

  useEffect(() => {
    load();
    if (!user) return undefined;
    const timer = setInterval(load, 30000);
    return () => clearInterval(timer);
  }, [user?.id]);

  async function markRead(item) {
    try {
      await api(`/notifications/${item.id}/read`, { method: "PATCH" });
      setItems((current) => current.map((row) => row.id === item.id ? { ...row, readAt: new Date().toISOString() } : row));
      if (item.url) window.open(item.url, "_blank", "noopener,noreferrer");
    } catch (error) {
      showToast(error.message, "error");
    }
  }

  const unread = items.filter((item) => !item.readAt).length;

  return (
    <div className="notification-bell-wrap">
      <button type="button" className="notification-bell" onClick={() => setOpen((value) => !value)} aria-label="Notifications">
        <Bell size={17} />
        {unread > 0 && <span>{unread}</span>}
      </button>
      {open && (
        <div className="notification-menu">
          <strong>Notifications</strong>
          {items.length === 0 && <p>No notifications yet.</p>}
          {items.slice(0, 8).map((item) => (
            <button type="button" key={item.id} className={item.readAt ? "notification-item read" : "notification-item"} onClick={() => markRead(item)}>
              <b>{item.title}</b>
              <small>{item.message}</small>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Navbar({ page, goTo, user, logout, openAuth, mobileOpen, setMobileOpen }) {
  const links = [
    ["home", "Home"],
    ["about", "About"],
    ["programs", "Programs"],
    ["admissions", "Admission"],
    ["library", "Books"],
    ["gallery", "Gallery"],
    ["contact", "Contact"]
  ];

  return (
    <header className="navbar">
      <div className="nav-inner">
        <button className="brand" onClick={() => goTo("home")}> 
          <span className="logo-glow"><img src={LOGO} alt="CIBI Logo" /></span>
          <span className="brand-copy">
            <strong>CIBI</strong>
            <small>Champion International Bible Institute</small>
            <em>Formerly CROBIC</em>
          </span>
        </button>

        <nav className="desktop-nav">
          {links.map(([key, label]) => (
            <button key={key} onClick={() => goTo(key)} className={page === key ? "active" : ""}>
              {label}
            </button>
          ))}
        </nav>

        <div className="nav-actions">
          {user ? (
            <>
              <NotificationBell user={user} />
              <button className="ghost-btn" onClick={() => goTo(isStaffUser(user) ? "admin" : "student")}>Portal</button>
              <button className="dark-btn" onClick={logout}>Logout</button>
            </>
          ) : (
            <>
              <button className="ghost-btn" onClick={() => openAuth("login")}>Login</button>
              <button className="gold-btn" onClick={() => openAuth("register")}>Enroll Now</button>
            </>
          )}

          <button className="menu-btn" onClick={() => setMobileOpen(!mobileOpen)}>{mobileOpen ? <X /> : <Menu />}</button>
        </div>
      </div>

      {mobileOpen && (
        <div className="mobile-nav">
          {links.map(([key, label]) => <button key={key} onClick={() => goTo(key)}>{label}</button>)}
          <button onClick={() => goTo("student")}>Student Portal</button>
          <button onClick={() => goTo("admin")}>Admin Dashboard</button>
        </div>
      )}
    </header>
  );
}


function getFaqQuestion(item = {}) {
  return item.question || item.title || "CIBI question";
}

function getFaqAnswer(item = {}) {
  return item.answer || item.body || item.description || "";
}

function HomeFaqSection({ faqs = [], settings = {} }) {
  const [openIndex, setOpenIndex] = useState(0);
  const list = faqs.length ? faqs : DEFAULT_FAQS;

  return (
    <section className="home-faq-section">
      <div className="container">
        <SectionIntro
          eyebrow={getSetting(settings, "home_faq_eyebrow", "FAQ")}
          title={getSetting(settings, "home_faq_title", "Frequently Asked Questions")}
          text={getSetting(settings, "home_faq_text", "Everything you need to know about CIBI programmes, admission and student support.")}
        />
        <div className="home-faq-list">
          {list.map((item, index) => {
            const active = openIndex === index;
            return (
              <div className={`home-faq-item ${active ? "open" : ""}`} key={item.id || `${getFaqQuestion(item)}-${index}`}>
                <button type="button" onClick={() => setOpenIndex(active ? -1 : index)}>
                  <span>{getFaqQuestion(item)}</span>
                  {active ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </button>
                {active && <p>{getFaqAnswer(item)}</p>}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function SiteRegistrationCTA({ page, goTo, openAuth, settings = {} }) {
  return (
    <section className={`site-registration-cta ${page === "admissions" ? "site-registration-cta-admission" : ""}`}>
      <div className="container site-registration-inner">
        <div>
          <span>{getSetting(settings, "global_registration_kicker", "Admission Open")}</span>
          <h2>{getSetting(settings, "global_registration_title", "Begin Your CIBI Registration")}</h2>
          <p>{getSetting(settings, "global_registration_text", "Create your student account, choose a programme, complete payment, and receive portal access after confirmation and approval.")}</p>
        </div>
        <div className="site-registration-actions">
          <button className="gold-btn big" type="button" onClick={() => openAuth("register")}>Enroll Now</button>
          <button className="white-btn big" type="button" onClick={() => goTo("admissions")}>Admission Details</button>
          <a className="ghost-btn big" href={CIBI_WHATSAPP_LINK} target="_blank" rel="noreferrer">Chat on WhatsApp</a>
        </div>
      </div>
    </section>
  );
}

function FloatingWhatsApp({ settings = {} }) {
  return (
    <a
      className="floating-whatsapp"
      href={CIBI_WHATSAPP_LINK}
      target="_blank"
      rel="noreferrer"
      aria-label="Chat with CIBI customer care on WhatsApp"
    >
      <MessageCircle size={22} />
      
    </a>
  );
}

function ContactMap({ address = CIBI_ADDRESS }) {
  const mapUrl = `https://www.google.com/maps?q=${encodeURIComponent(address || CIBI_MAP_QUERY)}&output=embed`;
  return (
    <div className="contact-map-card contact-map-card-with-image">
      <div>
        <span>Visit Us</span>
        <h2>Find Champions Royal Assembly</h2>
        <p>{address}</p>
      </div>
      <iframe
        title="Champions Royal Assembly map"
        src={mapUrl}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        allowFullScreen
      />
    </div>
  );
}


function Home({ data, goTo, openAuth }) {
  const s = data.settings || {};
  const faqs = (data.faqs || []).length ? data.faqs : DEFAULT_FAQS;
  // CMS SYNC FIX:
  // Each admin slide controls its matching homepage slot by slideOrder.
  // If a slot is missing, only that slot uses the default fallback.
  // This keeps the public homepage synced with Admin Dashboard → Slides even when fewer than 4 slides exist.
  const adminSlides = [...(data.slides || [])]
    .filter((item) => item?.title || item?.description || item?.imageUrl || item?.eyebrow)
    .sort((a, b) => Number(a.slideOrder || 999) - Number(b.slideOrder || 999));
  const usedAdminIds = new Set();
  const slides = DEFAULT_SLIDES.map((fallback, index) => {
    const slotOrder = index + 1;
    const byOrder = adminSlides.find((item) => Number(item.slideOrder || 0) === slotOrder && !usedAdminIds.has(item.id));
    const byIndex = adminSlides.find((item) => !usedAdminIds.has(item.id));
    const adminSlide = byOrder || byIndex || null;
    if (adminSlide?.id) usedAdminIds.add(adminSlide.id);
    return {
      ...fallback,
      ...adminSlide,
      eyebrow: adminSlide?.eyebrow || fallback.eyebrow,
      title: adminSlide?.title || fallback.title,
      description: adminSlide?.description || fallback.description,
      imageUrl: adminSlide?.imageUrl || fallback.imageUrl,
      ctaText: adminSlide?.ctaText || fallback.ctaText,
      ctaPage: adminSlide?.ctaPage || fallback.ctaPage,
      slideOrder: slotOrder
    };
  });
  const [active, setActive] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setActive((prev) => (prev + 1) % slides.length);
    }, SLIDE_DURATION);

    return () => clearTimeout(timer);
  }, [active, slides.length]);

  const slide = slides[active] || DEFAULT_SLIDES[0];
  const heroImage = slide.imageUrl || DEFAULT_SLIDES[active % DEFAULT_SLIDES.length].imageUrl;

  return (
    <main>
      <section className="hero hero-luxury">
        <div key={active} className="hero-bg hero-bg-animated" style={{ backgroundImage: `url(${heroImage})` }} />
        <div className="hero-overlay" />
        <div className="hero-line hero-line-left" />
        <div className="hero-line hero-line-right" />
        <div className="corner corner-top" />
        <div className="corner corner-bottom" />
        <div className="hero-content">
          <p className="eyebrow framed">{slide.eyebrow || "Champion International Bible Institute"}</p>
          <h1>{slide.title}</h1>
          <p>{slide.description}</p>
          <div className="hero-actions">
            <button className="gold-btn big" onClick={() => goTo(slide.ctaPage || "admissions")}>{slide.ctaText || "Apply Now"}<ArrowRight size={14} /></button>
            <button className="white-btn big" onClick={() => goTo("programs")}>Explore Programs</button>
          </div>
        </div>
        <div className="hero-progress">
          {slides.map((item, index) => (
            <button
              key={`${item.title}-${index}`}
              className={active === index ? "active-slide" : ""}
              onClick={() => setActive(index)}
              style={{ "--slide-duration": `${SLIDE_DURATION}ms` }}
            >
              <span>{String(index + 1).padStart(2, "0")}</span>
              <small>{item.eyebrow || "Program"}</small>
              <i className={active === index ? "progress-active" : ""} />
            </button>
          ))}
        </div>
      </section>

      <section className="info-cards container">
        <Feature icon={<BookOpen />} title={getSetting(s, "home_card_1_title", "Programs Available")} text={getSetting(s, "home_card_1_text", "Certificate, Diploma, Degree and executive learning options.")} />
        <Feature icon={<GraduationCap />} title={getSetting(s, "home_card_2_title", "Learning Options")} text={getSetting(s, "home_card_2_text", "Regular classes and executive classes for working ministers.")} />
        <Feature icon={<ShieldCheck />} title={getSetting(s, "home_card_3_title", "Structured Admission")} text={getSetting(s, "home_card_3_text", "Portal access begins after registration, payment confirmation and admission approval.")} />
      </section>

      <section className="stats stats-flat">
        <div><strong>{getSetting(s, "home_stat_1_value", "1000+")}</strong><span>{getSetting(s, "home_stat_1_label", "Ministerial Graduates")}</span></div>
        <div><strong>{getSetting(s, "home_stat_2_value", "15+")}</strong><span>{getSetting(s, "home_stat_2_label", "Years of Excellence")}</span></div>
        <div><strong>{getSetting(s, "home_stat_3_value", "6")}</strong><span>{getSetting(s, "home_stat_3_label", "Ministry Tracks")}</span></div>
        <div><strong>{getSetting(s, "home_stat_4_value", "Global")}</strong><span>{getSetting(s, "home_stat_4_label", "Reach and Impact")}</span></div>
      </section>

      <section className="split-section container about-preview">
        <div className="image-frame">
          <img src={getSetting(s, "home_about_image_url", CIBI_IMAGES.handshake)} alt="Convocation ceremony at Champion International Bible Institute" />
          <div className="image-caption"><strong>{getSetting(s, "home_about_caption_name", "Papa Joshua Iginla")}</strong><span>{getSetting(s, "home_about_caption_title", "Founder and President")}</span></div>
        </div>
        <div>
          <Kicker text={getSetting(s, "home_about_kicker", "About Us")} />
          <h2>{getSetting(s, "home_about_title", "About CIBI")}</h2>
          <div className="short-gold-line" />
          <p>
            {getSetting(s, "home_about_paragraph_1", "Champion International Bible Institute is the biblical training arm of Champions Royal Assembly, raising ministers and kingdom leaders through biblical doctrine, spiritual formation and practical ministry preparation.")}
          </p>
          <p>
            {getSetting(s, "home_about_paragraph_2", "CIBI combines theological learning, live classes, recorded lessons, book resources and a protected student portal for a clean academic experience.")}
          </p>
          <button className="text-link" onClick={() => goTo("about")}><span /> Read More <ArrowRight size={14} /></button>
        </div>
      </section>

      <section className="program-section">
        <div className="container">
          <SectionIntro eyebrow={getSetting(s, "home_programs_eyebrow", "Academics")} title={getSetting(s, "home_programs_title", "Our Programs")} text={getSetting(s, "home_programs_text", "Certificate, Diploma and Degree routes for ministers and Bible students.")} />
          <div className="program-showcase-grid home-program-showcase-grid">
            {programmeDisplayList(data.programmes, data.courses, s).map((course) => <ProgramCourseCard key={course.id || course.title} course={course} openAuth={openAuth} user={null} goTo={goTo} settings={s} showDetails />)}
          </div>
        </div>
      </section>

      <section className="learning-paths container">
        <SectionIntro eyebrow={getSetting(s, "home_paths_eyebrow", "Learning Paths")} title={getSetting(s, "home_paths_title", "Choose Your Learning Path")} text={getSetting(s, "home_paths_text", "Flexible options to fit your calling and schedule.")} />
        <div className="path-grid">
          <PathCard icon={<Users />} title={getSetting(s, "home_regular_class_title", "Regular Classes")} text={getSetting(s, "home_regular_class_text", "Full-time immersive biblical training for students seeking complete ministerial preparation.")} points={settingPoints(s, "home_regular_class_points", ["New ministers and full-time students", "Deep theological foundation", "Complete ministry preparation"])} />
          <PathCard icon={<Briefcase />} title={getSetting(s, "home_executive_class_title", "Executive Classes")} text={getSetting(s, "home_executive_class_text", "Part-time training designed for pastors and leaders who cannot attend regular weekday classes.")} points={settingPoints(s, "home_executive_class_points", ["Active pastors and evangelists", "Working-class ministers", "Flexible learning schedule"])} />
        </div>
      </section>

      <section className="graduate-quote">
        <div className="graduate-bg" style={{ backgroundImage: `url(${getSetting(s, "home_graduate_image_url", CIBI_IMAGES.graduation)})` }} />
        <div className="quote-card">
          <Kicker text={getSetting(s, "home_graduate_kicker", "Our Graduates")} center />
          <h2>{getSetting(s, "home_graduate_title", "Graduates We Have Raised")}</h2>
          <div className="gold-divider"><span /></div>
          <blockquote>{getSetting(s, "home_graduate_quote", "“CIBI continues to raise champions for God’s kingdom through biblical training, discipline and spiritual formation.”")}</blockquote>
          <p className="quote-author">{getSetting(s, "home_graduate_author", "Prophet Joshua Iginla")}</p>
          <div className="graduate-number"><strong>{getSetting(s, "home_graduate_number", "1000+")}</strong><span>{getSetting(s, "home_graduate_number_label", "Ministerial Graduates")}</span></div>
        </div>
      </section>

      <HomeFaqSection faqs={faqs} settings={s} />

      <section className="cta-section cta-luxury">
        <Kicker text={getSetting(s, "home_cta_kicker", "Admission Open")} center />
        <h2>{getSetting(s, "home_cta_title", "Ready to Become a Champion for Christ?")}</h2>
        <p>{getSetting(s, "home_cta_text", "Admission is open for pastors, evangelists, prophets, Bible teachers, associate ministers, leaders, academics and professionals.")}</p>
        <div>
          <button className="gold-btn big" onClick={() => openAuth("register")}>{getSetting(s, "home_cta_primary_button", "Apply Now")}</button>
          <button className="white-btn big" onClick={() => goTo("programs")}>{getSetting(s, "home_cta_secondary_button", "View Programs")}</button>
        </div>
      </section>
    </main>
  );
}

function defaultProgrammeCards(settings = {}) {
  return [
    {
      id: "programme-foundation",
      slot: "foundation",
      title: getSetting(settings, "program_card_1_title", "Foundation Certificate Program"),
      level: getSetting(settings, "program_card_1_level", "Foundation"),
      duration: getSetting(settings, "program_card_1_duration", "6 Months"),
      feeUsd: Number(getSetting(settings, "program_card_1_fee", "59")) || 0,
      fee: 0,
      audience: getSetting(settings, "program_card_1_audience", "Ministers, leaders, academics & professionals"),
      description: getSetting(settings, "program_card_1_description", "Foundational biblical training covering prophetic ministry, evangelism, digital literacy, and minister character development."),
      certification: getSetting(settings, "program_card_1_certification", "Foundation Certificate")
    },
    {
      id: "programme-diploma",
      slot: "diploma",
      title: getSetting(settings, "program_card_2_title", "Diploma Certificate Program in Theology and Leadership"),
      level: getSetting(settings, "program_card_2_level", "Diploma"),
      duration: getSetting(settings, "program_card_2_duration", "24 Months"),
      feeUsd: Number(getSetting(settings, "program_card_2_fee", "190")) || 0,
      fee: 0,
      audience: getSetting(settings, "program_card_2_audience", "Pastors, evangelists, prophets & Bible teachers"),
      description: getSetting(settings, "program_card_2_description", "Comprehensive theological training for pastors, evangelists, prophets, and Bible teachers."),
      certification: getSetting(settings, "program_card_2_certification", "Diploma Certificate in Theology and Leadership")
    },
    {
      id: "programme-advanced",
      slot: "advanced",
      title: getSetting(settings, "program_card_3_title", "Advanced Diploma Certificate Program in Theology and Leadership"),
      level: getSetting(settings, "program_card_3_level", "Advanced"),
      duration: getSetting(settings, "program_card_3_duration", "12 Months"),
      feeUsd: Number(getSetting(settings, "program_card_3_fee", "198")) || 0,
      fee: 0,
      audience: getSetting(settings, "program_card_3_audience", "Ministers seeking advanced theological training"),
      description: getSetting(settings, "program_card_3_description", "Advanced study in deliverance, prophetic ministry, biblical business, and principles of raising leaders."),
      certification: getSetting(settings, "program_card_3_certification", "Advanced Diploma Certificate in Theology and Leadership")
    },
    {
      id: "programme-corporate",
      slot: "corporate",
      title: getSetting(settings, "program_card_4_title", "Workers and Leadership Training Program"),
      level: getSetting(settings, "program_card_4_level", "Corporate"),
      duration: getSetting(settings, "program_card_4_duration", "Flexible"),
      feeUsd: Number(getSetting(settings, "program_card_4_fee", "0")) || 0,
      fee: 0,
      audience: getSetting(settings, "program_card_4_audience", "Churches and organizations training their workers and leaders"),
      description: getSetting(settings, "program_card_4_description", "Churches and organizations training their workers and leaders."),
      certification: getSetting(settings, "program_card_4_certification", "Workers and Leadership Training Certificate")
    }
  ];
}

function programSlotForCourse(course = {}) {
  const haystack = `${course.level || ""} ${course.title || ""}`.toLowerCase();
  if (/worker|corporate|leadership training/.test(haystack)) return "corporate";
  if (/advanced/.test(haystack)) return "advanced";
  if (/diploma/.test(haystack)) return "diploma";
  if (/foundation certificate|foundation program|certificate program|foundation/.test(haystack) && !/christian doctrine/.test(haystack)) return "foundation";
  return "";
}

function mergeProgrammeCourses(courses = [], settings = {}) {
  const defaults = defaultProgrammeCards(settings);
  const published = Array.isArray(courses) ? courses.filter((course) => course?.published !== false) : [];
  const bySlot = Object.fromEntries(defaults.map((item) => [item.slot, item]));

  for (const course of published) {
    const slot = programSlotForCourse(course);
    if (!slot || !bySlot[slot]) continue;
    bySlot[slot] = {
      ...bySlot[slot],
      ...course,
      slot,
      title: course.title || bySlot[slot].title,
      level: course.level || bySlot[slot].level,
      duration: course.duration || bySlot[slot].duration,
      description: course.description || bySlot[slot].description,
      audience: course.audience || bySlot[slot].audience,
      certification: course.certification || bySlot[slot].certification,
      feeUsd: Number(course.feeUsd || course.fee || bySlot[slot].feeUsd || 0)
    };
  }

  return defaults.map((item) => bySlot[item.slot]);
}


function programmeDisplayList(programmes = [], courses = [], settings = {}) {
  const activeProgrammes = Array.isArray(programmes) ? programmes.filter((item) => item?.published !== false) : [];
  if (activeProgrammes.length) {
    return activeProgrammes.map((programme) => ({
      ...programme,
      level: programme.level || "Programme",
      duration: programme.duration || "Flexible",
      feeUsd: Number(programme.feeUsd || 0),
      fee: Number(programme.fee || 0),
      audience: programme.audience || programme.description,
      certification: programme.certification || programme.title,
      courses: programme.courses || []
    }));
  }
  return mergeProgrammeCourses(courses, settings);
}

function registrationProgrammeList(programmes = [], courses = []) {
  const realProgrammes = Array.isArray(programmes) ? programmes.filter((item) => item?.id && Number(item.id) > 0 && item?.published !== false) : [];
  if (realProgrammes.length) return realProgrammes;
  return Array.isArray(courses) ? courses.filter((item) => item?.id && Number(item.id) > 0 && item?.published !== false) : [];
}

function registrationProgrammePayloadId(item = {}) {
  const id = Number(item?.id || 0);
  return id > 0 ? id : 0;
}

function isCorporateProgramme(programme = {}) {
  const text = `${programme.level || ""} ${programme.title || ""} ${programme.slot || ""}`.toLowerCase();
  return /worker|corporate|leadership training/.test(text);
}

function admissionFeeLabel(programme = {}, index = 0) {
  const text = `${programme.level || ""} ${programme.title || ""}`.toLowerCase();
  if (/advanced/.test(text)) return "Advanced Diploma Certificate";
  if (/diploma/.test(text)) return "Diploma Certificate";
  if (/foundation|certificate/.test(text)) return "Foundation Certificate";
  return ["Foundation Certificate", "Diploma Certificate", "Advanced Diploma Certificate"][index] || (programme.level || "Programme");
}

function About({ goTo, settings = {} }) {
  const founderParagraphs = settingLines(settings, "about_founder_bio", [
    "Papa Joshua Iginla is the founder of Champions Royal Assembly, a church known for prophetic and deliverance ministry with headquarters in Abuja, Nigeria.",
    "As President and Lead Lecturer of CIBI, he personally teaches students and raises ministers as tools for effective ministry."
  ]);

  const churchStats = settingPipeList(settings, "about_church_stats", [
    ["80,000-Seater Auditorium", "Megachurch capacity"],
    ["International Presence", "Branches in Nigeria, Africa, USA"],
    ["Founded 1996–1997", "Celebrated 29 years in 2025"],
    ["Prophetic & Deliverance", "Core ministry focus"]
  ]);

  const beliefs = settingPipeList(settings, "about_beliefs", [
    ["Strong Word Base", "Solid biblical teaching and doctrine form the foundation of every program."],
    ["Prophetic Ministry", "Training in prophetic call, operation, and sensitivity to the Holy Spirit."],
    ["Deliverance Power", "Techniques for freeing people from spiritual oppression and darkness."]
  ]);

  const milestones = settingPipeList(settings, "about_milestones", [
    ["2005–2006", "CIBI Established"],
    ["2020", "14th Anniversary - Graduated 30 ministerial students after 2 years"],
    ["2021", "15th Anniversary - Released End Time Kingdom Expanders"],
    ["2022", "16th Anniversary - Convocation A Fire Generation"],
    ["2025", "Church celebrates 29 years of ministry"]
  ]);

  const statIcons = [<Briefcase />, <Users />, <Clock />, <Award />];

  return (
    <main className="base44-about-page">
      <PageHero
        eyebrow={getSetting(settings, "about_hero_eyebrow", "CIBI")}
        title={getSetting(settings, "about_hero_title", "About Champion International Bible Institute")}
        text={getSetting(settings, "about_hero_text", "The Biblical Arm of Champions Royal Assembly")}
        image={getSetting(settings, "about_hero_image_url", CIBI_IMAGES.classroom)}
      />

      <section className="about-founder-section container">
        <div className="about-founder-image-wrap">
          <img src={getSetting(settings, "about_founder_image_url", getSetting(settings, "about_section_image_url", CIBI_IMAGES.handshake))} alt={getSetting(settings, "about_founder_name", "Papa Joshua Iginla")} />
        </div>
        <div className="about-founder-copy">
          <p className="eyebrow dark">{getSetting(settings, "about_founder_kicker", "The Founder")}</p>
          <h2>{getSetting(settings, "about_founder_name", "Papa Joshua Iginla")}</h2>
          <strong>{getSetting(settings, "about_founder_role", "Founder, President, and Lead Lecturer")}</strong>
          <div className="short-gold-line" />
          {founderParagraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
          <div className="about-founder-facts">
            <div><span>{getSetting(settings, "about_founder_fact_1_label", "Education")}</span><p>{getSetting(settings, "about_founder_fact_1_text", "B.Sc. Political Science, Masters and Doctorate in Political Science")}</p></div>
            <div><span>{getSetting(settings, "about_founder_fact_2_label", "CIBI Role")}</span><p>{getSetting(settings, "about_founder_fact_2_text", "President & Lead Lecturer")}</p></div>
          </div>
        </div>
      </section>

      <section className="about-church-section">
        <div className="container">
          <SectionIntro
            eyebrow={getSetting(settings, "about_church_kicker", "The Church")}
            title={getSetting(settings, "about_church_title", "About Champions Royal Assembly")}
            text={getSetting(settings, "about_church_text", "A global ministry with presence across continents")}
          />
          <div className="about-stat-grid">
            {churchStats.map((item, index) => (
              <div className="about-stat-card" key={`${item.title}-${index}`}>
                <span>{statIcons[index % statIcons.length]}</span>
                <h3>{item.title}</h3>
                <p>{item.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="about-mission-vision container">
        <div>
          <span>{getSetting(settings, "about_mission_kicker", "Our Purpose")}</span>
          <h3>{getSetting(settings, "about_mission_title", "Our Mission")}</h3>
          <div className="short-gold-line" />
          <p>{getSetting(settings, "about_mission_text", "To raise a generation of champions equipped for effective end-time ministry through intensive biblical training, prophetic instruction, and deliverance ministry.")}</p>
        </div>
        <div>
          <span>{getSetting(settings, "about_vision_kicker", "Our Direction")}</span>
          <h3>{getSetting(settings, "about_vision_title", "Our Vision")}</h3>
          <div className="short-gold-line" />
          <p>{getSetting(settings, "about_vision_text", "To depopulate hell and populate heaven by releasing people from powers of darkness, turning nobody into somebody, and raising end-time financial apostles.")}</p>
        </div>
      </section>

      <section className="about-beliefs-section container">
        <SectionIntro
          eyebrow={getSetting(settings, "about_beliefs_kicker", "Our Foundation")}
          title={getSetting(settings, "about_beliefs_title", "What We Believe")}
          text={getSetting(settings, "about_beliefs_text", "")}
        />
        <div className="about-belief-grid">
          {beliefs.map((item, index) => (
            <div className="about-belief-card" key={`${item.title}-${index}`}>
              <h3>{item.title}</h3>
              <div className="short-gold-line" />
              <p>{item.sub}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="about-milestones-section container">
        <SectionIntro
          eyebrow={getSetting(settings, "about_milestones_kicker", "Our History")}
          title={getSetting(settings, "about_milestones_title", "CIBI Milestones")}
          text={getSetting(settings, "about_milestones_text", "")}
        />
        <div className="about-timeline">
          {milestones.map((item, index) => (
            <div className="about-timeline-item" key={`${item.title}-${index}`}>
              <i />
              <div><strong>{item.title}</strong><p>{item.sub}</p></div>
            </div>
          ))}
        </div>
      </section>

      <section className="about-classroom-cta" style={{ backgroundImage: `url(${getSetting(settings, "about_classroom_image_url", CIBI_IMAGES.classroom)})` }}>
        <div className="about-classroom-overlay" />
        <div className="about-classroom-content">
          <p className="eyebrow framed">{getSetting(settings, "about_classroom_kicker", "In The Classroom")}</p>
          <h2>{getSetting(settings, "about_classroom_title", "Learning Directly from the Prophet")}</h2>
          <p>{getSetting(settings, "about_classroom_text", "At CIBI, students receive firsthand instruction from Prophet Joshua Iginla himself, gaining unique insights into prophetic ministry, deliverance, and kingdom administration that cannot be found in any textbook.")}</p>
          <button className="gold-btn big" onClick={() => goTo("admissions")}>{getSetting(settings, "about_classroom_button", "Begin Your Journey")}</button>
        </div>
      </section>
    </main>
  );
}

function Programs({ courses, programmes = [], openAuth, user, goTo, settings = {} }) {
  const list = programmeDisplayList(programmes, courses, settings);
  const curriculumGroups = parseProgramCurriculum(settings);
  const graduationRequirements = settingLines(settings, "programs_graduation_requirements", [
    "Complete all required courses for your program level",
    "Core Foundational Course is compulsory for all programs",
    "Maintain minimum attendance requirement",
    "Pass all examinations with satisfactory grades",
    "Complete ministry practicum, project or seminar",
    "Demonstrate proficiency in prophetic and deliverance ministry"
  ]);

  return (
    <main className="programs-page">
      <PageHero
        eyebrow={getSetting(settings, "programs_hero_eyebrow", "CIBI")}
        title={getSetting(settings, "programs_hero_title", "Our Programs")}
        text={getSetting(settings, "programs_hero_text", "Foundation Certificate, Diploma, Advanced Diploma Certificate, and Workers and Leadership Training Program")}
        image={getSetting(settings, "programs_hero_image_url", CIBI_IMAGES.graduation)}
      />

      <section className="program-overview-section">
        <div className="container">
          <SectionIntro
            eyebrow={getSetting(settings, "programs_overview_eyebrow", "Academics")}
            title={getSetting(settings, "programs_overview_title", "Program Overview")}
            text={getSetting(settings, "programs_overview_text", "Four pathways to deepen your theological knowledge, ministry effectiveness, and organizational leadership")}
          />
          <div className="program-showcase-grid base44-program-grid">
            {list.map((course) => <ProgramCourseCard key={course.id || course.title} course={course} openAuth={openAuth} user={user} goTo={goTo} settings={settings} />)}
          </div>

          <div className="program-core-note">
            <h3>{getSetting(settings, "programs_core_title", "Core Foundational Course")}</h3>
            <p>{getSetting(settings, "programs_core_text", "Compulsory for all programs — covers what CIBI stands for and believes in. All students must complete this course regardless of their chosen program.")}</p>
          </div>
        </div>
      </section>

      <section className="program-converter-section">
        <div className="container">
          <ProgramCurrencyConverterPanel settings={settings} />
        </div>
      </section>

      <section className="program-curriculum-section">
        <div className="container narrow-container">
          <SectionIntro
            eyebrow={getSetting(settings, "programs_curriculum_eyebrow", "Curriculum")}
            title={getSetting(settings, "programs_curriculum_title", "What You Will Study")}
            text={getSetting(settings, "programs_curriculum_text", "Comprehensive courses covering theology, prophetic ministry, deliverance, and practical ministry skills")}
          />
          <ProgramCurriculumAccordion groups={curriculumGroups} />
        </div>
      </section>

      <section className="program-learning-section">
        <div className="container">
          <SectionIntro
            eyebrow={getSetting(settings, "programs_classes_eyebrow", "Learning Streams")}
            title={getSetting(settings, "programs_classes_title", "Learning Options")}
            text={getSetting(settings, "programs_classes_text", "All programs are available in both Regular and Executive Classes")}
          />
          <div className="path-grid program-learning-grid">
            <PathCard icon={<Users />} title={getSetting(settings, "programs_regular_title", "Regular Classes")} text={getSetting(settings, "programs_regular_text", "For students who want a fuller classroom learning experience.")} points={settingPoints(settings, "programs_regular_points", ["Full-time daytime classes", "Immersive learning experience", "Ideal for full-time students and new ministers", "All programs available"])} />
            <PathCard icon={<Briefcase />} title={getSetting(settings, "programs_executive_title", "Executive Classes")} text={getSetting(settings, "programs_executive_text", "For pastors, ministers and professionals with active schedules.")} points={settingPoints(settings, "programs_executive_points", ["Intensive block scheduling", "Designed for working pastors and professionals", "Flexible for active ministry leaders", "All programs available"])} />
          </div>
        </div>
      </section>

      <section className="program-requirements-section">
        <div className="container narrow-container">
          <SectionIntro
            eyebrow={getSetting(settings, "programs_graduation_eyebrow", "Requirements")}
            title={getSetting(settings, "programs_graduation_title", "Graduation Requirements")}
            text={getSetting(settings, "programs_graduation_text", "")}
          />
          <div className="program-requirements-box">
            {graduationRequirements.map((item) => <p key={item}><CheckCircle size={17} /> <span>{item}</span></p>)}
          </div>
        </div>
      </section>

      <section className="program-final-cta">
        <div className="container">
          <p className="eyebrow framed">{getSetting(settings, "programs_cta_kicker", "Start Today")}</p>
          <h2>{getSetting(settings, "programs_cta_title", "Ready to Begin Your Theological Journey")}</h2>
          <p>{getSetting(settings, "programs_cta_text", "Applications are now open. Take the first step toward deeper ministry and theological excellence.")}</p>
          <button className="gold-btn big" onClick={() => user ? goTo("admissions") : openAuth("register")}>{getSetting(settings, "programs_cta_button", "Apply Now")}</button>
        </div>
      </section>
    </main>
  );
}

function ProgramCurrencyConverterPanel({ settings = {} }) {
  return (
    <div className="program-currency-panel refined-program-converter">
      <div>
        <span>{getSetting(settings, "currency_converter_kicker", "Currency Calculator")}</span>
        <strong>{getSetting(settings, "currency_converter_title", "Convert programme fee from USD")}</strong>
        <p>{getSetting(settings, "currency_converter_text", "Students can enter any programme fee in dollars and estimate the equivalent in their local currency before payment.")}</p>
      </div>
      <CurrencyConverter amountUsd={0} settings={settings} editableAmount />
    </div>
  );
}

function ProgramCourseCard({ course, openAuth, user, goTo, settings = {}, showDetails = false }) {
  const fee = usdFee(course);
  return (
    <div className="program-showcase-card base44-program-card compact-program-card">
      <span>{course.level || "Programme"}</span>
      <h3>{course.title}</h3>
      <div className="program-card-info"><Clock size={15} /> <small>Duration: {course.duration || course.level || "Flexible"}</small></div>
      <div className="program-card-info"><CreditCard size={15} /> <small>Fee: {programmeFeeText(course)}</small></div>
      <p>{course.audience || course.description}</p>
      {showDetails ? (
        <button type="button" className="program-detail-link" onClick={() => goTo("programs")}>View Details <ArrowRight size={14} /></button>
      ) : null}
      <div className="program-card-cert"><strong>Certification:</strong> <span>{course.certification || course.title}</span></div>
    </div>
  );
}

function parseProgramCurriculum(settings = {}) {
  const fallback = [
    "Foundation Certificate Program Courses|Available in Regular and Executive Classes|Core Foundational Course (What We Stand For and Believe In) — Compulsory;Use of English;Deliverance and Prophetic Ministry;Evangelism and Church Planting;Minister Character Development and Ethics;Social Media and Digital Literacy;Project / Seminar",
    "Advanced Certificate — First Semester Courses|Available in Regular and Executive Classes|Social Media and Digital Literacy;Mind and Capacity Building;Core Foundational Course;Deliverance and Prophetic Ministry;Evangelism and Church Growth;Biblical Business Concepts;Excellence in Ministry, Leadership and Stewardship;Seminar / Project",
    "Advanced Certificate — Second Semester Courses|Available in Regular and Executive Classes|Deliverance and Prophetic Ministry;Principles of Raising Leaders and Mentorship;Evangelism and Church Growth;Use of English;Project;Seminar / Defence",
    "Diploma — First Semester 100 Level Courses|Taught by Papa, Rector and faculty lecturers|Prophetic and Deliverance Ministry;Soteriology;Biblical Hermeneutics;Homiletics;Pneumatology;Minister Character Development and Ethics;Leadership Strategy & Principles Ministry;Biblical Business Concept & Management;Use of English Language;Extra Curriculum Activities",
    "Diploma — First Semester 200 Level Courses|Taught by Papa, Rector and faculty lecturers|Prophetic and Deliverance Ministry;Soteriology;Biblical Hermeneutics;Principles of Raising Leaders & Mentoring;Homiletics;Pneumatology;Index of Excellence in Ministry & Applied Stewardship;Church Planting and Church Growth;Principles of Women in Ministry;Vision Analysis & Goal Setting;Extra Curriculum Activities",
    "Diploma — Second Semester 100 Level Courses|Taught by faculty lecturers|Prophetic and Deliverance Ministry;Soteriology;Pneumatology;Homiletics;Hermeneutics;Evangelism and Excellent in Ministry;Biblical Business Concept and Financial Integrity & Management;Dynamics of Faith & Mental Exploit and Prayer & Spiritual Warfare;Use of English Language;Extra Curriculum Activities",
    "Executive Class 200 Level — Second Semester Courses|Timetable: Mon–Sat intensive block format|Homiletics;Pneumatology;Biblical Hermeneutics;Soteriology;Prophetic and Deliverance Ministry;Ministry in Purpose & Biblical Management;Evangelism and Church Planting & Growth;Excellence in Ministry, Raising Leaders & Ministry Family;Practical Leadership Analysis & Mentoring;Principles of Vision Analysis & Goals Setting;Use of English Language;Evangelism, Faith and Prayer"
  ];
  const lines = settingLines(settings, "programs_curriculum_items", fallback);
  return lines.map((line) => {
    const [title = "", sub = "", items = ""] = line.split("|").map((item) => item.trim());
    return { title, sub, items: items.split(";").map((item) => item.trim()).filter(Boolean) };
  }).filter((group) => group.title);
}

function ProgramCurriculumAccordion({ groups = [] }) {
  const [open, setOpen] = useState(0);
  return (
    <div className="program-accordion-list">
      {groups.map((group, index) => {
        const active = open === index;
        return (
          <div className={`program-accordion-item ${active ? "open" : ""}`} key={`${group.title}-${index}`}>
            <button type="button" onClick={() => setOpen(active ? -1 : index)}>
              <span><strong>{group.title}</strong><small>{group.sub}</small></span>
              {active ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>
            {active && (
              <div className="program-accordion-body">
                {group.items.map((item) => <p key={item}><CheckCircle size={16} /> <span>{item}</span></p>)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function BookLibrary({ books, settings = {} }) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const categories = useMemo(() => ["All", ...new Set(books.map((book) => book.category).filter(Boolean))], [books]);
  const filteredBooks = books.filter((book) => {
    const matchSearch = `${book.title} ${book.author}`.toLowerCase().includes(search.toLowerCase());
    const matchCategory = category === "All" || book.category === category;
    return matchSearch && matchCategory;
  });

  return (
    <main>
      <PageHero eyebrow={getSetting(settings, "books_hero_eyebrow", "Book Library")} title={getSetting(settings, "books_hero_title", "Books by Joshua Iginla")} text={getSetting(settings, "books_hero_text", "Open to the general public. Each book uses its official Stellar purchase link.")} image={getSetting(settings, "books_hero_image_url", CIBI_IMAGES.graduation)} />
      <section className="page container">
        <div className="library-tools">
          <div className="search-box"><Search size={18} /><input placeholder="Search books..." value={search} onChange={(e) => setSearch(e.target.value)} /></div>
          <div className="filter-buttons">
            {categories.map((item) => <button key={item} className={category === item ? "filter active-filter" : "filter"} onClick={() => setCategory(item)}>{item}</button>)}
          </div>
        </div>
        <div className="book-grid">{filteredBooks.map((book) => <BookCard key={book.id} book={book} />)}</div>
      </section>
    </main>
  );
}

function Admissions({ courses, programmes = [], settings, user, openAuth, goTo, setUser }) {
  const eligibility = settingPipeList(settings, "admission_roles", [
    ["Pastors", "G.O. and resident pastors"],
    ["Evangelists", "Field and outreach ministers"],
    ["Prophets", "Prophetic ministry leaders"],
    ["Bible Teachers", "Sunday school and Bible study"],
    ["Associate Ministers", "Ministry workers and leaders"],
    ["Church Workers", "Deacons, workers and volunteers"]
  ]);

  const basicRequirements = settingLines(settings, "admission_basic_requirements", [
    "Believer of good standing with a local church",
    "Conscious call of God for Christian service",
    "Pastor or ministry recommendation where applicable",
    "Secondary school completion or equivalent foundation",
    "Ability to study and communicate in English",
    "Willingness to complete all classes, assignments and ministry training"
  ]);

  const additionalRequirements = settingLines(settings, "admission_additional_requirements", [
    "Ministry involvement or church service experience",
    "Short statement of conversion and call to ministry",
    "Interview or review by the admissions team when required",
    "Payment confirmation before student portal activation",
    "Admin approval before access to courses, live classes and student WhatsApp group",
    "Agreement to CIBI academic and spiritual discipline standards"
  ]);

  const applicationSteps = settingPipeList(settings, "admission_application_steps", [
    ["Complete Application Form", "Fill the admission form with your personal, academic and ministry information."],
    ["Choose Programme and Stream", "Select the exact programme and learning stream you want to enroll for."],
    ["Create Student Account", "Your account is created from the admission form details."],
    ["Complete Payment", "Pay through Paystack or submit bank transfer details for review."],
    ["Admin Approval", "Approved students receive portal access for their selected programme only."],
    ["Begin Studies", "Access courses, lessons, live classes and student announcements attached to that programme."]
  ]).map((item, index) => ({ step: String(index + 1).padStart(2, "0"), title: item.title, desc: item.sub }));

  const calendar = settingPipeList(settings, "admission_calendar", [
    ["Application Opens", "January 2026"],
    ["Screening and Review", "March 2026"],
    ["Classes Begin", "April 2026"],
    ["First Term Ends", "July 2026"]
  ]).map((item) => ({ label: item.title, value: item.sub }));

  const visibleProgrammes = programmeDisplayList(programmes, courses, settings);
  const feeProgrammes = visibleProgrammes.filter((programme) => !isCorporateProgramme(programme)).slice(0, 3);

  return (
    <main className="admission-page">
      <PageHero
        eyebrow={getSetting(settings, "admission_hero_eyebrow", "Admission and Enrollment")}
        title={getSetting(settings, "admission_hero_title", "Admission is Now Open")}
        text={getSetting(settings, "admission_hero_text", "Apply for CIBI programmes, choose your learning stream, complete registration payment, and receive portal access after payment confirmation and admin approval.")}
        image={getSetting(settings, "admission_hero_image_url", CIBI_IMAGES.classroom)}
      />

      <section className="admission-section container">
        <SectionIntro eyebrow={getSetting(settings, "admission_eligibility_eyebrow", "Eligibility")} title={getSetting(settings, "admission_eligibility_title", "Who Should Apply")} text={getSetting(settings, "admission_eligibility_text", "CIBI is open to ministers, Bible students, church workers and kingdom leaders seeking structured theological training.")} />
        <div className="admission-role-grid">
          {eligibility.map((item) => (
            <div className="admission-role-card card-hover" key={item.title}>
              <h3>{item.title}</h3>
              <p>{item.sub}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="admission-band">
        <div className="container">
          <SectionIntro eyebrow={getSetting(settings, "admission_requirements_eyebrow", "Prerequisites")} title={getSetting(settings, "admission_requirements_title", "Admission Requirements")} text={getSetting(settings, "admission_requirements_text", "Applicants should be ready for biblical learning, ministry discipline and structured academic participation.")} />
          <div className="requirement-grid">
            <RequirementBox title="Basic Requirements" items={basicRequirements} />
            <RequirementBox title="Additional Requirements" items={additionalRequirements} />
          </div>
        </div>
      </section>

      <section className="admission-section container" id="apply">
        <SectionIntro eyebrow={getSetting(settings, "admission_apply_eyebrow", "Apply Online")} title={getSetting(settings, "admission_apply_title", "Enroll Online Now")} text={getSetting(settings, "admission_apply_text", "Complete the application form, select your programme and learning stream, then continue to payment.")} />

        {user?.role === "STUDENT" ? (
          <div className="admission-apply-card admission-payment-card">
            <div className="apply-copy">
              <Kicker text="Application Submitted" />
              <h2>{getSetting(settings, "admission_student_payment_title", "Complete Your Payment")}</h2>
              <p>
                Your application is attached to the programme you selected during registration. Portal access opens only after payment confirmation and admin approval.
              </p>
              <ul>
                <li><CheckCircle size={16} /> Your programme selection controls your course access</li>
                <li><CheckCircle size={16} /> Your learning stream is saved for admissions review</li>
                <li><CheckCircle size={16} /> Your certificate will carry the completed programme name</li>
                <li><CheckCircle size={16} /> Admin approval is required before portal access</li>
              </ul>
            </div>

            <div className="apply-action-panel">
              <PaymentPanel programmes={programmes} courses={courses} settings={settings} />
            </div>
          </div>
        ) : isStaffUser(user) ? (
          <div className="quiet-banner">
            <strong>Staff account detected.</strong>
            <p>Student applications should be submitted with a student account. Use the admin dashboard to manage admissions.</p>
            <button className="gold-btn" type="button" onClick={() => goTo("admin")}>Open Admin Dashboard</button>
          </div>
        ) : (
          <AdmissionApplicationForm programmes={programmes} courses={courses} settings={settings} setUser={setUser} goTo={goTo} openAuth={openAuth} />
        )}
      </section>

      <section className="admission-band">
        <div className="container">
          <SectionIntro eyebrow={getSetting(settings, "admission_process_eyebrow", "How It Works")} title={getSetting(settings, "admission_process_title", "Application Process")} text={getSetting(settings, "admission_process_text", "A clear admission path from application form to active student portal access.")} />
          <div className="application-process-grid">
            {applicationSteps.map((item) => (
              <div className="process-card card-hover" key={item.step}>
                <span>{item.step}</span>
                <h3>{item.title}</h3>
                <p>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="admission-section container admission-fees-section">
        <SectionIntro eyebrow={getSetting(settings, "admission_fees_eyebrow", "Fees")} title={getSetting(settings, "admission_fees_title", "Programme Fees")} text={getSetting(settings, "admission_fees_text", "")} />
        <div className="fee-grid admission-base44-fee-grid">
          {feeProgrammes.map((programme, index) => (
            <div className="fee-card admission-base44-fee-card" key={programme.id || programme.title}>
              <span>{admissionFeeLabel(programme, index)}</span>
              <h3>{programmeFeeText(programme).replace("Contact Us", "Contact")}</h3>
              <p>{programme.duration || "Flexible"}</p>
            </div>
          ))}
        </div>
        <div className="admission-fees-converter-panel">
          <div className="admission-fees-converter-copy">
            <span>Convert Estimate</span>
            <strong>Currency Converter</strong>
            <p>Enter any programme fee in USD to estimate the equivalent in your local currency.</p>
          </div>
          <CurrencyConverter amountUsd={0} settings={settings} editableAmount />
        </div>
        <div className="admission-fees-contact-note">
          <p>For Workers and Leadership Training Program fees, contact the admissions office.</p>
          <strong>{CIBI_PHONE_DISPLAY}</strong>
        </div>
      </section>

      <section className="admission-band">
        <div className="container">
          <SectionIntro eyebrow={getSetting(settings, "admission_calendar_eyebrow", "Calendar")} title={getSetting(settings, "admission_calendar_title", "Academic Calendar 2026")} text={getSetting(settings, "admission_calendar_text", "Key admission and academic dates for the incoming session.")} />
          <div className="calendar-grid">
            {calendar.map((item) => (
              <div className="calendar-card" key={item.label}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="admission-section container">
        <SectionIntro eyebrow={getSetting(settings, "admission_contact_eyebrow", "Get in Touch")} title={getSetting(settings, "admission_contact_title", "Contact Admissions Office")} text={getSetting(settings, "admission_contact_text", "For help with application, payment confirmation or programme selection.")} />
        <div className="contact-grid admission-contact-grid">
          <div className="content-card contact-card"><Phone /><h3>{getSetting(settings, "admission_contact_phone_title", "Phone / WhatsApp")}</h3><p>{CIBI_PHONE_DISPLAY}</p><a className="contact-card-link" href={CIBI_WHATSAPP_LINK} target="_blank" rel="noreferrer">Chat on WhatsApp</a></div>
          <div className="content-card contact-card"><MapPin /><h3>{getSetting(settings, "admission_contact_location_title", "Location")}</h3><p>{CIBI_ADDRESS}</p></div>
          <div className="content-card contact-card"><Clock /><h3>{getSetting(settings, "admission_contact_hours_title", "Office Hours")}</h3><p>{getSetting(settings, "office_hours", "Monday to Saturday, 9 AM to 5 PM")}</p></div>
        </div>
      </section>
    </main>
  );
}

function AdmissionApplicationForm({ programmes = [], courses = [], settings = {}, setUser, goTo, openAuth }) {
  const availableCourses = registrationProgrammeList(programmes, courses);
  const learningStreams = settingPoints(settings, "admission_learning_streams", ["Regular Classes", "Executive Classes"]);
  const firstCourseId = availableCourses[0]?.id ? String(availableCourses[0].id) : "";
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    country: "",
    password: "",
    confirmPassword: "",
    courseId: firstCourseId,
    learningStream: learningStreams[0] || "Regular Classes",
    ministryRole: "",
    yearsInMinistry: "",
    currentChurch: "",
    educationalBackground: "",
    previousMinistryExperience: "",
    howDidYouHear: "",
    personalStatement: "",
    additionalQuestions: ""
  });
  const [submitting, setSubmitting] = useState(false);
  const selectedCourse = availableCourses.find((course) => String(course.id) === String(form.courseId));
  const selectedProgrammeId = registrationProgrammePayloadId(selectedCourse);

  useEffect(() => {
    if (!form.courseId && firstCourseId) {
      setForm((current) => ({ ...current, courseId: firstCourseId }));
    }
  }, [firstCourseId]);

  function updateField(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(e) {
    e.preventDefault();
    if (!selectedProgrammeId) { showToast("Please select the programme you are applying for.", "error"); return; }
    if (!form.learningStream) {
      showToast("Please select your learning stream.", "error");
      return;
    }

    try {
      setSubmitting(true);
      const result = await api("/auth/register", {
        method: "POST",
        body: {
          ...form,
          programmeId: selectedProgrammeId,
          applicationSource: "ADMISSION_PAGE"
        }
      });
      setToken(null);
      setUser(result.user);
      showToast(result.message || "Application submitted. Continue to payment.", "success");
      goTo("admissions");
    } catch (error) {
      showToast(error.message || "Application submission failed", "error");
    } finally {
      setSubmitting(false);
    }
  }

  if (!availableCourses.length) {
    return (
      <div className="quiet-banner admission-no-programme">
        <strong>No active programme has been added yet.</strong>
        <p>Admin must add and publish at least one programme before students can submit the admission form.</p>
      </div>
    );
  }

  return (
    <div className="admission-apply-card admission-form-card">
      <div className="apply-copy">
        <Kicker text="Application Form" />
        <h2>{getSetting(settings, "admission_form_title", "CIBI Student Application Form")}</h2>
        <p>{getSetting(settings, "admission_form_text", "Fill the form carefully. Your selected programme determines the courses you can access after approval, and the same programme name appears on your certificate after completion.")}</p>
        <ul>
          <li><CheckCircle size={16} /> Select one programme before registration</li>
          <li><CheckCircle size={16} /> Choose Regular or Executive learning stream</li>
          <li><CheckCircle size={16} /> Courses are released based on the selected programme</li>
          <li><CheckCircle size={16} /> Certificate carries the completed programme name</li>
        </ul>
        {selectedCourse ? (
          <div className="selected-programme-note">
            <span>Selected Programme</span>
            <strong>{selectedCourse.title}</strong>
            <p>{selectedCourse.duration || "Programme duration"} · {usdFee(selectedCourse) > 0 ? formatUsd(usdFee(selectedCourse)) : "Contact admissions"}</p>
          </div>
        ) : null}
      </div>

      <form className="admin-form admission-full-application-form" onSubmit={submit}>
        <h3>Personal Information</h3>
        <div className="two-columns">
          <label className="content-field">
            <span>Full name</span>
            <input placeholder="Enter your full name" value={form.name} onChange={(e) => updateField("name", e.target.value)} required />
          </label>
          <label className="content-field">
            <span>Email address</span>
            <input type="email" placeholder="you@example.com" value={form.email} onChange={(e) => updateField("email", e.target.value)} required />
          </label>
        </div>

        <div className="two-columns">
          <label className="content-field">
            <span>Phone number</span>
            <input placeholder="Phone / WhatsApp number" value={form.phone} onChange={(e) => updateField("phone", e.target.value)} required />
          </label>
          <label className="content-field">
            <span>Country</span>
            <input placeholder="Country" value={form.country} onChange={(e) => updateField("country", e.target.value)} required />
          </label>
        </div>

        <label className="content-field">
          <span>Create password</span>
          <input type="password" placeholder="Create a secure password" value={form.password} onChange={(e) => updateField("password", e.target.value)} required minLength={6} />
        </label>

        <h3>Programme Selection</h3>
        <div className="two-columns">
          <label className="content-field">
            <span>Programme applying for</span>
            <select value={String(form.courseId || "")} onChange={(e) => updateField("courseId", e.target.value)} required>
              {availableCourses.map((course) => (
                <option value={String(course.id)} key={course.id}>{course.title} — {course.level || "Programme"}</option>
              ))}
            </select>
          </label>
          <label className="content-field">
            <span>Learning stream</span>
            <select value={form.learningStream} onChange={(e) => updateField("learningStream", e.target.value)} required>
              {learningStreams.map((stream) => <option key={stream} value={stream}>{stream}</option>)}
            </select>
          </label>
        </div>

        <h3>Ministry and Academic Details</h3>
        <div className="two-columns">
          <label className="content-field">
            <span>Current ministry role</span>
            <input placeholder="Pastor, worker, evangelist, teacher..." value={form.ministryRole} onChange={(e) => updateField("ministryRole", e.target.value)} />
          </label>
          <label className="content-field">
            <span>Years in ministry / church service</span>
            <input placeholder="e.g 3 years" value={form.yearsInMinistry} onChange={(e) => updateField("yearsInMinistry", e.target.value)} />
          </label>
        </div>

        <label className="content-field">
          <span>Current church / ministry</span>
          <input placeholder="Name of church or ministry" value={form.currentChurch} onChange={(e) => updateField("currentChurch", e.target.value)} />
        </label>

        <label className="content-field">
          <span>Educational background</span>
          <textarea placeholder="Briefly tell us about your education or previous Bible/ministry training" value={form.educationalBackground} onChange={(e) => updateField("educationalBackground", e.target.value)} />
        </label>

        <label className="content-field">
          <span>Previous ministry experience</span>
          <textarea placeholder="Tell us about your ministry, church service or leadership experience" value={form.previousMinistryExperience} onChange={(e) => updateField("previousMinistryExperience", e.target.value)} />
        </label>

        <label className="content-field">
          <span>Personal statement</span>
          <textarea placeholder="Why do you want to study at CIBI?" value={form.personalStatement} onChange={(e) => updateField("personalStatement", e.target.value)} required />
        </label>

        <div className="two-columns">
          <label className="content-field">
            <span>How did you hear about CIBI?</span>
            <input placeholder="Church, friend, social media, advert..." value={form.howDidYouHear} onChange={(e) => updateField("howDidYouHear", e.target.value)} />
          </label>
          <label className="content-field">
            <span>Additional questions</span>
            <input placeholder="Anything you want admissions to know?" value={form.additionalQuestions} onChange={(e) => updateField("additionalQuestions", e.target.value)} />
          </label>
        </div>

        <div className="application-form-note">
          <ShieldCheck size={18} />
          <p>After submission, you will continue to payment. Portal access opens only after CIBI confirms payment and approves admission.</p>
        </div>

        <button className="gold-btn full" type="submit" disabled={submitting}>{submitting ? "Submitting Application..." : "Submit Application and Continue to Payment"}</button>
        <button className="dark-btn full" type="button" onClick={() => openAuth("login")}>Already Applied? Login</button>
      </form>
    </div>
  );
}


function RequirementBox({ title, items }) {
  return (
    <div className="requirement-box">
      <h3>{title}</h3>
      <div className="short-gold-line" />
      <ul>
        {items.map((item) => (
          <li key={item}><CheckCircle size={15} /> {item}</li>
        ))}
      </ul>
    </div>
  );
}

function Gallery({ gallery = [], settings = {} }) {
  const items = gallery.length ? gallery : DEFAULT_GALLERY;
  return (
    <main>
      <PageHero eyebrow={getSetting(settings, "gallery_hero_eyebrow", "Gallery")} title={getSetting(settings, "gallery_hero_title", "CIBI Gallery")} text={getSetting(settings, "gallery_hero_text", "A visual glimpse into CIBI training, classroom moments and graduation ceremonies.")} image={getSetting(settings, "gallery_hero_image_url", CIBI_IMAGES.graduation)} />
      <section className="page container">
        <div className="gallery-grid">
          {items.map((item, index) => (
            <figure key={item.id || index} className="gallery-card">
              <img src={item.imageUrl || item.image || CIBI_IMAGES.graduation} alt={item.title} />
              <figcaption>{item.title}{item.category ? <small>{item.category}</small> : null}</figcaption>
            </figure>
          ))}
        </div>
      </section>
    </main>
  );
}

function Contact({ settings = {} }) {
  return (
    <main>
      <PageHero eyebrow={getSetting(settings, "contact_hero_eyebrow", "Contact")} title={getSetting(settings, "contact_hero_title", "Get in Touch with CIBI")} text={getSetting(settings, "contact_hero_text", "Contact the college for admissions, book enquiries, student support and general information.")} image={getSetting(settings, "contact_hero_image_url", CIBI_IMAGES.classroom)} />
      <section className="page container contact-page-section">
        <div className="contact-grid">
          <div className="content-card contact-card"><Phone /><h3>{getSetting(settings, "contact_phone_title", "Phone / WhatsApp")}</h3><p>{CIBI_PHONE_DISPLAY}</p><a className="contact-card-link" href={CIBI_WHATSAPP_LINK} target="_blank" rel="noreferrer">Chat on WhatsApp</a></div>
          <div className="content-card contact-card"><MapPin /><h3>{getSetting(settings, "contact_location_title", "Location")}</h3><p>{CIBI_ADDRESS}</p></div>
          <div className="content-card contact-card"><BookOpen /><h3>{getSetting(settings, "contact_enquiry_title", "Enquiries")}</h3><p>{getSetting(settings, "contact_enquiry_text", "Admissions, book support and general CIBI information.")}</p><a className="contact-card-link" href="mailto:info@cibionline.org">{getSetting(settings, "contact_email", "info@cibionline.org")}</a></div>
        </div>
        <ContactMap address={CIBI_ADDRESS} />
      </section>
    </main>
  );
}

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
      const index = parts.findIndex((part) => ["embed", "live", "shorts"].includes(part));
      if (index >= 0 && parts[index + 1]) return parts[index + 1];
      return parts.pop() || "";
    }
  } catch {
    const match = value.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|live\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/i);
    return match?.[1] || "";
  }
  return "";
}

function buildPlatformYouTubeEmbedUrl(videoId) {
  const params = new URLSearchParams({
    enablejsapi: "1",
    controls: "0",
    modestbranding: "1",
    rel: "0",
    disablekb: "1",
    fs: "0",
    iv_load_policy: "3",
    playsinline: "1",
    origin: window.location.origin
  });
  return `https://www.youtube-nocookie.com/embed/${videoId}?${params.toString()}`;
}

function getEmbeddableVideoUrl(input) {
  const raw = String(input || "").trim();
  if (!raw) return null;

  const youtubeId = extractYouTubeVideoId(raw);
  if (youtubeId) return { type: "youtube", videoId: youtubeId, src: buildPlatformYouTubeEmbedUrl(youtubeId) };

  const iframeMatch = raw.match(/src=["']([^"']+)["']/i);
  if (iframeMatch?.[1]) return { type: "iframe", src: iframeMatch[1] };

  if (/\.(mp4|webm|ogg)(\?.*)?$/i.test(raw)) return { type: "video", src: raw };

  try {
    const url = new URL(raw);
    const host = url.hostname.replace("www.", "");

    if (host.includes("vimeo.com")) {
      const videoId = url.pathname.split("/").filter(Boolean).pop();
      if (videoId && !host.includes("player.vimeo.com")) return { type: "iframe", src: `https://player.vimeo.com/video/${videoId}` };
      return { type: "iframe", src: raw };
    }

    if (host.includes("loom.com")) {
      const parts = url.pathname.split("/").filter(Boolean);
      const videoId = parts.pop();
      if (videoId && !url.pathname.includes("/embed/")) return { type: "iframe", src: `https://www.loom.com/embed/${videoId}` };
      return { type: "iframe", src: raw };
    }

    return { type: "iframe", src: raw };
  } catch {
    return { type: "iframe", src: raw };
  }
}

let youtubeApiPromise;
function loadYouTubeIframeApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (youtubeApiPromise) return youtubeApiPromise;

  youtubeApiPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[src="https://www.youtube.com/iframe_api"]');
    const previousReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previousReady?.();
      resolve(window.YT);
    };
    if (!existing) {
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      script.async = true;
      script.onerror = () => reject(new Error("Could not load secure video player."));
      document.head.appendChild(script);
    }
  });

  return youtubeApiPromise;
}

function formatWatchTime(seconds = 0) {
  const total = Math.max(0, Math.floor(Number(seconds || 0)));
  const minutes = Math.floor(total / 60);
  const secs = total % 60;
  return `${minutes}:${String(secs).padStart(2, "0")}`;
}

function PlatformYouTubePlayer({ videoId, title, initialSecond = 0, onProgress = () => {} }) {
  const containerRef = useRef(null);
  const playerRef = useRef(null);
  const timerRef = useRef(null);
  const lastSavedRef = useRef(0);
  const playingRef = useRef(false);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(Number(initialSecond || 0));
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    loadYouTubeIframeApi()
      .then((YT) => {
        if (cancelled || !containerRef.current) return;
        playerRef.current = new YT.Player(containerRef.current, {
          videoId,
          host: "https://www.youtube-nocookie.com",
          playerVars: {
            controls: 0,
            modestbranding: 1,
            rel: 0,
            disablekb: 1,
            fs: 0,
            iv_load_policy: 3,
            playsinline: 1,
            origin: window.location.origin
          },
          events: {
            onReady(event) {
              setReady(true);
              const total = event.target.getDuration?.() || 0;
              setDuration(total);
              if (initialSecond > 0 && initialSecond < total) event.target.seekTo(initialSecond, true);
            },
            onStateChange(event) {
              const state = event.data;
              playingRef.current = state === 1;
              setPlaying(state === 1);
              if (state === 0) {
                const time = event.target.getCurrentTime?.() || 0;
                const total = event.target.getDuration?.() || 0;
                onProgress(Math.floor(time), Math.floor(total), true);
              }
            }
          }
        });
      })
      .catch((error) => showToast(error.message, "error"));

    timerRef.current = setInterval(() => {
      const player = playerRef.current;
      if (!player?.getCurrentTime) return;
      const time = player.getCurrentTime() || 0;
      const total = player.getDuration?.() || 0;
      setCurrent(time);
      setDuration(total);
      if (playingRef.current && Math.abs(time - lastSavedRef.current) >= 10) {
        lastSavedRef.current = time;
        onProgress(Math.floor(time), Math.floor(total), false);
      }
    }, 1000);

    return () => {
      cancelled = true;
      if (timerRef.current) clearInterval(timerRef.current);
      try { playerRef.current?.destroy?.(); } catch { /* ignore */ }
      playerRef.current = null;
    };
  }, [videoId]);

  function togglePlay() {
    const player = playerRef.current;
    if (!player) return;
    if (playing) player.pauseVideo?.();
    else player.playVideo?.();
  }

  function seek(next) {
    const player = playerRef.current;
    const total = duration || player?.getDuration?.() || 0;
    const safe = Math.max(0, Math.min(Number(next || 0), total || Number(next || 0)));
    player?.seekTo?.(safe, true);
    setCurrent(safe);
  }

  function toggleMute() {
    const player = playerRef.current;
    if (!player) return;
    if (muted) player.unMute?.();
    else player.mute?.();
    setMuted(!muted);
  }

  return (
    <div className="platform-video-shell" onContextMenu={(e) => e.preventDefault()}>
      <div className="platform-video-frame-wrap">
        <div ref={containerRef} className="platform-youtube-mount" title={title || "CIBI video"} />
        {!ready && <div className="platform-video-loading">Preparing CIBI video player...</div>}
      </div>
      <div className="platform-video-controls">
        <button type="button" className="dark-btn mini-btn" onClick={togglePlay} disabled={!ready}>{playing ? "Pause" : "Play"}</button>
        <button type="button" className="ghost-btn mini-btn" onClick={() => seek(current - 10)} disabled={!ready}>-10s</button>
        <input
          aria-label="Video progress"
          type="range"
          min="0"
          max={Math.max(duration || 0, 1)}
          value={Math.min(current || 0, duration || current || 1)}
          onChange={(e) => seek(e.target.value)}
          disabled={!ready || !duration}
        />
        <small>{formatWatchTime(current)} / {formatWatchTime(duration)}</small>
        <button type="button" className="ghost-btn mini-btn" onClick={() => seek(current + 10)} disabled={!ready}>+10s</button>
        <button type="button" className="ghost-btn mini-btn" onClick={toggleMute} disabled={!ready}>{muted ? "Unmute" : "Mute"}</button>
      </div>
    </div>
  );
}

function PortalVideoPlayer({ url, title }) {
  const video = getEmbeddableVideoUrl(url);
  if (!video) return <div className="portal-video-missing">No video link added yet.</div>;

  if (video.type === "youtube") {
    return <PlatformYouTubePlayer videoId={video.videoId} title={title || "CIBI video"} />;
  }

  if (video.type === "video") {
    return <video className="portal-video" controls controlsList="nodownload" disablePictureInPicture onContextMenu={(e) => e.preventDefault()} src={video.src} title={title || "CIBI video"} />;
  }

  return (
    <iframe
      className="portal-video"
      title={title || "CIBI video"}
      src={video.src}
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      allowFullScreen
    />
  );
}

function LiveClassroom({ initialLiveSession }) {
  const [classroom, setClassroom] = useState(initialLiveSession ? { liveSession: initialLiveSession, chatMessages: [], questions: [], attendanceCount: 0, attendance: null } : null);
  const [chatMessage, setChatMessage] = useState("");
  const [question, setQuestion] = useState("");
  const [message, setMessage] = useState("");

  async function loadClassroom() {
    const result = await api("/student/live/classroom");
    setClassroom(result);
  }

  useEffect(() => {
    loadClassroom().catch(() => null);
    const interval = setInterval(() => loadClassroom().catch(() => null), 7000);
    return () => clearInterval(interval);
  }, []);

  async function markAttendance() {
    try {
      const result = await api("/student/live/attendance", { method: "POST", body: {} });
      setMessage(result.message || "Attendance marked");
      await loadClassroom();
    } catch (error) {
      showToast(error.message, "error");
    }
  }

  async function sendChat(e) {
    e.preventDefault();
    if (!chatMessage.trim()) return;
    try {
      await api("/student/live/chat", { method: "POST", body: { message: chatMessage } });
      setChatMessage("");
      await loadClassroom();
    } catch (error) {
      showToast(error.message, "error");
    }
  }

  async function submitQuestion(e) {
    e.preventDefault();
    if (!question.trim()) return;
    try {
      await api("/student/live/questions", { method: "POST", body: { question } });
      setQuestion("");
      setMessage("Question submitted to the lecturer");
      await loadClassroom();
    } catch (error) {
      showToast(error.message, "error");
    }
  }

  const liveSession = classroom?.liveSession;

  if (!liveSession) {
    return (
      <div className="quiet-banner live-classroom-empty">
        <strong>No live class currently active.</strong>
        <p>When admin starts a live class, students will watch it here inside the portal.</p>
      </div>
    );
  }

  return (
    <section className="live-classroom">
      <div className="live-classroom-header">
        <div>
          <span className="live-pill"><i /> Live Now</span>
          <h2>{liveSession.title}</h2>
          {liveSession.description && <p>{liveSession.description}</p>}
        </div>
        <div className="attendance-card-small">
          <strong>{classroom?.attendanceCount || 0}</strong>
          <span>Present</span>
          <button className="gold-btn" type="button" onClick={markAttendance}>Mark Attendance</button>
        </div>
      </div>

      <div className="classroom-grid">
        <div>
          <div className="portal-video-shell">
            <PortalVideoPlayer url={liveSession.liveUrl} title={liveSession.title} />
          </div>
          <p className="portal-video-note">This class plays inside the CIBI student portal. {liveSession.chatEnabled === false ? "The lecturer has turned off live chat for this class." : "Use chat for discussion and questions for lecturer attention."}</p>
          {liveSession.replayUrl && <p><a className="receipt-preview-link" href={liveSession.replayUrl} target="_blank" rel="noreferrer">Replay will remain available here</a></p>}
          {liveSession.subtitleUrl && <p><a className="receipt-preview-link" href={liveSession.subtitleUrl} target="_blank" rel="noreferrer">Subtitle / translation file: {liveSession.subtitleLanguage || "available"}</a></p>}
          {liveSession.voiceEnabled && <div className="voice-response-note">Voice response is enabled as a planned classroom feature. Full microphone control requires the advanced live-room integration.</div>}
          {message && <p className="success-message">{message}</p>}
        </div>

        <div className="classroom-side-panel">
          <div className="classroom-box">
            <div className="classroom-box-title"><h3>Class Chat</h3><span>{classroom?.chatMessages?.length || 0}</span></div>
            <div className="chat-thread">
              {(classroom?.chatMessages || []).map((chat) => (
                <div className="chat-bubble" key={chat.id}>
                  <strong>{chat.user?.name || "Student"}</strong>
                  <p>{chat.message}</p>
                </div>
              ))}
              {!(classroom?.chatMessages || []).length && <p className="empty-small">No chat messages yet.</p>}
            </div>
            {liveSession.chatEnabled === false ? (
              <div className="quiet-banner small-quiet">Live chat is turned off by the lecturer.</div>
            ) : (
              <form className="chat-form" onSubmit={sendChat}>
                <input placeholder="Type class message..." value={chatMessage} onChange={(e) => setChatMessage(e.target.value)} />
                <button className="gold-btn" type="submit">Send</button>
              </form>
            )}
          </div>

          <div className="classroom-box">
            <div className="classroom-box-title"><h3>Questions</h3><span>{classroom?.questions?.length || 0}</span></div>
            <form className="question-form" onSubmit={submitQuestion}>
              <textarea placeholder="Ask the lecturer a question..." value={question} onChange={(e) => setQuestion(e.target.value)} />
              <button className="dark-btn full" type="submit">Submit Question</button>
            </form>
            <div className="question-list">
              {(classroom?.questions || []).slice(0, 6).map((item) => (
                <div className="question-item" key={item.id}>
                  <strong>{item.user?.name || "Student"}</strong>
                  <p>{item.question}</p>
                  {item.answer && <div className="answer-box"><b>Lecturer Answer:</b> {item.answer}</div>}
                  <small>{item.status || "OPEN"}</small>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function getLessonProgress(lesson) {
  return Array.isArray(lesson.progress) ? lesson.progress[0] : null;
}

function buildCourseModules(course) {
  const modules = [...(course.modules || [])]
    .sort((a, b) => Number(a.moduleOrder || 0) - Number(b.moduleOrder || 0))
    .map((module) => ({
      ...module,
      lessons: [...(module.lessons || [])].sort((a, b) => Number(a.lessonOrder || 0) - Number(b.lessonOrder || 0))
    }));

  const seen = new Set(modules.flatMap((module) => module.lessons.map((lesson) => lesson.id)));
  const legacyLessons = [...(course.lessons || [])]
    .filter((lesson) => !seen.has(lesson.id))
    .sort((a, b) => Number(a.lessonOrder || 0) - Number(b.lessonOrder || 0));

  if (legacyLessons.length) {
    modules.push({ id: "general", title: "General Lessons", description: "Lessons not assigned to a module yet.", moduleOrder: 9999, lessons: legacyLessons });
  }

  return modules;
}

function flattenCourseLessonsForStudent(course) {
  return buildCourseModules(course).flatMap((module) => module.lessons.map((lesson) => ({ ...lesson, moduleTitle: module.title })));
}

function isLessonCompleted(lesson) {
  return Boolean(getLessonProgress(lesson)?.completed);
}

function isStudentLessonUnlocked(course, lessonId) {
  const lessons = flattenCourseLessonsForStudent(course);
  for (const lesson of lessons) {
    if (lesson.id === lessonId) return true;
    if (lesson.required !== false && !isLessonCompleted(lesson)) return false;
  }
  return false;
}

function getAssignmentSubmission(assignment) {
  return Array.isArray(assignment.submissions) ? assignment.submissions[0] : null;
}

function isAssignmentPassed(assignment) {
  if (assignment.required === false) return true;
  const submission = getAssignmentSubmission(assignment);
  if (!submission) return false;
  if (["PASSED", "APPROVED"].includes(submission.status)) return true;
  if (submission.score === null || submission.score === undefined) return false;
  return Number(submission.score) >= Number(assignment.passScore || 50);
}

function getQuizBestAttempt(quiz) {
  const attempts = Array.isArray(quiz.attempts) ? quiz.attempts : [];
  if (!attempts.length) return null;
  return [...attempts].sort((a, b) => Number(b.score || 0) - Number(a.score || 0))[0];
}

function isQuizPassed(quiz) {
  if (quiz.required === false) return true;
  return (quiz.attempts || []).some((attempt) => attempt.passed);
}

function getCourseProgressSummary(course) {
  const lessons = flattenCourseLessonsForStudent(course);
  const requiredLessons = lessons.filter((lesson) => lesson.required !== false);
  const completedRequired = requiredLessons.filter(isLessonCompleted).length;
  const totalRequired = requiredLessons.length;
  const assignments = (course.assignments || []).filter((item) => item.published !== false);
  const quizzes = (course.quizzes || []).filter((item) => item.published !== false);
  const requiredAssignments = assignments.filter((item) => item.required !== false);
  const requiredQuizzes = quizzes.filter((item) => item.required !== false);
  const completedAssignments = requiredAssignments.filter(isAssignmentPassed).length;
  const completedQuizzes = requiredQuizzes.filter(isQuizPassed).length;
  const completedRequirements = completedRequired + completedAssignments + completedQuizzes;
  const totalRequirements = totalRequired + requiredAssignments.length + requiredQuizzes.length;
  const percent = totalRequirements ? Math.round((completedRequirements / totalRequirements) * 100) : 0;
  return {
    lessons,
    requiredLessons,
    completedRequired,
    totalRequired,
    assignments,
    quizzes,
    requiredAssignments,
    requiredQuizzes,
    completedAssignments,
    completedQuizzes,
    completedRequirements,
    totalRequirements,
    percent
  };
}


function formatPortalStatus(value) {
  return String(value || "NOT AVAILABLE").replaceAll("_", " ");
}

function getPortalDecisionCopy(accountStatus, enrollment, fallbackError = "") {
  const admissionStatus = enrollment?.admissionStatus;
  const paymentStatusValue = enrollment?.paymentStatus;

  if (accountStatus === "REJECTED" || admissionStatus === "REJECTED") {
    return {
      tone: "rejected",
      category: "ADMISSION_REJECTED",
      title: "Admission Rejected",
      message: "Your admission application was not approved. You can submit an appeal for CIBI admin to review your application again.",
      buttonText: "Review Application",
      buttonPage: "admissions"
    };
  }

  if (accountStatus === "SUSPENDED" || admissionStatus === "SUSPENDED") {
    return {
      tone: "suspended",
      category: "ACCOUNT_SUSPENDED",
      title: "Account Suspended",
      message: "Your student account has been suspended by admin. Submit an appeal or chat with support for review.",
      buttonText: "Check Admission",
      buttonPage: "admissions"
    };
  }

  if (accountStatus === "GRADUATED" || admissionStatus === "GRADUATED") {
    return {
      tone: "graduated",
      category: "GRADUATED_ACCESS",
      title: "Programme Completed",
      message: "Your student record has been marked as graduated. You can still contact support for certificates, records or alumni access.",
      buttonText: "View Admissions",
      buttonPage: "admissions"
    };
  }

  if (!enrollment || accountStatus === "PENDING_PAYMENT" || paymentStatusValue === "PENDING_PAYMENT" || admissionStatus === "AWAITING_PAYMENT") {
    return {
      tone: "pending",
      category: "PAYMENT_REQUIRED",
      title: "Payment Required",
      message: "Your student account has been created, but payment has not been completed or submitted for review.",
      buttonText: "Complete Payment",
      buttonPage: "admissions"
    };
  }

  if (accountStatus === "MANUAL_PAYMENT_PENDING" || paymentStatusValue === "MANUAL_PAYMENT_PENDING") {
    return {
      tone: "review",
      category: "PAYMENT_REVIEW",
      title: "Payment Under Review",
      message: "Your bank transfer receipt has been submitted. CIBI admin will verify your payment and approve portal access after confirmation.",
      buttonText: "Check Admission",
      buttonPage: "admissions"
    };
  }

  if (accountStatus === "PAYMENT_CONFIRMED" || paymentStatusValue === "PAYMENT_CONFIRMED" || admissionStatus === "AWAITING_ADMIN_APPROVAL") {
    return {
      tone: "review",
      category: "ADMISSION_REVIEW",
      title: "Admission Approval Pending",
      message: "Your payment has been confirmed. Portal access will open after admin completes admission approval.",
      buttonText: "Check Admission",
      buttonPage: "admissions"
    };
  }

  return {
    tone: "pending",
    category: "GENERAL_SUPPORT",
    title: "Portal Access Pending",
    message: fallbackError || "Your registration is being reviewed. You will receive access once your payment and admission are approved.",
    buttonText: "Complete Payment / Check Admission",
    buttonPage: "admissions"
  };
}

function PortalDecisionGate({ error, paymentStatus, fallbackUser, goTo }) {
  const enrollments = paymentStatus?.enrollments || [];
  const enrollment = enrollments[0] || null;
  const accountStatus = paymentStatus?.user?.status || fallbackUser?.status || "PENDING_PAYMENT";
  const copy = getPortalDecisionCopy(accountStatus, enrollment, error);

  return (
    <main className={`page container gate student-decision-gate gate-${copy.tone}`}>
      <div className="student-gate-icon"><ShieldCheck size={52} /></div>
      <h1>{copy.title}</h1>
      <p>{copy.message}</p>

      <div className="student-status-grid">
        <div className="status-detail-card">
          <span>Account Status</span>
          <strong className={`status-chip status-chip-${copy.tone}`}>{formatPortalStatus(accountStatus)}</strong>
        </div>
        {enrollment && (
          <>
            <div className="status-detail-card"><span>Admission Status</span><strong>{formatPortalStatus(enrollment.admissionStatus)}</strong></div>
            <div className="status-detail-card"><span>Payment Status</span><strong>{formatPortalStatus(enrollment.paymentStatus)}</strong></div>
            <div className="status-detail-card"><span>Programme</span><strong>{enrollment.programme?.title || enrollment.course?.programme?.title || enrollment.course?.title || "Selected programme"}</strong></div>
          </>
        )}
      </div>

      <div className="student-gate-actions">
        <button className="gold-btn big" onClick={() => goTo(copy.buttonPage)}>{copy.buttonText}</button>
        <button className="ghost-btn dark-text big" type="button" onClick={() => window.location.reload()}>Check Access Again</button>
      </div>

      <StudentSupportCenter
        defaultCategory={copy.category}
        defaultSubject={copy.title}
        defaultEnrollmentId={enrollment?.id || ""}
        gateMode
      />
    </main>
  );
}

function StudentSupportCenter({ defaultCategory = "GENERAL_SUPPORT", defaultSubject = "Support Request", defaultEnrollmentId = "", gateMode = false }) {
  const [cases, setCases] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [form, setForm] = useState({
    category: defaultCategory,
    subject: defaultSubject,
    message: "",
    enrollmentId: defaultEnrollmentId
  });
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(false);

  async function loadCases() {
    const result = await api("/student/support/cases");
    setCases(result);
    if (!activeId && result[0]?.id) setActiveId(result[0].id);
  }

  useEffect(() => {
    loadCases().catch(() => null);
    const timer = setInterval(() => loadCases().catch(() => null), 7000);
    return () => clearInterval(timer);
  }, []);

  const activeCase = cases.find((item) => item.id === activeId) || cases[0] || null;

  async function createCase(e) {
    e.preventDefault();
    if (!form.message.trim()) {
      showToast("Please type your appeal/support message.", "error");
      return;
    }
    try {
      setLoading(true);
      const created = await api("/student/support/cases", { method: "POST", body: form });
      showToast("Your appeal/support case has been submitted.", "success");
      setForm((current) => ({ ...current, message: "" }));
      await loadCases();
      setActiveId(created.id);
    } catch (error) {
      showToast(error.message || "Could not submit support case", "error");
    } finally {
      setLoading(false);
    }
  }

  async function sendReply(e) {
    e.preventDefault();
    if (!activeCase || !reply.trim()) return;
    try {
      await api(`/student/support/cases/${activeCase.id}/messages`, { method: "POST", body: { message: reply } });
      setReply("");
      await loadCases();
      showToast("Message sent to support.", "success");
    } catch (error) {
      showToast(error.message || "Could not send message", "error");
    }
  }

  return (
    <section className={gateMode ? "support-center support-center-gate" : "support-center"}>
      <div className="support-head">
        <div>
          <span><MessageCircle size={15} /> Appeals & Support</span>
          <h2>{gateMode ? "Appeal or Chat with CIBI Support" : "Support & Appeals"}</h2>
          <p>Messages are saved in your portal history. Admin replies will appear here automatically.</p>
        </div>
        <button className="ghost-btn dark-text" type="button" onClick={loadCases}>Refresh</button>
      </div>

      <div className="support-grid">
        <form className="support-new-case" onSubmit={createCase}>
          <h3>Start New Case</h3>
          <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
            <option value="ADMISSION_REJECTED">Admission Rejected</option>
            <option value="ACCOUNT_SUSPENDED">Account Suspended</option>
            <option value="PAYMENT_REVIEW">Payment Issue</option>
            <option value="ADMISSION_REVIEW">Admission Review</option>
            <option value="GENERAL_SUPPORT">General Support</option>
          </select>
          <input placeholder="Subject" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
          <textarea placeholder="Explain what happened and what you want admin to review..." value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
          <button className="gold-btn full" type="submit" disabled={loading}>{loading ? "Submitting..." : "Submit Appeal / Support"}</button>
        </form>

        <div className="support-thread-card">
          <div className="support-case-tabs">
            {cases.map((item) => (
              <button type="button" key={item.id} className={activeCase?.id === item.id ? "active-support-case" : ""} onClick={() => setActiveId(item.id)}>
                <strong>{item.subject}</strong>
                <small>{formatPortalStatus(item.status)} · {formatPortalStatus(item.category)}</small>
              </button>
            ))}
            {!cases.length && <p className="empty-small">No support case yet. Submit a message to start one.</p>}
          </div>

          {activeCase && (
            <>
              <div className="support-thread-header">
                <div><strong>{activeCase.subject}</strong><small>{formatPortalStatus(activeCase.category)} · {formatPortalStatus(activeCase.status)}</small></div>
              </div>
              <div className="support-message-list">
                {(activeCase.messages || []).map((message) => (
                  <div className={message.sender?.role === "ADMIN" ? "support-message admin-message" : "support-message student-message"} key={message.id}>
                    <strong>{message.sender?.role === "ADMIN" ? "CIBI Support" : message.sender?.name || "Student"}</strong>
                    <p>{message.message}</p>
                    <small>{new Date(message.createdAt).toLocaleString()}</small>
                  </div>
                ))}
              </div>
              <form className="support-reply-form" onSubmit={sendReply}>
                <input placeholder="Type reply..." value={reply} onChange={(e) => setReply(e.target.value)} />
                <button className="dark-btn" type="submit"><Send size={14} /> Send</button>
              </form>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function StudentPortal({ user, setUser, goTo }) {
  const [dashboard, setDashboard] = useState(null);
  const [paymentStatus, setPaymentStatus] = useState(null);
  const [error, setError] = useState("");
  const [activeEnrollmentId, setActiveEnrollmentId] = useState(null);
  const [studentTab, setStudentTab] = useState("dashboard");
  const [publicBooks, setPublicBooks] = useState([]);

  async function loadDashboard() {
    const result = await api("/student/dashboard");
    setDashboard(result);
  }

  async function loadPublicBooks() {
    const result = await api(`/public/bootstrap?_=${Date.now()}`);
    setPublicBooks(result.books || []);
  }

  useEffect(() => {
    loadDashboard()
      .catch(async (err) => {
        setError(err.message);
        const status = await api("/student/payment-status").catch(() => null);
        setPaymentStatus(status);
      });
    loadPublicBooks().catch(() => null);
  }, []);

  if (error) {
    return <PortalDecisionGate error={error} paymentStatus={paymentStatus} fallbackUser={user} goTo={goTo} />;
  }

  if (!dashboard) return <div className="loading-screen">Loading student portal...</div>;

  const activeEnrollment = dashboard.enrollments.find((item) => (item.virtualEnrollmentId || item.id) === activeEnrollmentId || String(item.id) === String(activeEnrollmentId));
  const totalLessons = dashboard.enrollments.reduce((a, e) => a + getCourseProgressSummary(e.course).lessons.length, 0);
  const completedCourses = dashboard.enrollments.filter((enrollment) => getCourseProgressSummary(enrollment.course).percent >= 100).length;

  function switchStudentTab(nextTab) {
    setStudentTab(nextTab);
    setActiveEnrollmentId(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function openCourse(enrollmentId) {
    setStudentTab("my courses");
    setActiveEnrollmentId(enrollmentId);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <main className="portal-page student-portal-page">
      <PortalSidebar
        title="Student Portal"
        items={["Dashboard", "My Profile", "My Courses", "Live Classes", "Attendance", "Book Library", "My Results", "Certificates", "Support & Appeals"]}
        tab={studentTab}
        setTab={switchStudentTab}
      />
      <div className="portal-main">
        <div className="portal-header student-portal-topbar">
          <div><p className="eyebrow dark">Welcome back</p><h1>{user.name}</h1></div>
          <a className="gold-btn" href={dashboard.settings.student_whatsapp_group_link} target="_blank" rel="noreferrer">Student WhatsApp Group</a>
        </div>

        {dashboard.enrollments.some((item) => item.studentPaymentNotice) && (
          <div className="student-payment-notice">
            <strong>Payment Notice</strong>
            <p>{dashboard.enrollments.find((item) => item.studentPaymentNotice)?.studentPaymentNoticeMessage || "Your programme payment needs attention. Please contact CIBI admin."}</p>
          </div>
        )}

        {activeEnrollment ? (
          <LearningCourseView
            enrollment={activeEnrollment}
            back={() => { setActiveEnrollmentId(null); setStudentTab("my courses"); }}
            reloadDashboard={loadDashboard}
          />
        ) : (
          <>
            {studentTab === "dashboard" && (
              <section className="student-tab-panel">
                <div className="student-tab-heading">
                  <span>Student Overview</span>
                  <h2>Dashboard</h2>
                  <p>Track your approved programmes, lessons, live classes and recent announcements.</p>
                </div>

                <div className="dashboard-grid">
                  <DashboardCard icon={<BookOpen />} label="Approved Courses" value={dashboard.enrollments.length} />
                  <DashboardCard icon={<Video />} label="Lessons" value={totalLessons} />
                  <DashboardCard icon={<Award />} label="Completed Courses" value={completedCourses} />
                </div>

                <div className="student-dashboard-split">
                  <div className="student-dashboard-panel">
                    <div className="section-mini-head"><span>Continue</span><h3>My Courses</h3></div>
                    <div className="student-mini-course-list">
                      {dashboard.enrollments.map((enrollment) => {
                        const summary = getCourseProgressSummary(enrollment.course);
                        return (
                          <button type="button" key={enrollment.virtualEnrollmentId || enrollment.id} onClick={() => openCourse(enrollment.virtualEnrollmentId || enrollment.id)}>
                            <strong>{enrollment.course.title}</strong>
                            <small>{summary.percent}% complete · {summary.completedRequirements || summary.completedRequired}/{summary.totalRequirements || summary.totalRequired} required items</small>
                            <i><b style={{ width: `${summary.percent}%` }} /></i>
                          </button>
                        );
                      })}
                      {!dashboard.enrollments.length && <p className="empty-small">No approved course yet.</p>}
                    </div>
                  </div>

                  <div className="student-dashboard-panel">
                    <div className="section-mini-head"><span>Updates</span><h3>Announcements</h3></div>
                    <div className="announcement-list compact-announcements">
                      {dashboard.announcements.slice(0, 4).map((item) => <div className="announcement" key={item.id}><Megaphone /><div><strong>{item.title}</strong><p>{item.body}</p></div></div>)}
                      {!dashboard.announcements.length && <p className="empty-small">No announcements yet.</p>}
                    </div>
                  </div>
                </div>
              </section>
            )}

            {studentTab === "my profile" && (
              <section className="student-tab-panel">
                <StudentProfilePanel user={user} setUser={setUser} reloadDashboard={loadDashboard} />
              </section>
            )}

            {studentTab === "my courses" && (
              <section className="student-tab-panel">
                <div className="student-tab-heading">
                  <span>Learning</span>
                  <h2>My Courses</h2>
                  <p>Open your approved programme and continue lessons in the correct order.</p>
                </div>
                <div className="course-grid student-course-grid">
                  {dashboard.enrollments.map((enrollment) => (
                    <StudentCourse key={enrollment.virtualEnrollmentId || enrollment.id} enrollment={enrollment} openCourse={() => openCourse(enrollment.virtualEnrollmentId || enrollment.id)} />
                  ))}
                  {!dashboard.enrollments.length && <div className="quiet-banner"><strong>No approved courses yet.</strong><p>Your courses will appear here after admission approval.</p></div>}
                </div>
              </section>
            )}

            {studentTab === "live classes" && (
              <section className="student-tab-panel">
                <div className="student-tab-heading">
                  <span>Classroom</span>
                  <h2>Live Classes</h2>
                  <p>Watch live classes, mark attendance, chat and submit questions inside the portal.</p>
                </div>
                <LiveClassroom initialLiveSession={dashboard.liveSession} />
              </section>
            )}

            {studentTab === "attendance" && (
              <section className="student-tab-panel">
                <StudentAttendancePanel />
              </section>
            )}

            {studentTab === "book library" && (
              <section className="student-tab-panel">
                <div className="student-tab-heading">
                  <span>Resources</span>
                  <h2>Book Library</h2>
                  <p>Buy official CIBI/Joshua Iginla books through the approved purchase links.</p>
                </div>
                <div className="book-grid student-book-grid">
                  {publicBooks.map((book) => <BookCard key={book.id} book={book} />)}
                  {!publicBooks.length && <div className="quiet-banner"><strong>No books available yet.</strong><p>Admin can add books from the Books section.</p></div>}
                </div>
              </section>
            )}

            {studentTab === "my results" && (
              <section className="student-tab-panel">
                <StudentResultsPanel />
              </section>
            )}

            {studentTab === "certificates" && (
              <section className="student-tab-panel">
                <StudentCertificatesPanel />
              </section>
            )}

            {studentTab === "support & appeals" && (
              <section className="student-tab-panel">
                <StudentSupportCenter />
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}


function StudentProfilePanel({ user, setUser, reloadDashboard }) {
  const [form, setForm] = useState({
    name: user?.name || "",
    email: user?.email || "",
    phone: user?.phone || "",
    country: user?.country || ""
  });
  const [saving, setSaving] = useState(false);

  function updateField(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function saveProfile(e) {
    e.preventDefault();
    const fullName = String(form.name || "").trim();
    if (!fullName || fullName.split(/\s+/).length < 2) {
      showToast("Please enter your full name as it should appear on official records and certificates.", "error");
      return;
    }

    try {
      setSaving(true);
      const result = await api("/student/profile", { method: "PATCH", body: form });
      setUser(result.user);
      await reloadDashboard?.();
      showToast("Your profile details have been updated.", "success");
    } catch (error) {
      showToast(error.message || "Could not update profile", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="profile-panel">
      <div className="student-tab-heading profile-heading-card">
        <span>Account Details</span>
        <h2>My Profile</h2>
        <p>Update your correct full name and contact details. Your full name is used for official CIBI records and certificates.</p>
      </div>

      <form className="admin-form profile-form" onSubmit={saveProfile}>
        <label className="content-field content-field-wide">
          <span>Full name for certificate</span>
          <input placeholder="Enter your full name" value={form.name} onChange={(e) => updateField("name", e.target.value)} required />
        </label>
        <div className="profile-two-cols">
          <label className="content-field">
            <span>Email address</span>
            <input type="email" placeholder="Email address" value={form.email} onChange={(e) => updateField("email", e.target.value)} required />
          </label>
          <label className="content-field">
            <span>Phone number</span>
            <input placeholder="Phone number" value={form.phone} onChange={(e) => updateField("phone", e.target.value)} />
          </label>
        </div>
        <label className="content-field content-field-wide">
          <span>Country</span>
          <input placeholder="Country" value={form.country} onChange={(e) => updateField("country", e.target.value)} />
        </label>
        <div className="profile-note-box">
          <strong>Important:</strong> Use your real full name before certificate issuance. Admin can also correct your details where necessary.
        </div>
        <button className="gold-btn" type="submit" disabled={saving}>{saving ? "Saving..." : "Save Profile Details"}</button>
      </form>
    </div>
  );
}

function StudentCourse({ enrollment, openCourse }) {
  const course = enrollment.course;
  const summary = getCourseProgressSummary(course);
  return (
    <div className="course-card student-course-card">
      <img src={course.imageUrl || CIBI_IMAGES.classroom} alt={course.title} />
      <div>
        <span>{course.level}</span>
        <h3>{course.title}</h3>
        <div className="meta-line"><Clock size={13} /> <small>{course.duration || "Learning programme"}</small></div>
        <p>{course.description}</p>
        <div className="learning-progress-mini">
          <div><strong>{summary.percent}%</strong><small>{summary.completedRequirements || summary.completedRequired} of {summary.totalRequirements || summary.totalRequired} required items completed</small></div>
          <i><b style={{ width: `${summary.percent}%` }} /></i>
        </div>
        <button className="gold-btn full" onClick={openCourse}>Continue Learning <ArrowRight size={14} /></button>
      </div>
    </div>
  );
}

function LearningCourseView({ enrollment, back, reloadDashboard }) {
  const [course, setCourse] = useState(enrollment.course);
  const [activeLessonId, setActiveLessonId] = useState(null);
  const [message, setMessage] = useState("");
  const modules = buildCourseModules(course);
  const summary = getCourseProgressSummary(course);
  const firstOpenLesson = summary.lessons.find((lesson) => isStudentLessonUnlocked(course, lesson.id) && !isLessonCompleted(lesson)) || summary.lessons.find((lesson) => isStudentLessonUnlocked(course, lesson.id)) || summary.lessons[0];
  const activeLesson = summary.lessons.find((lesson) => lesson.id === activeLessonId) || firstOpenLesson;

  useEffect(() => {
    if (!activeLessonId && firstOpenLesson?.id) setActiveLessonId(firstOpenLesson.id);
  }, [activeLessonId, firstOpenLesson?.id]);

  useEffect(() => {
    reloadCourse().catch(() => null);
  }, [enrollment.id]);

  async function reloadCourse() {
    const result = await api(`/student/courses/${course.id}/learning`);
    setCourse(result.enrollment.course);
    await reloadDashboard();
  }

  async function markProgress(lesson, percent = 100, completed = true) {
    if (!lesson) return;
    try {
      const result = await api(`/student/lessons/${lesson.id}/progress`, { method: "POST", body: { progressPercent: percent, completed } });
      setMessage(completed ? "Lesson completed. The next lesson is now unlocked." : "Progress saved.");
      await reloadCourse();
      return result;
    } catch (error) {
      showToast(error.message, "error");
    }
  }

  function selectLesson(lesson) {
    if (!isStudentLessonUnlocked(course, lesson.id)) {
      showToast("Complete the previous required lesson before opening this one.", "error");
      return;
    }
    setActiveLessonId(lesson.id);
    setMessage("");
  }

  return (
    <section className="learning-room">
      <button className="text-link" onClick={back}><span /> Back to My Courses</button>
      <div className="learning-room-header">
        <div>
          <p className="eyebrow dark">Course Learning</p>
          <h2>{course.title}</h2>
          <p>{course.description}</p>
        </div>
        <div className="learning-progress-card">
          <strong>{summary.percent}%</strong>
          <span>{summary.completedRequirements || summary.completedRequired} of {summary.totalRequirements || summary.totalRequired} required items</span>
          <i><b style={{ width: `${summary.percent}%` }} /></i>
        </div>
      </div>

      <CourseLiveBanner courseId={course.id} />
      <CourseVideosPanel course={course} canManage={false} onReload={reloadCourse} />
      <PastLiveClasses courseId={course.id} liveSessions={course.liveSessions || []} />

      <div className="learning-layout">
        <div className="learning-main-panel">
          {activeLesson ? (
            <>
              <div className="lesson-active-header">
                <span>{activeLesson.moduleTitle || "Lesson"}</span>
                <h3>{activeLesson.title}</h3>
                <p>{activeLesson.duration || "Video lesson"} · Completion required: {activeLesson.completionPercentRequired || 90}%</p>
              </div>
              <TrackedLessonVideo lesson={activeLesson} onComplete={() => markProgress(activeLesson, 100, true)} />
              <div className="lesson-actions-row">
                {activeLesson.notesUrl && <a className="white-btn dark-text" href={activeLesson.notesUrl} target="_blank" rel="noreferrer">Open Notes</a>}
                <button className="gold-btn" onClick={() => markProgress(activeLesson, 100, true)}>{isLessonCompleted(activeLesson) ? "Completed" : "Mark Lesson Complete"}</button>
              </div>
              {message && <p className="success-message">{message}</p>}
            </>
          ) : (
            <div className="quiet-banner"><strong>No lessons have been added yet.</strong><p>Admin can add modules and video lessons from Course Builder.</p></div>
          )}
        </div>

        <aside className="learning-outline">
          <h3>Course Content</h3>
          {modules.map((module) => {
            const moduleRequired = module.lessons.filter((lesson) => lesson.required !== false);
            const moduleCompleted = moduleRequired.filter(isLessonCompleted).length;
            return (
              <div className="module-outline" key={module.id}>
                <div className="module-title-row">
                  <div><strong>{module.title}</strong><small>{moduleCompleted}/{moduleRequired.length} complete</small></div>
                </div>
                <div className="module-lessons">
                  {module.lessons.map((lesson) => {
                    const unlocked = isStudentLessonUnlocked(course, lesson.id);
                    const completed = isLessonCompleted(lesson);
                    return (
                      <button key={lesson.id} className={activeLesson?.id === lesson.id ? "lesson-outline-item active" : "lesson-outline-item"} onClick={() => selectLesson(lesson)}>
                        <span>{completed ? "✓" : unlocked ? "▶" : "🔒"}</span>
                        <div><strong>{lesson.title}</strong><small>{lesson.duration || `Lesson ${lesson.lessonOrder}`}</small></div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </aside>
      </div>

      <LearningAssessments course={course} reloadCourse={reloadCourse} />
      <CourseDiscussionPanel courseId={course.id} />
    </section>
  );
}

function TrackedLessonVideo({ lesson, onComplete }) {
  const video = getEmbeddableVideoUrl(lesson.videoUrl);
  const [autoCompleted, setAutoCompleted] = useState(false);
  const requiredPercent = Number(lesson.completionPercentRequired || 90);

  function handleTimeUpdate(e) {
    const node = e.currentTarget;
    if (!node.duration || autoCompleted) return;
    const percent = Math.round((node.currentTime / node.duration) * 100);
    if (percent >= requiredPercent) {
      setAutoCompleted(true);
      onComplete();
    }
  }

  if (!video) {
    return (
      <div className="student-lesson-video-shell">
        <div className="portal-video-missing">No video link added for this lesson yet.</div>
      </div>
    );
  }

  if (video.type === "video") {
    return (
      <div className="student-lesson-video-shell">
        <video className="portal-video" controls src={video.src} title={lesson.title} onTimeUpdate={handleTimeUpdate} />
      </div>
    );
  }

  return (
    <>
      <div className="student-lesson-video-shell">
        <PortalVideoPlayer url={lesson.videoUrl} title={lesson.title} />
      </div>
      <p className="portal-video-note">For YouTube, Vimeo and other embedded players, use the completion button after watching the lecture inside the portal.</p>
    </>
  );
}


function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}


function CourseLiveBanner({ courseId }) {
  const [live, setLive] = useState(null);

  async function load() {
    try {
      const result = await api(`/courses/${courseId}/live/active`);
      setLive(result.live || null);
    } catch {
      setLive(null);
    }
  }

  useEffect(() => {
    load();
    const timer = setInterval(load, 30000);
    return () => clearInterval(timer);
  }, [courseId]);

  if (!live) return null;

  return (
    <section className="course-live-banner">
      <div>
        <span><Radio size={15} /> Live now</span>
        <h3>{live.title}</h3>
        <p>{live.description || `Lecturer: ${live.startedBy?.name || "CIBI Lecturer"}`}</p>
      </div>
      <a className="gold-btn" href={live.liveUrl} target="_blank" rel="noreferrer">Join Now</a>
    </section>
  );
}

function PastLiveClasses({ courseId, liveSessions = [] }) {
  const [sessions, setSessions] = useState(liveSessions);

  async function load() {
    try {
      const result = await api(`/courses/${courseId}/live/history`);
      setSessions(result || []);
    } catch {
      setSessions(liveSessions || []);
    }
  }

  useEffect(() => { load(); }, [courseId]);

  const ended = (sessions || []).filter((session) => session.status === "ended" || session.endedAt);
  if (!ended.length) return null;

  return (
    <section className="course-video-panel">
      <div className="course-video-panel-head">
        <div><span>Live Class History</span><h3>Past Live Classes</h3></div>
      </div>
      <div className="course-video-list">
        {ended.map((session) => (
          <div className="course-video-row" key={session.id}>
            <div>
              <strong>{session.title}</strong>
              <small>{formatDateTime(session.createdAt)} {session.durationSeconds ? `· ${Math.round(session.durationSeconds / 60)} mins` : ""}</small>
            </div>
            {(session.recordingUrl || session.replayUrl) && <a className="ghost-btn mini-btn" href={session.recordingUrl || session.replayUrl} target="_blank" rel="noreferrer">Watch Recording</a>}
          </div>
        ))}
      </div>
    </section>
  );
}

function CourseLiveManager({ course, onReload }) {
  const [form, setForm] = useState({ title: "", description: "", liveUrl: "", scheduledAt: "" });
  const [active, setActive] = useState(null);
  const [history, setHistory] = useState([]);
  const [recordingUrl, setRecordingUrl] = useState("");
  const [loading, setLoading] = useState(false);

  async function loadLive() {
    if (!course?.id) return;
    try {
      const [activeResult, historyResult] = await Promise.all([
        api(`/courses/${course.id}/live/active`),
        api(`/courses/${course.id}/live/history`)
      ]);
      setActive(activeResult.live || null);
      setHistory(historyResult || []);
    } catch {
      setActive(null);
    }
  }

  useEffect(() => { loadLive(); }, [course?.id]);

  async function startLive(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await api(`/courses/${course.id}/live/start`, { method: "POST", body: form });
      showToast("Live class started. Students have been notified.", "success");
      setActive(result.live);
      setForm({ title: "", description: "", liveUrl: "", scheduledAt: "" });
      await onReload?.();
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      setLoading(false);
    }
  }

  async function endLive() {
    if (!active) return;
    const ok = await showConfirm({ title: "End live class?", message: "Students will be notified that the class has ended.", confirmText: "End Class", danger: true });
    if (!ok) return;
    try {
      await api(`/courses/${course.id}/live/${active.id}/end`, { method: "PATCH" });
      showToast("Live class ended.", "success");
      setActive(null);
      await loadLive();
    } catch (error) {
      showToast(error.message, "error");
    }
  }

  async function saveRecording(sessionId) {
    if (!recordingUrl.trim()) return showToast("Paste the recording link first.", "error");
    try {
      await api(`/courses/${course.id}/live/${sessionId}/recording`, { method: "PATCH", body: { recordingUrl } });
      showToast("Recording link saved and students notified.", "success");
      setRecordingUrl("");
      await loadLive();
    } catch (error) {
      showToast(error.message, "error");
    }
  }

  return (
    <section className="course-live-manager">
      <div className="course-video-panel-head">
        <div><span>Go Live</span><h3>Course Live Class</h3></div>
        {active && <button type="button" className="delete-btn" onClick={endLive}>End Class</button>}
      </div>

      {active ? (
        <div className="course-live-active">
          <strong>{active.title}</strong>
          <p>{active.description || "Live class is currently active."}</p>
          <a className="gold-btn mini-btn" href={active.liveUrl} target="_blank" rel="noreferrer">Open Live Link</a>
        </div>
      ) : (
        <form className="admin-form go-live-form" onSubmit={startLive}>
          <input placeholder="Live class title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          <textarea placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <input placeholder="Zoom or YouTube Live link" value={form.liveUrl} onChange={(e) => setForm({ ...form, liveUrl: e.target.value })} required />
          <input type="datetime-local" value={form.scheduledAt} onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })} />
          <button className="gold-btn" type="submit" disabled={loading}>{loading ? "Starting..." : "Go Live"}</button>
        </form>
      )}

      {history.filter((session) => session.status === "ended" || session.endedAt).slice(0, 3).map((session) => (
        <div className="recording-row" key={session.id}>
          <div><strong>{session.title}</strong><small>{formatDateTime(session.createdAt)}</small></div>
          {(session.recordingUrl || session.replayUrl) ? (
            <a className="ghost-btn mini-btn" href={session.recordingUrl || session.replayUrl} target="_blank" rel="noreferrer">Recording</a>
          ) : (
            <div className="recording-input-row">
              <input placeholder="Add recording link" value={recordingUrl} onChange={(e) => setRecordingUrl(e.target.value)} />
              <button type="button" className="dark-btn mini-btn" onClick={() => saveRecording(session.id)}>Save</button>
            </div>
          )}
        </div>
      ))}
    </section>
  );
}

function CourseVideosPanel({ course, canManage = false, onReload = async () => {} }) {
  const [uploadOpen, setUploadOpen] = useState(false);
  const [playing, setPlaying] = useState(null);
  const videos = [...(course?.videos || [])].sort((a, b) => Number(a.sortOrder || a.chapter || 0) - Number(b.sortOrder || b.chapter || 0));

  async function deleteVideo(video) {
    const ok = await showConfirm({
      title: "Delete video?",
      message: `This will remove "${video.title}" from the CIBI course list. The original YouTube video is not deleted.`,
      confirmText: "Delete Video",
      danger: true
    });
    if (!ok) return;
    try {
      await api(`/courses/${course.id}/videos/${video.id}`, { method: "DELETE" });
      showToast("Video removed from course.", "success");
      await onReload();
    } catch (error) {
      showToast(error.message, "error");
    }
  }

  return (
    <section className="course-video-panel">
      <div className="course-video-panel-head">
        <div><span>Platform Videos</span><h3>Course Videos</h3></div>
        {canManage && <button type="button" className="gold-btn mini-btn" onClick={() => setUploadOpen(true)}>Add Video</button>}
      </div>

      {videos.length === 0 ? (
        <div className="quiet-banner compact"><strong>No course videos yet.</strong><p>{canManage ? "Paste a YouTube unlisted link and CIBI will play it inside the platform." : "Videos will appear here when your lecturer adds them."}</p></div>
      ) : (
        <div className="course-video-list">
          {videos.map((video) => (
            <div className="course-video-row" key={video.id}>
              <div>
                <span>Chapter {video.chapter || video.sortOrder || 1}</span>
                <strong>{video.title}</strong>
                <small>{formatDateTime(video.uploadDate || video.createdAt)} · {video.uploadedBy?.name || "CIBI"}</small>
              </div>
              <div className="video-row-actions">
                <button type="button" className="dark-btn mini-btn" onClick={() => setPlaying(video)}>Play</button>
                {canManage && <button type="button" className="delete-btn" onClick={() => deleteVideo(video)}><Trash2 size={14} /></button>}
              </div>
            </div>
          ))}
        </div>
      )}

      {uploadOpen && <VideoLinkModal course={course} close={() => setUploadOpen(false)} onSaved={onReload} />}
      {playing && <SecureCourseVideoPlayer courseId={course.id} video={playing} close={() => setPlaying(null)} />}
    </section>
  );
}

function VideoLinkModal({ course, close, onSaved }) {
  const [form, setForm] = useState({ title: "", description: "", chapter: 1, videoUrl: "" });
  const [saving, setSaving] = useState(false);

  function validateLink(value) {
    const videoId = extractYouTubeVideoId(value);
    return Boolean(videoId && /^[A-Za-z0-9_-]{6,}$/.test(videoId));
  }

  async function submit(e) {
    e.preventDefault();
    if (!validateLink(form.videoUrl)) return showToast("Please paste a valid YouTube video, YouTube Live, Shorts, or embed link.", "error");
    setSaving(true);
    try {
      await api(`/courses/${course.id}/videos/upload`, {
        method: "POST",
        body: {
          title: form.title,
          description: form.description,
          chapter: form.chapter,
          videoUrl: form.videoUrl
        }
      });
      showToast("Video added to CIBI course player.", "success");
      await onSaved();
      close();
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop">
      <form className="auth-modal video-upload-modal admin-form" onSubmit={submit}>
        <button type="button" className="close-btn" onClick={close}><X /></button>
        <h3>Add Course Video</h3>
        <p>Paste a YouTube unlisted link. CIBI will play it with a platform player, no upload storage cost.</p>
        <input placeholder="Video title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
        <textarea placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <input type="number" min="1" placeholder="Chapter / module number" value={form.chapter} onChange={(e) => setForm({ ...form, chapter: e.target.value })} />
        <input placeholder="Paste YouTube unlisted/video/live link" value={form.videoUrl} onChange={(e) => setForm({ ...form, videoUrl: e.target.value })} required />
        {form.videoUrl && validateLink(form.videoUrl) && (
          <div className="admin-video-preview builder-form-preview">
            <PortalVideoPlayer url={form.videoUrl} title={form.title || "Video preview"} />
          </div>
        )}
        <div className="quiet-banner compact video-policy-note">
          <strong>Storage-saving mode active.</strong>
          <p>The video file stays on YouTube. Students only see the CIBI player inside the course page.</p>
        </div>
        <button className="gold-btn full" type="submit" disabled={saving}>{saving ? "Saving..." : "Save Video Link"}</button>
      </form>
    </div>
  );
}

function SecureCourseVideoPlayer({ courseId, video, close }) {
  const [playerData, setPlayerData] = useState(null);
  const [loading, setLoading] = useState(true);
  const saveTimer = useRef(null);

  useEffect(() => {
    setLoading(true);
    api(`/courses/${courseId}/videos/${video.id}/stream-url`)
      .then((result) => setPlayerData(result))
      .catch((error) => showToast(error.message, "error"))
      .finally(() => setLoading(false));
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [courseId, video.id]);

  function saveProgress(progressSecond = 0, durationSecond = 0, completed = false) {
    if (saveTimer.current && !completed) return;
    const run = async () => {
      saveTimer.current = null;
      try {
        await api(`/courses/${courseId}/videos/${video.id}/progress`, {
          method: "POST",
          body: {
            progressSecond: Math.floor(progressSecond || 0),
            durationSecond: Math.floor(durationSecond || 0),
            completed
          }
        });
      } catch {
        // Progress save should not interrupt playback.
      }
    };
    if (completed) run();
    else saveTimer.current = setTimeout(run, 8000);
  }

  const videoId = playerData?.externalVideoId || video.externalVideoId || extractYouTubeVideoId(playerData?.embedUrl || "");
  const resumeSecond = Number(video.progress?.progressSecond || 0);

  return (
    <div className="modal-backdrop">
      <div className="auth-modal secure-video-modal">
        <button type="button" className="close-btn" onClick={close}><X /></button>
        <h3>{video.title}</h3>
        <p>{video.uploadedBy?.name ? `Lecturer: ${video.uploadedBy.name}` : "CIBI platform video"}</p>
        {loading ? (
          <div className="quiet-banner"><strong>Preparing CIBI video player...</strong></div>
        ) : videoId ? (
          <PlatformYouTubePlayer
            videoId={videoId}
            title={video.title}
            initialSecond={resumeSecond}
            onProgress={saveProgress}
          />
        ) : (
          <div className="quiet-banner"><strong>This video link is not playable inside CIBI.</strong></div>
        )}
        <small className="secure-video-note">Download and YouTube redirect controls are hidden inside the CIBI player.</small>
      </div>
    </div>
  );
}

function LearningAssessments({ course, reloadCourse }) {
  const assignments = (course.assignments || []).filter((item) => item.published !== false);
  const quizzes = (course.quizzes || []).filter((item) => item.published !== false);
  if (!assignments.length && !quizzes.length) return null;

  return (
    <section className="learning-assessments-panel">
      <div className="student-tab-heading compact-learning-heading">
        <span>Course Work</span>
        <h2>Assignments & Quizzes</h2>
        <p>Required assignments and quizzes must be passed before certificate eligibility.</p>
      </div>
      <div className="assessment-grid">
        {assignments.map((assignment) => <StudentAssignmentCard key={assignment.id} assignment={assignment} reloadCourse={reloadCourse} />)}
        {quizzes.map((quiz) => <StudentQuizCard key={quiz.id} quiz={quiz} reloadCourse={reloadCourse} />)}
      </div>
    </section>
  );
}

function StudentAssignmentCard({ assignment, reloadCourse }) {
  const submission = getAssignmentSubmission(assignment);
  const [answer, setAnswer] = useState(submission?.answer || "");
  const [fileUrl, setFileUrl] = useState(submission?.fileUrl || "");
  const [videoUrl, setVideoUrl] = useState(submission?.videoUrl || "");
  const [fileName, setFileName] = useState("");
  const [saving, setSaving] = useState(false);

  async function uploadFile(file) {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      showToast("Assignment file must not be more than 10MB.", "error");
      return;
    }
    try {
      setSaving(true);
      const dataUrl = await fileToDataUrl(file);
      const result = await api("/uploads/assignment-file", { method: "POST", body: { fileName: file.name, contentType: file.type, dataUrl } });
      setFileUrl(result.url);
      setFileName(file.name);
      showToast("Assignment file uploaded.", "success");
    } catch (error) {
      showToast(error.message || "Could not upload file", "error");
    } finally {
      setSaving(false);
    }
  }

  async function submitAssignment(e) {
    e.preventDefault();
    if (!answer.trim() && !fileUrl && !videoUrl.trim()) {
      showToast("Type an answer, upload your assignment file, or paste a video assignment link.", "error");
      return;
    }
    try {
      setSaving(true);
      const result = await api(`/student/assignments/${assignment.id}/submit`, { method: "POST", body: { answer, fileUrl, videoUrl } });
      showToast(result.message || "Assignment submitted.", "success");
      await reloadCourse();
    } catch (error) {
      showToast(error.message || "Could not submit assignment", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <article className="student-assessment-card">
      <div className="assessment-card-head">
        <span>{assignment.required ? "Required Assignment" : "Optional Assignment"}</span>
        <strong>{assignment.title}</strong>
      </div>
      <p>{assignment.instructions}</p>
      <div className="assessment-status-line">
        <small>Pass mark: {assignment.passScore || 50}%</small>
        {submission ? <small>Status: {formatPortalStatus(submission.status)}</small> : <small>Not submitted</small>}
        {submission?.score !== null && submission?.score !== undefined && <small>Score: {submission.score}/{assignment.maxScore || 100}</small>}
      </div>
      {submission?.feedback && <div className="answer-box"><b>Admin Feedback:</b> {submission.feedback}</div>}
      <form className="assessment-submit-form" onSubmit={submitAssignment}>
        <textarea placeholder="Type your assignment answer..." value={answer} onChange={(e) => setAnswer(e.target.value)} />
        <input placeholder="Video assignment link (YouTube, Vimeo, Loom, Google Drive, etc.)" value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} />
        {submission?.videoUrl && <a className="receipt-preview-link" href={submission.videoUrl} target="_blank" rel="noreferrer">View submitted video link</a>}
        <label className="receipt-upload-box assessment-upload-box">
          <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf,.doc,.docx" onChange={(e) => uploadFile(e.target.files?.[0])} />
          <span>{fileUrl ? "File uploaded" : "Upload assignment file"}</span>
          <small>{fileName || submission?.fileUrl || "JPG, PNG, WEBP, PDF, DOC or DOCX. Maximum 10MB."}</small>
        </label>
        {fileUrl && <a className="receipt-preview-link" href={fileUrl} target="_blank" rel="noreferrer">View uploaded file</a>}
        <button className="gold-btn" type="submit" disabled={saving}>{saving ? "Saving..." : submission ? "Resubmit Assignment" : "Submit Assignment"}</button>
      </form>
    </article>
  );
}

function StudentQuizCard({ quiz, reloadCourse }) {
  const [answers, setAnswers] = useState({});
  const [saving, setSaving] = useState(false);
  const bestAttempt = getQuizBestAttempt(quiz);

  function setAnswer(questionId, option) {
    setAnswers((current) => ({ ...current, [questionId]: option }));
  }

  async function submitQuiz(e) {
    e.preventDefault();
    if ((quiz.questions || []).some((question) => !answers[question.id])) {
      showToast("Please answer every quiz question before submitting.", "error");
      return;
    }
    try {
      setSaving(true);
      const result = await api(`/student/quizzes/${quiz.id}/attempt`, { method: "POST", body: { answers } });
      showToast(`${result.message} Score: ${result.attempt?.score || 0}%`, result.attempt?.passed ? "success" : "error");
      setAnswers({});
      await reloadCourse();
    } catch (error) {
      showToast(error.message || "Could not submit quiz", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <article className="student-assessment-card quiz-card">
      <div className="assessment-card-head">
        <span>{quiz.required ? "Required Quiz" : "Optional Quiz"}</span>
        <strong>{quiz.title}</strong>
      </div>
      {quiz.description && <p>{quiz.description}</p>}
      <div className="assessment-status-line">
        <small>Pass mark: {quiz.passScore || 70}%</small>
        {bestAttempt ? <small>Best score: {bestAttempt.score}% · {bestAttempt.passed ? "Passed" : "Not passed"}</small> : <small>No attempt yet</small>}
      </div>
      <form className="quiz-form" onSubmit={submitQuiz}>
        {(quiz.questions || []).map((question, index) => (
          <div className="quiz-question-card" key={question.id}>
            <strong>{index + 1}. {question.question}</strong>
            {["A", "B", "C", "D"].map((option) => (
              <label key={option}>
                <input type="radio" name={`quiz-${quiz.id}-q-${question.id}`} checked={answers[question.id] === option} onChange={() => setAnswer(question.id, option)} />
                <span>{option}. {question[`option${option}`]}</span>
              </label>
            ))}
          </div>
        ))}
        {!(quiz.questions || []).length && <p className="empty-small">Admin has not added quiz questions yet.</p>}
        <button className="dark-btn" type="submit" disabled={saving || !(quiz.questions || []).length}>{saving ? "Submitting..." : "Submit Quiz"}</button>
      </form>
    </article>
  );
}

function PaymentPanel({ programmes = [], courses = [], settings }) {
  const availableProgrammes = registrationProgrammeList(programmes, courses);
  const [courseId, setCourseId] = useState(availableProgrammes[0]?.id ? String(availableProgrammes[0].id) : "");
  const [applicationEnrollment, setApplicationEnrollment] = useState(null);
  const [manualReference, setManualReference] = useState("");
  const [paymentProofUrl, setPaymentProofUrl] = useState("");
  const [receiptName, setReceiptName] = useState("");
  const [receiptUploading, setReceiptUploading] = useState(false);
  const [message, setMessage] = useState("");
  const selectedCourse = availableProgrammes.find((course) => String(course.id) === String(courseId)) || applicationEnrollment?.programme || applicationEnrollment?.course;
  const lockedToApplication = Boolean(applicationEnrollment?.programmeId || applicationEnrollment?.courseId);

  async function loadApplicationEnrollment() {
    try {
      const result = await api("/student/payment-status");
      const enrollment = (result.enrollments || [])[0] || null;
      if (enrollment?.programmeId || enrollment?.courseId) {
        setApplicationEnrollment(enrollment);
        setCourseId(String(enrollment.programmeId || enrollment.courseId));
      }
    } catch {
      // Payment status is only available for logged-in students.
    }
  }

  useEffect(() => {
    loadApplicationEnrollment();
  }, []);

  async function payWithPaystack() {
    if (!courseId) {
      showToast("Please submit the admission form and select a programme first.", "error");
      return;
    }
    try {
      const result = await api("/payments/paystack/initialize", { method: "POST", body: { programmeId: Number(courseId) } });
      window.location.href = result.authorizationUrl;
    } catch (error) {
      showToast(error.message, "error");
    }
  }

  function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function uploadReceipt(file) {
    if (!file) return;
    const allowed = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    if (!allowed.includes(file.type)) {
      showToast("Please upload a JPG, PNG, WEBP or PDF receipt.", "error");
      return;
    }
    if (file.size > 6 * 1024 * 1024) {
      showToast("Receipt file must not be more than 6MB.", "error");
      return;
    }

    try {
      setReceiptUploading(true);
      setMessage("");
      const dataUrl = await fileToDataUrl(file);
      const result = await api("/uploads/payment-proof", {
        method: "POST",
        body: { fileName: file.name, contentType: file.type, dataUrl }
      });
      setPaymentProofUrl(result.url);
      setReceiptName(file.name);
      setMessage("Receipt uploaded. You can now submit your bank transfer for review.");
      showToast("Receipt uploaded. You can now submit your bank transfer for review.", "success");
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      setReceiptUploading(false);
    }
  }

  async function submitManual(e) {
    e.preventDefault();
    if (!courseId) {
      showToast("Please submit the admission form and select a programme first.", "error");
      return;
    }
    if (!paymentProofUrl) {
      showToast("Please upload your payment receipt before submitting bank transfer.", "error");
      return;
    }
    try {
      const result = await api("/payments/manual", { method: "POST", body: { programmeId: Number(courseId), manualReference, paymentProofUrl } });
      setMessage(result.message);
      showToast(result.message, "success");
      await loadApplicationEnrollment();
    } catch (error) {
      showToast(error.message, "error");
    }
  }

  if (!selectedCourse) {
    return (
      <div className="payment-box premium-payment-box">
        <div className="quiet-banner">
          <strong>No programme selected.</strong>
          <p>Please submit the admission form first so your payment can be attached to the right programme and learning stream.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="payment-box premium-payment-box">
      <div className="payment-box-heading">
        <span>Secure Payment</span>
        <h3>Complete Payment for Your Selected Programme</h3>
        <p>Payment is locked to the programme selected in your application. Pay instantly with Paystack or submit a bank transfer receipt for admin verification.</p>
      </div>

      {lockedToApplication ? (
        <div className="selected-payment-programme">
          <span>Application Programme</span>
          <strong>{selectedCourse.title}</strong>
          {applicationEnrollment?.learningStream ? <small>Learning Stream: {applicationEnrollment.learningStream}</small> : null}
        </div>
      ) : (
        <select value={courseId} onChange={(e) => setCourseId(e.target.value)}>
          {availableProgrammes.map((course) => <option value={String(course.id)} key={course.id}>{course.title} — {programmeFeeText(course)}</option>)}
        </select>
      )}

      {selectedCourse && <div className="payment-fee-line"><strong>Fee:</strong> {programmePaymentFeeText(selectedCourse)}<CurrencyConverter amountUsd={usdFee(selectedCourse)} settings={settings} /></div>}

      <button className="gold-btn full" type="button" onClick={payWithPaystack}>Pay Now with Paystack</button>

      <div className="bank-box premium-bank-box">
        <h4>Manual Bank Transfer</h4>
        <p><strong>Bank:</strong> {settings.bank_name}</p>
        <p><strong>Account Name:</strong> {settings.account_name}</p>
        <p><strong>Account Number:</strong> {settings.account_number}</p>
      </div>

      <form className="admin-form manual-payment-form" onSubmit={submitManual}>
        <input placeholder="Payment reference / depositor name" value={manualReference} onChange={(e) => setManualReference(e.target.value)} required />

        <label className="receipt-upload-box">
          <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(e) => uploadReceipt(e.target.files?.[0])} />
          <span>{receiptUploading ? "Uploading receipt..." : paymentProofUrl ? "Receipt uploaded" : "Upload payment receipt"}</span>
          <small>{receiptName || "JPG, PNG, WEBP or PDF. Maximum 6MB."}</small>
        </label>

        {paymentProofUrl && <a className="receipt-preview-link" href={paymentProofUrl} target="_blank" rel="noreferrer">View uploaded receipt</a>}

        <button className="dark-btn" type="submit" disabled={receiptUploading}>{receiptUploading ? "Uploading..." : "I have paid by bank transfer"}</button>
      </form>

      {message && <p className="success-message">{message}</p>}
    </div>
  );
}


function PaymentCallback({ goTo }) {
  const [message, setMessage] = useState("Verifying payment...");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const reference = params.get("reference") || params.get("trxref");
    if (!reference) {
      setMessage("Payment reference not found.");
      return;
    }

    api(`/payments/paystack/verify/${reference}`)
      .then((result) => setMessage(result.paid ? "Payment confirmed. Admin will review and activate your portal access." : "Payment was not successful."))
      .catch((error) => setMessage(error.message));
  }, []);

  return <main className="page container gate"><CheckCircle size={56} /><h1>Payment Status</h1><p>{message}</p><button className="gold-btn big" onClick={() => goTo("student")}>Go to Student Portal</button></main>;
}

function AdminDashboard({ reloadPublic, currentUser }) {
  const [tab, setTab] = useState("overview");
  const [overview, setOverview] = useState(null);

  async function loadOverview() {
    const result = await api("/admin/overview");
    setOverview(result);
  }

  function switchAdminTab(nextTab) {
    setTab(nextTab);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  useEffect(() => { loadOverview(); }, []);

  return (
    <main className="portal-page">
      <PortalSidebar title="Admin Dashboard" items={(isPowerAdmin(currentUser) ? ["Overview", "Website Content", "Programmes", "Courses", "Currency Settings", "Users & Roles", "Students", "Books", "Course Builder", "Progress", "Gradebook", "Student Groups", "Activity Log", "Attendance Records", "Course Discussions", "Certificates", "Assignments & Quiz", "Slides", "Gallery", "Announcements", "Live", "Appeals & Support", "Email Settings", "Settings"] : currentUser?.role === "LECTURER" ? ["Overview", "Course Builder", "Assignments & Quiz", "Student Groups", "Attendance Records", "Course Discussions", "Live"] : ["Overview", "Students", "Programmes", "Courses", "Course Builder", "Progress", "Gradebook", "Student Groups", "Attendance Records", "Course Discussions", "Certificates", "Assignments & Quiz", "Live", "Appeals & Support"])} tab={tab} setTab={switchAdminTab} admin />
      <div className="portal-main">
        <div className="portal-header"><div><p className="eyebrow dark">Admin Control</p><h1>CIBI Management</h1></div></div>
        {tab === "overview" && <Overview overview={overview} />}
        {tab === "users & roles" && <UsersRolesAdmin />}
        {tab === "students" && <StudentsAdmin />}
        {tab === "books" && <CrudAdmin title="Books" path="books" reloadPublic={reloadPublic} fields={bookFields} />}
        {tab === "programmes" && <CrudAdmin title="Programmes" path="programmes" reloadPublic={reloadPublic} fields={programmeFields} />}
        {tab === "courses" && <CoursesAdmin reloadPublic={reloadPublic} />}
        {tab === "course builder" && <CourseBuilderAdmin reloadPublic={reloadPublic} currentUser={currentUser} />}
        {tab === "progress" && <ProgressAdmin />}
        {tab === "gradebook" && <GradebookAdmin />}
        {tab === "student groups" && <StudentGroupsAdmin />}
        {tab === "activity log" && <ActivityLogAdmin />}
        {tab === "attendance records" && <AttendanceRecordsAdmin />}
        {tab === "course discussions" && <CourseDiscussionsAdmin />}
        {tab === "certificates" && <CertificatesAdmin />}
        {tab === "assignments & quiz" && <AssessmentsAdmin />}
        {tab === "slides" && <SlidesAdmin reloadPublic={reloadPublic} />}
        {tab === "gallery" && <CrudAdmin title="Gallery" path="gallery" reloadPublic={reloadPublic} fields={galleryFields} />}
        {tab === "announcements" && <CrudAdmin title="Announcements" path="announcements" reloadPublic={reloadPublic} fields={announcementFields} />}
        {tab === "live" && <LiveAdmin reloadPublic={reloadPublic} />}
        {tab === "appeals & support" && <SupportAdmin />}
        {tab === "website content" && <WebsiteContentAdmin reloadPublic={reloadPublic} />}
        {tab === "currency settings" && <CurrencySettingsAdmin />}
        {tab === "email settings" && <EmailSettingsAdmin />}
        {tab === "settings" && <SettingsAdmin reloadPublic={reloadPublic} />}
      </div>
    </main>
  );
}






function UsersRolesAdmin() {
  const [data, setData] = useState({ rawUsers: [], courses: [] });
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "LECTURER" });
  const [accessForm, setAccessForm] = useState({ lecturerId: "", courseId: "" });

  async function load() {
    const result = await api("/admin/users-roles");
    setData(result);
    const firstLecturer = (result.rawUsers || []).find((user) => ["LECTURER", "ADMIN", "RECTOR", "SUPER_ADMIN"].includes(user.role));
    setAccessForm((current) => ({ ...current, lecturerId: current.lecturerId || firstLecturer?.id || "", courseId: current.courseId || result.courses?.[0]?.id || "" }));
  }

  useEffect(() => { load().catch((error) => showToast(error.message, "error")); }, []);

  async function createUser(e) {
    e.preventDefault();
    try {
      await api("/admin/users-roles", { method: "POST", body: form });
      setForm({ name: "", email: "", password: "", role: "LECTURER" });
      await load();
      showToast("Staff account created.", "success");
    } catch (error) {
      showToast(error.message || "Could not create staff account", "error");
    }
  }

  async function assignCourse(e) {
    e.preventDefault();
    try {
      await api("/admin/lecturer-course-access", { method: "POST", body: accessForm });
      await load();
      showToast("Course access assigned.", "success");
    } catch (error) {
      showToast(error.message || "Could not assign course access", "error");
    }
  }

  async function removeAccess(id) {
    if (!(await showConfirm({ title: "Remove course access?", message: "This staff member will no longer see that course.", confirmText: "Remove", danger: true }))) return;
    await api(`/admin/lecturer-course-access/${id}`, { method: "DELETE" });
    await load();
  }

  const staff = data.rawUsers || [];
  return (
    <section className="admin-section phase2-panel">
      <h2>Users & Roles</h2>
      <p>Super Admin can create Rector, Admin and Lecturer accounts, then assign courses to lecturers.</p>

      <div className="phase2-grid">
        <form className="admin-form phase2-card" onSubmit={createUser}>
          <h3>Create Staff Account</h3>
          <input placeholder="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <input placeholder="Email address" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          <input placeholder="Temporary password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            <option value="LECTURER">Lecturer</option>
            <option value="ADMIN">Admin</option>
            <option value="RECTOR">Rector / Senior Admin</option>
            <option value="SUPER_ADMIN">Super Admin</option>
          </select>
          <button className="gold-btn" type="submit">Create Account</button>
        </form>

        <form className="admin-form phase2-card" onSubmit={assignCourse}>
          <h3>Assign Course to Lecturer</h3>
          <select value={accessForm.lecturerId} onChange={(e) => setAccessForm({ ...accessForm, lecturerId: e.target.value })}>
            {staff.map((user) => <option key={user.id} value={user.id}>{user.name} — {formatPortalStatus(user.role)}</option>)}
          </select>
          <select value={accessForm.courseId} onChange={(e) => setAccessForm({ ...accessForm, courseId: e.target.value })}>
            {(data.courses || []).map((course) => <option key={course.id} value={String(course.id)}>{course.title}</option>)}
          </select>
          <button className="dark-btn" type="submit">Grant Course Access</button>
        </form>
      </div>

      <div className="admin-list">
        {staff.map((user) => (
          <div className="admin-item phase2-staff-row" key={user.id}>
            <div>
              <strong>{user.name}</strong>
              <p>{user.email} · {formatPortalStatus(user.role)}</p>
              <div className="mini-chip-row">
                {(user.lecturerCourseAccesses || []).map((access) => (
                  <span className="mini-chip" key={access.id}>{access.course?.title}<button type="button" onClick={() => removeAccess(access.id)}>×</button></span>
                ))}
                {!(user.lecturerCourseAccesses || []).length && <small>No assigned course yet.</small>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function CurrencySettingsAdmin() {
  const [settings, setSettings] = useState({ base_currency: "USD", currency_rates: "NGN|1500\nGHS|12\nKES|130\nZAR|18", currency_converter_note: "" });
  async function load() {
    setSettings({ ...settings, ...(await api("/admin/currency-settings")) });
  }
  useEffect(() => { load().catch((error) => showToast(error.message, "error")); }, []);

  async function save(e) {
    e.preventDefault();
    await api("/admin/currency-settings", { method: "PATCH", body: settings });
    showToast("Currency settings saved.", "success");
  }

  return (
    <section className="admin-section phase2-panel">
      <h2>USD Pricing & Currency Converter</h2>
      <p>Course prices display in USD. Students can estimate their local currency using the rates below.</p>
      <form className="admin-form" onSubmit={save}>
        <label className="content-field">
          <span>Base Currency</span>
          <input value={settings.base_currency || "USD"} onChange={(e) => setSettings({ ...settings, base_currency: e.target.value })} />
        </label>
        <label className="content-field">
          <span>Currency Rates, one per line: CODE|RATE_PER_USD</span>
          <textarea value={settings.currency_rates || ""} onChange={(e) => setSettings({ ...settings, currency_rates: e.target.value })} />
        </label>
        <label className="content-field">
          <span>Converter Note</span>
          <input value={settings.currency_converter_note || ""} onChange={(e) => setSettings({ ...settings, currency_converter_note: e.target.value })} />
        </label>
        <button className="gold-btn" type="submit">Save Currency Settings</button>
      </form>
    </section>
  );
}

function StudentGroupsAdmin() {
  const [data, setData] = useState({ courses: [], groups: [], students: [] });
  const [courseId, setCourseId] = useState("");
  const [form, setForm] = useState({ groupSize: 10, taskTitle: "", instructions: "" });

  async function load(nextCourseId = courseId) {
    const result = await api(`/admin/student-groups${nextCourseId ? `?courseId=${nextCourseId}` : ""}`);
    setData(result);
    if (!nextCourseId && result.courses?.[0]?.id) setCourseId(result.courses[0].id);
  }

  useEffect(() => { load().catch((error) => showToast(error.message, "error")); }, []);
  useEffect(() => { if (courseId) load(courseId).catch(() => null); }, [courseId]);

  async function createGroups(e) {
    e.preventDefault();
    try {
      const result = await api("/admin/student-groups/auto", { method: "POST", body: { courseId, ...form } });
      showToast(result.message || "Student groups created.", "success");
      await load(courseId);
    } catch (error) {
      showToast(error.message || "Could not create groups", "error");
    }
  }

  async function removeGroup(id) {
    if (!(await showConfirm({ title: "Delete group?", message: "This will remove the group and its members.", confirmText: "Delete", danger: true }))) return;
    await api(`/admin/student-groups/${id}`, { method: "DELETE" });
    await load(courseId);
  }

  return (
    <section className="admin-section phase2-panel">
      <h2>Student Groups</h2>
      <p>Group students under a lecturer course. Example: 300 students can be split into 30 groups of 10 students each.</p>

      <form className="admin-form phase2-card" onSubmit={createGroups}>
        <select value={courseId} onChange={(e) => setCourseId(e.target.value)}>
          <option value="">Select course</option>
          {(data.courses || []).map((course) => <option key={course.id} value={String(course.id)}>{course.title}</option>)}
        </select>
        <input type="number" min="1" placeholder="Students per group" value={form.groupSize} onChange={(e) => setForm({ ...form, groupSize: Number(e.target.value || 10) })} />
        <input placeholder="Group task title" value={form.taskTitle} onChange={(e) => setForm({ ...form, taskTitle: e.target.value })} />
        <textarea placeholder="Task / assignment instruction for groups" value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} />
        <button className="gold-btn" type="submit" disabled={!courseId}>Auto Create Groups</button>
      </form>

      <p className="muted-note">{(data.students || []).length} approved students found for the selected course.</p>
      <div className="student-group-grid">
        {(data.groups || []).map((group) => (
          <div className="student-group-card" key={group.id}>
            <div className="student-group-head">
              <div><strong>{group.name}</strong><small>{group.course?.title}</small></div>
              <button className="delete-btn" type="button" onClick={() => removeGroup(group.id)}><Trash2 size={15} /></button>
            </div>
            {group.taskTitle && <h3>{group.taskTitle}</h3>}
            {group.instructions && <p>{group.instructions}</p>}
            <div className="mini-member-list">
              {(group.members || []).map((member) => <span key={member.id}>{member.student?.name || "Student"}</span>)}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}


const EMPTY_OBJECTIVE_QUESTION = { question: "", optionA: "", optionB: "", optionC: "", optionD: "", correctOption: "A" };

function objectiveQuestionIsComplete(question = {}) {
  return ["question", "optionA", "optionB", "optionC", "optionD"].every((key) => String(question[key] || "").trim());
}

function getCorrectOptionText(question = {}) {
  const key = `option${String(question.correctOption || "A").toUpperCase()}`;
  return question[key] || "";
}

function AssessmentsAdmin() {
  const [data, setData] = useState({ courses: [], assignments: [], quizzes: [] });
  const [assignmentForm, setAssignmentForm] = useState({ courseId: "", moduleId: "", lessonId: "", title: "", instructions: "", dueDate: "", required: true, published: true, maxScore: 100, passScore: 50 });
  const [quizForm, setQuizForm] = useState({ courseId: "", moduleId: "", lessonId: "", title: "", description: "", passScore: 70, required: true, published: true });
  const [quizDraftQuestion, setQuizDraftQuestion] = useState(EMPTY_OBJECTIVE_QUESTION);
  const [quizDraftQuestions, setQuizDraftQuestions] = useState([]);
  const [questionForms, setQuestionForms] = useState({});
  const [gradeForms, setGradeForms] = useState({});

  async function load() {
    const result = await api("/admin/assessments");
    setData(result);
    const firstCourse = result.courses?.[0]?.id || "";
    setAssignmentForm((current) => ({ ...current, courseId: current.courseId || firstCourse }));
    setQuizForm((current) => ({ ...current, courseId: current.courseId || firstCourse }));
  }

  useEffect(() => { load().catch((error) => showToast(error.message, "error")); }, []);

  function courseOptions() {
    return data.courses || [];
  }

  function modulesFor(courseId) {
    const course = data.courses.find((item) => Number(item.id) === Number(courseId));
    return course?.modules || [];
  }

  function lessonsFor(courseId, moduleId = "") {
    const course = data.courses.find((item) => Number(item.id) === Number(courseId));
    if (!course) return [];
    if (moduleId) {
      const module = (course.modules || []).find((item) => Number(item.id) === Number(moduleId));
      return module?.lessons || [];
    }
    return course.lessons || [];
  }

  async function saveAssignment(e) {
    e.preventDefault();
    try {
      const created = await api("/admin/assignments", { method: "POST", body: assignmentForm });
      showToast("Assignment created.", "success");
      setAssignmentForm((current) => ({ ...current, title: "", instructions: "", dueDate: "" }));
      await load();
      return created;
    } catch (error) {
      showToast(error.message || "Could not create assignment", "error");
    }
  }

  async function saveQuiz(e) {
    e.preventDefault();

    const cleanDraftQuestions = quizDraftQuestions
      .map((item, index) => ({
        question: String(item.question || "").trim(),
        optionA: String(item.optionA || "").trim(),
        optionB: String(item.optionB || "").trim(),
        optionC: String(item.optionC || "").trim(),
        optionD: String(item.optionD || "").trim(),
        correctOption: String(item.correctOption || "A").toUpperCase(),
        questionOrder: index + 1
      }))
      .filter(objectiveQuestionIsComplete);

    if (!cleanDraftQuestions.length) {
      showToast("Please add at least one objective question with options A-D before creating the quiz.", "error");
      return;
    }

    try {
      const created = await api("/admin/quizzes", { method: "POST", body: quizForm });
      for (const question of cleanDraftQuestions) {
        await api(`/admin/quizzes/${created.id}/questions`, { method: "POST", body: question });
      }
      showToast(`Quiz created with ${cleanDraftQuestions.length} objective question${cleanDraftQuestions.length === 1 ? "" : "s"}.`, "success");
      setQuizForm((current) => ({ ...current, title: "", description: "" }));
      setQuizDraftQuestion(EMPTY_OBJECTIVE_QUESTION);
      setQuizDraftQuestions([]);
      await load();
    } catch (error) {
      showToast(error.message || "Could not create quiz", "error");
    }
  }

  function updateQuizDraftField(field, value) {
    setQuizDraftQuestion((current) => ({ ...current, [field]: value }));
  }

  function addQuizDraftQuestion() {
    if (!objectiveQuestionIsComplete(quizDraftQuestion)) {
      showToast("Enter the question and all four objective options before adding it.", "error");
      return;
    }

    setQuizDraftQuestions((current) => [
      ...current,
      { ...quizDraftQuestion, correctOption: String(quizDraftQuestion.correctOption || "A").toUpperCase() }
    ]);
    setQuizDraftQuestion(EMPTY_OBJECTIVE_QUESTION);
    showToast("Objective question added to this quiz draft.", "success");
  }

  function removeQuizDraftQuestion(index) {
    setQuizDraftQuestions((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  async function deleteAssignment(id) {
    if (!(await showConfirm({ title: "Delete assignment?", message: "Student submissions under this assignment will also be deleted.", confirmText: "Delete", danger: true }))) return;
    await api(`/admin/assignments/${id}`, { method: "DELETE" });
    showToast("Assignment deleted.", "success");
    await load();
  }

  async function deleteQuiz(id) {
    if (!(await showConfirm({ title: "Delete quiz?", message: "Quiz questions and attempts will also be deleted.", confirmText: "Delete", danger: true }))) return;
    await api(`/admin/quizzes/${id}`, { method: "DELETE" });
    showToast("Quiz deleted.", "success");
    await load();
  }

  async function addQuestion(quizId) {
    const form = questionForms[quizId] || { question: "", optionA: "", optionB: "", optionC: "", optionD: "", correctOption: "A", questionOrder: 1 };
    try {
      await api(`/admin/quizzes/${quizId}/questions`, { method: "POST", body: form });
      showToast("Quiz question added.", "success");
      setQuestionForms((current) => ({ ...current, [quizId]: { question: "", optionA: "", optionB: "", optionC: "", optionD: "", correctOption: "A", questionOrder: Number(form.questionOrder || 1) + 1 } }));
      await load();
    } catch (error) {
      showToast(error.message || "Could not add question", "error");
    }
  }

  async function deleteQuestion(id) {
    await api(`/admin/quiz-questions/${id}`, { method: "DELETE" });
    showToast("Question deleted.", "success");
    await load();
  }

  async function gradeSubmission(submissionId, assignment) {
    const form = gradeForms[submissionId] || {};
    try {
      const score = Number(form.score ?? 0);
      await api(`/admin/assignment-submissions/${submissionId}/grade`, { method: "PATCH", body: { score, feedback: form.feedback || "" } });
      showToast(score >= Number(assignment.passScore || 50) ? "Assignment passed." : "Assignment graded but did not pass.", "success");
      await load();
    } catch (error) {
      showToast(error.message || "Could not grade submission", "error");
    }
  }

  return (
    <section className="admin-section assessments-admin">
      <div className="content-editor-header">
        <div><span>LMS Assessment</span><h2>Assignments & Quiz</h2><p>Create coursework, grade student submissions, add quiz questions and control certificate eligibility.</p></div>
        <button className="gold-btn" type="button" onClick={load}>Refresh</button>
      </div>

      <div className="assessment-admin-forms">
        <form className="admin-form assessment-admin-form" onSubmit={saveAssignment}>
          <h3>Add Assignment</h3>
          <select value={assignmentForm.courseId} onChange={(e) => setAssignmentForm({ ...assignmentForm, courseId: e.target.value, moduleId: "", lessonId: "" })} required>
            <option value="">Select course</option>
            {courseOptions().map((course) => <option key={course.id} value={String(course.id)}>{course.title}</option>)}
          </select>
          <div className="form-row">
            <select value={assignmentForm.moduleId} onChange={(e) => setAssignmentForm({ ...assignmentForm, moduleId: e.target.value, lessonId: "" })}>
              <option value="">Course level / no module</option>
              {modulesFor(assignmentForm.courseId).map((module) => <option key={module.id} value={module.id}>{module.title}</option>)}
            </select>
            <select value={assignmentForm.lessonId} onChange={(e) => setAssignmentForm({ ...assignmentForm, lessonId: e.target.value })}>
              <option value="">No specific lesson</option>
              {lessonsFor(assignmentForm.courseId, assignmentForm.moduleId).map((lesson) => <option key={lesson.id} value={lesson.id}>{lesson.title}</option>)}
            </select>
          </div>
          <input placeholder="Assignment title" value={assignmentForm.title} onChange={(e) => setAssignmentForm({ ...assignmentForm, title: e.target.value })} required />
          <textarea placeholder="Instructions for students" value={assignmentForm.instructions} onChange={(e) => setAssignmentForm({ ...assignmentForm, instructions: e.target.value })} required />
          <div className="form-row">
            <label className="assessment-field">
              <span>Submission deadline</span>
              <input type="date" value={assignmentForm.dueDate} onChange={(e) => setAssignmentForm({ ...assignmentForm, dueDate: e.target.value })} />
            </label>
            <label className="assessment-field">
              <span>Assignment pass score (%)</span>
              <input type="number" min="0" max="100" placeholder="Example: 50" value={assignmentForm.passScore} onChange={(e) => setAssignmentForm({ ...assignmentForm, passScore: e.target.value })} />
              <small>Students must score this mark or above to pass.</small>
            </label>
          </div>
          <label className="checkbox-field"><input type="checkbox" checked={assignmentForm.required} onChange={(e) => setAssignmentForm({ ...assignmentForm, required: e.target.checked })} /> Required for certificate</label>
          <label className="checkbox-field"><input type="checkbox" checked={assignmentForm.published} onChange={(e) => setAssignmentForm({ ...assignmentForm, published: e.target.checked })} /> Published to students</label>
          <button className="gold-btn" type="submit">Add Assignment</button>
        </form>

        <form className="admin-form assessment-admin-form" onSubmit={saveQuiz}>
          <h3>Add Quiz</h3>
          <select value={quizForm.courseId} onChange={(e) => setQuizForm({ ...quizForm, courseId: e.target.value, moduleId: "", lessonId: "" })} required>
            <option value="">Select course</option>
            {courseOptions().map((course) => <option key={course.id} value={String(course.id)}>{course.title}</option>)}
          </select>
          <div className="form-row">
            <select value={quizForm.moduleId} onChange={(e) => setQuizForm({ ...quizForm, moduleId: e.target.value, lessonId: "" })}>
              <option value="">Course level / no module</option>
              {modulesFor(quizForm.courseId).map((module) => <option key={module.id} value={module.id}>{module.title}</option>)}
            </select>
            <select value={quizForm.lessonId} onChange={(e) => setQuizForm({ ...quizForm, lessonId: e.target.value })}>
              <option value="">No specific lesson</option>
              {lessonsFor(quizForm.courseId, quizForm.moduleId).map((lesson) => <option key={lesson.id} value={lesson.id}>{lesson.title}</option>)}
            </select>
          </div>
          <input placeholder="Quiz title" value={quizForm.title} onChange={(e) => setQuizForm({ ...quizForm, title: e.target.value })} required />
          <textarea placeholder="Quiz description" value={quizForm.description} onChange={(e) => setQuizForm({ ...quizForm, description: e.target.value })} />
          <label className="assessment-field">
            <span>Quiz pass mark (%)</span>
            <input type="number" min="0" max="100" placeholder="Example: 70" value={quizForm.passScore} onChange={(e) => setQuizForm({ ...quizForm, passScore: e.target.value })} />
            <small>Students must score this mark or above to pass this quiz.</small>
          </label>

          <div className="objective-builder">
            <div className="objective-builder-head">
              <span>Objective Questions</span>
              <small>Add question options A-D and select the correct answer before creating the quiz.</small>
            </div>
            <textarea placeholder="Question e.g. What is faith?" value={quizDraftQuestion.question} onChange={(e) => updateQuizDraftField("question", e.target.value)} />
            <div className="form-row">
              <input placeholder="Option A" value={quizDraftQuestion.optionA} onChange={(e) => updateQuizDraftField("optionA", e.target.value)} />
              <input placeholder="Option B" value={quizDraftQuestion.optionB} onChange={(e) => updateQuizDraftField("optionB", e.target.value)} />
            </div>
            <div className="form-row">
              <input placeholder="Option C" value={quizDraftQuestion.optionC} onChange={(e) => updateQuizDraftField("optionC", e.target.value)} />
              <input placeholder="Option D" value={quizDraftQuestion.optionD} onChange={(e) => updateQuizDraftField("optionD", e.target.value)} />
            </div>
            <div className="form-row objective-action-row">
              <label className="assessment-field">
                <span>Correct answer</span>
                <select value={quizDraftQuestion.correctOption} onChange={(e) => updateQuizDraftField("correctOption", e.target.value)}>
                  <option value="A">A</option>
                  <option value="B">B</option>
                  <option value="C">C</option>
                  <option value="D">D</option>
                </select>
              </label>
              <button className="white-btn dark-text" type="button" onClick={addQuizDraftQuestion}>Add Objective Question</button>
            </div>

            <div className="draft-objective-list">
              {quizDraftQuestions.map((item, index) => (
                <div className="draft-objective-card" key={`${item.question}-${index}`}>
                  <div>
                    <strong>{index + 1}. {item.question}</strong>
                    <small>Correct answer: {item.correctOption} — {getCorrectOptionText(item)}</small>
                  </div>
                  <button className="delete-btn" type="button" onClick={() => removeQuizDraftQuestion(index)}><Trash2 size={14} /></button>
                </div>
              ))}
              {!quizDraftQuestions.length && <p className="empty-small">No objective question added yet. Add at least one question before creating the quiz.</p>}
            </div>
          </div>

          <label className="checkbox-field"><input type="checkbox" checked={quizForm.required} onChange={(e) => setQuizForm({ ...quizForm, required: e.target.checked })} /> Required for certificate</label>
          <label className="checkbox-field"><input type="checkbox" checked={quizForm.published} onChange={(e) => setQuizForm({ ...quizForm, published: e.target.checked })} /> Published to students</label>
          <button className="dark-btn" type="submit">Add Quiz</button>
        </form>
      </div>

      <div className="assessment-admin-list">
        <div className="content-editor-header assessment-list-head"><div><span>Assignments</span><h2>Student Assignments</h2></div></div>
        {(data.assignments || []).map((assignment) => (
          <article className="assessment-admin-card" key={assignment.id}>
            <div className="assessment-admin-card-head">
              <div><span>{assignment.required ? "Required" : "Optional"} · {assignment.published ? "Published" : "Hidden"}</span><h3>{assignment.title}</h3><p>{assignment.course?.title} {assignment.lesson?.title ? `· ${assignment.lesson.title}` : ""}</p></div>
              <button className="delete-btn" type="button" onClick={() => deleteAssignment(assignment.id)}><Trash2 size={16} /></button>
            </div>
            <p>{assignment.instructions}</p>
            <div className="assessment-submissions-list">
              {(assignment.submissions || []).map((submission) => (
                <div className="submission-grade-card" key={submission.id}>
                  <div><strong>{submission.user?.name}</strong><small>{submission.user?.email} · {formatPortalStatus(submission.status)}</small></div>
                  {submission.answer && <p>{submission.answer}</p>}
                  {submission.fileUrl && <a href={submission.fileUrl} target="_blank" rel="noreferrer">View submitted file</a>}
                  {submission.videoUrl && <a href={submission.videoUrl} target="_blank" rel="noreferrer">View submitted video link</a>}
                  <div className="form-row">
                    <input type="number" placeholder="Score" value={gradeForms[submission.id]?.score ?? submission.score ?? ""} onChange={(e) => setGradeForms((current) => ({ ...current, [submission.id]: { ...(current[submission.id] || {}), score: e.target.value } }))} />
                    <input placeholder="Feedback" value={gradeForms[submission.id]?.feedback ?? submission.feedback ?? ""} onChange={(e) => setGradeForms((current) => ({ ...current, [submission.id]: { ...(current[submission.id] || {}), feedback: e.target.value } }))} />
                    <button className="gold-btn" type="button" onClick={() => gradeSubmission(submission.id, assignment)}>Grade</button>
                  </div>
                </div>
              ))}
              {!assignment.submissions?.length && <p className="empty-small">No submissions yet.</p>}
            </div>
          </article>
        ))}

        <div className="content-editor-header assessment-list-head"><div><span>Quizzes</span><h2>Quiz Builder</h2></div></div>
        {(data.quizzes || []).map((quiz) => {
          const qForm = questionForms[quiz.id] || { question: "", optionA: "", optionB: "", optionC: "", optionD: "", correctOption: "A", questionOrder: (quiz.questions?.length || 0) + 1 };
          return (
            <article className="assessment-admin-card" key={quiz.id}>
              <div className="assessment-admin-card-head">
                <div><span>{quiz.required ? "Required" : "Optional"} · Pass mark {quiz.passScore}%</span><h3>{quiz.title}</h3><p>{quiz.course?.title} {quiz.lesson?.title ? `· ${quiz.lesson.title}` : ""}</p></div>
                <button className="delete-btn" type="button" onClick={() => deleteQuiz(quiz.id)}><Trash2 size={16} /></button>
              </div>
              {quiz.description && <p>{quiz.description}</p>}
              <div className="quiz-question-admin-list">
                {(quiz.questions || []).map((question) => (
                  <div className="quiz-question-admin" key={question.id}>
                    <strong>{question.question}</strong>
                    <small>Correct: {question.correctOption}</small>
                    <button className="delete-btn" type="button" onClick={() => deleteQuestion(question.id)}><Trash2 size={14} /></button>
                  </div>
                ))}
              </div>
              <div className="admin-form quiz-question-form existing-question-form">
                <div className="objective-builder-head">
                  <span>Add More Objective Questions</span>
                  <small>Use options A-D and choose the correct answer.</small>
                </div>
                <textarea placeholder="Question" value={qForm.question} onChange={(e) => setQuestionForms((current) => ({ ...current, [quiz.id]: { ...qForm, question: e.target.value } }))} />
                <div className="form-row"><input placeholder="Option A" value={qForm.optionA} onChange={(e) => setQuestionForms((current) => ({ ...current, [quiz.id]: { ...qForm, optionA: e.target.value } }))} /><input placeholder="Option B" value={qForm.optionB} onChange={(e) => setQuestionForms((current) => ({ ...current, [quiz.id]: { ...qForm, optionB: e.target.value } }))} /></div>
                <div className="form-row"><input placeholder="Option C" value={qForm.optionC} onChange={(e) => setQuestionForms((current) => ({ ...current, [quiz.id]: { ...qForm, optionC: e.target.value } }))} /><input placeholder="Option D" value={qForm.optionD} onChange={(e) => setQuestionForms((current) => ({ ...current, [quiz.id]: { ...qForm, optionD: e.target.value } }))} /></div>
                <div className="form-row"><label className="assessment-field"><span>Correct answer</span><select value={qForm.correctOption} onChange={(e) => setQuestionForms((current) => ({ ...current, [quiz.id]: { ...qForm, correctOption: e.target.value } }))}><option>A</option><option>B</option><option>C</option><option>D</option></select></label><button className="gold-btn" type="button" onClick={() => addQuestion(quiz.id)}>Add Question</button></div>
              </div>
              <div className="quiz-attempt-list">
                {(quiz.attempts || []).slice(0, 10).map((attempt) => <div key={attempt.id}><strong>{attempt.user?.name}</strong><small>{attempt.score}% · {attempt.passed ? "Passed" : "Not passed"}</small></div>)}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function SupportAdmin() {
  const [cases, setCases] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [reply, setReply] = useState("");
  const [filter, setFilter] = useState("ACTIVE");
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      setLoading(true);
      const result = await api("/admin/support/cases");
      setCases(result);
      if (!activeId && result[0]?.id) setActiveId(result[0].id);
    } catch (error) {
      showToast(error.message || "Could not load support cases", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const timer = setInterval(() => load().catch(() => null), 8000);
    return () => clearInterval(timer);
  }, []);

  const stats = useMemo(() => {
    const openStatuses = ["OPEN", "WAITING_ADMIN", "UNDER_REVIEW", "WAITING_STUDENT"];
    return {
      total: cases.length,
      active: cases.filter((item) => openStatuses.includes(item.status)).length,
      open: cases.filter((item) => item.status === "OPEN" || item.status === "WAITING_ADMIN").length,
      review: cases.filter((item) => item.status === "UNDER_REVIEW").length,
      waitingStudent: cases.filter((item) => item.status === "WAITING_STUDENT").length,
      resolved: cases.filter((item) => item.status === "RESOLVED").length,
      closed: cases.filter((item) => item.status === "CLOSED").length
    };
  }, [cases]);

  const filteredCases = cases.filter((item) => {
    if (filter === "ALL") return true;
    if (filter === "ACTIVE") return ["OPEN", "WAITING_ADMIN", "UNDER_REVIEW", "WAITING_STUDENT"].includes(item.status);
    return item.status === filter;
  });

  const activeCase = cases.find((item) => item.id === activeId) || filteredCases[0] || cases[0] || null;
  const canRestoreAccess = Boolean(
    activeCase?.enrollment &&
    (
      activeCase.user?.status !== "ACTIVE" ||
      activeCase.enrollment?.admissionStatus !== "APPROVED" ||
      activeCase.enrollment?.paymentStatus !== "PAYMENT_CONFIRMED"
    )
  );

  async function sendReply(e) {
    e.preventDefault();
    if (!activeCase || !reply.trim()) return;
    try {
      await api(`/admin/support/cases/${activeCase.id}/messages`, { method: "POST", body: { message: reply } });
      setReply("");
      await load();
      showToast("Reply sent to student.", "success");
    } catch (error) {
      showToast(error.message || "Could not send reply", "error");
    }
  }

  async function updateCase(status) {
    if (!activeCase) return;
    try {
      await api(`/admin/support/cases/${activeCase.id}`, { method: "PATCH", body: { status } });
      await load();
      showToast(`Case marked ${formatAdminStatusLabel(status)}`, "success");
    } catch (error) {
      showToast(error.message || "Could not update case", "error");
    }
  }

  async function restoreAccess() {
    if (!activeCase) return;
    const confirmed = await showConfirm({
      title: "Restore student access?",
      message: "This will confirm payment, approve admission, activate the student account and resolve this support case.",
      confirmText: "Restore Access",
      danger: false
    });
    if (!confirmed) return;

    try {
      const result = await api(`/admin/support/cases/${activeCase.id}/restore-access`, {
        method: "POST",
        body: { message: "Your appeal has been reviewed. Your payment and admission have been approved. You can now access your CIBI learning portal." }
      });
      await load();
      showToast(result.message || "Student access restored.", "success");
    } catch (error) {
      showToast(error.message || "Could not restore access", "error");
    }
  }

  return (
    <section className="admin-section support-admin-panel support-admin-dashboard">
      <div className="content-editor-header students-admin-header">
        <div>
          <span>Support Inbox</span>
          <h2>Appeals & Support</h2>
          <p>Review student cases, restore access after successful appeal, reply to messages and keep resolved issues cleanly archived.</p>
        </div>
        <button className="gold-btn" type="button" onClick={load}>Refresh</button>
      </div>

      <div className="support-stats-grid">
        <button type="button" className={filter === "ACTIVE" ? "support-stat-card active-support-filter" : "support-stat-card"} onClick={() => setFilter("ACTIVE")}>
          <span>Active Issues</span><strong>{stats.active}</strong><small>Open / review / waiting</small>
        </button>
        <button type="button" className={filter === "OPEN" ? "support-stat-card active-support-filter" : "support-stat-card"} onClick={() => setFilter("OPEN")}>
          <span>New / Waiting Admin</span><strong>{stats.open}</strong><small>Needs admin action</small>
        </button>
        <button type="button" className={filter === "UNDER_REVIEW" ? "support-stat-card active-support-filter" : "support-stat-card"} onClick={() => setFilter("UNDER_REVIEW")}>
          <span>Under Review</span><strong>{stats.review}</strong><small>Being handled</small>
        </button>
        <button type="button" className={filter === "RESOLVED" ? "support-stat-card active-support-filter" : "support-stat-card"} onClick={() => setFilter("RESOLVED")}>
          <span>Resolved</span><strong>{stats.resolved}</strong><small>Completed cases</small>
        </button>
        <button type="button" className={filter === "ALL" ? "support-stat-card active-support-filter" : "support-stat-card"} onClick={() => setFilter("ALL")}>
          <span>All Cases</span><strong>{stats.total}</strong><small>Full history</small>
        </button>
      </div>

      {loading && <p>Loading support cases...</p>}
      {!loading && !cases.length && <div className="quiet-banner"><strong>No appeals yet.</strong><p>Rejected, suspended or pending students can submit appeal messages from their portal gate.</p></div>}

      <div className="support-admin-grid">
        <div className="support-admin-list">
          <div className="support-list-heading">
            <strong>{filter === "ACTIVE" ? "Active Cases" : `${formatAdminStatusLabel(filter)} Cases`}</strong>
            <span>{filteredCases.length} shown</span>
          </div>
          {filteredCases.map((item) => (
            <button key={item.id} type="button" className={activeCase?.id === item.id ? "active-admin-support-case" : ""} onClick={() => setActiveId(item.id)}>
              <strong>{item.subject}</strong>
              <span>{item.user?.name || "Student"}</span>
              <small>{formatAdminStatusLabel(item.status)} · {formatAdminStatusLabel(item.category)}</small>
            </button>
          ))}
          {!filteredCases.length && <p className="empty-small">No case in this filter.</p>}
        </div>

        {activeCase && (
          <div className="support-admin-thread">
            <div className="support-admin-case-head">
              <div>
                <span className={statusBadgeClass(activeCase.status)}>{formatAdminStatusLabel(activeCase.status)}</span>
                <h3>{activeCase.subject}</h3>
                <p>{activeCase.user?.name} · {activeCase.user?.email}</p>
                {activeCase.enrollment?.course && <p><strong>Programme:</strong> {activeCase.enrollment.course.title}</p>}
              </div>
              <div className="support-case-actions">
                {canRestoreAccess && <button className="gold-btn restore-access-btn" type="button" onClick={restoreAccess}>Restore Access & Resolve</button>}
                <button className="gold-btn" type="button" onClick={() => updateCase("UNDER_REVIEW")}>Under Review</button>
                <button className="dark-btn" type="button" onClick={() => updateCase("RESOLVED")}>Resolve Case Only</button>
                <button className="ghost-btn admin-cancel-btn" type="button" onClick={() => updateCase("CLOSED")}>Close</button>
              </div>
            </div>

            <div className="support-access-state-grid">
              <div><span>Account</span><strong>{formatAdminStatusLabel(activeCase.user?.status)}</strong></div>
              <div><span>Admission</span><strong>{formatAdminStatusLabel(activeCase.enrollment?.admissionStatus || "NO ENROLLMENT")}</strong></div>
              <div><span>Payment</span><strong>{formatAdminStatusLabel(activeCase.enrollment?.paymentStatus || "NO PAYMENT")}</strong></div>
              <div><span>Support Case</span><strong>{formatAdminStatusLabel(activeCase.status)}</strong></div>
            </div>

            {activeCase.enrollment && canRestoreAccess && (
              <div className="support-access-note">
                <strong>Access is still blocked.</strong>
                <p>Resolving a support case only closes the conversation. Use <b>Restore Access & Resolve</b> when admin has decided to approve the student after appeal.</p>
              </div>
            )}

            <div className="support-message-list admin-support-message-list">
              {(activeCase.messages || []).map((message) => (
                <div className={message.sender?.role === "ADMIN" ? "support-message admin-message" : "support-message student-message"} key={message.id}>
                  <strong>{message.sender?.role === "ADMIN" ? "CIBI Support" : message.sender?.name || "Student"}</strong>
                  <p>{message.message}</p>
                  <small>{new Date(message.createdAt).toLocaleString()}</small>
                </div>
              ))}
            </div>

            <form className="support-reply-form" onSubmit={sendReply}>
              <input placeholder="Reply student..." value={reply} onChange={(e) => setReply(e.target.value)} />
              <button className="gold-btn" type="submit"><Send size={14} /> Send Reply</button>
            </form>
          </div>
        )}
      </div>
    </section>
  );
}

function Overview({ overview }) {
  if (!overview) return <p>Loading overview...</p>;
  return (
    <div className="dashboard-grid">
      <DashboardCard icon={<Users />} label="Students" value={overview.students} />
      <DashboardCard icon={<ShoppingBag />} label="Books" value={overview.books} />
      <DashboardCard icon={<GraduationCap />} label="Courses" value={overview.courses} />
      <DashboardCard icon={<CreditCard />} label="Pending Approval" value={overview.pendingEnrollments} />
      <DashboardCard icon={<MessageCircle />} label="Open Support" value={overview.openSupport || 0} />
    </div>
  );
}


function formatAdminStatusLabel(value) {
  return String(value || "UNKNOWN").replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
}

function statusBadgeClass(value) {
  const status = String(value || "").toUpperCase();
  if (["ACTIVE", "APPROVED", "PAYMENT_CONFIRMED", "GRADUATED"].includes(status)) return "status-badge status-good";
  if (["MANUAL_PAYMENT_PENDING", "PENDING_PAYMENT", "AWAITING_PAYMENT", "AWAITING_ADMIN_APPROVAL", "PAYMENT_CONFIRMED"].includes(status)) return "status-badge status-waiting";
  if (["REJECTED", "SUSPENDED", "FAILED", "REFUNDED"].includes(status)) return "status-badge status-danger";
  return "status-badge";
}

function parseApplicationDetails(value) {
  if (!value) return {};
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

function applicationDetailRows(details = {}) {
  return [
    ["Learning Stream", details.learningStream],
    ["Ministry Role", details.ministryRole],
    ["Years in Ministry", details.yearsInMinistry],
    ["Current Church / Ministry", details.currentChurch],
    ["Educational Background", details.educationalBackground],
    ["Previous Ministry Experience", details.previousMinistryExperience],
    ["How They Heard", details.howDidYouHear],
    ["Personal Statement", details.personalStatement],
    ["Additional Questions", details.additionalQuestions]
  ].filter(([, value]) => value !== undefined && value !== null && String(value).trim());
}

function StudentsAdmin() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingStudentId, setEditingStudentId] = useState(null);
  const [studentForm, setStudentForm] = useState({ name: "", email: "", phone: "", country: "" });

  async function load() {
    try {
      setLoading(true);
      setStudents(await api("/admin/students"));
    } catch (error) {
      showToast(error.message || "Could not load students", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function startEditStudent(student) {
    setEditingStudentId(student.id);
    setStudentForm({
      name: student.name || "",
      email: student.email || "",
      phone: student.phone || "",
      country: student.country || ""
    });
  }

  function cancelEditStudent() {
    setEditingStudentId(null);
    setStudentForm({ name: "", email: "", phone: "", country: "" });
  }

  async function saveStudentDetails(e) {
    e.preventDefault();
    const fullName = String(studentForm.name || "").trim();
    if (!fullName || fullName.split(/\s+/).length < 2) {
      showToast("Please enter the student's full name before saving.", "error");
      return;
    }

    try {
      const result = await api(`/admin/students/${editingStudentId}`, { method: "PATCH", body: studentForm });
      showToast(result.message || "Student details updated", "success");
      cancelEditStudent();
      await load();
    } catch (error) {
      showToast(error.message || "Could not update student details", "error");
    }
  }

  async function accessAction(enrollment, actionName, extra = {}) {
    const prompts = {
      "send-payment-notice": { title: "Send payment notice?", message: "The student will see a payment notice inside the portal.", confirmText: "Send Notice" },
      "hide-payment-notice": { title: "Hide payment notice?", message: "The payment notice will be removed from the student portal.", confirmText: "Hide Notice" },
      "mark-payment-due": { title: "Mark payment due?", message: "Admin will see this as payment due. Student will not see notice until you send it.", confirmText: "Mark Due" },
      "block-access": { title: "Block student access?", message: "This will block the student's course access and show a notice.", confirmText: "Block Access", danger: true },
      "restore-access": { title: "Restore access?", message: "This will restore course access and hide payment notice.", confirmText: "Restore" },
      "confirm-next-payment": { title: "Confirm next payment?", message: "This will confirm payment and refresh the student's access period.", confirmText: "Confirm Payment" }
    };

    if (actionName === "promote-level") {
      const current = enrollment.currentLevelStage || "100 Level";
      const next = window.prompt("Enter next level/stage for this student:", current === "100 Level" ? "200 Level" : current);
      if (!next) return;
      extra.currentLevelStage = next;
    }

    const copy = prompts[actionName] || { title: "Update access?", message: "Continue with this action?", confirmText: "Continue" };
    if (!(await showConfirm(copy))) return;

    try {
      const result = await api(`/admin/enrollments/${enrollment.id}/access`, { method: "PATCH", body: { action: actionName, ...extra } });
      showToast(result.message || "Access updated", "success");
      await load();
    } catch (error) {
      showToast(error.message || "Could not update access", "error");
    }
  }

  async function action(enrollment, actionName) {
    const actionCopy = {
      approve: {
        title: "Approve student?",
        message: "This will confirm the payment, approve admission and open the student learning portal.",
        confirmText: "Approve"
      },
      reject: {
        title: "Reject admission?",
        message: "This will reject this student's admission request.",
        confirmText: "Reject",
        danger: true
      },
      suspend: {
        title: "Suspend student?",
        message: "This will block the student's portal access until you reactivate them.",
        confirmText: "Suspend",
        danger: true
      },
      graduate: {
        title: "Mark as graduated?",
        message: "Use this only after the student has completed the programme.",
        confirmText: "Graduate"
      }
    };

    const copy = actionCopy[actionName] || { title: "Confirm action?", message: "Continue with this action?", confirmText: "Continue" };
    if (!(await showConfirm(copy))) return;

    try {
      const result = await api(`/admin/enrollments/${enrollment.id}/status`, { method: "PATCH", body: { action: actionName } });
      showToast(result.message || "Student status updated", "success");
      await load();
    } catch (error) {
      showToast(error.message || "Could not update student status", "error");
    }
  }

  return (
    <section className="admin-section students-admin-polished">
      <div className="content-editor-header students-admin-header">
        <div>
          <span>Admissions</span>
          <h2>Admissions and Payments</h2>
          <p>Review payment receipts, confirm payment, approve portal access, suspend students or mark completed students as graduated.</p>
        </div>
        <button className="gold-btn" type="button" onClick={load}>Refresh</button>
      </div>

      {loading ? <p>Loading students...</p> : null}

      {!loading && !students.length ? (
        <div className="quiet-banner"><strong>No students yet.</strong><p>New student applications will appear here after registration.</p></div>
      ) : null}

      <div className="student-list admissions-list-polished">
        {students.map((student) => {
          const enrollments = student.enrollments || [];
          return (
            <div className="student-card admission-student-card" key={student.id}>
              <div className="student-card-top">
                <div>
                  <h3>{student.name}</h3>
                  <p>{student.email} · {student.phone || "No phone"}</p>
                </div>
                <div className="student-card-actions-top">
                  <span className={statusBadgeClass(student.status)}>{formatAdminStatusLabel(student.status)}</span>
                  <button className="edit-btn" type="button" onClick={() => startEditStudent(student)}>Edit Details</button>
                </div>
              </div>

              {editingStudentId === student.id ? (
                <form className="admin-form admin-student-edit-form" onSubmit={saveStudentDetails}>
                  <div className="form-row two-columns">
                    <input placeholder="Full name" value={studentForm.name} onChange={(e) => setStudentForm({ ...studentForm, name: e.target.value })} required />
                    <input type="email" placeholder="Email address" value={studentForm.email} onChange={(e) => setStudentForm({ ...studentForm, email: e.target.value })} required />
                  </div>
                  <div className="form-row two-columns">
                    <input placeholder="Phone number" value={studentForm.phone} onChange={(e) => setStudentForm({ ...studentForm, phone: e.target.value })} />
                    <input placeholder="Country" value={studentForm.country} onChange={(e) => setStudentForm({ ...studentForm, country: e.target.value })} />
                  </div>
                  <div className="form-row">
                    <button className="gold-btn" type="submit">Save Student Details</button>
                    <button className="ghost-btn admin-cancel-btn" type="button" onClick={cancelEditStudent}>Cancel</button>
                  </div>
                  <p className="empty-small">Status is controlled by approve, reject, suspend and graduate actions. This form only updates personal details.</p>
                </form>
              ) : null}

              {!enrollments.length ? <p className="empty-small">This student has not selected a programme or submitted payment yet.</p> : null}

              {enrollments.map((enrollment) => {
                const paymentConfirmed = enrollment.paymentStatus === "PAYMENT_CONFIRMED";
                const approved = enrollment.admissionStatus === "APPROVED";
                const rejected = enrollment.admissionStatus === "REJECTED";
                const suspended = enrollment.admissionStatus === "SUSPENDED";
                const graduated = enrollment.admissionStatus === "GRADUATED";
                const canApprove = !graduated && (!approved || !paymentConfirmed);
                const canReject = !rejected && !graduated;
                const canSuspend = !suspended && !graduated;
                const canGraduate = approved && paymentConfirmed && !graduated;
                const applicationDetails = parseApplicationDetails(enrollment.applicationJson);
                const applicationRows = applicationDetailRows({
                  ...applicationDetails,
                  learningStream: enrollment.learningStream || applicationDetails.learningStream
                });

                return (
                  <div className="enrollment-box enrollment-box-polished" key={enrollment.id}>
                    <div className="enrollment-summary-row">
                      <div>
                        <span>Programme</span>
                        <strong>{enrollment.course?.title || "Course not found"}</strong>
                      </div>
                      <div>
                        <span>Learning Stream</span>
                        <strong>{enrollment.learningStream || applicationDetails.learningStream || "Not selected"}</strong>
                      </div>
                      <div>
                        <span>Amount</span>
                        <strong>₦{Number(enrollment.amount || 0).toLocaleString()}</strong>
                      </div>
                    </div>

                    {applicationRows.length ? (
                      <details className="application-details-box">
                        <summary>View Application Form Details</summary>
                        <div className="application-details-grid">
                          {applicationRows.map(([label, value]) => (
                            <div key={label}>
                              <span>{label}</span>
                              <p>{value}</p>
                            </div>
                          ))}
                        </div>
                      </details>
                    ) : null}

                    <div className="enrollment-status-grid">
                      <div><small>Payment</small><span className={statusBadgeClass(enrollment.paymentStatus)}>{formatAdminStatusLabel(enrollment.paymentStatus)}</span></div>
                      <div><small>Admission</small><span className={statusBadgeClass(enrollment.admissionStatus)}>{formatAdminStatusLabel(enrollment.admissionStatus)}</span></div>
                      <div><small>Method</small><strong>{formatAdminStatusLabel(enrollment.paymentMethod)}</strong></div>
                      <div><small>Reference</small><strong>{enrollment.paystackReference || enrollment.manualReference || "None"}</strong></div>
                    </div>

                    <div className="enrollment-access-grid">
                      <div><small>Access</small><strong>{formatAdminStatusLabel(enrollment.accessStatus || "ACTIVE")}</strong></div>
                      <div><small>Current Level</small><strong>{enrollment.currentLevelStage || "Not set"}</strong></div>
                      <div><small>Paid Until</small><strong>{enrollment.paidUntil ? new Date(enrollment.paidUntil).toLocaleDateString() : "Not set"}</strong></div>
                      <div><small>Student Notice</small><strong>{enrollment.studentPaymentNotice ? "Visible" : "Hidden"}</strong></div>
                    </div>

                    {enrollment.studentPaymentNotice ? (
                      <div className="admin-payment-notice-preview">
                        <strong>Student payment notice</strong>
                        <p>{enrollment.studentPaymentNoticeMessage || "Payment notice is visible to this student."}</p>
                      </div>
                    ) : null}

                    <div className="payment-proof-row">
                      {enrollment.paymentProofUrl ? (
                        <a className="proof-btn" href={enrollment.paymentProofUrl} target="_blank" rel="noreferrer">View Payment Receipt</a>
                      ) : (
                        <span className="no-proof-note">No receipt uploaded</span>
                      )}
                    </div>

                    <div className="student-action-row">
                      {canApprove ? <button className="gold-btn" type="button" onClick={() => action(enrollment, "approve")}>Approve & Confirm Payment</button> : null}
                      {canReject ? <button className="ghost-btn admin-cancel-btn" type="button" onClick={() => action(enrollment, "reject")}>Reject</button> : null}
                      {canSuspend ? <button className="dark-btn" type="button" onClick={() => action(enrollment, "suspend")}>Suspend</button> : null}
                      {canGraduate ? <button className="ghost-btn admin-cancel-btn" type="button" onClick={() => action(enrollment, "graduate")}>Graduate</button> : null}
                      <button className="ghost-btn admin-cancel-btn" type="button" onClick={() => accessAction(enrollment, "promote-level")}>Promote Level</button>
                      <button className="ghost-btn admin-cancel-btn" type="button" onClick={() => accessAction(enrollment, "mark-payment-due")}>Mark Payment Due</button>
                      <button className="ghost-btn admin-cancel-btn" type="button" onClick={() => accessAction(enrollment, "send-payment-notice")}>Send Payment Notice</button>
                      {enrollment.studentPaymentNotice ? <button className="ghost-btn admin-cancel-btn" type="button" onClick={() => accessAction(enrollment, "hide-payment-notice")}>Hide Notice</button> : null}
                      <button className="gold-btn" type="button" onClick={() => accessAction(enrollment, "confirm-next-payment")}>Confirm Next Payment</button>
                      <button className="dark-btn" type="button" onClick={() => accessAction(enrollment, enrollment.accessStatus === "BLOCKED" ? "restore-access" : "block-access")}>{enrollment.accessStatus === "BLOCKED" ? "Restore Access" : "Block Access"}</button>
                      {graduated ? <span className="status-badge status-good">Graduated</span> : null}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </section>
  );
}

const bookFields = [
  ["title", "Book title"], ["author", "Author"], ["category", "Category"], ["price", "Price e.g ₦8,500"], ["buyLink", "Stellar purchase link"], ["imageUrl", "Book cover image URL"], ["description", "Description", "textarea"]
];
const programmeFields = [
  ["title", "Programme title"], ["level", "Level e.g Foundation"], ["duration", "Duration e.g 12 Months"], ["feeUsd", "Fee in USD e.g 50", "number"], ["currency", "Currency e.g USD"], ["fee", "Local payment backup e.g 75000", "number"], ["paymentPlan", "Payment plan: ONE_TIME, YEARLY or CONTACT_ADMIN"], ["paymentCycleMonths", "Payment cycle months e.g 12", "number"], ["defaultLevelStage", "Default student level/stage e.g 100 Level"], ["certification", "Certificate name"], ["imageUrl", "Image URL"], ["description", "Description", "textarea"]
];
const courseFields = [
  ["title", "Course title"], ["level", "Level"], ["duration", "Duration e.g 12 Months"], ["feeUsd", "Fee in USD e.g 50", "number"], ["currency", "Currency e.g USD"], ["fee", "Local payment backup e.g 75000", "number"], ["imageUrl", "Image URL"], ["description", "Description", "textarea"]
];
const slideFields = [
  ["eyebrow", "Small heading"], ["title", "Slide title"], ["description", "Description", "textarea"], ["imageUrl", "Image URL"], ["ctaText", "CTA text"], ["ctaPage", "CTA page e.g admissions"], ["slideOrder", "Order", "number"]
];
const announcementFields = [["title", "Title"], ["body", "Message", "textarea"]];
const galleryFields = [["title", "Image title"], ["category", "Category"], ["imageUrl", "Image URL"], ["description", "Description", "textarea"]];


function SlidesAdmin({ reloadPublic }) {
  const empty = { eyebrow: "", title: "", description: "", imageUrl: "", ctaText: "Apply Now", ctaPage: "admissions", slideOrder: 1 };
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState(null);

  async function load() {
    const result = await api("/admin/slides");
    setItems([...result].sort((a, b) => Number(a.slideOrder || 0) - Number(b.slideOrder || 0)));
  }

  useEffect(() => { load(); }, []);

  function startEdit(item) {
    setForm({
      eyebrow: item.eyebrow || "",
      title: item.title || "",
      description: item.description || "",
      imageUrl: item.imageUrl || "",
      ctaText: item.ctaText || "Apply Now",
      ctaPage: item.ctaPage || "admissions",
      slideOrder: Number(item.slideOrder || 1)
    });
    setEditingId(item.id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function createSlot(order) {
    const fallback = DEFAULT_SLIDES[order - 1] || DEFAULT_SLIDES[0];
    setForm({
      eyebrow: fallback.eyebrow || "",
      title: fallback.title || "",
      description: fallback.description || "",
      imageUrl: fallback.imageUrl || "",
      ctaText: fallback.ctaText || "Apply Now",
      ctaPage: fallback.ctaPage || "admissions",
      slideOrder: order
    });
    setEditingId(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEdit() {
    setForm(empty);
    setEditingId(null);
  }

  async function submit(e) {
    e.preventDefault();
    const payload = { ...form, slideOrder: Number(form.slideOrder || 1) };

    if (editingId) {
      await api(`/admin/slides/${editingId}`, { method: "PATCH", body: payload });
    } else {
      await api("/admin/slides", { method: "POST", body: payload });
    }

    const wasEditing = Boolean(editingId);
    setForm(empty);
    setEditingId(null);
    await load();
    await reloadPublic();
    showToast(wasEditing ? `${title} updated successfully` : `${title} added successfully`, "success");
  }

  async function remove(id) {
    if (!(await showConfirm({ title: "Delete homepage slide?", message: "This slide will be removed from the homepage slider.", confirmText: "Delete", danger: true }))) return;
    await api(`/admin/slides/${id}`, { method: "DELETE" });
    if (editingId === id) cancelEdit();
    await load();
    await reloadPublic();
  }

  const slots = [1, 2, 3, 4].map((order) => items.find((item) => Number(item.slideOrder) === order) || null);

  return (
    <section className="admin-section slider-admin-section">
      <div className="slider-admin-note">
        <h2>Homepage Hero Slider</h2>
        <p>Edit the 4 big homepage slides here. Each slide controls the image, small heading, title, description and button on the homepage hero.</p>
        <strong>Slide Order 1 controls Slide 01, Order 2 controls Slide 02, Order 3 controls Slide 03 and Order 4 controls Slide 04. Missing slots use the safe default image only until admin creates them.</strong>
      </div>

      <form className="admin-form slider-editor-form" onSubmit={submit}>
        <h3>{editingId ? `Editing Slide ${String(form.slideOrder).padStart(2, "0")}` : `Create / Replace Slide ${String(form.slideOrder).padStart(2, "0")}`}</h3>
        <select value={form.slideOrder} onChange={(e) => setForm({ ...form, slideOrder: Number(e.target.value) })} required>
          <option value={1}>Slide 01</option>
          <option value={2}>Slide 02</option>
          <option value={3}>Slide 03</option>
          <option value={4}>Slide 04</option>
        </select>
        <input placeholder="Small heading e.g Flagship Program" value={form.eyebrow} onChange={(e) => setForm({ ...form, eyebrow: e.target.value })} required />
        <input placeholder="Slide title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
        <textarea placeholder="Slide description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required />
        <input placeholder="Slide image URL" value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} required />
        {form.imageUrl && <img className="slide-form-preview" src={form.imageUrl} alt="Slide preview" />}
        <div className="form-row two-columns">
          <input placeholder="CTA text e.g Apply Now" value={form.ctaText} onChange={(e) => setForm({ ...form, ctaText: e.target.value })} />
          <input placeholder="CTA page e.g admissions, programs, library" value={form.ctaPage} onChange={(e) => setForm({ ...form, ctaPage: e.target.value })} />
        </div>
        <div className="form-row">
          <button className="gold-btn" type="submit">{editingId ? "Update Slide" : "Save Slide"}</button>
          <button className="ghost-btn admin-cancel-btn" type="button" onClick={cancelEdit}>Clear Form</button>
        </div>
      </form>

      <div className="slider-slot-grid">
        {slots.map((item, index) => {
          const order = index + 1;
          return (
            <div className={item ? "slider-slot-card" : "slider-slot-card empty-slot"} key={order}>
              {item?.imageUrl ? <img src={item.imageUrl} alt={item.title} /> : <div className="slot-placeholder">No image</div>}
              <div className="slider-slot-body">
                <span>Slide {String(order).padStart(2, "0")}</span>
                <h3>{item?.title || "Empty slide slot"}</h3>
                <p>{item?.eyebrow || "Create this slide for the homepage hero."}</p>
                <div className="admin-item-actions">
                  {item ? (
                    <>
                      <button className="edit-btn" type="button" onClick={() => startEdit(item)}>Edit</button>
                      <button className="delete-btn" type="button" onClick={() => remove(item.id)}><Trash2 size={18} /></button>
                    </>
                  ) : (
                    <button className="gold-btn" type="button" onClick={() => createSlot(order)}>Create Slide {String(order).padStart(2, "0")}</button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}


function CoursesAdmin({ reloadPublic }) {
  const empty = { programmeId: "", title: "", level: "Course", levelStage: "", generalForAllProgrammes: false, duration: "", feeUsd: 0, currency: "USD", fee: 0, imageUrl: "", description: "" };
  const [items, setItems] = useState([]);
  const [programmes, setProgrammes] = useState([]);
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState(null);

  async function load() {
    const [courseRows, programmeRows] = await Promise.all([api("/admin/courses"), api("/admin/programmes")]);
    setItems(courseRows || []);
    setProgrammes(programmeRows || []);
    if (!form.programmeId && programmeRows?.[0]?.id) setForm((current) => ({ ...current, programmeId: current.programmeId || programmeRows[0].id }));
  }

  useEffect(() => { load().catch((error) => showToast(error.message, "error")); }, []);

  function startEdit(item) {
    setForm({
      programmeId: item.programmeId || "",
      title: item.title || "",
      level: item.level || "Course",
      duration: item.duration || "",
      levelStage: item.levelStage || "",
      generalForAllProgrammes: Boolean(item.generalForAllProgrammes),
      feeUsd: Number(item.feeUsd || 0),
      currency: item.currency || "USD",
      fee: Number(item.fee || 0),
      imageUrl: item.imageUrl || "",
      description: item.description || ""
    });
    setEditingId(item.id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEdit() {
    setForm({ ...empty, programmeId: programmes[0]?.id || "" });
    setEditingId(null);
  }

  async function submit(e) {
    e.preventDefault();
    if (!form.programmeId && !form.generalForAllProgrammes) {
      showToast("Create/select a programme before adding a course, or mark the course as general for all programmes.", "error");
      return;
    }
    const payload = {
      ...form,
      programmeId: form.generalForAllProgrammes ? null : Number(form.programmeId),
      generalForAllProgrammes: Boolean(form.generalForAllProgrammes),
      feeUsd: Number(form.feeUsd || 0),
      fee: Number(form.fee || 0)
    };
    if (editingId) await api(`/admin/courses/${editingId}`, { method: "PATCH", body: payload });
    else await api("/admin/courses", { method: "POST", body: payload });
    cancelEdit();
    await load();
    await reloadPublic();
    showToast(editingId ? "Course updated." : "Course added under programme.", "success");
  }

  async function remove(id) {
    if (!(await showConfirm({ title: "Delete course?", message: "This course will be removed from its programme.", confirmText: "Delete", danger: true }))) return;
    await api(`/admin/courses/${id}`, { method: "DELETE" });
    if (editingId === id) cancelEdit();
    await load();
    await reloadPublic();
  }

  return (
    <section className="admin-section">
      <h2>{editingId ? "Edit Course" : "Courses Under Programmes"}</h2>
      <p className="admin-helper-text">Create programmes first, then attach each course to the correct programme. Student access follows the programme selected on the Admission page.</p>
      {!programmes.length && <div className="quiet-banner"><strong>No programme yet.</strong><p>Add programmes from the Programmes tab before adding courses.</p></div>}
      <form className="admin-form" onSubmit={submit}>
        <select value={form.programmeId} onChange={(e) => setForm({ ...form, programmeId: e.target.value })} required={!form.generalForAllProgrammes} disabled={form.generalForAllProgrammes}>
          <option value="">Select programme</option>
          {programmes.map((programme) => <option key={programme.id} value={programme.id}>{programme.title}</option>)}
        </select>
        <input placeholder="Course title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
        <input placeholder="Level" value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })} required />
        <input placeholder="Level/Stage e.g 100 Level, 200 Level, General" value={form.levelStage} onChange={(e) => setForm({ ...form, levelStage: e.target.value })} />
        <label className="admin-checkbox-row">
          <input type="checkbox" checked={Boolean(form.generalForAllProgrammes)} onChange={(e) => setForm({ ...form, generalForAllProgrammes: e.target.checked, programmeId: e.target.checked ? "" : form.programmeId })} />
          <span>General compulsory course for all programmes</span>
        </label>
        <input placeholder="Duration e.g 12 Weeks" value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} />
        <div className="form-row two-columns">
          <input type="number" placeholder="Fee in USD, optional" value={form.feeUsd} onChange={(e) => setForm({ ...form, feeUsd: e.target.value })} />
          <input type="number" placeholder="Local fee backup, optional" value={form.fee} onChange={(e) => setForm({ ...form, fee: e.target.value })} />
        </div>
        <input placeholder="Currency e.g USD" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} />
        <input placeholder="Image URL" value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} />
        <textarea placeholder="Course description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required />
        <div className="form-row">
          <button className="gold-btn" type="submit">{editingId ? "Update Course" : "Add Course"}</button>
          {editingId && <button className="ghost-btn" type="button" onClick={cancelEdit}>Cancel Edit</button>}
        </div>
      </form>
      <div className="admin-list">
        {items.map((item) => (
          <div key={item.id} className="admin-list-item">
            <div>
              <strong>{item.title}</strong>
              <p>{item.generalForAllProgrammes ? "General for all programmes" : item.programme?.title || "No programme attached"} · {item.level}{item.levelStage ? ` · ${item.levelStage}` : ""}</p>
            </div>
            <div>
              <button className="ghost-btn" type="button" onClick={() => startEdit(item)}>Edit</button>
              <button className="danger-action-btn" type="button" onClick={() => remove(item.id)}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function CrudAdmin({ title, path, fields, reloadPublic }) {
  const empty = Object.fromEntries(fields.map(([name]) => [name, ""]));
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState(null);

  async function load() { setItems(await api(`/admin/${path}`)); }
  useEffect(() => { load(); }, []);

  function startEdit(item) {
    const nextForm = { ...empty };
    fields.forEach(([name]) => {
      nextForm[name] = item[name] ?? "";
    });
    setForm(nextForm);
    setEditingId(item.id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEdit() {
    setForm(empty);
    setEditingId(null);
  }

  async function submit(e) {
    e.preventDefault();
    const payload = { ...form };
    fields.forEach(([name, _label, type]) => {
      if (type === "number") payload[name] = Number(payload[name] || 0);
    });

    if (editingId) {
      await api(`/admin/${path}/${editingId}`, { method: "PATCH", body: payload });
    } else {
      await api(`/admin/${path}`, { method: "POST", body: payload });
    }

    setForm(empty);
    setEditingId(null);
    await load();
    await reloadPublic();
  }

  async function remove(id) {
    if (!(await showConfirm({ title: `Delete ${title}?`, message: "This item will be removed. This action cannot be undone.", confirmText: "Delete", danger: true }))) return;
    await api(`/admin/${path}/${id}`, { method: "DELETE" });
    if (editingId === id) cancelEdit();
    await load();
    await reloadPublic();
    showToast(`${title} deleted successfully`, "success");
  }

  return (
    <section className="admin-section">
      <h2>{editingId ? `Edit ${title}` : title}</h2>
      <form className="admin-form" onSubmit={submit}>
        {fields.map(([name, label, type]) => type === "textarea" ? <textarea key={name} placeholder={label} value={form[name]} onChange={(e) => setForm({ ...form, [name]: e.target.value })} /> : <input key={name} type={type || "text"} placeholder={label} value={form[name]} onChange={(e) => setForm({ ...form, [name]: e.target.value })} required={name !== "imageUrl" && name !== "ctaText" && name !== "ctaPage"} />)}
        <div className="form-row">
          <button className="gold-btn" type="submit">{editingId ? `Update ${title}` : `Add ${title}`}</button>
          {editingId && <button className="ghost-btn" type="button" onClick={cancelEdit}>Cancel Edit</button>}
        </div>
      </form>
      <AdminList items={items} onDelete={remove} onEdit={startEdit} />
    </section>
  );
}

function CourseBuilderAdmin({ reloadPublic = async () => {}, currentUser = null }) {
  const blankModule = { title: "", description: "", moduleOrder: 1, published: true };
  const blankLesson = { moduleId: "", title: "", videoUrl: "", notesUrl: "", duration: "", lessonOrder: 1, completionPercentRequired: 90, required: true, published: true };
  const [courses, setCourses] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [moduleForm, setModuleForm] = useState(blankModule);
  const [lessonForm, setLessonForm] = useState(blankLesson);
  const [editingModuleId, setEditingModuleId] = useState(null);
  const [editingLessonId, setEditingLessonId] = useState(null);
  const [previewLesson, setPreviewLesson] = useState(null);
  const [statusMessage, setStatusMessage] = useState("");

  async function load() {
    const result = await api("/admin/course-builder");
    setCourses(result);
    if (!selectedCourseId && result[0]?.id) setSelectedCourseId(String(result[0].id));
  }

  useEffect(() => { load(); }, []);

  const selectedCourse = courses.find((course) => String(course.id) === String(selectedCourseId));
  const sortedModules = [...(selectedCourse?.modules || [])].sort((a, b) => Number(a.moduleOrder || 0) - Number(b.moduleOrder || 0));
  const moduleLessonIds = new Set(sortedModules.flatMap((module) => (module.lessons || []).map((lesson) => lesson.id)));
  const generalLessons = [...(selectedCourse?.lessons || [])]
    .filter((lesson) => !moduleLessonIds.has(lesson.id))
    .sort((a, b) => Number(a.lessonOrder || 0) - Number(b.lessonOrder || 0));

  function resetModuleForm(nextOrder = 1) {
    setModuleForm({ ...blankModule, moduleOrder: nextOrder });
    setEditingModuleId(null);
  }

  function resetLessonForm(nextOrder = 1, moduleId = lessonForm.moduleId || "") {
    setLessonForm({ ...blankLesson, moduleId, lessonOrder: nextOrder });
    setEditingLessonId(null);
  }

  function startEditModule(module) {
    setModuleForm({
      title: module.title || "",
      description: module.description || "",
      moduleOrder: Number(module.moduleOrder || 1),
      published: module.published !== false
    });
    setEditingModuleId(module.id);
    setStatusMessage(`Editing module: ${module.title}`);
  }

  function startEditLesson(lesson) {
    setLessonForm({
      moduleId: lesson.moduleId ? String(lesson.moduleId) : "",
      title: lesson.title || "",
      videoUrl: lesson.videoUrl || "",
      notesUrl: lesson.notesUrl || "",
      duration: lesson.duration || "",
      lessonOrder: Number(lesson.lessonOrder || 1),
      completionPercentRequired: Number(lesson.completionPercentRequired || 90),
      required: lesson.required !== false,
      published: lesson.published !== false
    });
    setEditingLessonId(lesson.id);
    setPreviewLesson(lesson.videoUrl ? lesson : null);
    setStatusMessage(`Editing lesson: ${lesson.title}`);
  }

  async function saveAndReload(message) {
    await load();
    await reloadPublic();
    setStatusMessage(message);
    showToast(message, "success");
  }

  async function saveModule(e) {
    e.preventDefault();
    if (!selectedCourseId) { showToast("Select a course first.", "error"); return; }
    const payload = {
      courseId: selectedCourseId,
      title: moduleForm.title,
      description: moduleForm.description,
      moduleOrder: Number(moduleForm.moduleOrder || 1),
      published: moduleForm.published
    };

    if (editingModuleId) {
      await api(`/admin/modules/${editingModuleId}`, { method: "PATCH", body: payload });
    } else {
      await api("/admin/modules", { method: "POST", body: payload });
    }

    resetModuleForm(Number(moduleForm.moduleOrder || 1) + 1);
    await saveAndReload(editingModuleId ? "Module updated" : "Module added");
  }

  async function deleteModule(id) {
    if (!(await showConfirm({ title: "Delete module?", message: "Lessons under this module will move to General Lessons.", confirmText: "Delete", danger: true }))) return;
    await api(`/admin/modules/${id}`, { method: "DELETE" });
    if (editingModuleId === id) resetModuleForm();
    await saveAndReload("Module deleted");
  }

  async function toggleModule(module) {
    await api(`/admin/modules/${module.id}`, { method: "PATCH", body: { published: module.published === false } });
    await saveAndReload(module.published === false ? "Module published" : "Module hidden from students");
  }

  async function moveModule(module, direction) {
    const index = sortedModules.findIndex((item) => item.id === module.id);
    const target = sortedModules[index + direction];
    if (!target) return;
    await Promise.all([
      api(`/admin/modules/${module.id}`, { method: "PATCH", body: { moduleOrder: Number(target.moduleOrder || 1) } }),
      api(`/admin/modules/${target.id}`, { method: "PATCH", body: { moduleOrder: Number(module.moduleOrder || 1) } })
    ]);
    await saveAndReload("Module order updated");
  }

  function buildLessonPayload(lessonLike, overrides = {}) {
    return {
      courseId: selectedCourseId,
      moduleId: lessonLike.moduleId ? String(lessonLike.moduleId) : "",
      title: lessonLike.title || "",
      videoUrl: lessonLike.videoUrl || "",
      notesUrl: lessonLike.notesUrl || "",
      duration: lessonLike.duration || "",
      lessonOrder: Number(lessonLike.lessonOrder || 1),
      completionPercentRequired: Number(lessonLike.completionPercentRequired || 90),
      required: lessonLike.required !== false,
      published: lessonLike.published !== false,
      ...overrides
    };
  }

  async function saveLesson(e) {
    e.preventDefault();
    if (!selectedCourseId) { showToast("Select a course first.", "error"); return; }
    const payload = buildLessonPayload(lessonForm);

    if (editingLessonId) {
      await api(`/admin/lessons/${editingLessonId}`, { method: "PATCH", body: payload });
    } else {
      await api("/admin/lessons", { method: "POST", body: payload });
    }

    resetLessonForm(Number(lessonForm.lessonOrder || 1) + 1, lessonForm.moduleId);
    setPreviewLesson(null);
    await saveAndReload(editingLessonId ? "Lesson updated" : "Lesson added");
  }

  async function deleteLesson(id) {
    if (!(await showConfirm({ title: "Delete lesson?", message: "This lesson will be removed from the course builder.", confirmText: "Delete", danger: true }))) return;
    await api(`/admin/lessons/${id}`, { method: "DELETE" });
    if (editingLessonId === id) resetLessonForm();
    await saveAndReload("Lesson deleted");
  }

  async function toggleLesson(lesson) {
    await api(`/admin/lessons/${lesson.id}`, {
      method: "PATCH",
      body: buildLessonPayload(lesson, { published: lesson.published === false })
    });
    await saveAndReload(lesson.published === false ? "Lesson published" : "Lesson hidden from students");
  }

  async function moveLesson(lesson, lessonList, direction) {
    const index = lessonList.findIndex((item) => item.id === lesson.id);
    const target = lessonList[index + direction];
    if (!target) return;
    await Promise.all([
      api(`/admin/lessons/${lesson.id}`, { method: "PATCH", body: buildLessonPayload(lesson, { lessonOrder: Number(target.lessonOrder || 1) }) }),
      api(`/admin/lessons/${target.id}`, { method: "PATCH", body: buildLessonPayload(target, { lessonOrder: Number(lesson.lessonOrder || 1) }) })
    ]);
    await saveAndReload("Lesson order updated");
  }

  function renderLessonRow(lesson, lessonList) {
    const isHidden = lesson.published === false;
    return (
      <div className={isHidden ? "builder-lesson-row builder-row-muted" : "builder-lesson-row"} key={lesson.id}>
        <div>
          <strong>{lesson.lessonOrder}. {lesson.title}</strong>
          <small>{lesson.duration || "Video lesson"} · {lesson.required ? "Required" : "Optional"} · {lesson.completionPercentRequired || 90}% · {isHidden ? "Hidden" : "Published"}</small>
        </div>
        <div className="builder-row-actions">
          <button type="button" className="edit-btn" onClick={() => startEditLesson(lesson)}>Edit</button>
          <button type="button" className="ghost-btn admin-cancel-btn mini-btn" onClick={() => moveLesson(lesson, lessonList, -1)}>↑</button>
          <button type="button" className="ghost-btn admin-cancel-btn mini-btn" onClick={() => moveLesson(lesson, lessonList, 1)}>↓</button>
          <button type="button" className="ghost-btn admin-cancel-btn mini-btn" onClick={() => setPreviewLesson(lesson)}>Preview</button>
          <button type="button" className="dark-btn mini-btn" onClick={() => toggleLesson(lesson)}>{isHidden ? "Publish" : "Hide"}</button>
          <button type="button" className="delete-btn" onClick={() => deleteLesson(lesson.id)}><Trash2 size={16} /></button>
        </div>
      </div>
    );
  }

  return (
    <section className="admin-section course-builder-admin course-builder-polish">
      <div className="content-editor-header">
        <div>
          <span>LMS Builder</span>
          <h2>Course Builder</h2>
          <p>Create modules/stages, edit lessons, preview videos, publish/hide content and control learning order.</p>
        </div>
        <button className="gold-btn" type="button" onClick={load}>Refresh</button>
      </div>

      <div className="admin-form builder-course-select">
        <select value={selectedCourseId} onChange={(e) => { setSelectedCourseId(e.target.value); resetModuleForm(); resetLessonForm(1, ""); setPreviewLesson(null); }}>
          <option value="">Select programme/course</option>
          {courses.map((course) => <option key={course.id} value={String(course.id)}>{course.title}</option>)}
        </select>
      </div>

      {statusMessage && <p className="editing-note">{statusMessage}</p>}

      {selectedCourse && (
        <div className="builder-layout builder-layout-polished">
          <div className="builder-forms">
            <form className="admin-form builder-box builder-editor-card" onSubmit={saveModule}>
              <div className="builder-form-title-row">
                <h3>{editingModuleId ? "Edit Module / Stage" : "Add Module / Stage"}</h3>
                {editingModuleId && <button type="button" className="ghost-btn admin-cancel-btn mini-btn" onClick={() => resetModuleForm()}>Cancel</button>}
              </div>
              <input placeholder="Module title e.g Stage 1: Foundations" value={moduleForm.title} onChange={(e) => setModuleForm({ ...moduleForm, title: e.target.value })} required />
              <textarea placeholder="Module description" value={moduleForm.description} onChange={(e) => setModuleForm({ ...moduleForm, description: e.target.value })} />
              <input type="number" placeholder="Module order" value={moduleForm.moduleOrder} onChange={(e) => setModuleForm({ ...moduleForm, moduleOrder: Number(e.target.value) })} />
              <label className="checkbox-field"><input type="checkbox" checked={moduleForm.published} onChange={(e) => setModuleForm({ ...moduleForm, published: e.target.checked })} /> Show this module to students</label>
              <button className="gold-btn" type="submit">{editingModuleId ? "Update Module" : "Add Module"}</button>
            </form>

            <form className="admin-form builder-box builder-editor-card" onSubmit={saveLesson}>
              <div className="builder-form-title-row">
                <h3>{editingLessonId ? "Edit Video Lesson" : "Add Video Lesson"}</h3>
                {editingLessonId && <button type="button" className="ghost-btn admin-cancel-btn mini-btn" onClick={() => { resetLessonForm(); setPreviewLesson(null); }}>Cancel</button>}
              </div>
              <select value={lessonForm.moduleId} onChange={(e) => setLessonForm({ ...lessonForm, moduleId: e.target.value })}>
                <option value="">General Lessons / No Module</option>
                {sortedModules.map((module) => <option key={module.id} value={module.id}>{module.moduleOrder}. {module.title}</option>)}
              </select>
              <input placeholder="Lesson title" value={lessonForm.title} onChange={(e) => setLessonForm({ ...lessonForm, title: e.target.value })} required />
              <input placeholder="Video link or embed code" value={lessonForm.videoUrl} onChange={(e) => setLessonForm({ ...lessonForm, videoUrl: e.target.value })} />
              <input placeholder="Notes/PDF link optional" value={lessonForm.notesUrl} onChange={(e) => setLessonForm({ ...lessonForm, notesUrl: e.target.value })} />
              <div className="form-row builder-three-cols">
                <input type="text" placeholder="Duration e.g 18 mins" value={lessonForm.duration} onChange={(e) => setLessonForm({ ...lessonForm, duration: e.target.value })} />
                <input type="number" placeholder="Lesson order" value={lessonForm.lessonOrder} onChange={(e) => setLessonForm({ ...lessonForm, lessonOrder: Number(e.target.value) })} />
                <input type="number" placeholder="Completion %" value={lessonForm.completionPercentRequired} onChange={(e) => setLessonForm({ ...lessonForm, completionPercentRequired: Number(e.target.value) })} />
              </div>
              <label className="checkbox-field"><input type="checkbox" checked={lessonForm.required} onChange={(e) => setLessonForm({ ...lessonForm, required: e.target.checked })} /> Required before next lesson opens</label>
              <label className="checkbox-field"><input type="checkbox" checked={lessonForm.published} onChange={(e) => setLessonForm({ ...lessonForm, published: e.target.checked })} /> Show this lesson to students</label>
              {lessonForm.videoUrl && <div className="admin-video-preview builder-form-preview"><PortalVideoPlayer url={lessonForm.videoUrl} title={lessonForm.title || "Lesson preview"} /></div>}
              <button className="gold-btn" type="submit">{editingLessonId ? "Update Lesson" : "Add Lesson"}</button>
            </form>
          </div>

          <div className="builder-preview builder-preview-polished">
            <div className="builder-course-head">
              <span>{selectedCourse.level || "Programme"}</span>
              <h3>{selectedCourse.title}</h3>
              <p>{selectedCourse.description}</p>
            </div>

            <CourseLiveManager course={selectedCourse} onReload={load} />
            <CourseVideosPanel course={selectedCourse} canManage={isPowerAdmin(currentUser) || currentUser?.role === "LECTURER"} onReload={load} />

            {sortedModules.length === 0 && generalLessons.length === 0 && <div className="quiet-banner"><strong>No modules or lessons yet.</strong><p>Add Stage 1, Stage 2, Stage 3, then add lessons inside each stage.</p></div>}

            {sortedModules.map((module, moduleIndex) => {
              const lessons = [...(module.lessons || [])].sort((a, b) => Number(a.lessonOrder || 0) - Number(b.lessonOrder || 0));
              const isHidden = module.published === false;
              return (
                <div className={isHidden ? "builder-module-card builder-row-muted" : "builder-module-card"} key={module.id}>
                  <div className="module-title-row builder-module-title-row">
                    <div>
                      <strong>{module.moduleOrder}. {module.title}</strong>
                      <small>{module.description || "No description"} · {isHidden ? "Hidden from students" : "Published"}</small>
                    </div>
                    <div className="builder-row-actions">
                      <button type="button" className="edit-btn" onClick={() => startEditModule(module)}>Edit</button>
                      <button type="button" className="ghost-btn admin-cancel-btn mini-btn" onClick={() => moveModule(module, -1)} disabled={moduleIndex === 0}>↑</button>
                      <button type="button" className="ghost-btn admin-cancel-btn mini-btn" onClick={() => moveModule(module, 1)} disabled={moduleIndex === sortedModules.length - 1}>↓</button>
                      <button type="button" className="dark-btn mini-btn" onClick={() => toggleModule(module)}>{isHidden ? "Publish" : "Hide"}</button>
                      <button type="button" className="delete-btn" onClick={() => deleteModule(module.id)}><Trash2 size={16} /></button>
                    </div>
                  </div>
                  <div className="builder-lesson-list">
                    {lessons.map((lesson) => renderLessonRow(lesson, lessons))}
                    {lessons.length === 0 && <p className="empty-small lesson-empty-note">No lesson under this module yet.</p>}
                  </div>
                </div>
              );
            })}

            {generalLessons.length > 0 && (
              <div className="builder-module-card general-module-card">
                <div className="module-title-row builder-module-title-row">
                  <div><strong>General Lessons</strong><small>Lessons not assigned to any module yet</small></div>
                </div>
                <div className="builder-lesson-list">
                  {generalLessons.map((lesson) => renderLessonRow(lesson, generalLessons))}
                </div>
              </div>
            )}

            {previewLesson && (
              <div className="builder-video-preview-card">
                <div className="module-title-row">
                  <div><strong>Preview: {previewLesson.title}</strong><small>This is how the lesson video will appear inside the portal.</small></div>
                  <button type="button" className="ghost-btn admin-cancel-btn mini-btn" onClick={() => setPreviewLesson(null)}>Close</button>
                </div>
                <div className="admin-video-preview"><PortalVideoPlayer url={previewLesson.videoUrl} title={previewLesson.title} /></div>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function formatCertificateDate(date) {
  if (!date) return "Not issued yet";
  return new Date(date).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

function certificateVerifyUrl(number) {
  return `${window.location.origin}/certificate-verification?code=${encodeURIComponent(number || "")}`;
}

const DEFAULT_CERTIFICATE_SETTINGS = {
  certificate_rector_name: "Joshua Iginla",
  certificate_rector_title: "Rector / President",
  certificate_footer_text: "Raising world class ministers",
  certificate_signature_url: "",
  certificate_seal_url: LOGO,
  certificate_show_qr: "true"
};

function normalizeCertificateSettings(settings = {}) {
  return { ...DEFAULT_CERTIFICATE_SETTINGS, ...(settings || {}) };
}

function certificateQrUrl(number) {
  if (!number) return "";
  const verifyUrl = certificateVerifyUrl(number);
  return `https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=10&data=${encodeURIComponent(verifyUrl)}`;
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function CertificateSheet({ certificate, enrollment, settings = {} }) {
  const course = certificate?.course || enrollment?.course || {};
  const programmeTitle = certificate?.programmeTitle || enrollment?.programmeTitle || course.title || "CIBI Programme";
  const studentName = certificate?.user?.name || enrollment?.user?.name || "Student";
  const certSettings = normalizeCertificateSettings(settings);
  const certificateNumber = certificate?.certificateNumber || "";
  const sealUrl = certSettings.certificate_seal_url || LOGO;
  const signatureUrl = certSettings.certificate_signature_url || "";
  const showQr = certSettings.certificate_show_qr !== "false";
  return (
    <div className="certificate-sheet">
      <div className="certificate-sheet-border">
        <img className="certificate-main-seal" src={sealUrl} alt="CIBI seal" />
        <span>Champion International Bible Institute</span>
        <h2>Certificate of Completion</h2>
        <p>This certifies that</p>
        <h3>{studentName}</h3>
        <p>has successfully completed the required programme of study in</p>
        <h4>{programmeTitle}</h4>
        <div className="certificate-sheet-meta">
          <div><small>Certificate No.</small><strong>{certificateNumber || "Pending"}</strong></div>
          <div><small>Date Issued</small><strong>{formatCertificateDate(certificate?.issuedAt)}</strong></div>
          <div><small>Status</small><strong>{certificate?.status || "PENDING"}</strong></div>
        </div>

        <div className="certificate-authority-row">
          <div className="certificate-signature-block">
            {signatureUrl ? <img className="certificate-signature-image" src={signatureUrl} alt="Authorized signature" /> : <div className="certificate-signature-placeholder">Signature</div>}
            <strong>{certSettings.certificate_rector_name || "Joshua Iginla"}</strong>
            <small>{certSettings.certificate_rector_title || "Rector / President"}</small>
          </div>
          {showQr && certificateNumber ? (
            <div className="certificate-qr-block">
              <img src={certificateQrUrl(certificateNumber)} alt="Certificate verification QR code" />
              <small>Scan to verify</small>
            </div>
          ) : null}
        </div>

        <p className="certificate-footer-text">{certSettings.certificate_footer_text || "Raising world class ministers"}</p>
        <p className="certificate-verify-line">Verify: {certificateNumber ? certificateVerifyUrl(certificateNumber) : "Certificate not issued yet"}</p>
      </div>
    </div>
  );
}


function scoreLabel(value, suffix = "%") {
  if (value === null || value === undefined || value === "") return "Pending";
  return `${value}${suffix}`;
}

function resultTone(status = "") {
  const value = String(status || "").toUpperCase();
  if (["PASSED", "APPROVED", "CERTIFICATE_READY", "CERTIFICATE_ISSUED", "COMPLETED"].includes(value)) return "success";
  if (["FAILED", "NEEDS_REVISION", "NOT_PASSED", "NEEDS_ATTENTION"].includes(value)) return "danger";
  if (["PENDING_GRADE", "PENDING_SUBMISSION", "IN_PROGRESS", "PENDING_REQUIREMENTS"].includes(value)) return "warning";
  return "neutral";
}

function ResultStatusPill({ status }) {
  return <span className={`result-status-pill result-${resultTone(status)}`}>{formatPortalStatus(status)}</span>;
}


function formatDateTime(value) {
  if (!value) return "Not available";
  try { return new Date(value).toLocaleString(); } catch { return "Not available"; }
}

function StudentAttendancePanel() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      setLoading(true);
      setRecords(await api("/student/attendance-history"));
    } catch (error) {
      showToast(error.message || "Could not load attendance history", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="attendance-panel">
      <div className="student-tab-heading profile-heading-card">
        <span>Class Record</span>
        <h2>My Attendance</h2>
        <p>Your live class attendance history is recorded automatically when you join a live session inside the portal.</p>
      </div>
      {loading ? <p>Loading attendance...</p> : (
        <div className="attendance-record-list">
          {records.map((record) => (
            <div className="attendance-record-card" key={record.id}>
              <div>
                <strong>{record.liveSession?.title || "Live Class"}</strong>
                <small>{record.liveSession?.description || "CIBI live session"}</small>
              </div>
              <div><span>Joined</span><b>{formatDateTime(record.joinedAt)}</b></div>
              <div><span>Last Seen</span><b>{formatDateTime(record.lastSeenAt)}</b></div>
            </div>
          ))}
          {!records.length && <div className="quiet-banner"><strong>No attendance record yet.</strong><p>Your record will appear after you join a live class.</p></div>}
        </div>
      )}
    </div>
  );
}

function CourseDiscussionPanel({ courseId }) {
  const [discussions, setDiscussions] = useState([]);
  const [form, setForm] = useState({ title: "", message: "" });
  const [replyMap, setReplyMap] = useState({});
  const [loading, setLoading] = useState(false);

  async function load() {
    if (!courseId) return;
    try {
      setDiscussions(await api(`/student/courses/${courseId}/discussions`));
    } catch (error) {
      showToast(error.message || "Could not load course discussions", "error");
    }
  }

  useEffect(() => { load(); }, [courseId]);

  async function createDiscussion(e) {
    e.preventDefault();
    if (!form.message.trim()) {
      showToast("Please type your course question or comment.", "error");
      return;
    }
    try {
      setLoading(true);
      await api(`/student/courses/${courseId}/discussions`, { method: "POST", body: form });
      setForm({ title: "", message: "" });
      await load();
      showToast("Course discussion posted.", "success");
    } catch (error) {
      showToast(error.message || "Could not post discussion", "error");
    } finally {
      setLoading(false);
    }
  }

  async function sendReply(e, discussionId) {
    e.preventDefault();
    const message = String(replyMap[discussionId] || "").trim();
    if (!message) return;
    try {
      await api(`/student/course-discussions/${discussionId}/replies`, { method: "POST", body: { message } });
      setReplyMap((current) => ({ ...current, [discussionId]: "" }));
      await load();
      showToast("Reply posted.", "success");
    } catch (error) {
      showToast(error.message || "Could not send reply", "error");
    }
  }

  return (
    <section className="course-discussion-panel">
      <div className="student-tab-heading compact-learning-heading">
        <span>Class Discussion</span>
        <h2>Course Discussion / Comments</h2>
        <p>Ask questions related to this course. Admin replies will appear under your discussion.</p>
      </div>
      <form className="discussion-new-form" onSubmit={createDiscussion}>
        <input placeholder="Discussion title, e.g. Question about lesson 2" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        <textarea placeholder="Type your course question or comment..." value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
        <button className="gold-btn" type="submit" disabled={loading}>{loading ? "Posting..." : "Post Discussion"}</button>
      </form>
      <div className="discussion-thread-list">
        {discussions.map((discussion) => (
          <article className="discussion-card" key={discussion.id}>
            <div className="discussion-card-head">
              <div><strong>{discussion.title}</strong><small>{discussion.author?.name || "Student"} · {formatPortalStatus(discussion.status)} · {formatDateTime(discussion.createdAt)}</small></div>
            </div>
            <p>{discussion.message}</p>
            <div className="discussion-replies">
              {(discussion.replies || []).map((reply) => (
                <div className={reply.author?.role === "ADMIN" ? "discussion-reply admin-reply" : "discussion-reply"} key={reply.id}>
                  <strong>{reply.author?.role === "ADMIN" ? "CIBI Admin" : reply.author?.name || "Student"}</strong>
                  <p>{reply.message}</p>
                  <small>{formatDateTime(reply.createdAt)}</small>
                </div>
              ))}
            </div>
            <form className="discussion-reply-form" onSubmit={(e) => sendReply(e, discussion.id)}>
              <input placeholder="Reply to discussion..." value={replyMap[discussion.id] || ""} onChange={(e) => setReplyMap((current) => ({ ...current, [discussion.id]: e.target.value }))} />
              <button className="dark-btn" type="submit"><Send size={14} /> Reply</button>
            </form>
          </article>
        ))}
        {!discussions.length && <div className="quiet-banner"><strong>No course discussion yet.</strong><p>Be the first to ask a question about this course.</p></div>}
      </div>
    </section>
  );
}

function StudentResultsPanel() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      setLoading(true);
      setRows(await api("/student/results"));
    } catch (error) {
      showToast(error.message || "Could not load your results", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const totalCourses = rows.length;
  const readyCourses = rows.filter((row) => row.status === "CERTIFICATE_READY" || row.status === "CERTIFICATE_ISSUED").length;
  const pendingItems = rows.reduce((sum, row) => sum + Number(row.pendingRequired || 0), 0);

  return (
    <>
      <div className="student-tab-heading results-heading-row">
        <div>
          <span>Academic Record</span>
          <h2>My Results</h2>
          <p>Track your lesson progress, assignment grades, quiz scores, certificate eligibility and admin feedback.</p>
        </div>
        <button className="ghost-btn dark-text" type="button" onClick={load}>Refresh</button>
      </div>

      <div className="results-summary-grid">
        <DashboardCard icon={<BookOpen />} label="Courses" value={totalCourses} />
        <DashboardCard icon={<Award />} label="Certificate Ready" value={readyCourses} />
        <DashboardCard icon={<Clock />} label="Pending Items" value={pendingItems} />
      </div>

      {loading ? <p>Loading results...</p> : (
        <div className="student-results-list">
          {rows.map((row) => (
            <article className="result-course-card" key={row.enrollmentId}>
              <div className="result-course-head">
                <div>
                  <span>{row.course?.level || "Programme"}</span>
                  <h3>{row.course?.title}</h3>
                  <p>{row.completedRequirements} of {row.totalRequirements} required items completed.</p>
                </div>
                <div className="result-score-box">
                  <strong>{row.percent}%</strong>
                  <ResultStatusPill status={row.status} />
                </div>
              </div>

              <div className="learning-progress-mini result-progress-bar">
                <i><b style={{ width: `${row.percent}%` }} /></i>
              </div>

              <div className="result-breakdown-grid">
                <div><small>Lessons</small><strong>{row.completedLessons}/{row.totalLessons}</strong></div>
                <div><small>Assignments</small><strong>{row.passedAssignments}/{row.totalAssignments}</strong></div>
                <div><small>Quizzes</small><strong>{row.passedQuizzes}/{row.totalQuizzes}</strong></div>
                <div><small>Overall Score</small><strong>{scoreLabel(row.overallScore)}</strong></div>
              </div>

              <div className="result-detail-grid">
                <div className="result-detail-panel">
                  <h4>Assignments</h4>
                  {(row.assignments || []).map((item) => (
                    <div className="result-item-row" key={item.id}>
                      <div><strong>{item.title}</strong><small>Pass score: {item.passScore}%</small></div>
                      <div><ResultStatusPill status={item.status} /><small>{scoreLabel(item.score, `/${item.maxScore}`)}</small></div>
                      {item.feedback && <p><b>Feedback:</b> {item.feedback}</p>}
                    </div>
                  ))}
                  {!row.assignments?.length && <p className="empty-small">No assignment has been added for this course yet.</p>}
                </div>

                <div className="result-detail-panel">
                  <h4>Quizzes</h4>
                  {(row.quizzes || []).map((item) => (
                    <div className="result-item-row" key={item.id}>
                      <div><strong>{item.title}</strong><small>Pass mark: {item.passScore}% · Questions: {item.questionCount}</small></div>
                      <div><ResultStatusPill status={item.status} /><small>{scoreLabel(item.bestScore)}</small></div>
                    </div>
                  ))}
                  {!row.quizzes?.length && <p className="empty-small">No quiz has been added for this course yet.</p>}
                </div>
              </div>
            </article>
          ))}
          {!rows.length && <div className="quiet-banner"><strong>No result record yet.</strong><p>Your results will appear here after admission approval and course activities.</p></div>}
        </div>
      )}
    </>
  );
}

function StudentCertificatesPanel() {
  const [records, setRecords] = useState([]);
  const [selected, setSelected] = useState(null);
  const [certSettings, setCertSettings] = useState(DEFAULT_CERTIFICATE_SETTINGS);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      setLoading(true);
      const [certificateRows, settingsResult] = await Promise.all([
        api("/student/certificates"),
        api("/certificates/settings").catch(() => DEFAULT_CERTIFICATE_SETTINGS)
      ]);
      setRecords(certificateRows);
      setCertSettings(normalizeCertificateSettings(settingsResult));
    } catch (error) {
      showToast(error.message || "Could not load certificates", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const issuedRecord = selected || records.find((item) => item.certificate?.status === "ISSUED");

  return (
    <>
      <div className="student-tab-heading certificate-heading-row">
        <div>
          <span>Completion</span>
          <h2>Certificates</h2>
          <p>Certificates are issued by admin after you complete all required lessons, assignments and quizzes.</p>
        </div>
        <button className="ghost-btn dark-text" type="button" onClick={load}>Refresh</button>
      </div>

      {loading ? <p>Loading certificates...</p> : (
        <div className="certificate-grid">
          {records.map((enrollment) => {
            const summary = enrollment.learningSummary || getCourseProgressSummary(enrollment.course);
            const certificate = enrollment.certificate;
            const issued = certificate?.status === "ISSUED";
            const completed = summary.percent >= 100;
            return (
              <div className={issued ? "certificate-card certificate-issued-card" : "certificate-card"} key={enrollment.id}>
                <span>{issued ? "Certificate Issued" : completed ? "Awaiting Admin Issuance" : "In Progress"}</span>
                <h3>{enrollment.course.title}</h3>
                <p>{summary.completedRequirements || summary.completedRequired} of {summary.totalRequirements || summary.totalRequired} required items completed.</p>
                <strong>{summary.percent}%</strong>
                <i><b style={{ width: `${summary.percent}%` }} /></i>
                {issued ? (
                  <div className="certificate-actions">
                    <small>Certificate No: {certificate.certificateNumber}</small>
                    <button className="gold-btn" type="button" onClick={() => setSelected(enrollment)}>View Certificate</button>
                    <a className="ghost-btn dark-text" href={certificateVerifyUrl(certificate.certificateNumber)} target="_blank" rel="noreferrer">Verify</a>
                  </div>
                ) : (
                  <small>{completed ? "Your course is complete. Admin can now issue your certificate." : "Complete all required lessons, assignments and quizzes to become eligible."}</small>
                )}
              </div>
            );
          })}
          {!records.length && <div className="quiet-banner"><strong>No certificate record yet.</strong><p>Your certificate progress begins after admission approval.</p></div>}
        </div>
      )}

      {issuedRecord?.certificate?.status === "ISSUED" && (
        <div className="certificate-preview-panel">
          <div className="certificate-preview-actions">
            <h3>Certificate Preview</h3>
            <button className="gold-btn" type="button" onClick={() => window.print()}>Print / Save as PDF</button>
          </div>
          <CertificateSheet certificate={issuedRecord.certificate} enrollment={{ ...issuedRecord, user: { name: issuedRecord.student?.name } }} settings={certSettings} />
        </div>
      )}
    </>
  );
}

function CertificatesAdmin() {
  const [rows, setRows] = useState([]);
  const [filter, setFilter] = useState("READY");
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState(DEFAULT_CERTIFICATE_SETTINGS);
  const [uploadingAsset, setUploadingAsset] = useState("");

  async function loadCertificateSettings() {
    const result = await api("/admin/settings");
    setSettings(normalizeCertificateSettings(result));
  }

  async function load() {
    try {
      setLoading(true);
      const [certificateRows, settingsResult] = await Promise.all([
        api("/admin/certificates"),
        api("/admin/settings").catch(() => DEFAULT_CERTIFICATE_SETTINGS)
      ]);
      setRows(certificateRows);
      setSettings(normalizeCertificateSettings(settingsResult));
    } catch (error) {
      showToast(error.message || "Could not load certificate records", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const stats = useMemo(() => ({
    total: rows.length,
    ready: rows.filter((row) => (row.learningSummary?.percent || 0) >= 100 && !row.certificate).length,
    issued: rows.filter((row) => row.certificate?.status === "ISSUED").length,
    progress: rows.filter((row) => (row.learningSummary?.percent || 0) < 100).length
  }), [rows]);

  const filtered = rows.filter((row) => {
    const percent = row.learningSummary?.percent || 0;
    if (filter === "ALL") return true;
    if (filter === "READY") return percent >= 100 && !row.certificate;
    if (filter === "ISSUED") return row.certificate?.status === "ISSUED";
    if (filter === "IN_PROGRESS") return percent < 100;
    return true;
  });

  function updateCertificateSetting(key, value) {
    setSettings((current) => ({ ...current, [key]: value }));
  }

  async function uploadCertificateAsset(field, file) {
    if (!file) return;
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) {
      showToast("Please upload a JPG, PNG or WEBP image.", "error");
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      showToast("Certificate asset must not be more than 4MB.", "error");
      return;
    }

    try {
      setUploadingAsset(field);
      const dataUrl = await readFileAsDataUrl(file);
      const result = await api("/uploads/certificate-asset", {
        method: "POST",
        body: { fileName: file.name, contentType: file.type, dataUrl }
      });
      updateCertificateSetting(field, result.url);
      showToast("Certificate image uploaded. Click Save Certificate Settings to apply it.", "success");
    } catch (error) {
      showToast(error.message || "Could not upload certificate image", "error");
    } finally {
      setUploadingAsset("");
    }
  }

  async function saveCertificateSettings(e) {
    e.preventDefault();
    const payload = {
      certificate_rector_name: settings.certificate_rector_name || "Joshua Iginla",
      certificate_rector_title: settings.certificate_rector_title || "Rector / President",
      certificate_footer_text: settings.certificate_footer_text || "Raising world class ministers",
      certificate_signature_url: settings.certificate_signature_url || "",
      certificate_seal_url: settings.certificate_seal_url || LOGO,
      certificate_show_qr: settings.certificate_show_qr === "false" ? "false" : "true"
    };
    await api("/admin/settings", { method: "PATCH", body: payload });
    await loadCertificateSettings();
    showToast("Certificate settings saved", "success");
  }

  async function issueCertificate(row) {
    if (!(await showConfirm({ title: "Issue certificate?", message: `Issue certificate for ${row.user.name} in ${row.course.title}?`, confirmText: "Issue Certificate" }))) return;
    try {
      const result = await api(`/admin/enrollments/${row.id}/certificate`, { method: "POST", body: {} });
      showToast(result.message || "Certificate issued", "success");
      await load();
    } catch (error) {
      showToast(error.message || "Could not issue certificate", "error");
    }
  }

  async function revokeCertificate(row) {
    if (!row.certificate) return;
    if (!(await showConfirm({ title: "Revoke certificate?", message: "This certificate will no longer verify as valid.", confirmText: "Revoke", danger: true }))) return;
    try {
      const result = await api(`/admin/certificates/${row.certificate.id}/revoke`, { method: "PATCH", body: {} });
      showToast(result.message || "Certificate revoked", "success");
      await load();
    } catch (error) {
      showToast(error.message || "Could not revoke certificate", "error");
    }
  }

  return (
    <section className="admin-section certificates-admin">
      <div className="content-editor-header">
        <div><span>Certification</span><h2>Certificates</h2><p>Review completed students, issue certificates, update certificate branding and verify certificate status.</p></div>
        <button className="gold-btn" type="button" onClick={load}>Refresh</button>
      </div>

      <details className="certificate-settings-panel" open>
        <summary><strong>Certificate Settings</strong><span>Signature, seal, rector name, footer text and QR</span></summary>
        <form className="certificate-settings-form" onSubmit={saveCertificateSettings}>
          <div className="certificate-settings-grid">
            <label>
              <span>Rector / President Name</span>
              <input value={settings.certificate_rector_name || ""} onChange={(e) => updateCertificateSetting("certificate_rector_name", e.target.value)} placeholder="Joshua Iginla" />
            </label>
            <label>
              <span>Rector / President Title</span>
              <input value={settings.certificate_rector_title || ""} onChange={(e) => updateCertificateSetting("certificate_rector_title", e.target.value)} placeholder="Rector / President" />
            </label>
            <label className="certificate-settings-wide">
              <span>Footer Text</span>
              <input value={settings.certificate_footer_text || ""} onChange={(e) => updateCertificateSetting("certificate_footer_text", e.target.value)} placeholder="Raising world class ministers" />
            </label>
            <label>
              <span>Signature Image URL</span>
              <input value={settings.certificate_signature_url || ""} onChange={(e) => updateCertificateSetting("certificate_signature_url", e.target.value)} placeholder="Paste signature image URL or upload below" />
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => uploadCertificateAsset("certificate_signature_url", e.target.files?.[0])} />
              <small>{uploadingAsset === "certificate_signature_url" ? "Uploading signature..." : "Upload transparent PNG/JPG/WEBP signature"}</small>
            </label>
            <label>
              <span>College Seal Image URL</span>
              <input value={settings.certificate_seal_url || ""} onChange={(e) => updateCertificateSetting("certificate_seal_url", e.target.value)} placeholder="Paste seal image URL or upload below" />
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => uploadCertificateAsset("certificate_seal_url", e.target.files?.[0])} />
              <small>{uploadingAsset === "certificate_seal_url" ? "Uploading seal..." : "Upload college seal/stamp image"}</small>
            </label>
            <label className="checkbox-field certificate-settings-wide">
              <input type="checkbox" checked={settings.certificate_show_qr !== "false"} onChange={(e) => updateCertificateSetting("certificate_show_qr", e.target.checked ? "true" : "false")} /> Show automatic certificate verification QR code
            </label>
          </div>
          <div className="certificate-settings-preview-row">
            <div>
              <strong>Seal Preview</strong>
              <img src={settings.certificate_seal_url || LOGO} alt="Certificate seal preview" />
            </div>
            <div>
              <strong>Signature Preview</strong>
              {settings.certificate_signature_url ? <img src={settings.certificate_signature_url} alt="Certificate signature preview" /> : <span>No signature uploaded yet</span>}
            </div>
          </div>
          <button className="gold-btn" type="submit">Save Certificate Settings</button>
        </form>
      </details>

      <div className="certificate-admin-stats">
        <button className={filter === "READY" ? "active-filter" : "filter"} onClick={() => setFilter("READY")}>Ready: {stats.ready}</button>
        <button className={filter === "ISSUED" ? "active-filter" : "filter"} onClick={() => setFilter("ISSUED")}>Issued: {stats.issued}</button>
        <button className={filter === "IN_PROGRESS" ? "active-filter" : "filter"} onClick={() => setFilter("IN_PROGRESS")}>In Progress: {stats.progress}</button>
        <button className={filter === "ALL" ? "active-filter" : "filter"} onClick={() => setFilter("ALL")}>All: {stats.total}</button>
      </div>

      {loading ? <p>Loading certificate records...</p> : (
        <div className="certificate-admin-list">
          {filtered.map((row) => {
            const summary = row.learningSummary || { percent: 0, completedRequired: 0, totalRequired: 0 };
            const canIssue = summary.percent >= 100 && !row.certificate && row.paymentStatus === "PAYMENT_CONFIRMED";
            return (
              <div className="certificate-admin-row" key={row.id}>
                <div>
                  <span>{row.certificate?.status === "ISSUED" ? "Issued" : summary.percent >= 100 ? "Ready for Certificate" : "In Progress"}</span>
                  <h3>{row.user.name}</h3>
                  <p>{row.user.email} · {row.course.title}</p>
                  <small>Payment: {formatPortalStatus(row.paymentStatus)} · Admission: {formatPortalStatus(row.admissionStatus)}</small>
                </div>
                <div className="learning-progress-mini admin-progress-mini">
                  <div><strong>{summary.percent}%</strong><small>{summary.completedRequirements || summary.completedRequired} of {summary.totalRequirements || summary.totalRequired} required items</small></div>
                  <i><b style={{ width: `${summary.percent}%` }} /></i>
                </div>
                <div className="certificate-admin-actions">
                  {row.certificate?.status === "ISSUED" ? (
                    <>
                      <small>{row.certificate.certificateNumber}</small>
                      <a className="ghost-btn dark-text" href={certificateVerifyUrl(row.certificate.certificateNumber)} target="_blank" rel="noreferrer">Verify</a>
                      <button className="ghost-btn admin-cancel-btn" type="button" onClick={() => revokeCertificate(row)}>Revoke</button>
                    </>
                  ) : (
                    <button className="gold-btn" type="button" onClick={() => issueCertificate(row)} disabled={!canIssue}>{canIssue ? "Issue Certificate" : "Not Eligible Yet"}</button>
                  )}
                </div>
              </div>
            );
          })}
          {!filtered.length && <div className="quiet-banner"><strong>No records in this filter.</strong><p>Completed students will appear here when they reach 100% course progress.</p></div>}
        </div>
      )}
    </section>
  );
}

function CertificateVerification() {
  const params = new URLSearchParams(window.location.search);
  const [code, setCode] = useState(params.get("code") || "");
  const [result, setResult] = useState(null);
  const [certSettings, setCertSettings] = useState(DEFAULT_CERTIFICATE_SETTINGS);
  const [message, setMessage] = useState("");

  async function verify(e) {
    e?.preventDefault?.();
    if (!code.trim()) return;
    try {
      const response = await api(`/certificates/verify/${encodeURIComponent(code.trim())}`);
      setResult(response.certificate);
      setCertSettings(normalizeCertificateSettings(response.settings));
      setMessage("");
    } catch (error) {
      setResult(null);
      setMessage(error.message || "Certificate not found.");
    }
  }

  useEffect(() => { if (code) verify(); }, []);

  return (
    <main className="page container certificate-verification-page">
      <div className="section-intro">
        <Kicker text="Certificate Verification" center />
        <h1>Verify CIBI Certificate</h1>
        <p>Enter a certificate number to confirm if it was issued by Champion International Bible Institute.</p>
      </div>
      <form className="certificate-verify-form" onSubmit={verify}>
        <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="CIBI-2026-001-0001-ABC123" />
        <button className="gold-btn" type="submit">Verify Certificate</button>
      </form>
      {message && <div className="quiet-banner"><strong>Verification failed</strong><p>{message}</p></div>}
      {result && (
        <div className="certificate-verification-result">
          <CheckCircle size={42} />
          <h2>Certificate Verified</h2>
          <p>This certificate is valid and was issued by CIBI.</p>
          <CertificateSheet certificate={result} settings={certSettings} />
        </div>
      )}
    </main>
  );
}


function GradebookAdmin() {
  const [rows, setRows] = useState([]);
  const [filter, setFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      setLoading(true);
      setRows(await api("/admin/gradebook"));
    } catch (error) {
      showToast(error.message || "Could not load gradebook", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const stats = useMemo(() => ({
    total: rows.length,
    ready: rows.filter((row) => row.status === "CERTIFICATE_READY").length,
    issued: rows.filter((row) => row.status === "CERTIFICATE_ISSUED").length,
    attention: rows.filter((row) => row.status === "NEEDS_ATTENTION").length,
    pending: rows.filter((row) => ["IN_PROGRESS", "PENDING_REQUIREMENTS"].includes(row.status)).length
  }), [rows]);

  const filtered = rows.filter((row) => {
    const haystack = `${row.student?.name || ""} ${row.student?.email || ""} ${row.course?.title || ""}`.toLowerCase();
    const matchesSearch = !search.trim() || haystack.includes(search.toLowerCase());
    const matchesFilter = filter === "ALL" || row.status === filter;
    return matchesSearch && matchesFilter;
  });

  return (
    <section className="admin-section gradebook-admin-panel">
      <div className="content-editor-header students-admin-header">
        <div>
          <span>Academic Results</span>
          <h2>Gradebook</h2>
          <p>Review lesson completion, assignment grades, quiz scores, overall progress and certificate readiness in one place.</p>
        </div>
        <button className="gold-btn" type="button" onClick={load}>Refresh</button>
      </div>

      <div className="gradebook-stats-grid">
        <button type="button" className={filter === "ALL" ? "support-stat-card active-support-filter" : "support-stat-card"} onClick={() => setFilter("ALL")}><span>All Records</span><strong>{stats.total}</strong><small>All approved students</small></button>
        <button type="button" className={filter === "CERTIFICATE_READY" ? "support-stat-card active-support-filter" : "support-stat-card"} onClick={() => setFilter("CERTIFICATE_READY")}><span>Ready</span><strong>{stats.ready}</strong><small>Can issue certificate</small></button>
        <button type="button" className={filter === "NEEDS_ATTENTION" ? "support-stat-card active-support-filter" : "support-stat-card"} onClick={() => setFilter("NEEDS_ATTENTION")}><span>Needs Attention</span><strong>{stats.attention}</strong><small>Failed or revision</small></button>
        <button type="button" className={filter === "IN_PROGRESS" ? "support-stat-card active-support-filter" : "support-stat-card"} onClick={() => setFilter("IN_PROGRESS")}><span>In Progress</span><strong>{stats.pending}</strong><small>Still learning</small></button>
        <button type="button" className={filter === "CERTIFICATE_ISSUED" ? "support-stat-card active-support-filter" : "support-stat-card"} onClick={() => setFilter("CERTIFICATE_ISSUED")}><span>Issued</span><strong>{stats.issued}</strong><small>Certificate issued</small></button>
      </div>

      <div className="library-tools gradebook-toolbar">
        <div className="search-box"><Search size={18} /><input placeholder="Search by student, email or course..." value={search} onChange={(e) => setSearch(e.target.value)} /></div>
      </div>

      {loading ? <p>Loading gradebook...</p> : (
        <div className="gradebook-list">
          {filtered.map((row) => (
            <article className="gradebook-card" key={row.enrollmentId}>
              <div className="gradebook-card-head">
                <div>
                  <span>{row.course?.level || "Programme"}</span>
                  <h3>{row.student?.name}</h3>
                  <p>{row.student?.email} · {row.course?.title}</p>
                </div>
                <div className="gradebook-score-box">
                  <strong>{row.percent}%</strong>
                  <ResultStatusPill status={row.status} />
                </div>
              </div>

              <div className="learning-progress-mini admin-progress-mini">
                <div><strong>{row.completedRequirements}/{row.totalRequirements}</strong><small>required items completed</small></div>
                <i><b style={{ width: `${row.percent}%` }} /></i>
              </div>

              <div className="gradebook-metrics">
                <div><small>Lessons</small><strong>{row.completedLessons}/{row.totalLessons}</strong></div>
                <div><small>Assignments</small><strong>{row.passedAssignments}/{row.totalAssignments}</strong></div>
                <div><small>Quizzes</small><strong>{row.passedQuizzes}/{row.totalQuizzes}</strong></div>
                <div><small>Overall Score</small><strong>{scoreLabel(row.overallScore)}</strong></div>
                <div><small>Certificate</small><strong>{row.certificate?.status || "Not issued"}</strong></div>
              </div>

              <details className="gradebook-details">
                <summary>View assignment and quiz breakdown</summary>
                <div className="result-detail-grid">
                  <div className="result-detail-panel">
                    <h4>Assignments</h4>
                    {(row.assignments || []).map((item) => (
                      <div className="result-item-row" key={item.id}>
                        <div><strong>{item.title}</strong><small>{item.studentSubmittedAt ? `Submitted: ${new Date(item.studentSubmittedAt).toLocaleDateString()}` : "Not submitted"}</small></div>
                        <div><ResultStatusPill status={item.status} /><small>{scoreLabel(item.score, `/${item.maxScore}`)}</small></div>
                        {item.fileUrl && <a href={item.fileUrl} target="_blank" rel="noreferrer">View file</a>}
                        {item.feedback && <p><b>Feedback:</b> {item.feedback}</p>}
                      </div>
                    ))}
                    {!row.assignments?.length && <p className="empty-small">No assignments for this course.</p>}
                  </div>
                  <div className="result-detail-panel">
                    <h4>Quizzes</h4>
                    {(row.quizzes || []).map((item) => (
                      <div className="result-item-row" key={item.id}>
                        <div><strong>{item.title}</strong><small>{item.attemptCount} attempt(s) · Pass mark {item.passScore}%</small></div>
                        <div><ResultStatusPill status={item.status} /><small>{scoreLabel(item.bestScore)}</small></div>
                      </div>
                    ))}
                    {!row.quizzes?.length && <p className="empty-small">No quizzes for this course.</p>}
                  </div>
                </div>
              </details>
            </article>
          ))}
          {!filtered.length && <div className="quiet-banner"><strong>No gradebook records found.</strong><p>Approved students with course activities will appear here.</p></div>}
        </div>
      )}
    </section>
  );
}

function ProgressAdmin() {
  const [rows, setRows] = useState([]);
  async function load() { setRows(await api("/admin/student-progress")); }
  useEffect(() => { load(); }, []);

  return (
    <section className="admin-section">
      <div className="content-editor-header">
        <div><span>Learning Analytics</span><h2>Student Progress</h2><p>See who has started, who is stuck, and who has completed required lessons, assignments and quizzes.</p></div>
        <button className="gold-btn" onClick={load}>Refresh</button>
      </div>
      <div className="progress-admin-list">
        {rows.map((row) => (
          <div className="progress-admin-card" key={`${row.enrollmentId}-${row.student.id}`}>
            <div>
              <strong>{row.student.name}</strong>
              <p>{row.student.email}</p>
              <small>{row.course.title}</small>
              {row.certificate?.status === "ISSUED" && <em className="cert-mini-badge">Certificate Issued</em>}
            </div>
            <div className="learning-progress-mini admin-progress-mini">
              <div><strong>{row.percent}%</strong><small>{row.completedRequired} of {row.totalRequired} required items</small></div>
              <i><b style={{ width: `${row.percent}%` }} /></i>
            </div>
          </div>
        ))}
        {rows.length === 0 && <p>No approved student progress yet.</p>}
      </div>
    </section>
  );
}

function LessonsAdmin() {
  return <CourseBuilderAdmin />;
}

function LiveAdmin({ reloadPublic }) {
  const [form, setForm] = useState({ courseId: "", title: "", description: "", liveUrl: "", replayUrl: "", subtitleUrl: "", subtitleLanguage: "", chatEnabled: true, voiceEnabled: false });
  const [classroom, setClassroom] = useState(null);
  const [courses, setCourses] = useState([]);
  const [answers, setAnswers] = useState({});

  async function loadCourses() {
    const result = await api("/admin/course-builder");
    setCourses(result || []);
    setForm((current) => ({ ...current, courseId: current.courseId || result?.[0]?.id || "" }));
  }

  async function loadClassroom() {
    const result = await api("/admin/live/classroom");
    setClassroom(result);
  }

  useEffect(() => {
    loadCourses().catch(() => null);
    loadClassroom().catch(() => null);
    const interval = setInterval(() => loadClassroom().catch(() => null), 7000);
    return () => clearInterval(interval);
  }, []);

  async function start(e) {
    e.preventDefault();
    await api("/admin/live/start", { method: "POST", body: form });
    setForm((current) => ({ ...current, title: "", description: "", liveUrl: "", replayUrl: "", subtitleUrl: "", subtitleLanguage: "" }));
    await reloadPublic();
    await loadClassroom();
    showToast("Live class started inside the student portal", "success");
  }

  async function stop() {
    await api("/admin/live/stop", { method: "POST" });
    await reloadPublic();
    await loadClassroom();
    showToast("Live class stopped", "success");
  }

  async function answerQuestion(questionId) {
    const answer = answers[questionId] || "";
    await api(`/admin/live/questions/${questionId}`, { method: "PATCH", body: { answer, status: "ANSWERED" } });
    setAnswers({ ...answers, [questionId]: "" });
    await loadClassroom();
  }

  async function markQuestionStatus(questionId, status) {
    await api(`/admin/live/questions/${questionId}`, { method: "PATCH", body: { status } });
    await loadClassroom();
  }

  async function deleteChat(chatId) {
    if (!(await showConfirm({ title: "Delete chat message?", message: "This chat message will be removed from the live classroom record.", confirmText: "Delete", danger: true }))) return;
    await api(`/admin/live/chat/${chatId}`, { method: "DELETE" });
    await loadClassroom();
  }

  const liveSession = classroom?.liveSession;

  return (
    <section className="admin-section live-admin-panel">
      <div className="live-admin-header">
        <div>
          <h2>Live Classroom Control</h2>
          <p className="admin-help-text">Students watch live classes inside CIBI. The external platform link stays hidden inside the embedded player.</p>
        </div>
        {liveSession && <span className={liveSession.active ? "live-status active-live-status" : "live-status"}>{liveSession.active ? "Live Active" : "Last Class"}</span>}
      </div>

      <form className="admin-form live-start-form" onSubmit={start}>
        <select value={form.courseId} onChange={(e) => setForm({ ...form, courseId: e.target.value })}>
          <option value="">General live class for all students</option>
          {courses.map((course) => <option key={course.id} value={String(course.id)}>{course.title}</option>)}
        </select>
        <input placeholder="Live class title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
        <input placeholder="Embeddable live/video link or iframe code" value={form.liveUrl} onChange={(e) => setForm({ ...form, liveUrl: e.target.value })} required />
        <input placeholder="Replay link after class ends (optional)" value={form.replayUrl} onChange={(e) => setForm({ ...form, replayUrl: e.target.value })} />
        <div className="two-columns">
          <input placeholder="Subtitle file/link (optional)" value={form.subtitleUrl} onChange={(e) => setForm({ ...form, subtitleUrl: e.target.value })} />
          <input placeholder="Subtitle language e.g English / French" value={form.subtitleLanguage} onChange={(e) => setForm({ ...form, subtitleLanguage: e.target.value })} />
        </div>
        <textarea placeholder="Description for students" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <div className="phase2-toggle-row">
          <label><input type="checkbox" checked={form.chatEnabled} onChange={(e) => setForm({ ...form, chatEnabled: e.target.checked })} /> Student live chat enabled</label>
          <label><input type="checkbox" checked={form.voiceEnabled} onChange={(e) => setForm({ ...form, voiceEnabled: e.target.checked })} /> Voice response planned/enabled flag</label>
        </div>
        {form.liveUrl && <div className="admin-video-preview"><PortalVideoPlayer url={form.liveUrl} title={form.title || "Live class preview"} /></div>}
        <div className="form-row">
          <button className="gold-btn" type="submit">Start Live Class</button>
          <button type="button" className="dark-btn" onClick={stop}>Stop Live Class</button>
          <button type="button" className="ghost-btn admin-cancel-btn" onClick={loadClassroom}>Refresh Classroom</button>
        </div>
      </form>

      {liveSession ? (
        <div className="admin-live-current">
          <div className="live-current-grid">
            <div>
              <h3>{liveSession.title}</h3>
              <p>{liveSession.description || "No description added."}</p>
              <p><strong>Course:</strong> {liveSession.course?.title || "General"}</p>
              <p><strong>Chat:</strong> {liveSession.chatEnabled === false ? "Off" : "On"} · <strong>Voice:</strong> {liveSession.voiceEnabled ? "Flagged Enabled" : "Off"}</p>
              {liveSession.replayUrl && <p><a className="receipt-preview-link" href={liveSession.replayUrl} target="_blank" rel="noreferrer">Open replay link</a></p>}
              {liveSession.subtitleUrl && <p><a className="receipt-preview-link" href={liveSession.subtitleUrl} target="_blank" rel="noreferrer">Open subtitle file ({liveSession.subtitleLanguage || "language"})</a></p>}
            </div>
            <div className="attendance-card-small">
              <strong>{classroom?.attendanceCount || 0}</strong>
              <span>Students Present</span>
            </div>
          </div>

          <div className="classroom-grid admin-classroom-grid">
            <div className="classroom-box">
              <div className="classroom-box-title"><h3>Live Chat</h3><span>{classroom?.chatMessages?.length || 0}</span></div>
              <div className="chat-thread">
                {(classroom?.chatMessages || []).map((chat) => (
                  <div className="chat-bubble" key={chat.id}>
                    <strong>{chat.user?.name || "Student"}</strong>
                    <p>{chat.message}</p>
                    <button className="delete-mini-btn" type="button" onClick={() => deleteChat(chat.id)}>Delete</button>
                  </div>
                ))}
                {!(classroom?.chatMessages || []).length && <p className="empty-small">No chat messages yet.</p>}
              </div>
            </div>

            <div className="classroom-box">
              <div className="classroom-box-title"><h3>Questions</h3><span>{classroom?.questions?.length || 0}</span></div>
              <div className="question-list admin-question-list">
                {(classroom?.questions || []).map((item) => (
                  <div className="question-item" key={item.id}>
                    <strong>{item.user?.name || "Student"}</strong>
                    <p>{item.question}</p>
                    {item.answer && <div className="answer-box"><b>Answer:</b> {item.answer}</div>}
                    <textarea placeholder="Type lecturer answer..." value={answers[item.id] || ""} onChange={(e) => setAnswers({ ...answers, [item.id]: e.target.value })} />
                    <div className="form-row">
                      <button className="gold-btn" type="button" onClick={() => answerQuestion(item.id)}>Answer</button>
                      <button className="dark-btn" type="button" onClick={() => markQuestionStatus(item.id, "CLOSED")}>Close</button>
                    </div>
                  </div>
                ))}
                {!(classroom?.questions || []).length && <p className="empty-small">No questions yet.</p>}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="quiet-banner"><strong>No live class yet.</strong><p>Start a class above to open the student classroom.</p></div>
      )}
    </section>
  );
}

const websiteContentGroups = [
  {
    title: "Home Page",
    fields: [
      ["home_card_1_title", "Info Card 1 Title"], ["home_card_1_text", "Info Card 1 Text", "textarea"],
      ["home_card_2_title", "Info Card 2 Title"], ["home_card_2_text", "Info Card 2 Text", "textarea"],
      ["home_card_3_title", "Info Card 3 Title"], ["home_card_3_text", "Info Card 3 Text", "textarea"],
      ["home_stat_1_value", "Stat 1 Value"], ["home_stat_1_label", "Stat 1 Label"],
      ["home_stat_2_value", "Stat 2 Value"], ["home_stat_2_label", "Stat 2 Label"],
      ["home_stat_3_value", "Stat 3 Value"], ["home_stat_3_label", "Stat 3 Label"],
      ["home_stat_4_value", "Stat 4 Value"], ["home_stat_4_label", "Stat 4 Label"],
      ["home_about_kicker", "About Preview Kicker"], ["home_about_title", "About Preview Title"],
      ["home_about_paragraph_1", "About Preview Paragraph 1", "textarea"], ["home_about_paragraph_2", "About Preview Paragraph 2", "textarea"],
      ["home_about_image_url", "About Preview Image URL"], ["home_about_caption_name", "Image Caption Name"], ["home_about_caption_title", "Image Caption Title"],
      ["home_programs_eyebrow", "Programs Section Eyebrow"], ["home_programs_title", "Programs Section Title"], ["home_programs_text", "Programs Section Text", "textarea"],
      ["home_paths_eyebrow", "Learning Paths Eyebrow"], ["home_paths_title", "Learning Paths Title"], ["home_paths_text", "Learning Paths Text", "textarea"],
      ["home_regular_class_title", "Regular Class Title"], ["home_regular_class_text", "Regular Class Text", "textarea"], ["home_regular_class_points", "Regular Class Points (separate with |)", "textarea"],
      ["home_executive_class_title", "Executive Class Title"], ["home_executive_class_text", "Executive Class Text", "textarea"], ["home_executive_class_points", "Executive Class Points (separate with |)", "textarea"],
      ["home_graduate_kicker", "Graduates Kicker"], ["home_graduate_title", "Graduates Title"], ["home_graduate_quote", "Graduates Quote", "textarea"], ["home_graduate_author", "Quote Author"], ["home_graduate_number", "Graduate Number"], ["home_graduate_number_label", "Graduate Number Label"], ["home_graduate_image_url", "Graduates Background Image URL"],
      ["home_faq_eyebrow", "FAQ Eyebrow"], ["home_faq_title", "FAQ Title"], ["home_faq_text", "FAQ Intro Text", "textarea"],
      ["home_cta_kicker", "CTA Kicker"], ["home_cta_title", "CTA Title"], ["home_cta_text", "CTA Text", "textarea"], ["home_cta_primary_button", "CTA Primary Button"], ["home_cta_secondary_button", "CTA Secondary Button"],
      ["global_registration_kicker", "Global Registration Kicker"], ["global_registration_title", "Global Registration Title"], ["global_registration_text", "Global Registration Text", "textarea"]
    ]
  },
  {
    title: "About Page",
    fields: [
      ["about_hero_eyebrow", "Hero Eyebrow"], ["about_hero_title", "Hero Title"], ["about_hero_text", "Hero Text", "textarea"], ["about_hero_image_url", "Hero Image URL"],
      ["about_founder_kicker", "Founder Kicker"], ["about_founder_name", "Founder Name"], ["about_founder_role", "Founder Role"], ["about_founder_bio", "Founder Biography (one paragraph per line)", "textarea"], ["about_founder_image_url", "Founder Image URL"], ["about_founder_fact_1_label", "Founder Fact 1 Label"], ["about_founder_fact_1_text", "Founder Fact 1 Text", "textarea"], ["about_founder_fact_2_label", "Founder Fact 2 Label"], ["about_founder_fact_2_text", "Founder Fact 2 Text", "textarea"],
      ["about_church_kicker", "Church Section Kicker"], ["about_church_title", "Church Section Title"], ["about_church_text", "Church Section Text", "textarea"], ["about_church_stats", "Church Stat Cards (one per line: Title|Subtitle)", "textarea"],
      ["about_mission_kicker", "Mission Kicker"], ["about_mission_title", "Mission Title"], ["about_mission_text", "Mission Text", "textarea"], ["about_vision_kicker", "Vision Kicker"], ["about_vision_title", "Vision Title"], ["about_vision_text", "Vision Text", "textarea"],
      ["about_beliefs_kicker", "Beliefs Kicker"], ["about_beliefs_title", "Beliefs Title"], ["about_beliefs_text", "Beliefs Intro Text", "textarea"], ["about_beliefs", "Belief Cards (one per line: Title|Description)", "textarea"],
      ["about_milestones_kicker", "Milestones Kicker"], ["about_milestones_title", "Milestones Title"], ["about_milestones_text", "Milestones Intro Text", "textarea"], ["about_milestones", "Milestones (one per line: Year|Description)", "textarea"],
      ["about_classroom_kicker", "Classroom CTA Kicker"], ["about_classroom_title", "Classroom CTA Title"], ["about_classroom_text", "Classroom CTA Text", "textarea"], ["about_classroom_image_url", "Classroom CTA Background Image URL"], ["about_classroom_button", "Classroom CTA Button Text"]
    ]
  },
  {
    title: "Programs Page",
    fields: [
      ["programs_hero_eyebrow", "Hero Eyebrow"], ["programs_hero_title", "Hero Title"], ["programs_hero_text", "Hero Text", "textarea"], ["programs_hero_image_url", "Hero Image URL"],
      ["programs_overview_eyebrow", "Program Overview Eyebrow"], ["programs_overview_title", "Program Overview Title"], ["programs_overview_text", "Program Overview Text", "textarea"],
      ["program_card_1_title", "Program Card 1 Title"], ["program_card_1_level", "Program Card 1 Level"], ["program_card_1_duration", "Program Card 1 Duration"], ["program_card_1_fee", "Program Card 1 USD Fee"], ["program_card_1_audience", "Program Card 1 Audience Text", "textarea"], ["program_card_1_description", "Program Card 1 Description", "textarea"], ["program_card_1_certification", "Program Card 1 Certification"],
      ["program_card_2_title", "Program Card 2 Title"], ["program_card_2_level", "Program Card 2 Level"], ["program_card_2_duration", "Program Card 2 Duration"], ["program_card_2_fee", "Program Card 2 USD Fee"], ["program_card_2_audience", "Program Card 2 Audience Text", "textarea"], ["program_card_2_description", "Program Card 2 Description", "textarea"], ["program_card_2_certification", "Program Card 2 Certification"],
      ["program_card_3_title", "Program Card 3 Title"], ["program_card_3_level", "Program Card 3 Level"], ["program_card_3_duration", "Program Card 3 Duration"], ["program_card_3_fee", "Program Card 3 USD Fee"], ["program_card_3_audience", "Program Card 3 Audience Text", "textarea"], ["program_card_3_description", "Program Card 3 Description", "textarea"], ["program_card_3_certification", "Program Card 3 Certification"],
      ["program_card_4_title", "Program Card 4 Title"], ["program_card_4_level", "Program Card 4 Level"], ["program_card_4_duration", "Program Card 4 Duration"], ["program_card_4_fee", "Program Card 4 USD Fee (0 shows Contact Us)"], ["program_card_4_audience", "Program Card 4 Audience Text", "textarea"], ["program_card_4_description", "Program Card 4 Description", "textarea"], ["program_card_4_certification", "Program Card 4 Certification"],
      ["currency_converter_kicker", "Currency Converter Kicker"], ["currency_converter_title", "Currency Converter Title"], ["currency_converter_text", "Currency Converter Text", "textarea"], ["currency_rates", "Currency Rates (one per line: CODE|RATE)", "textarea"], ["currency_converter_note", "Currency Converter Note", "textarea"],
      ["programs_core_title", "Core Foundational Course Title"], ["programs_core_text", "Core Foundational Course Text", "textarea"],
      ["programs_curriculum_eyebrow", "Curriculum Eyebrow"], ["programs_curriculum_title", "Curriculum Title"], ["programs_curriculum_text", "Curriculum Intro Text", "textarea"], ["programs_curriculum_items", "Curriculum Accordions (one per line: Title|Subtitle|Course 1;Course 2;Course 3)", "textarea"],
      ["programs_classes_eyebrow", "Learning Options Eyebrow"], ["programs_classes_title", "Learning Options Title"], ["programs_classes_text", "Learning Options Text", "textarea"],
      ["programs_regular_title", "Regular Classes Title"], ["programs_regular_text", "Regular Classes Text", "textarea"], ["programs_regular_points", "Regular Classes Points (separate with |)", "textarea"],
      ["programs_executive_title", "Executive Classes Title"], ["programs_executive_text", "Executive Classes Text", "textarea"], ["programs_executive_points", "Executive Classes Points (separate with |)", "textarea"],
      ["programs_graduation_eyebrow", "Graduation Requirements Eyebrow"], ["programs_graduation_title", "Graduation Requirements Title"], ["programs_graduation_text", "Graduation Requirements Intro", "textarea"], ["programs_graduation_requirements", "Graduation Requirements (one per line)", "textarea"],
      ["programs_cta_kicker", "Final CTA Kicker"], ["programs_cta_title", "Final CTA Title"], ["programs_cta_text", "Final CTA Text", "textarea"], ["programs_cta_button", "Final CTA Button Text"]
    ]
  },
  {
    title: "Book Library, Gallery and Contact Pages",
    fields: [
      ["books_hero_eyebrow", "Book Hero Eyebrow"], ["books_hero_title", "Book Hero Title"], ["books_hero_text", "Book Hero Text", "textarea"], ["books_hero_image_url", "Book Hero Image URL"],
      ["gallery_hero_eyebrow", "Gallery Hero Eyebrow"], ["gallery_hero_title", "Gallery Hero Title"], ["gallery_hero_text", "Gallery Hero Text", "textarea"], ["gallery_hero_image_url", "Gallery Hero Image URL"],
      ["contact_hero_eyebrow", "Contact Hero Eyebrow"], ["contact_hero_title", "Contact Hero Title"], ["contact_hero_text", "Contact Hero Text", "textarea"], ["contact_hero_image_url", "Contact Hero Image URL"],
      ["contact_phone_title", "Phone Card Title"], ["contact_phone", "Phone Number"], ["contact_location_title", "Location Card Title"], ["contact_address", "Address"], ["contact_enquiry_title", "Enquiry Card Title"], ["contact_enquiry_text", "Enquiry Card Text", "textarea"], ["contact_email", "Contact Email"], ["office_hours", "Office Hours"]
    ]
  },
  {
    title: "Admission Page",
    fields: [
      ["admission_hero_eyebrow", "Hero Eyebrow"], ["admission_hero_title", "Hero Title"], ["admission_hero_text", "Hero Text", "textarea"], ["admission_hero_image_url", "Hero Image URL"],
      ["admission_eligibility_eyebrow", "Eligibility Eyebrow"], ["admission_eligibility_title", "Eligibility Title"], ["admission_eligibility_text", "Eligibility Text", "textarea"], ["admission_roles", "Who Should Apply Items (one per line: Title|Subtitle)", "textarea"],
      ["admission_requirements_eyebrow", "Requirements Eyebrow"], ["admission_requirements_title", "Requirements Title"], ["admission_requirements_text", "Requirements Text", "textarea"], ["admission_basic_requirements", "Basic Requirements (one per line)", "textarea"], ["admission_additional_requirements", "Additional Requirements (one per line)", "textarea"],
      ["admission_apply_eyebrow", "Apply Section Eyebrow"], ["admission_apply_title", "Apply Section Title"], ["admission_apply_text", "Apply Section Text", "textarea"], ["admission_start_title", "Start Title"], ["admission_start_text", "Start Text", "textarea"], ["admission_start_box_title", "Start Box Title"], ["admission_start_box_text", "Start Box Text", "textarea"], ["admission_student_payment_title", "Student Payment Title"],
      ["admission_process_eyebrow", "Process Eyebrow"], ["admission_process_title", "Process Title"], ["admission_process_text", "Process Text", "textarea"], ["admission_application_steps", "Application Steps (one per line: Title|Description)", "textarea"],
      ["admission_fees_eyebrow", "Fees Eyebrow"], ["admission_fees_title", "Fees Title"], ["admission_fees_text", "Fees Text", "textarea"],
      ["admission_calendar_eyebrow", "Calendar Eyebrow"], ["admission_calendar_title", "Calendar Title"], ["admission_calendar_text", "Calendar Text", "textarea"], ["admission_calendar", "Calendar Items (one per line: Label|Value)", "textarea"],
      ["admission_contact_eyebrow", "Admission Contact Eyebrow"], ["admission_contact_title", "Admission Contact Title"], ["admission_contact_text", "Admission Contact Text", "textarea"], ["admission_contact_location", "Admission Contact Location"], ["admission_contact_phone_title", "Admission Phone Title"], ["admission_contact_location_title", "Admission Location Title"], ["admission_contact_hours_title", "Admission Hours Title"]
    ]
  },
  {
    title: "Footer",
    fields: [
      ["footer_brand_title", "Footer Brand Title"], ["footer_brand_text", "Footer Brand Text"], ["footer_brand_small", "Footer Small Text"], ["footer_address", "Footer Address"], ["footer_phone", "Footer Phone"], ["footer_email", "Footer Email"], ["footer_copyright", "Copyright Text"], ["footer_bottom_note", "Footer Bottom Note"]
    ]
  }
];

function getContentSection(key) {
  if (key.includes("_hero_")) return "Hero Section";

  if (key.startsWith("home_card_")) return "Home Info Cards";
  if (key.startsWith("home_stat_")) return "Home Statistics";
  if (key.startsWith("home_about_")) return "Home About Preview";
  if (key.startsWith("home_programs_")) return "Home Programs Intro";
  if (key.startsWith("home_paths_") || key.startsWith("home_regular_") || key.startsWith("home_executive_")) return "Home Learning Paths";
  if (key.startsWith("home_graduate_")) return "Home Graduates Section";
  if (key.startsWith("home_faq_")) return "Home FAQ Section";
  if (key.startsWith("home_cta_")) return "Home Admission CTA";

  if (key.startsWith("about_founder_")) return "Founder Section";
  if (key.startsWith("about_church_")) return "Church Overview";
  if (key.startsWith("about_mission_") || key.startsWith("about_vision_")) return "Mission and Vision";
  if (key.startsWith("about_beliefs")) return "Beliefs Section";
  if (key.startsWith("about_milestones")) return "Milestones Section";
  if (key.startsWith("about_classroom_")) return "Classroom CTA";
  if (key.startsWith("about_section_")) return "Legacy About Section";

  if (key.startsWith("currency_")) return "Currency Converter";
  if (key.startsWith("programs_overview_")) return "Program Overview";
  if (key.startsWith("programs_core_")) return "Core Foundational Course";
  if (key.startsWith("programs_curriculum_")) return "Curriculum Section";
  if (key.startsWith("programs_classes_") || key.startsWith("programs_regular_") || key.startsWith("programs_executive_")) return "Learning Options";
  if (key.startsWith("programs_graduation_")) return "Graduation Requirements";
  if (key.startsWith("programs_cta_")) return "Programs Final CTA";

  if (key.startsWith("books_")) return "Book Library Page";
  if (key.startsWith("gallery_")) return "Gallery Page";
  if (key.startsWith("contact_")) return "Contact Page";
  if (key.startsWith("office_")) return "Contact Page";

  if (key.startsWith("admission_eligibility_") || key === "admission_roles") return "Who Should Apply";
  if (key.startsWith("admission_requirements_") || key.includes("_requirements")) return "Admission Requirements";
  if (key.startsWith("admission_apply_") || key.startsWith("admission_start_") || key.startsWith("admission_student_")) return "Apply Online Section";
  if (key.startsWith("admission_process_") || key === "admission_application_steps") return "Application Process";
  if (key.startsWith("admission_fees_")) return "Programme Fees Section";
  if (key.startsWith("admission_calendar_") || key === "admission_calendar") return "Academic Calendar";
  if (key.startsWith("admission_contact_")) return "Admission Contact Section";

  if (key.startsWith("footer_")) return "Footer";

  return "General Content";
}

function groupWebsiteFields(fields) {
  return fields.reduce((groups, field) => {
    const section = getContentSection(field[0]);
    if (!groups[section]) groups[section] = [];
    groups[section].push(field);
    return groups;
  }, {});
}

function WebsiteContentAdmin({ reloadPublic }) {
  const [settings, setSettings] = useState({});
  const [activeGroupTitle, setActiveGroupTitle] = useState(websiteContentGroups[0]?.title || "Home Page");

  async function load() {
    setSettings(await api("/admin/settings"));
  }

  useEffect(() => { load(); }, []);

  const activeGroup = websiteContentGroups.find((group) => group.title === activeGroupTitle) || websiteContentGroups[0];
  const sectionGroups = groupWebsiteFields(activeGroup.fields);
  const sectionEntries = Object.entries(sectionGroups);
  const imageFieldCount = activeGroup.fields.filter(([key, label]) => key.includes("image_url") || label.toLowerCase().includes("image url")).length;

  async function submit(e) {
    e.preventDefault();
    const savedSettings = await api("/admin/settings", { method: "PATCH", body: settings });
    setSettings(savedSettings);
    await reloadPublic();
    showToast(`${activeGroup.title} content saved and synced to the public website`, "success");
  }

  function updateSetting(key, value) {
    setSettings((current) => ({ ...current, [key]: value }));
  }

  return (
    <section className="admin-section content-manager">
      <div className="content-manager-title">
        <div>
          <p className="eyebrow dark">Website Content</p>
          <h2>Public Page Editor</h2>
          <p>
            Choose the page or section first, then edit only what belongs there. Homepage hero slides are managed separately under the Slides tab.
          </p>
        </div>
      </div>

      <div className="content-manager-layout">
        <aside className="content-page-menu">
          <h3>Choose Area</h3>
          {websiteContentGroups.map((group) => {
            const isActive = activeGroup.title === group.title;
            const imageCount = group.fields.filter(([key, label]) => key.includes("image_url") || label.toLowerCase().includes("image url")).length;

            return (
              <button
                type="button"
                key={group.title}
                className={isActive ? "content-page-card active-content-page" : "content-page-card"}
                onClick={() => setActiveGroupTitle(group.title)}
              >
                <strong>{group.title}</strong>
                <span>{group.fields.length} fields · {imageCount} images</span>
              </button>
            );
          })}
        </aside>

        <form className="admin-form content-editor-panel" onSubmit={submit}>
          <div className="content-editor-header">
            <div>
              <span>Now editing</span>
              <h3>{activeGroup.title}</h3>
              <p>{sectionEntries.length} sections · {activeGroup.fields.length} editable fields · {imageFieldCount} image fields</p>
            </div>
            <button className="gold-btn" type="submit">Save {activeGroup.title}</button>
          </div>

          {activeGroup.title === "Home Page" && (
            <div className="content-help-box">
              <strong>Homepage note:</strong>
              <p>The large 01–04 hero slider is edited under <b>Slides</b>. This page controls the homepage cards, statistics, about section, programmes intro, graduates section, book preview and admission CTA.</p>
            </div>
          )}

          {sectionEntries.map(([sectionTitle, fields]) => (
            <details className="content-section-panel" key={sectionTitle} open>
              <summary>
                <strong>{sectionTitle}</strong>
                <span>{fields.length} fields</span>
              </summary>

              <div className="content-admin-grid clean-content-grid">
                {fields.map(([key, label, type]) => {
                  const isImageField = key.includes("image_url") || label.toLowerCase().includes("image url");
                  const value = settings[key] || "";

                  return (
                    <label className={type === "textarea" ? "content-field content-field-wide" : "content-field"} key={key}>
                      <span>{label}</span>
                      {type === "textarea" ? (
                        <textarea value={value} onChange={(e) => updateSetting(key, e.target.value)} />
                      ) : (
                        <input value={value} onChange={(e) => updateSetting(key, e.target.value)} />
                      )}

                      {isImageField && value && (
                        <div className="image-url-preview">
                          <img src={value} alt={`${label} preview`} />
                          <small>Image preview</small>
                        </div>
                      )}
                    </label>
                  );
                })}
              </div>
            </details>
          ))}

          <div className="content-save-footer">
            <button className="gold-btn" type="submit">Save {activeGroup.title}</button>
          </div>
        </form>
      </div>
    </section>
  );
}



function ActivityLogAdmin() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      setLoading(true);
      setLogs(await api("/admin/activity-logs"));
    } catch (error) {
      showToast(error.message || "Could not load activity log", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  return (
    <section className="admin-section audit-admin-panel">
      <div className="content-editor-header students-admin-header">
        <div>
          <span>Audit Trail</span>
          <h2>Admin Activity Log</h2>
          <p>Track important admin actions such as approvals, grading, certificate actions, settings changes and content updates.</p>
        </div>
        <button className="gold-btn" type="button" onClick={load}>Refresh</button>
      </div>
      {loading ? <p>Loading activity log...</p> : (
        <div className="audit-log-list">
          {logs.map((log) => {
            let details = {};
            try { details = log.details ? JSON.parse(log.details) : {}; } catch { details = { raw: log.details }; }
            return (
              <div className="audit-log-card" key={log.id}>
                <div>
                  <strong>{formatPortalStatus(log.action)}</strong>
                  <small>{log.admin?.name || "System/Admin"} · {log.admin?.email || "No email"}</small>
                </div>
                <div><span>Entity</span><b>{log.entityType || "System"}{log.entityId ? ` #${log.entityId}` : ""}</b></div>
                <div><span>Date</span><b>{formatDateTime(log.createdAt)}</b></div>
                <div className="audit-details"><span>Details</span><p>{Object.keys(details).length ? Object.entries(details).map(([key, value]) => `${key}: ${value}`).join(" · ") : "No extra details"}</p></div>
              </div>
            );
          })}
          {!logs.length && <div className="quiet-banner"><strong>No activity yet.</strong><p>Admin actions will appear here after the new audit system is active.</p></div>}
        </div>
      )}
    </section>
  );
}

function AttendanceRecordsAdmin() {
  const [payload, setPayload] = useState({ records: [], grouped: [] });
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      setLoading(true);
      setPayload(await api("/admin/attendance-records"));
    } catch (error) {
      showToast(error.message || "Could not load attendance records", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  return (
    <section className="admin-section attendance-admin-panel">
      <div className="content-editor-header students-admin-header">
        <div>
          <span>Live Class Records</span>
          <h2>Student Attendance Record</h2>
          <p>View all students who joined live classes, including joined time and last seen time.</p>
        </div>
        <button className="gold-btn" type="button" onClick={load}>Refresh</button>
      </div>
      {loading ? <p>Loading attendance records...</p> : (
        <div className="attendance-session-list">
          {(payload.grouped || []).map((group) => (
            <div className="attendance-session-card" key={group.liveSession?.id || group.liveSession?.title}>
              <div className="attendance-session-head">
                <div><strong>{group.liveSession?.title || "Live Session"}</strong><small>{group.liveSession?.description || "CIBI live class"}</small></div>
                <span>{group.count} present</span>
              </div>
              <div className="attendance-table">
                {(group.students || []).map((item) => (
                  <div key={item.id}>
                    <strong>{item.student?.name || "Student"}</strong>
                    <small>{item.student?.email || "No email"}</small>
                    <span>Joined: {formatDateTime(item.joinedAt)}</span>
                    <span>Last seen: {formatDateTime(item.lastSeenAt)}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {!(payload.grouped || []).length && <div className="quiet-banner"><strong>No attendance records yet.</strong><p>Records appear after students join live classes.</p></div>}
        </div>
      )}
    </section>
  );
}

function CourseDiscussionsAdmin() {
  const [discussions, setDiscussions] = useState([]);
  const [replyMap, setReplyMap] = useState({});
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      setLoading(true);
      setDiscussions(await api("/admin/course-discussions"));
    } catch (error) {
      showToast(error.message || "Could not load course discussions", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function reply(e, discussionId) {
    e.preventDefault();
    const message = String(replyMap[discussionId] || "").trim();
    if (!message) return;
    try {
      await api(`/admin/course-discussions/${discussionId}/replies`, { method: "POST", body: { message } });
      setReplyMap((current) => ({ ...current, [discussionId]: "" }));
      await load();
      showToast("Reply sent to discussion.", "success");
    } catch (error) {
      showToast(error.message || "Could not send reply", "error");
    }
  }

  async function changeStatus(discussionId, status) {
    try {
      await api(`/admin/course-discussions/${discussionId}/status`, { method: "PATCH", body: { status } });
      await load();
      showToast("Discussion status updated.", "success");
    } catch (error) {
      showToast(error.message || "Could not update discussion", "error");
    }
  }

  async function removeDiscussion(discussionId) {
    const confirmed = await showConfirm({ title: "Remove discussion?", message: "This will hide the discussion from students.", confirmText: "Remove", danger: true });
    if (!confirmed) return;
    try {
      await api(`/admin/course-discussions/${discussionId}`, { method: "DELETE" });
      await load();
      showToast("Discussion removed.", "success");
    } catch (error) {
      showToast(error.message || "Could not remove discussion", "error");
    }
  }

  return (
    <section className="admin-section discussions-admin-panel">
      <div className="content-editor-header students-admin-header">
        <div>
          <span>Course Comments</span>
          <h2>Course Discussions</h2>
          <p>Reply to student course questions and manage discussion status.</p>
        </div>
        <button className="gold-btn" type="button" onClick={load}>Refresh</button>
      </div>
      {loading ? <p>Loading discussions...</p> : (
        <div className="admin-discussion-list">
          {discussions.map((discussion) => (
            <article className="admin-discussion-card" key={discussion.id}>
              <div className="discussion-card-head">
                <div>
                  <strong>{discussion.title}</strong>
                  <small>{discussion.course?.title || "Course"} · {discussion.author?.name || "Student"} · {formatPortalStatus(discussion.status)}</small>
                </div>
                <div className="admin-item-actions">
                  <button className="edit-btn" type="button" onClick={() => changeStatus(discussion.id, discussion.status === "CLOSED" ? "OPEN" : "CLOSED")}>{discussion.status === "CLOSED" ? "Reopen" : "Close"}</button>
                  <button className="delete-btn" type="button" onClick={() => removeDiscussion(discussion.id)}><Trash2 size={16} /></button>
                </div>
              </div>
              <p>{discussion.message}</p>
              <div className="discussion-replies">
                {(discussion.replies || []).map((reply) => (
                  <div className={reply.author?.role === "ADMIN" ? "discussion-reply admin-reply" : "discussion-reply"} key={reply.id}>
                    <strong>{reply.author?.role === "ADMIN" ? "CIBI Admin" : reply.author?.name || "Student"}</strong>
                    <p>{reply.message}</p>
                    <small>{formatDateTime(reply.createdAt)}</small>
                  </div>
                ))}
              </div>
              <form className="discussion-reply-form" onSubmit={(e) => reply(e, discussion.id)}>
                <input placeholder="Reply as admin..." value={replyMap[discussion.id] || ""} onChange={(e) => setReplyMap((current) => ({ ...current, [discussion.id]: e.target.value }))} />
                <button className="dark-btn" type="submit"><Send size={14} /> Reply</button>
              </form>
            </article>
          ))}
          {!discussions.length && <div className="quiet-banner"><strong>No discussion yet.</strong><p>Student course comments will appear here.</p></div>}
        </div>
      )}
    </section>
  );
}

function EmailSettingsAdmin() {
  const [settings, setSettings] = useState({});
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testEmail, setTestEmail] = useState("");

  async function load() {
    const result = await api("/admin/settings");
    setSettings({
      email_notifications_enabled: result.email_notifications_enabled || "false",
      email_school_name: result.email_school_name || "Champion International Bible Institute",
      email_from_name: result.email_from_name || "CIBI Admissions",
      email_from_address: result.email_from_address || "",
      email_reply_to: result.email_reply_to || "",
      email_admin_recipients: result.email_admin_recipients || "",
      email_smtp_host: result.email_smtp_host || "",
      email_smtp_port: result.email_smtp_port || "587",
      email_smtp_user: result.email_smtp_user || "",
      email_smtp_password: result.email_smtp_password || "",
      email_smtp_secure: result.email_smtp_secure || "false",
      email_base_url: result.email_base_url || window.location.origin,
      email_footer_text: result.email_footer_text || "Raising world class ministers"
    });
  }

  useEffect(() => { load(); }, []);

  function updateField(key, value) {
    setSettings((current) => ({ ...current, [key]: value }));
  }

  async function submit(e) {
    e.preventDefault();
    try {
      setSaving(true);
      const saved = await api("/admin/settings", { method: "PATCH", body: settings });
      setSettings((current) => ({ ...current, ...saved }));
      showToast("Email notification settings saved.", "success");
    } catch (error) {
      showToast(error.message || "Could not save email settings", "error");
    } finally {
      setSaving(false);
    }
  }

  async function sendTestEmail() {
    const to = testEmail || settings.email_admin_recipients || settings.email_from_address;
    if (!to) {
      showToast("Enter a test email address or admin recipient email first.", "error");
      return;
    }
    try {
      setTesting(true);
      const result = await api("/admin/email/test", { method: "POST", body: { to } });
      showToast(result.message || "Test email request completed.", result.message?.includes("not sent") ? "error" : "success");
    } catch (error) {
      showToast(error.message || "Could not send test email", "error");
    } finally {
      setTesting(false);
    }
  }

  return (
    <section className="admin-section email-settings-panel">
      <div className="content-editor-header students-admin-header">
        <div>
          <span>Communication</span>
          <h2>Email Settings</h2>
          <p>Send automatic email notifications for admissions, payments, support replies, assignments, quizzes and certificates.</p>
        </div>
        <button className="gold-btn" type="button" onClick={load}>Refresh</button>
      </div>

      <form className="admin-form email-settings-form" onSubmit={submit}>
        <div className="email-settings-grid">
          <div className="email-settings-card">
            <h3>Notification Control</h3>
            <label className="checkbox-field email-toggle-field">
              <input type="checkbox" checked={settings.email_notifications_enabled === "true"} onChange={(e) => updateField("email_notifications_enabled", e.target.checked ? "true" : "false")} />
              Enable email notifications
            </label>
            <label className="content-field content-field-wide">
              <span>School email name</span>
              <input value={settings.email_school_name || ""} onChange={(e) => updateField("email_school_name", e.target.value)} placeholder="Champion International Bible Institute" />
            </label>
            <label className="content-field content-field-wide">
              <span>Website / portal base URL</span>
              <input value={settings.email_base_url || ""} onChange={(e) => updateField("email_base_url", e.target.value)} placeholder="https://yourdomain.com" />
            </label>
            <label className="content-field content-field-wide">
              <span>Email footer text</span>
              <input value={settings.email_footer_text || ""} onChange={(e) => updateField("email_footer_text", e.target.value)} placeholder="Raising world class ministers" />
            </label>
          </div>

          <div className="email-settings-card">
            <h3>Sender Details</h3>
            <label className="content-field content-field-wide">
              <span>From name</span>
              <input value={settings.email_from_name || ""} onChange={(e) => updateField("email_from_name", e.target.value)} placeholder="CIBI Admissions" />
            </label>
            <label className="content-field content-field-wide">
              <span>From email address</span>
              <input type="email" value={settings.email_from_address || ""} onChange={(e) => updateField("email_from_address", e.target.value)} placeholder="noreply@yourdomain.com" />
            </label>
            <label className="content-field content-field-wide">
              <span>Reply-to email</span>
              <input type="email" value={settings.email_reply_to || ""} onChange={(e) => updateField("email_reply_to", e.target.value)} placeholder="admissions@yourdomain.com" />
            </label>
            <label className="content-field content-field-wide">
              <span>Admin recipients</span>
              <textarea value={settings.email_admin_recipients || ""} onChange={(e) => updateField("email_admin_recipients", e.target.value)} placeholder="admin@crobic.org\nadmissions@crobic.org" />
            </label>
          </div>

          <div className="email-settings-card">
            <h3>SMTP Settings</h3>
            <label className="content-field content-field-wide">
              <span>SMTP host</span>
              <input value={settings.email_smtp_host || ""} onChange={(e) => updateField("email_smtp_host", e.target.value)} placeholder="smtp.gmail.com or mail.yourdomain.com" />
            </label>
            <div className="email-two-cols">
              <label className="content-field">
                <span>SMTP port</span>
                <input value={settings.email_smtp_port || "587"} onChange={(e) => updateField("email_smtp_port", e.target.value)} placeholder="587" />
              </label>
              <label className="checkbox-field email-secure-field">
                <input type="checkbox" checked={settings.email_smtp_secure === "true"} onChange={(e) => updateField("email_smtp_secure", e.target.checked ? "true" : "false")} />
                Use SSL / secure port
              </label>
            </div>
            <label className="content-field content-field-wide">
              <span>SMTP username</span>
              <input value={settings.email_smtp_user || ""} onChange={(e) => updateField("email_smtp_user", e.target.value)} placeholder="email username" />
            </label>
            <label className="content-field content-field-wide">
              <span>SMTP password / app password</span>
              <input type="password" value={settings.email_smtp_password || ""} onChange={(e) => updateField("email_smtp_password", e.target.value)} placeholder="SMTP password" />
            </label>
          </div>

          <div className="email-settings-card email-test-card">
            <h3>Test Email</h3>
            <p>After saving SMTP details, send a test email to confirm delivery before going live.</p>
            <input value={testEmail} onChange={(e) => setTestEmail(e.target.value)} placeholder="test@example.com" />
            <button className="dark-btn" type="button" onClick={sendTestEmail} disabled={testing}>{testing ? "Sending..." : "Send Test Email"}</button>
          </div>
        </div>

        <div className="content-save-footer email-save-footer">
          <button className="gold-btn" type="submit" disabled={saving}>{saving ? "Saving..." : "Save Email Settings"}</button>
        </div>
      </form>
    </section>
  );
}

function SettingsAdmin({ reloadPublic }) {
  const [settings, setSettings] = useState({});
  async function load() { setSettings(await api("/admin/settings")); }
  useEffect(() => { load(); }, []);
  async function submit(e) { e.preventDefault(); const savedSettings = await api("/admin/settings", { method: "PATCH", body: settings }); setSettings(savedSettings); await reloadPublic(); showToast("Settings saved and synced", "success"); }
  return <section className="admin-section"><h2>Settings</h2><form className="admin-form" onSubmit={submit}><input placeholder="Student WhatsApp Group Link" value={settings.student_whatsapp_group_link || ""} onChange={(e) => setSettings({ ...settings, student_whatsapp_group_link: e.target.value })} /><input placeholder="Bank Name" value={settings.bank_name || ""} onChange={(e) => setSettings({ ...settings, bank_name: e.target.value })} /><input placeholder="Account Name" value={settings.account_name || ""} onChange={(e) => setSettings({ ...settings, account_name: e.target.value })} /><input placeholder="Account Number" value={settings.account_number || ""} onChange={(e) => setSettings({ ...settings, account_number: e.target.value })} /><button className="gold-btn">Save Settings</button></form></section>;
}

const COUNTRY_OPTIONS = [
  { name: "Nigeria", code: "NG", dialCode: "+234" },
  { name: "Ghana", code: "GH", dialCode: "+233" },
  { name: "United States", code: "US", dialCode: "+1" },
  { name: "United Kingdom", code: "GB", dialCode: "+44" },
  { name: "Canada", code: "CA", dialCode: "+1" },
  { name: "South Africa", code: "ZA", dialCode: "+27" },
  { name: "Kenya", code: "KE", dialCode: "+254" },
  { name: "Uganda", code: "UG", dialCode: "+256" },
  { name: "Tanzania", code: "TZ", dialCode: "+255" },
  { name: "Rwanda", code: "RW", dialCode: "+250" },
  { name: "Cameroon", code: "CM", dialCode: "+237" },
  { name: "Benin", code: "BJ", dialCode: "+229" },
  { name: "Togo", code: "TG", dialCode: "+228" },
  { name: "Sierra Leone", code: "SL", dialCode: "+232" },
  { name: "Liberia", code: "LR", dialCode: "+231" },
  { name: "Ethiopia", code: "ET", dialCode: "+251" },
  { name: "Zambia", code: "ZM", dialCode: "+260" },
  { name: "Zimbabwe", code: "ZW", dialCode: "+263" },
  { name: "United Arab Emirates", code: "AE", dialCode: "+971" },
  { name: "Qatar", code: "QA", dialCode: "+974" },
  { name: "Saudi Arabia", code: "SA", dialCode: "+966" },
  { name: "Australia", code: "AU", dialCode: "+61" },
  { name: "Germany", code: "DE", dialCode: "+49" },
  { name: "France", code: "FR", dialCode: "+33" },
  { name: "Italy", code: "IT", dialCode: "+39" },
  { name: "Spain", code: "ES", dialCode: "+34" },
  { name: "Netherlands", code: "NL", dialCode: "+31" },
  { name: "Ireland", code: "IE", dialCode: "+353" },
  { name: "Singapore", code: "SG", dialCode: "+65" },
  { name: "Malaysia", code: "MY", dialCode: "+60" },
  { name: "China", code: "CN", dialCode: "+86" },
  { name: "India", code: "IN", dialCode: "+91" }
];

function getProgrammeOptionId(item = {}) {
  const raw = item?.id ?? item?.programmeId ?? item?.courseId ?? "";
  return raw === null || raw === undefined ? "" : String(raw);
}

function findCountry(value) {
  const text = String(value || "").trim().toLowerCase();
  if (!text) return null;
  return (
    COUNTRY_OPTIONS.find((item) => item.name.toLowerCase() === text || item.code.toLowerCase() === text) ||
    COUNTRY_OPTIONS.find((item) => item.name.toLowerCase().startsWith(text)) ||
    COUNTRY_OPTIONS.find((item) => item.name.toLowerCase().includes(text)) || null
  );
}

function AuthModal({ mode, setMode, close, setUser, goTo, courses = [], programmes = [], settings = {} }) {
  const availableCourses = registrationProgrammeList(programmes, courses);
  const learningStreams = settingPoints(settings, "admission_learning_streams", ["Regular Classes", "Executive Classes"]);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    country: "",
    password: "",
    confirmPassword: "",
    courseId: availableCourses[0]?.id ? String(availableCourses[0].id) : "",
    learningStream: learningStreams[0] || "Regular Classes"
  });
  const selectedCountry = findCountry(form.country);
  const [countryMenuOpen, setCountryMenuOpen] = useState(false);
  const [countrySearch, setCountrySearch] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const isRegister = mode === "register";
  const countrySearchText = String(countrySearch || "").trim().toLowerCase();
  const countryMatches = countrySearchText
    ? COUNTRY_OPTIONS.filter((country) =>
        country.name.toLowerCase().includes(countrySearchText) ||
        country.code.toLowerCase().includes(countrySearchText) ||
        country.dialCode.includes(countrySearchText)
      )
    : COUNTRY_OPTIONS;

  useEffect(() => {
    if (isRegister && !form.courseId && availableCourses[0]?.id) {
      setForm((current) => ({ ...current, courseId: String(availableCourses[0].id) }));
    }
  }, [isRegister, availableCourses[0]?.id]);

  function updateField(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(e) {
    e.preventDefault();
    try {
      const endpoint = isRegister ? "/auth/register" : "/auth/login";
      const selectedProgramme = availableCourses.find((course) => String(course.id) === String(form.courseId));
      const selectedProgrammeId = registrationProgrammePayloadId(selectedProgramme);

      if (isRegister && (!selectedProgrammeId || Number.isNaN(selectedProgrammeId))) {
        showToast("Please select the programme you are applying for.", "error");
        return;
      }

      if (isRegister && !form.learningStream) {
        showToast("Please select your learning stream before creating your student account.", "error");
        return;
      }
      if (isRegister && form.password !== form.confirmPassword) {
        showToast("Passwords do not match.", "error");
        return;
      }

      const { confirmPassword, ...safeForm } = form;
      const payload = isRegister
        ? {
            ...safeForm,
            programmeId: selectedProgrammeId,
            country: selectedCountry?.name || form.country,
            phone: form.phone ? `${selectedCountry?.dialCode || ""} ${form.phone}`.trim() : "",
            applicationSource: "QUICK_REGISTER"
          }
        : { email: form.email, password: form.password };
      const result = await api(endpoint, { method: "POST", body: payload });
      setToken(null);
      setUser(result.user);
      close();
      goTo(isStaffUser(result.user) ? "admin" : result.user.status === "ACTIVE" ? "student" : "admissions");
    } catch (error) {
      showToast(error.message, "error");
    }
  }

  return (
    <div className="modal-backdrop auth-backdrop">
      <div className={`auth-modal auth-modal-premium ${isRegister ? "auth-modal-register" : "auth-modal-login"}`}>
        <button type="button" className="close-btn auth-close-btn" onClick={close} aria-label="Close"><X /></button>

        <div className="auth-modal-grid">
          <aside className="auth-brand-panel">
            <img src={LOGO} alt="CIBI Logo" />
            <p className="eyebrow framed">Champion International Bible Institute</p>
            <h2>{isRegister ? "Begin Your CIBI Journey" : "Welcome Back"}</h2>
            <p>
              {isRegister
                ? "Create your student application. Programme and learning stream are required before payment and admin approval."
                : "Login securely to continue to your student or admin portal."}
            </p>
            <div className="auth-mini-points">
              <span><CheckCircle size={14} /> Secure portal access</span>
              <span><CheckCircle size={14} /> Programme-based course access</span>
              <span><CheckCircle size={14} /> Certificate carries your completed programme</span>
            </div>
          </aside>

          <section className="auth-form-panel">
            <div className="auth-tabs auth-tabs-premium">
              <button type="button" className={mode === "login" ? "active-auth" : ""} onClick={() => setMode("login")}>Login</button>
              <button type="button" className={mode === "register" ? "active-auth" : ""} onClick={() => setMode("register")}>Register</button>
            </div>

            <div className="auth-heading-block">
              <span>{isRegister ? "Student Application" : "Portal Login"}</span>
              <h2>{isRegister ? "Create Application" : "Login"}</h2>
              <p>{isRegister ? "Use your correct details and choose your programme before payment." : "Enter your email and password to continue."}</p>
            </div>

            <form onSubmit={submit} className="auth-form premium-auth-form">
              {isRegister && (
                <>
                  <label className="auth-field">
                    <span>Full name</span>
                    <input placeholder="e.g Justice Emmanuel" value={form.name} onChange={(e) => updateField("name", e.target.value)} required />
                  </label>

                  <div className="auth-two-cols">
                    <div className="auth-field country-combobox-field">
                      <span>Country</span>
                      <div className="country-combobox">
                        <input
                          placeholder="Select or type country"
                          value={countryMenuOpen ? countrySearch : form.country}
                          onFocus={() => {
                            setCountrySearch("");
                            setCountryMenuOpen(true);
                          }}
                          onBlur={() => window.setTimeout(() => setCountryMenuOpen(false), 160)}
                          onChange={(e) => {
                            setCountrySearch(e.target.value);
                            setCountryMenuOpen(true);
                          }}
                          aria-label="Country"
                          aria-expanded={countryMenuOpen}
                          aria-controls="cibi-country-menu"
                          required
                        />
                        <button
                          type="button"
                          className="country-combobox-toggle"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            setCountrySearch("");
                            setCountryMenuOpen((open) => !open);
                          }}
                          aria-label="Show countries"
                        >
                          <ChevronDown size={18} />
                        </button>

                        {countryMenuOpen && (
                          <div className="country-combobox-menu" id="cibi-country-menu">
                            {countryMatches.length ? countryMatches.map((country) => (
                              <button
                                type="button"
                                key={country.code}
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  updateField("country", country.name);
                                  setCountrySearch("");
                                  setCountryMenuOpen(false);
                                }}
                              >
                                <strong>{country.name}</strong>
                                <small>{country.dialCode}</small>
                              </button>
                            )) : (
                              <div className="country-combobox-empty">No country found</div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <label className="auth-field">
                      <span>Phone number</span>
                      <div className="phone-input-wrap">
                        <b>{selectedCountry?.dialCode || "+"}</b>
                        <input
                          inputMode="tel"
                          placeholder="Phone number"
                          value={form.phone}
                          onChange={(e) => updateField("phone", e.target.value.replace(/[^0-9 ]/g, ""))}
                        />
                      </div>
                    </label>
                  </div>

                  <label className="auth-field">
                    <span>Programme</span>
                    <select value={String(form.courseId || "")} onChange={(e) => updateField("courseId", e.target.value)} required>
                      <option value="">Select programme</option>
                      {availableCourses.map((course) => (
                        <option key={course.id} value={String(course.id)}>{course.title}</option>
                      ))}
                    </select>
                  </label>

                  <label className="auth-field">
                    <span>Learning stream</span>
                    <select value={form.learningStream} onChange={(e) => updateField("learningStream", e.target.value)} required>
                      {learningStreams.map((stream) => <option key={stream} value={stream}>{stream}</option>)}
                    </select>
                  </label>

                  {!availableCourses.length && (
                    <div className="quiet-banner small-quiet">
                      <strong>No active programme yet.</strong>
                      <p>Admin must publish a programme before student registration can continue.</p>
                    </div>
                  )}
                </>
              )}

              <label className="auth-field">
                <span>Email address</span>
                <input type="email" placeholder="you@example.com" value={form.email} onChange={(e) => updateField("email", e.target.value)} required />
              </label>

              <label className="auth-field auth-password-field">
                <span>Password</span>
                <div className="password-input-wrap">
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter password"
                    value={form.password}
                    onChange={(e) => updateField("password", e.target.value)}
                    required
                  />
                  <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label="Toggle password visibility">
                    {showPassword ? "HIDE" : "SHOW"}
                  </button>
                </div>
              </label>

              {isRegister && (
                <label className="auth-field auth-password-field">
                  <span>Confirm password</span>
                  <div className="password-input-wrap">
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="Confirm password"
                      value={form.confirmPassword}
                      onChange={(e) => updateField("confirmPassword", e.target.value)}
                      required
                    />
                    <button type="button" onClick={() => setShowConfirmPassword((value) => !value)} aria-label="Toggle confirm password visibility">
                      {showConfirmPassword ? "HIDE" : "SHOW"}
                    </button>
                  </div>
                </label>
              )}

              <button className="gold-btn full auth-submit-btn" type="submit" disabled={isRegister && !availableCourses.length}>{isRegister ? "Create Application" : "Login Securely"}</button>
              {isRegister ? <button className="dark-btn full" type="button" onClick={() => { close(); goTo("admissions"); }}>Use Full Admission Form</button> : null}
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}


function CourseCard({ course, openAuth, user, goTo, settings = {} }) {
  const fee = usdFee(course);
  return <div className="course-card"><img src={course.imageUrl || CIBI_IMAGES.classroom} alt={course.title} /><div><span>{course.level}</span><h3>{course.title}</h3><div className="meta-line"><Clock size={13} /> <small>{course.duration || course.level || "Program"}</small></div><p>{course.description}</p>{fee > 0 && <strong>{programmeFeeText(course)}</strong>}<button className="gold-btn full" onClick={() => user ? goTo("admissions") : openAuth("register")}>Apply for Course <ArrowRight size={14} /></button></div></div>;
}
function BookCard({ book }) { return <div className="book-card"><img src={book.imageUrl || CIBI_IMAGES.logo} alt={book.title} /><div><span>{book.category}</span><h3>{book.title}</h3><p>{book.description}</p><strong>{book.price}</strong><a className="gold-btn full" href={book.buyLink} target="_blank" rel="noreferrer">Buy Book</a></div></div>; }
function Feature({ icon, title, text }) { return <div className="feature-card"><div className="icon-box">{icon}</div><h3>{title}</h3><p>{text}</p></div>; }
function SectionIntro({ eyebrow, title, text }) { return <div className="section-intro"><Kicker text={eyebrow} center /><h2>{title}</h2><p>{text}</p><div className="gold-divider"><span /></div></div>; }
function Kicker({ text, center }) { return <div className={center ? "kicker kicker-center" : "kicker"}><span /> <small>{text}</small> <span /></div>; }
function PageHero({ eyebrow, title, text, image }) { return <section className="page-hero"><div className="page-hero-bg" style={{ backgroundImage: `url(${image})` }} /><div className="page-hero-overlay" /><div className="container page-hero-content"><Kicker text={eyebrow} /><h1>{title}</h1><p>{text}</p></div></section>; }
function DashboardCard({ icon, label, value }) { return <div className="dashboard-card"><div className="icon-box">{icon}</div><span>{label}</span><strong>{value}</strong></div>; }
function Step({ number, title, text }) { return <div className="step"><strong>{number}</strong><h3>{title}</h3><p>{text}</p></div>; }
function PathCard({ icon, title, text, points }) { return <div className="path-card"><div className="icon-box">{icon}</div><h3>{title}</h3><div className="short-gold-line" /><p>{text}</p><small>Ideal For</small><ul>{points.map((point) => <li key={point}><span />{point}</li>)}</ul></div>; }
function AdminList({ items, onDelete, onEdit }) { return <div className="admin-list">{items.map((item) => <div className="admin-item" key={item.id}><div><strong>{item.title}</strong><p>ID: {item.id}</p></div><div className="admin-item-actions">{onEdit && <button className="edit-btn" onClick={() => onEdit(item)}>Edit</button>}<button className="delete-btn" onClick={() => onDelete(item.id)}><Trash2 size={18} /></button></div></div>)}</div>; }
function PortalSidebar({ title, items, tab, setTab }) { return <div className="portal-sidebar"><img src={LOGO} alt="CIBI" /><h3>{title}</h3>{items.map((item) => <button key={item} className={tab === item.toLowerCase() ? "side-active" : ""} onClick={() => setTab && setTab(item.toLowerCase())}>{item}</button>)}</div>; }
function AccessGate({ title, openAuth }) { return <main className="page container gate"><ShieldCheck size={56} /><h1>{title}</h1><p>You need to login before accessing this section.</p><button className="gold-btn big" onClick={openAuth}>Login</button></main>; }
function Footer({ goTo, settings = {} }) {
  return (
    <footer className="footer">
      <div className="footer-line" />

      <div className="container footer-grid">
        <div>
          <img src={LOGO} alt="CIBI" />
          <h3>{getSetting(settings, "footer_brand_title", "CIBI")}</h3>
          <p>{getSetting(settings, "footer_brand_text", "Champion International Bible Institute")}</p>
          <small>{getSetting(settings, "footer_brand_small", "Raising a Generation of Champions")}</small>
        </div>

        <div>
          <h4>Navigation</h4>
          <button onClick={() => goTo("home")}>Home</button>
          <button onClick={() => goTo("about")}>About</button>
          <button onClick={() => goTo("programs")}>Programs</button>
          <button onClick={() => goTo("admissions")}>Admission</button>
          <button onClick={() => goTo("gallery")}>Gallery</button>
          <button onClick={() => goTo("contact")}>Contact</button>
        </div>

        <div>
          <h4>Explore</h4>
          <button onClick={() => goTo("library")}>Book Library</button>
          <button onClick={() => goTo("programs")}>Regular Classes</button>
          <button onClick={() => goTo("programs")}>Executive Classes</button>
          <button onClick={() => goTo("admissions")}>Apply for Admission</button>
        </div>

        <div>
          <h4>Contact</h4>
          <p>{CIBI_ADDRESS}</p>
          <p>{CIBI_PHONE_DISPLAY}</p>
          <p>{getSetting(settings, "footer_email", getSetting(settings, "contact_email", "info@cibionline.org"))}</p>
          <a className="footer-whatsapp-link" href={CIBI_WHATSAPP_LINK} target="_blank" rel="noreferrer">WhatsApp Customer Care</a>
        </div>
      </div>

      <div className="container footer-bottom">
        <p>{getSetting(settings, "footer_copyright", "© 2026 Champion International Bible Institute (CIBI). All Rights Reserved.")}</p>
        <p>{getSetting(settings, "footer_bottom_note", "The Biblical Arm of Champions Royal Assembly International")}</p>
      </div>
    </footer>
  );
}

createRoot(document.getElementById("root")).render(<App />);