// ============================================================================
// Admin-triggered receipt (re)send — called from admin.html's
// "Send receipt to client" button. Regenerates the PDF from current quote
// data (so it's always accurate) and emails it via Resend.
// Deploy: supabase functions deploy send-receipt-email
// Secrets needed: RESEND_API_KEY, RECEIPT_FROM_EMAIL (optional)
// ============================================================================

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildReceiptPdf } from "../_shared/receipt-pdf.ts";

serve(async (req) => {
  try {
    // Verify the caller is a logged-in staff/admin user (this function is
    // deployed WITH JWT verification, so req already carries a valid user
    // token — we still re-check their role against the DB below).
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

    const { quote_id } = await req.json();
    if (!quote_id) return new Response(JSON.stringify({ error: "quote_id is required" }), { status: 400 });

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user } } = await supabaseUser.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: profile } = await supabaseAdmin.from("profiles").select("role").eq("id", user.id).single();
    if (!profile || !["staff", "admin"].includes(profile.role)) {
      return new Response(JSON.stringify({ error: "Forbidden — staff only" }), { status: 403 });
    }

    const { data: quote, error } = await supabaseAdmin.from("quotes").select("*").eq("id", quote_id).single();
    if (error || !quote) return new Response(JSON.stringify({ error: "Quote not found" }), { status: 404 });

    const pdfBytes = await buildReceiptPdf(quote);
    const path = `${quote.id}.pdf`;

    await supabaseAdmin.storage.from("receipts").upload(path, pdfBytes, {
      contentType: "application/pdf",
      upsert: true,
    });

    const { data: pub } = supabaseAdmin.storage.from("receipts").getPublicUrl(path);
    await supabaseAdmin
      .from("quotes")
      .update({ receipt_url: pub.publicUrl, receipt_generated_at: new Date().toISOString() })
      .eq("id", quote.id);

    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) {
      return new Response(JSON.stringify({ error: "RESEND_API_KEY not configured", receipt_url: pub.publicUrl }), { status: 200 });
    }

    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: Deno.env.get("RECEIPT_FROM_EMAIL") || "receipts@paramount-logistics.example",
        to: quote.email,
        subject: "Your Paramount Logistics payment receipt",
        html: `<p>Hi ${quote.full_name},</p><p>Please find your payment receipt attached.</p>`,
        attachments: [{ filename: "receipt.pdf", content: btoa(String.fromCharCode(...pdfBytes)) }],
      }),
    });

    if (!emailRes.ok) {
      return new Response(JSON.stringify({ error: "Email send failed", receipt_url: pub.publicUrl }), { status: 502 });
    }

    return new Response(JSON.stringify({ ok: true, receipt_url: pub.publicUrl }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
