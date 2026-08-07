document.addEventListener("DOMContentLoaded", async () => {
  const { data: { user } } = await supabaseClient.auth.getUser();

  if (!user) {
    window.location.href = "index.html";
    return;
  }

  const shipmentsPanel = document.getElementById("shipments-panel");
  const quotesPanel = document.getElementById("quotes-panel");

  const { data: shipments } = await supabaseClient
    .from("shipments")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (shipments && shipments.length) {
    shipmentsPanel.innerHTML = shipments.map(s => `
      <a href="track.html" class="list-row" style="text-decoration:none; color:inherit;">
        <div>
          <div class="primary" style="font-family:monospace;">${escapeHtml(s.tracking_number)}</div>
          <div class="secondary">${escapeHtml(s.origin)} → ${escapeHtml(s.destination)}</div>
        </div>
        <span class="status-pill ${s.status}">${s.status.replace(/_/g, " ")}</span>
      </a>`).join("");
  } else {
    shipmentsPanel.innerHTML = `<p class="empty-note" style="padding:20px;">No shipments yet.</p>`;
  }

  const { data: quotes } = await supabaseClient
    .from("quotes")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (quotes && quotes.length) {
    quotesPanel.innerHTML = quotes.map(q => `
      <div class="list-row">
        <div>
          <div class="primary">${escapeHtml(q.origin)} → ${escapeHtml(q.destination)} (${escapeHtml(q.mode)})</div>
          <div class="secondary">Submitted ${new Date(q.created_at).toLocaleDateString()}</div>
        </div>
        <span class="status-pill">${escapeHtml(q.status)}</span>
      </div>`).join("");
  } else {
    quotesPanel.innerHTML = `<p class="empty-note" style="padding:20px;">No quote requests yet. <a href="quote.html">Get a quote</a></p>`;
  }
});

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
