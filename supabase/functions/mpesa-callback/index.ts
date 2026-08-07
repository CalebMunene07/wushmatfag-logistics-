// ============================================================================
// M-Pesa Daraja callback receiver — set this function's URL as
// MPESA_CALLBACK_URL in mpesa-stk-push. Safaricom POSTs the payment result
// here once the customer completes (or cancels) the STK push prompt.
//
// On a successful payment this also:
//  1. Generates a PDF receipt (supabase/functions/_shared/receipt-pdf.ts)
//  2. Uploads it to the "receipts" storage bucket
//  3. Saves the public URL on the quote (quotes.receipt_url)
//  4. Emails the receipt to the client via Resend (if RESEND_API_KEY is set)
//
// Deploy: supabase functions deploy mpesa-callback --no-verify-jwt
// ============================================================================

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildReceiptPdf } from "../_shared/receipt-pdf.ts";

serve(async (req) => {
  const body = await req.json();
  const callback = body?.Body?.stkCallback;
  if (!callback) return new Response("ignored", { status: 200 });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")! // service role — bypasses RLS, server-side only
  );

  const success = callback.ResultCode === 0;
  const items = callback.CallbackMetadata?.Item || [];
  const receipt = items.find((i: any) => i.Name === "MpesaReceiptNumber")?.Value ?? null;
  const amount = items.find((i: any) => i.Name === "Amount")?.Value ?? null;

  const { data: quote } = await supabase
    .from("quotes")
    .update({
      payment_status: success ? "paid" : "failed",
      payment_reference: receipt || callback.CheckoutRequestID,
      payment_amount: amount,
    })
    .eq("payment_reference", callback.CheckoutRequestID)
    .select()
    .single();

  if (success && quote) {
    try {
      const pdfBytes = await buildReceiptPdf(quote);
      const path = `${quote.id}.pdf`;

      await supabase.storage.from("receipts").upload(path, pdfBytes, {
        contentType: "application/pdf",
        upsert: true,
      });

      const { data: pub } = supabase.storage.from("receipts").getPublicUrl(path);

      await supabase
        .from("quotes")
        .update({ receipt_url: pub.publicUrl, receipt_generated_at: new Date().toISOString() })
        .eq("id", quote.id);

      const resendKey = Deno.env.get("RESEND_API_KEY");
      if (resendKey) {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: Deno.env.get("RECEIPT_FROM_EMAIL") || "receipts@paramount-logistics.example",
            to: quote.email,
            subject: "Your Paramount Logistics payment receipt",
            html: `<p>Hi ${quote.full_name},</p><p>Thanks for your payment. Your receipt is attached.</p>`,
            attachments: [
              { filename: "receipt.pdf", content: btoa(String.fromCharCode(...pdfBytes)) },
            ],
          }),
        });
      }
    } catch (err) {
      console.error("Receipt generation/email failed:", err);
      // Payment status is already saved — receipt failure shouldn't fail the callback response.
    }
  }

  return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: "Accepted" }), {
    headers: { "Content-Type": "application/json" },
  });
});
