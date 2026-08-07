// ============================================================================
// Shared: builds a one-page PDF payment receipt using pdf-lib.
// Imported by mpesa-callback (auto-generate on payment) and
// send-receipt-email (admin "Send to client" / re-send).
// ============================================================================

import { PDFDocument, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";

const EGYPTIAN_BLUE = rgb(16 / 255, 52 / 255, 166 / 255);
const RED = rgb(215 / 255, 38 / 255, 61 / 255);
const DARK = rgb(0.06, 0.09, 0.15);
const GREY = rgb(0.4, 0.45, 0.53);

export interface ReceiptQuote {
  id: string;
  full_name: string;
  email: string;
  origin: string;
  destination: string;
  mode: string;
  payment_amount: number | null;
  payment_reference: string | null;
  payment_method: string | null;
  created_at: string;
}

export async function buildReceiptPdf(quote: ReceiptQuote): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]); // A4
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  // Header band
  page.drawRectangle({ x: 0, y: 760, width: 595, height: 82, color: EGYPTIAN_BLUE });
  page.drawText("Paramount Logistics", { x: 40, y: 805, size: 20, font: bold, color: rgb(1, 1, 1) });
  page.drawText("Payment Receipt", { x: 40, y: 782, size: 11, font, color: rgb(1, 1, 1) });
  page.drawRectangle({ x: 0, y: 756, width: 595, height: 4, color: RED });

  let y = 715;
  const line = (label: string, value: string, opts: { boldValue?: boolean } = {}) => {
    page.drawText(label, { x: 40, y, size: 10, font, color: GREY });
    page.drawText(value || "—", {
      x: 220,
      y,
      size: 11,
      font: opts.boldValue ? bold : font,
      color: DARK,
    });
    y -= 26;
  };

  page.drawText("Receipt Details", { x: 40, y, size: 13, font: bold, color: DARK });
  y -= 30;

  line("Receipt / Quote Reference", quote.id.slice(0, 8).toUpperCase());
  line("Date", new Date(quote.created_at).toLocaleString());
  line("Customer", quote.full_name);
  line("Email", quote.email);
  line("Route", `${quote.origin} -> ${quote.destination}`);
  line("Service", quote.mode);

  y -= 10;
  page.drawLine({ start: { x: 40, y }, end: { x: 555, y }, thickness: 1, color: rgb(0.9, 0.91, 0.93) });
  y -= 30;

  page.drawText("Payment", { x: 40, y, size: 13, font: bold, color: DARK });
  y -= 30;

  line("Method", quote.payment_method === "mpesa" ? "M-Pesa" : (quote.payment_method || "—"));
  line("M-Pesa Reference", quote.payment_reference || "—");
  line("Amount Paid", quote.payment_amount ? `KES ${quote.payment_amount.toLocaleString()}` : "—", { boldValue: true });

  y -= 20;
  page.drawRectangle({ x: 40, y: y - 10, width: 515, height: 44, color: rgb(0.97, 0.98, 1) });
  page.drawText("This receipt confirms your processing fee payment for the above quote", {
    x: 54, y: y + 12, size: 9.5, font, color: GREY,
  });
  page.drawText("request. Our team will follow up with full shipment pricing shortly.", {
    x: 54, y: y - 2, size: 9.5, font, color: GREY,
  });

  page.drawText("Paramount Logistics — support@paramount-logistics.example", {
    x: 40, y: 40, size: 9, font, color: GREY,
  });

  return doc.save();
}
