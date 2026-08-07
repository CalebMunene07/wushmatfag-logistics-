# Paramount Logistics (Static, No Node)

Plain HTML/CSS/JS — no build step, no npm, no Node required. Supabase is
loaded straight from a CDN `<script>` tag in every page.

## What's included

- `index.html` — home (glass hero, services, why-us, testimonials, CTA)
- `quote.html` — **4-step quote wizard**: Service → Details → Review → Payment (M-Pesa STK Push) → `quotes` table
- `track.html` — public tracking lookup via `track_shipment` RPC, with a working demo (`PLX-2026-000123`)
- `contact.html` — contact form → `contact_messages` table
- `login.html` — email/password login + signup (Supabase Auth)
- `dashboard.html` — logged-in client's own shipments & quotes
- `about.html`
- `css/style.css` — Egyptian blue / red / white theme, hamburger nav, glass hero, wizard stepper
- `js/` — one small vanilla-JS file per page, plus `supabase-client.js` and `nav.js` (shared)
- `supabase/schema.sql` — full Postgres schema: tables, RLS policies, triggers, tracking RPCs, payment columns, demo data
- `supabase/functions/mpesa-stk-push/` — Edge Function that triggers an M-Pesa Daraja STK push (keeps API secrets server-side)
- `supabase/functions/mpesa-callback/` — Edge Function that receives Safaricom's payment confirmation and updates the quote

## 1. Set up Supabase

1. Create a free project at https://supabase.com
2. **SQL Editor** → paste in `supabase/schema.sql` → Run
3. **Settings → API** → copy your Project URL and anon public key

## 2. Configure

Open `js/supabase-client.js` and fill in:

```js
const SUPABASE_URL = "https://YOUR-PROJECT-REF.supabase.co";
const SUPABASE_ANON_KEY = "your-anon-public-key";
```

## 3. Set up M-Pesa payments (optional but wired in)

The quote wizard's payment step calls a Supabase Edge Function so your Daraja
API secret key never touches the browser.

1. Get sandbox credentials at https://developer.safaricom.co.ke
2. `supabase functions deploy mpesa-stk-push`
3. `supabase functions deploy mpesa-callback --no-verify-jwt`
4. Set secrets:
   ```bash
   supabase secrets set MPESA_CONSUMER_KEY=xxx MPESA_CONSUMER_SECRET=xxx \
     MPESA_SHORTCODE=174379 MPESA_PASSKEY=xxx \
     MPESA_CALLBACK_URL=https://YOUR-PROJECT-REF.functions.supabase.co/mpesa-callback
   ```
5. Switch `BASE_URL` in `mpesa-stk-push/index.ts` from sandbox to
   `https://api.safaricom.co.ke` when you go live.

Until this is deployed, the "Pay & Submit" button will show a friendly error
and the visitor can use "Submit request without paying" instead — the form
still saves to `quotes` either way.

## 4. Run it

No build, no install. Just serve the folder:

- **Python:** `python3 -m http.server 8000` from this folder, then visit `http://localhost:8000`
- **PHP:** `php -S localhost:8000`
- **VS Code:** the "Live Server" extension
- Or deploy the folder as-is to Netlify, Vercel (static), GitHub Pages, or any static host

## Design notes

- **Palette:** Egyptian blue (`--navy-900`, `#1034A6`) as the primary brand
  color, red (`--amber-500`, `#d7263d`) as the accent/CTA color, white
  backgrounds. All defined as CSS variables at the top of `css/style.css` —
  change them once to re-theme the whole site.
- **Hero:** layered as Background Image → semi-transparent Egyptian-blue
  overlay → a frosted-glass panel (`backdrop-filter: blur`) holding the
  headline and buttons — a premium "glassmorphism" look. Add your photo via
  `style="background-image:url('images/hero.jpg')"` on the `.hero` /
  `.page-hero` element; the overlay and glass panel sit on top automatically.
