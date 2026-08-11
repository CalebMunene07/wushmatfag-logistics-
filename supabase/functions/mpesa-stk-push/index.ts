// ============================================================================
// M-Pesa Daraja "STK Push" — Supabase Edge Function
// Deploy: supabase functions deploy mpesa-stk-push
// Secrets (set via `supabase secrets set`):
//   MPESA_CONSUMER_KEY, MPESA_CONSUMER_SECRET, MPESA_SHORTCODE,
//   MPESA_PASSKEY, MPESA_CALLBACK_URL
// Sign up for Daraja API credentials at https://developer.safaricom.co.ke
//
// NOTE: MPESA_SHORTCODE (4749207) is a TILL / Buy Goods number, not a
// Paybill — TransactionType must be CustomerBuyGoodsOnline. Using
// CustomerPayBillOnline against a Till number causes Daraja to accept the
// initial request but then fail silently (no prompt ever reaches the
// phone, callback comes back with a generic error instead of a real
// success/failure).
// ============================================================================
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
const BASE_URL = "https://api.safaricom.co.ke"; // PRODUCTION

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  // Browser sends this preflight request before the real POST — without
  // handling it, the actual STK push call never even reaches this function.
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { phone, amount, account_ref } = await req.json();
    if (!phone || !amount) {
      return new Response(JSON.stringify({ error: "phone and amount are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // Normalize phone to 2547XXXXXXXX format (handles 07..., +2547..., 2547..., 7...)
    let normalizedPhone = phone.replace(/\s+/g, "").replace(/^\+/, "");
    if (normalizedPhone.startsWith("0")) normalizedPhone = "254" + normalizedPhone.slice(1);
    else if (normalizedPhone.startsWith("7") || normalizedPhone.startsWith("1")) normalizedPhone = "254" + normalizedPhone;

    const consumerKey = Deno.env.get("MPESA_CONSUMER_KEY")!;
    const consumerSecret = Deno.env.get("MPESA_CONSUMER_SECRET")!;
    const shortcode = Deno.env.get("MPESA_SHORTCODE")!;
    const passkey = Deno.env.get("MPESA_PASSKEY")!;
    const callbackUrl = Deno.env.get("MPESA_CALLBACK_URL")!;
    // 1. Get an OAuth token
    const authRes = await fetch(`${BASE_URL}/oauth/v1/generate?grant_type=client_credentials`, {
      headers: { Authorization: "Basic " + btoa(`${consumerKey}:${consumerSecret}`) },
    });
    const { access_token } = await authRes.json();
    // 2. Build the STK push request
    const timestamp = new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 14);
    const password = btoa(`${shortcode}${passkey}${timestamp}`);
    const stkRes = await fetch(`${BASE_URL}/mpesa/stkpush/v1/processrequest`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        BusinessShortCode: shortcode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: "CustomerBuyGoodsOnline", // Till/Buy Goods — was CustomerPayBillOnline
        Amount: amount,
        PartyA: normalizedPhone,
        PartyB: shortcode,
        PhoneNumber: normalizedPhone,
        CallBackURL: callbackUrl,
        AccountReference: account_ref || "WUSHMAT",
        TransactionDesc: "Wushmat FAG Ltd quote processing fee",
      }),
    });
    const stkData = await stkRes.json();
    if (stkData.ResponseCode !== "0") {
      return new Response(JSON.stringify({ error: stkData.errorMessage || "STK push failed" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return new Response(
      JSON.stringify({ checkout_request_id: stkData.CheckoutRequestID, merchant_request_id: stkData.MerchantRequestID }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
