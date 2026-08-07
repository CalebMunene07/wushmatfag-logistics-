// ============================================================================
// 4-step quote wizard: Service -> Details -> Review -> Payment
// ============================================================================

let currentStep = 1;
let selectedMode = null;

const MODE_LABELS = { sea: "Sea Freight", air: "Air Freight", road: "Road Transport", customs: "Customs Clearance", warehousing: "Warehousing" };

function goToStep(n) {
  document.querySelectorAll(".wizard-panel").forEach((p) => (p.style.display = "none"));
  document.getElementById(`panel-${n}`).style.display = "block";
  currentStep = n;

  document.querySelectorAll(".wizard-step").forEach((el) => {
    const step = Number(el.dataset.step);
    el.classList.remove("active", "done");
    if (step < n) el.classList.add("done");
    if (step === n) el.classList.add("active");
  });

  window.scrollTo({ top: 0, behavior: "smooth" });
}

// --- Step 1: service selection ---
document.querySelectorAll(".service-choice").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".service-choice").forEach((b) => b.classList.remove("selected"));
    btn.classList.add("selected");
    selectedMode = btn.dataset.mode;
    document.getElementById("to-step-2").disabled = false;
  });
});
document.getElementById("to-step-2").addEventListener("click", () => goToStep(2));

// --- Step 2: details ---
document.getElementById("to-step-1-back").addEventListener("click", () => goToStep(1));
document.getElementById("to-step-3").addEventListener("click", () => {
  const form = document.getElementById("details-form");
  if (!form.reportValidity()) return;
  renderReview();
  goToStep(3);
});

function getDetailsData() {
  return Object.fromEntries(new FormData(document.getElementById("details-form")).entries());
}

function renderReview() {
  const d = getDetailsData();
  const rows = [
    ["Service", MODE_LABELS[selectedMode] || selectedMode],
    ["Name", d.full_name],
    ["Email", d.email],
    ["Phone", d.phone],
    ["Company", d.company_name || "—"],
    ["Origin", d.origin],
    ["Destination", d.destination],
    ["Cargo", d.cargo_description || "—"],
    ["Weight (kg)", d.weight_kg || "—"],
    ["Volume (CBM)", d.volume_cbm || "—"],
    ["Container type", d.container_type || "—"],
    ["Incoterm", d.incoterm || "—"],
    ["Preferred ship date", d.preferred_ship_date || "—"],
  ];
  document.getElementById("review-content").innerHTML = rows
    .map(([label, value]) => `<div class="review-row"><span class="label">${label}</span><span class="value">${escapeHtml(String(value))}</span></div>`)
    .join("");
}

// --- Step 3: review ---
document.getElementById("to-step-2-back").addEventListener("click", () => goToStep(2));
document.getElementById("to-step-4").addEventListener("click", () => goToStep(4));

// --- Step 4: payment ---
document.getElementById("to-step-3-back").addEventListener("click", () => goToStep(3));

document.getElementById("pay-btn").addEventListener("click", async () => {
  const phone = document.getElementById("mpesa-phone").value.trim();
  const msg = document.getElementById("payment-msg");
  const btn = document.getElementById("pay-btn");

  if (!phone) {
    msg.textContent = "Enter your M-Pesa phone number.";
    msg.className = "form-msg error";
    return;
  }

  btn.disabled = true;
  btn.textContent = "Sending STK push...";
  msg.textContent = "";
  msg.className = "form-msg";

  try {
    // Server-side Edge Function holds the M-Pesa Daraja credentials and
    // performs the STK push — see supabase/functions/mpesa-stk-push/.
    const { data, error } = await supabaseClient.functions.invoke("mpesa-stk-push", {
      body: { phone, amount: 500, account_ref: "PARAMOUNT-QUOTE" },
    });

    if (error) throw error;

    msg.textContent = "Check your phone and enter your M-Pesa PIN to complete payment.";
    msg.className = "form-msg success";

    await submitQuote({ payment_status: "pending", payment_method: "mpesa", payment_reference: data?.checkout_request_id || null });
  } catch (err) {
    msg.textContent = "Could not start M-Pesa payment (STK push not configured yet). You can submit without paying for now.";
    msg.className = "form-msg error";
    btn.disabled = false;
    btn.textContent = "Pay KES 500 & Submit";
  }
});

document.getElementById("skip-pay").addEventListener("click", async () => {
  await submitQuote({ payment_status: "skipped", payment_method: null, payment_reference: null });
});

// --- Final submit ---
async function submitQuote(payment) {
  const d = getDetailsData();
  const { data: { user } } = await supabaseClient.auth.getUser();

  const payload = {
    user_id: user ? user.id : null,
    full_name: d.full_name,
    email: d.email,
    phone: d.phone || null,
    company_name: d.company_name || null,
    mode: selectedMode === "customs" || selectedMode === "warehousing" ? "multimodal" : selectedMode,
    origin: d.origin,
    destination: d.destination,
    cargo_description: d.cargo_description || null,
    weight_kg: d.weight_kg ? Number(d.weight_kg) : null,
    volume_cbm: d.volume_cbm ? Number(d.volume_cbm) : null,
    container_type: d.container_type || null,
    incoterm: d.incoterm || null,
    preferred_ship_date: d.preferred_ship_date || null,
    payment_status: payment.payment_status === "pending" ? "pending" : payment.payment_status === "skipped" ? "skipped" : "unpaid",
    payment_method: payment.payment_method,
    payment_reference: payment.payment_reference,
    payment_amount: payment.payment_status === "pending" ? 500 : null,
  };

  const { error } = await supabaseClient.from("quotes").insert(payload);

  document.querySelectorAll(".wizard-panel").forEach((p) => (p.style.display = "none"));
  document.getElementById("wizard-steps").style.display = "none";
  document.getElementById("success-state").style.display = "block";

  if (error) {
    document.getElementById("success-detail").textContent =
      "Your payment step completed, but we couldn't save your request details — please contact us directly so we can confirm it.";
  } else if (payment.payment_status === "pending") {
    document.getElementById("success-detail").textContent =
      "Thanks — complete the M-Pesa prompt on your phone to confirm. Our team will follow up with pricing shortly after.";
  }
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
