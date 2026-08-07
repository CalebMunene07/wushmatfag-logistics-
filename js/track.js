const STATUS_LABELS = {
  quote_requested: "Quote Requested",
  booked: "Booked",
  picked_up: "Picked Up",
  in_transit: "In Transit",
  customs_clearance: "Customs Clearance",
  out_for_delivery: "Out for Delivery",
  delivered: "Delivered",
  delayed: "Delayed",
  cancelled: "Cancelled",
};

document.getElementById("track-form").addEventListener("submit", async (e) => {
  e.preventDefault();

  const btn = document.getElementById("track-btn");
  const msg = document.getElementById("track-msg");
  const resultEl = document.getElementById("tracking-result");
  const trackingNumber = document.getElementById("tracking-number").value.trim();

  btn.disabled = true;
  btn.textContent = "Searching...";
  msg.textContent = "";
  resultEl.style.display = "none";

  const { data: shipmentRows, error: shipmentError } = await supabaseClient
    .rpc("track_shipment", { p_tracking_number: trackingNumber });

  btn.disabled = false;
  btn.textContent = "Track";

  if (shipmentError) {
    msg.textContent = "Something went wrong. Please try again.";
    return;
  }

  if (!shipmentRows || shipmentRows.length === 0) {
    msg.textContent = "No shipment found for that tracking number.";
    return;
  }

  const shipment = shipmentRows[0];

  const { data: events } = await supabaseClient
    .rpc("track_shipment_events", { p_tracking_number: trackingNumber });

  renderResult(shipment, events || []);
});

function renderResult(shipment, events) {
  const resultEl = document.getElementById("tracking-result");

  const timelineHtml = events.length
    ? `<div style="margin-top:32px;">
        <p style="font-size:14px; font-weight:700; margin-bottom:16px;">Shipment Timeline</p>
        <ul class="timeline">
          ${events.map(ev => `
            <li>
              <div class="t-status">${STATUS_LABELS[ev.status] || ev.status}</div>
              <div class="t-meta">${new Date(ev.event_time).toLocaleString()}${ev.location ? " · " + ev.location : ""}</div>
              ${ev.note ? `<div class="t-note">${escapeHtml(ev.note)}</div>` : ""}
            </li>`).join("")}
        </ul>
      </div>`
    : "";

  resultEl.innerHTML = `
    <div class="tracking-head">
      <div>
        <div style="font-size:12.5px; color:var(--slate-500);">Tracking Number</div>
        <div class="tracking-number">${escapeHtml(shipment.tracking_number)}</div>
      </div>
      <span class="status-pill ${shipment.status}">${STATUS_LABELS[shipment.status] || shipment.status}</span>
    </div>
    <div class="tracking-meta">
      <div><div class="label">Origin</div><div class="value">${escapeHtml(shipment.origin)}</div></div>
      <div><div class="label">Destination</div><div class="value">${escapeHtml(shipment.destination)}</div></div>
      <div><div class="label">Mode</div><div class="value" style="text-transform:capitalize;">${escapeHtml(shipment.mode)}</div></div>
      <div><div class="label">Current Location</div><div class="value">${shipment.current_location ? escapeHtml(shipment.current_location) : "—"}</div></div>
    </div>
    ${timelineHtml}
  `;
  resultEl.style.display = "block";
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
