# Sparkle & Shine — website

A one-page site for Sparkle & Shine, built from the Canva design. Plain HTML,
CSS and a little JavaScript, plus one Cloudflare Pages Function for the contact
form. No build step, no framework, nothing to compile — what's in this folder is
what gets served.

```
index.html                  the whole site
404.html                    shown for any unknown URL
assets/
  irelia-560.webp           the portrait, cut out, for phones
  irelia-896.webp           the same at full size, for large screens
  irelia-fallback.png       only used by browsers too old for WebP
  cientificos.webp/.png     the partner logo
  og.jpg                    preview image when the link is shared
  favicon.svg               browser tab icon
  apple-touch-icon.png      home-screen icon on iPhone
  fonts/*.woff2             Baloo 2 + Rokkitt, self-hosted
functions/api/contact.js    receives the contact form and emails it on
_headers                    caching + security headers
robots.txt, sitemap.xml, site.webmanifest
```

The site is already set up for **https://sparkleandshine.party**. If that ever
changes, search and replace it across `index.html` (5 places), `sitemap.xml` and
`robots.txt`.

---

## 1. Put it online

**Cloudflare dashboard → Workers & Pages → Create → Pages.**

Either drag this whole folder onto *Upload assets*, or connect a Git repo. If it
asks for a build command, leave it empty and set the output directory to `/`.

With the Wrangler CLI instead:

```bash
npx wrangler pages deploy . --project-name=sparkle-and-shine
```

The site works the moment it deploys. The contact form needs step 2 before it
can actually send anything.

### Pointing the domain at it

Once **sparkleandshine.party** clears, open the Pages project → *Custom domains*
→ *Set up a domain*, and enter it. If the domain is registered with Cloudflare
the DNS record is created for you; otherwise Cloudflare shows you the CNAME to
add at your registrar. The HTTPS certificate is issued automatically — it can
take a few minutes to go from "Initializing" to "Active".

---

## 2. Make the contact form send email

The form posts to `functions/api/contact.js`, which hands the message to
[Resend](https://resend.com) — free for 100 emails a day, far more than this
site will need.

**a. Get a Resend key.** Sign up at resend.com **using the address you want the
enquiries to land in**. Go to *API Keys → Create API Key* and copy the key (it
starts with `re_`). You only get to see it once.

**b. Add it to Cloudflare.** In your Pages project: *Settings → Environment
variables → Production*, add:

| Name | Value | Type |
|---|---|---|
| `RESEND_API_KEY` | the `re_…` key | **Secret** (use *Encrypt*) |
| `CONTACT_TO` | the address enquiries should go to | Plaintext |

**c. Redeploy.** Environment variables only reach the site on the next deploy —
*Deployments → … → Retry deployment* is enough.

**d. Send yourself a test message** through the live form.

### The "from" address

Until a domain is verified, Resend only sends from its own shared address, and
only *to* the address you signed up with. That's why `CONTACT_TO` has to match
your Resend account email at first — it's a Resend rule, not a bug in the site.

Once sparkleandshine.party is live, verify it in Resend (*Domains → Add Domain*,
then add the DNS records it gives you), add a third variable and redeploy:

| Name | Value |
|---|---|
| `CONTACT_FROM` | `Sparkle & Shine <hello@sparkleandshine.party>` |

After that `CONTACT_TO` can be any address you like.

### If something goes wrong

Replies go straight back to the customer — the function sets `reply_to` to
whatever address they typed, so hitting Reply just works.

If the form shows an error, open *Workers & Pages → your project → Logs* and look
for a line starting `contact:`. The two usual causes are a missing environment
variable and a `CONTACT_TO` that Resend won't send to yet (see above).

---

## 3. Changing things later

**Words** — open `index.html` and edit the text between the tags. Everything
visible on the page is in there in the order you see it, with `<!-- comments -->`
marking each section.

**Colours** — near the top of `index.html`, in the `:root` block. Every colour is
named there once, so changing `--butter` changes every yellow button at the same
time. They were sampled from the Canva file, so they match the original.

**The three service cards** — in the `<!-- SERVICES -->` section. This section
isn't in the Canva design; it was added because the nav had a "Services" link
with nowhere to go. The wording only repeats what the home page already promises
(invitations, flyers), so change it if you offer something different.

**The portrait** — it's a transparent cut-out, so the pink-to-cream backdrop
behind it comes from CSS (`.portrait-img`), not from the image. To replace it,
export a new cut-out at 896px wide and 560px wide, save them over
`assets/irelia-896.webp` and `assets/irelia-560.webp`, and update
`irelia-fallback.png` if you want the old-browser version to match.

---

## Notes on how it's built

**Mobile first, and checked on desktop.** One column below 900px with a
slide-down menu; two columns above it, where the hero fills the first screen and
the illustrations scale up to match. Verified at 320, 390, 768, 1440 and 1920px
with no horizontal scroll at any of them. Every button and link is at least 44px
tall, and form fields are 16px so iOS doesn't zoom when you tap one.

**The background** is CSS, not an image — six layered radial gradients over a
linear one, rebuilt from colours sampled out of the Canva PDF. It's one fixed
layer behind the whole page rather than one per section; repeating it per section
put a hard blue-under-cream seam at every join.

**The bunting, bouquet and stars** are SVG drawn in the page, so they stay sharp
at any size and cost almost nothing to load.

**Two things move, and only two.** On every page load the bunting strings itself
up — the rope draws on, the flags drop in — and then settles into a breeze that
runs forever, each flag lagging a fraction behind the one to its left so it reads
as one gust travelling along the string. And when a message actually sends, the
three stars beside the form pop once. The bouquet is deliberately still.

Both are pure CSS on SVG that's already in the page: no library, no extra
requests, a few hundred bytes. Nothing but `transform` and `stroke-dashoffset`
animates, so it stays on the compositor and won't drain a phone battery. To
retune the breeze, change `--flag-amp` (3.6°) and `--flag-period` (2.4s) on
`.hero-art` near the top of the stylesheet — every other timing is derived from
them.

Anyone whose device asks for reduced motion gets the banner fully strung and
perfectly still, and no star pop.

**The email address is not on the page** anywhere — it lives in an environment
variable, so it can't be scraped by spam bots.

**It works without JavaScript.** The fade-in is skipped, and the form posts
normally and gets a thank-you page back. It also respects the system
"reduce motion" accessibility setting.

**Nothing loads from another server.** The fonts are self-hosted, so there is no
third-party request anywhere on the page.

**Contrast was measured, not eyeballed.** Body text is at least 8:1 against every
part of the gradient. The heading outline is 10% darker than the Canva colour so
it clears 3:1 where the background is bluest — visually identical, but legible.
