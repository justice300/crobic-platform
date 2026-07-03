import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export function appBaseUrl() {
  return (process.env.CLIENT_URL || process.env.FRONTEND_URL || "http://localhost:5173").replace(/\/$/, "");
}

export function apiBaseUrl() {
  return (process.env.PUBLIC_API_URL || process.env.API_PUBLIC_URL || "http://localhost:5000").replace(/\/$/, "");
}

function brandEmailShell({ title, bodyHtml, buttonText, buttonUrl }) {
  const button = buttonText && buttonUrl
    ? `<p style="margin:28px 0"><a href="${buttonUrl}" style="background:#c49f64;color:#070b18;padding:14px 24px;text-decoration:none;font-weight:800;letter-spacing:.08em;text-transform:uppercase;border-radius:4px">${buttonText}</a></p>`
    : "";
  return `
  <div style="margin:0;padding:0;background:#f8f3e9;font-family:Inter,Arial,sans-serif;color:#111827">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:28px 14px;background:#f8f3e9">
      <tr><td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border:1px solid rgba(17,24,39,.1);border-radius:10px;overflow:hidden">
          <tr><td style="background:#070b18;padding:28px 30px;border-bottom:3px solid #c49f64">
            <img src="${appBaseUrl()}/crobic-images/cra-logo.png" alt="CIBI" width="64" style="display:block;margin-bottom:14px" />
            <div style="color:#c49f64;font-size:11px;letter-spacing:.22em;text-transform:uppercase;font-weight:800">Champion International Bible Institute</div>
            <h1 style="margin:12px 0 0;color:#ffffff;font-size:28px;line-height:1.15;font-family:Georgia,serif">${title}</h1>
          </td></tr>
          <tr><td style="padding:32px 30px;font-size:15px;line-height:1.75;color:#374151">${bodyHtml}${button}</td></tr>
          <tr><td style="padding:20px 30px;background:#fbf7ef;border-top:1px solid rgba(17,24,39,.08);font-size:12px;color:#6b7280">Reply to this email if you have questions.</td></tr>
        </table>
      </td></tr>
    </table>
  </div>`;
}

export async function sendTransactionalEmail({ to, subject, html, text, buttonText, buttonUrl, title }) {
  const recipients = Array.isArray(to) ? to.filter(Boolean) : [to].filter(Boolean);
  if (!recipients.length) return { skipped: true, reason: "No recipients" };

  if (!resend) {
    console.warn("RESEND_API_KEY is not configured; email skipped:", subject);
    return { skipped: true, reason: "RESEND_API_KEY missing" };
  }

  const from = process.env.RESEND_FROM_EMAIL || "CIBI <no-reply@crobic.org>";
  const bodyHtml = html || `<p>${String(text || "").replace(/\n/g, "<br />")}</p>`;
  return resend.emails.send({
    from,
    to: recipients,
    replyTo: process.env.RESEND_REPLY_TO || process.env.RESEND_FROM_EMAIL,
    subject,
    html: brandEmailShell({ title: title || subject, bodyHtml, buttonText, buttonUrl }),
    text: text || subject
  });
}

export function goLiveEmailHtml({ course, lecturer, title, description, liveUrl, startedAt }) {
  return `
    <p><strong>${course?.title || "CIBI Course"}</strong> is now live.</p>
    <p><strong>Lecturer:</strong> ${lecturer?.name || "CIBI Lecturer"}</p>
    <p><strong>Class:</strong> ${title}</p>
    ${description ? `<p>${description}</p>` : ""}
    <p><strong>Started:</strong> ${new Date(startedAt || Date.now()).toLocaleString()}</p>
  `;
}

export function classEndedEmailHtml({ title }) {
  return `<p>The live class <strong>${title}</strong> has ended.</p><p>The recording will be available soon.</p>`;
}

export function recordingAvailableEmailHtml({ title }) {
  return `<p>The recording of <strong>${title}</strong> is now available.</p>`;
}

export async function sendOneSignalNotification({ userIds = [], title, message, url }) {
  const appId = process.env.ONESIGNAL_APP_ID;
  const apiKey = process.env.ONESIGNAL_API_KEY;
  if (!appId || !apiKey || !userIds.length) return { skipped: true };

  const response = await fetch("https://onesignal.com/api/v1/notifications", {
    method: "POST",
    headers: {
      Authorization: `Basic ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      app_id: appId,
      include_external_user_ids: userIds.map(String),
      headings: { en: title },
      contents: { en: message },
      url
    })
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`OneSignal notification failed (${response.status}). ${text}`.trim());
  }
  return response.json();
}

export async function createDailyRoom({ name, exp, properties = {} }) {
  const apiKey = process.env.DAILY_API_KEY;
  if (!apiKey) throw new Error("DAILY_API_KEY is not configured.");

  const response = await fetch("https://api.daily.co/v1/rooms", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      privacy: "private",
      properties: {
        enable_chat: true,
        enable_screenshare: true,
        exp,
        ...properties
      }
    })
  });

  if (!response.ok) throw new Error(`Daily room creation failed: ${await response.text()}`);
  return response.json();
}

export async function createDailyMeetingToken({ roomName, userName, userId, isOwner = false, exp }) {
  const apiKey = process.env.DAILY_API_KEY;
  if (!apiKey) throw new Error("DAILY_API_KEY is not configured.");

  const response = await fetch("https://api.daily.co/v1/meeting-tokens", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      properties: {
        room_name: roomName,
        user_name: userName,
        user_id: String(userId),
        is_owner: isOwner,
        exp
      }
    })
  });

  if (!response.ok) throw new Error(`Daily token creation failed: ${await response.text()}`);
  return response.json();
}

export async function deleteDailyRoom(roomName) {
  const apiKey = process.env.DAILY_API_KEY;
  if (!apiKey || !roomName) return { skipped: true };

  const response = await fetch(`https://api.daily.co/v1/rooms/${encodeURIComponent(roomName)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${apiKey}` }
  });

  if (!response.ok && response.status !== 404) throw new Error(`Daily room delete failed: ${await response.text()}`);
  return { deleted: true };
}