- **Nav:** collapses to a hamburger menu under 860px, with a "Services"
  link added alongside Home / Track & Trace / Get a Quote / About / Contact.
- This is an original design in the same visual genre as freight-forwarding
  sites — glass hero, service cards, step-wizard quoting, tracking timeline —
  not a pixel copy of any specific company's branding, logo, or photography.

## Access model

- Anyone (logged out included) can submit a quote/contact message and look up
  a shipment by tracking number.
- Logged-in clients see only their own quotes/shipments on `dashboard.html`.
- `staff`/`admin` roles (set manually in the `profiles` table for now) can see
  and manage everything — build an admin page when you're ready to manage
  shipments and mark quotes reviewed/quoted from the browser instead of the
  Supabase table editor.

## Next steps you'll likely want

- An admin page for staff to update shipment status and add tracking events
- Auto-generating `tracking_number` when a quote is accepted
- Switching M-Pesa from sandbox to production credentials
- Realtime status updates on `track.html` via `supabaseClient.channel(...)`

## Staff / Admin access

- `admin.html` — staff-only quote management: filter by payment/quote status,
  see M-Pesa payment badges (Paid / Pending / Unpaid / Skipped / Failed) with
  the M-Pesa receipt/reference number and amount when available, update quote
  status, and set a quoted amount inline.
- To make a user staff: in the Supabase Table Editor, open `profiles`, find
  their row, and set `role` to `staff` (or `admin`). They'll then see an
  "Admin" link in the nav automatically.
- Access is enforced twice: the page itself checks `profiles.role` before
  rendering, and the database's RLS policies (`is_staff()` in `schema.sql`)
  block non-staff from reading/updating other people's quotes even if they
  call the API directly.

## Service pages

`services/sea-freight.html`, `air-freight.html`, `road-transport.html`,
`customs-clearance.html`, and `warehousing.html` — each with its own hero,
feature breakdown, and CTA, linked from the homepage service cards and footer.

## PDF receipts

When an M-Pesa payment is confirmed (via `mpesa-callback`), Paramount
automatically:

1. Builds a one-page PDF receipt (`supabase/functions/_shared/receipt-pdf.ts`,
   using `pdf-lib` — Egyptian-blue header band, payment details, M-Pesa
   reference).
2. Uploads it to the public `receipts` Storage bucket.
3. Saves the link on `quotes.receipt_url`.
4. Emails it to the client as a PDF attachment via **Resend**, if
   `RESEND_API_KEY` is set.

From `admin.html`, staff can **download the receipt directly** (Receipt
column → "Download PDF") or **resend it to the client** at any time via the
`send-receipt-email` function — this regenerates the PDF fresh from current
quote data and re-emails it, so it also works as a manual "generate & send"
action for payments confirmed some other way.

### Deploy the extra pieces

```bash
supabase functions deploy send-receipt-email
supabase secrets set RESEND_API_KEY=re_xxx RECEIPT_FROM_EMAIL=receipts@yourdomain.com
```

(`mpesa-callback` already covered in the M-Pesa setup section above — redeploy
it since its code now also builds/emails the receipt.)

Without `RESEND_API_KEY` set, the PDF still generates and uploads — admin can
still download it manually — the email step is just skipped.

## Hero images

The hero `<img>` (`.hero-bg-img` / `.page-hero-bg-img`) is a real full-bleed
image element (`object-fit: cover`), not a CSS background, so it always fills
the entire hero section edge-to-edge regardless of the photo's aspect ratio.
Drop your photo in `images/hero.jpg` (see `images/README.txt`) — no code
changes needed. Until then it fails gracefully and you just see the
Egyptian-blue gradient.

## Note on admin access

`admin.html` is intentionally **not linked anywhere** in the site nav or
footer — it's reached only by typing the URL directly. Access is still fully
gated by role (both client-side and via RLS), this just keeps it out of the
public navigation entirely.
