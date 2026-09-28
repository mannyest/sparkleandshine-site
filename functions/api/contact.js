/**
 * POST /api/contact  —  Cloudflare Pages Function
 *
 * Takes the contact form, checks it, and emails it on via Resend.
 *
 * Environment variables (set in the Cloudflare dashboard):
 *   RESEND_API_KEY  (required, secret)  your Resend API key, starts "re_"
 *   CONTACT_TO      (required)          the inbox that receives enquiries
 *   CONTACT_FROM    (optional)          defaults to Resend's shared sender
 *
 * Replies with JSON when the browser asks for it (the form's fetch does),
 * and with a plain redirect otherwise, so the form still works with
 * JavaScript switched off.
 */

const MAX = { name: 100, email: 200, kind: 60, eventDate: 20, message: 4000 };

function clean(value, limit) {
  return String(value ?? "").trim().slice(0, limit);
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

function wantsJson(request) {
  return (request.headers.get("accept") || "").includes("application/json");
}

/**
 * The form's fetch() asks for JSON. A browser with JavaScript switched off
 * posts the form the old-fashioned way and gets a real page back — so the
 * form works either way.
 */
function respond(request, url, status, payload) {
  if (wantsJson(request)) {
    return new Response(JSON.stringify(payload), {
      status,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }

  const ok = status === 200;
  const heading = ok ? "Thank you!" : "That didn't send";
  const body = ok
    ? "Your message is on its way. We'll reply by email as soon as we can."
    : escapeHtml(payload.error || "Something went wrong. Please try again.");

  const page = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>${escapeHtml(heading)} — Sparkle &amp; Shine</title>
<style>
  body{margin:0;min-height:100vh;display:grid;place-items:center;padding:2rem;
       font-family:Georgia,"Times New Roman",serif;color:#141414;
       background:linear-gradient(168deg,#8FB6F5,#C3C4E8 27%,#F6D6D9 51%,#FDE6CF 76%,#FDF3E4)}
  .box{max-width:32rem;text-align:center;background:rgba(255,253,247,.85);
       border:3px solid #161616;border-radius:22px;box-shadow:0 6px 0 rgba(22,22,22,.85);
       padding:2.2rem 1.8rem}
  h1{margin:0 0 .5em;font-size:2rem;line-height:1.1}
  p{margin:0 0 1.5em;line-height:1.6}
  a{display:inline-block;background:#FFF292;color:#161616;text-decoration:none;
    border:2.5px solid #161616;border-radius:999px;box-shadow:0 4px 0 #161616;
    padding:.75em 1.5em;font-weight:700}
</style></head>
<body><main class="box">
  <h1>${escapeHtml(heading)}</h1>
  <p>${body}</p>
  <a href="/">Back to Sparkle &amp; Shine</a>
</main></body></html>`;

  return new Response(page, {
    status,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

export async function onRequestPost({ request, env }) {
  const url = new URL(request.url);

  let form;
  try {
    form = await request.formData();
  } catch {
    return respond(request, url, 400, { error: "We couldn't read that submission." });
  }

  // --- honeypot: real people never fill this in ---------------------------
  if (clean(form.get("website"), 200)) {
    // Look like a success so the bot doesn't retry with a different shape.
    return respond(request, url, 200, { ok: true });
  }

  // --- validate ----------------------------------------------------------
  const name = clean(form.get("name"), MAX.name);
  const email = clean(form.get("email"), MAX.email);
  const kind = clean(form.get("kind"), MAX.kind) || "Not specified";
  const eventDate = clean(form.get("eventDate"), MAX.eventDate);
  const message = clean(form.get("message"), MAX.message);

  if (!name || !email || !message) {
    return respond(request, url, 400, { error: "Please fill in your name, email and message." });
  }
  if (!isEmail(email)) {
    return respond(request, url, 400, { error: "That email address doesn't look quite right." });
  }

  // --- configuration -----------------------------------------------------
  const apiKey = env.RESEND_API_KEY;
  const to = env.CONTACT_TO;
  const from = env.CONTACT_FROM || "Sparkle & Shine <onboarding@resend.dev>";

  if (!apiKey || !to) {
    console.error("contact: RESEND_API_KEY or CONTACT_TO is not set");
    return respond(request, url, 500, {
      error: "The contact form isn't finished being set up yet. Please try again later.",
    });
  }

  // --- compose -----------------------------------------------------------
  const rows = [
    ["Name", name],
    ["Email", email],
    ["Needs", kind],
    ["Needed by", eventDate || "—"],
  ];

  const html = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;line-height:1.55;color:#141414">
      <h2 style="margin:0 0 .6em">New enquiry from the website</h2>
      <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:1.2em">
        ${rows.map(([k, v]) => `
          <tr>
            <td style="padding:.3em 1.2em .3em 0;color:#666;vertical-align:top">${escapeHtml(k)}</td>
            <td style="padding:.3em 0"><strong>${escapeHtml(v)}</strong></td>
          </tr>`).join("")}
      </table>
      <div style="padding:1em 1.2em;background:#FDF3E4;border-radius:10px;white-space:pre-wrap">${escapeHtml(message)}</div>
    </div>`;

  const text =
    `New enquiry from the website\n\n` +
    rows.map(([k, v]) => `${k}: ${v}`).join("\n") +
    `\n\n${message}\n`;

  // --- send --------------------------------------------------------------
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        // so hitting Reply in the mail app writes back to the customer
        reply_to: email,
        subject: `Sparkle & Shine — ${kind} enquiry from ${name}`,
        html,
        text,
      }),
    });

    if (!res.ok) {
      console.error("contact: resend responded", res.status, await res.text());
      return respond(request, url, 502, {
        error: "We couldn't send that just now. Please try again in a few minutes.",
      });
    }
  } catch (err) {
    console.error("contact: send failed", err);
    return respond(request, url, 502, {
      error: "We couldn't send that just now. Please try again in a few minutes.",
    });
  }

  return respond(request, url, 200, { ok: true });
}

/** Someone opening /api/contact in a browser gets a sentence, not a mystery error. */
export async function onRequestGet() {
  return new Response("This endpoint only accepts form submissions.", {
    status: 405,
    headers: { allow: "POST", "content-type": "text/plain; charset=utf-8" },
  });
}
