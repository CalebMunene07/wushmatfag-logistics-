// ============================================================================
// Contact form email notifier — Supabase Edge Function
//
// Called from js/contact.js right after a contact_messages row is inserted.
// Sends a notification email to staff, and a short confirmation email back
// to the customer, both via Resend.
//
// Reuses secrets already set for the receipt-email flow:
//   RESEND_API_KEY, RECEIPT_FROM_EMAIL
// Add one more:
//   STAFF_NOTIFY_EMAIL   — where new contact messages should be sent
//
// Deploy (needs --no-verify-jwt: called from the browser, no auth header):
//   npx supabase functions deploy send-contact-email --no-verify-jwt
// ============================================================================

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { full_name, email, phone, subject, message } = await req.json();

    if (!full_name || !email || !message) {
      return new Response(JSON.stringify({ error: "full_name, email, and message are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resendKey = Deno.env.get("RESEND_API_KEY");
    const fromEmail = Deno.env.get("RECEIPT_FROM_EMAIL") || "info@wushmatfagltd.co.ke";
    const staffEmail = Deno.env.get("STAFF_NOTIFY_EMAIL");

    if (!resendKey) {
      // Not fatal — the message is already saved in contact_messages either
      // way. Just skip the email step quietly.
      return new Response(JSON.stringify({ skipped: true, reason: "RESEND_API_KEY not set" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sends = [];

    // 1. Notify staff
    if (staffEmail) {
      sends.push(
        fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: fromEmail,
            to: staffEmail,
            reply_to: email,
            subject: `New contact message: ${subject || "(no subject)"}`,
            html: `
              <p><strong>From:</strong> ${escapeHtml(full_name)} &lt;${escapeHtml(email)}&gt;</p>
              ${phone ? `<p><strong>Phone:</strong> ${escapeHtml(phone)}</p>` : ""}
              <p><strong>Subject:</strong> ${escapeHtml(subject || "(no subject)")}</p>
              <p><strong>Message:</strong></p>
              <p>${escapeHtml(message).replace(/\n/g, "<br>")}</p>
            `,
          }),
        })
      );
    }

    // 2. Confirmation back to the customer
    sends.push(
      fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: fromEmail,
          to: email,
          subject: "We've received your message — Wushmat FAG Ltd",
          html: `
            <p>Hi ${escapeHtml(full_name)},</p>
            <p>Thanks for reaching out. We've received your message and someone from our team will get back to you shortly.</p>
            <p style="color:#666; font-size:13px; margin-top:24px;">— Wushmat Family Allied Generations Ltd</p>
          `,
        }),
      })
    );

    await Promise.all(sends);

    return new Response(JSON.stringify({ sent: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
