document.getElementById("contact-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = document.getElementById("contact-submit-btn");
  const msg = document.getElementById("contact-msg");
  btn.disabled = true;
  btn.textContent = "Sending...";

  const data = Object.fromEntries(new FormData(e.target).entries());
  const { error } = await supabaseClient.from("contact_messages").insert(data);

  if (error) {
    msg.textContent = "Something went wrong — please try again.";
    msg.className = "form-msg error";
    btn.disabled = false;
    btn.textContent = "Send Message";
    return;
  }

  document.getElementById("form-state").style.display = "none";
  document.getElementById("success-state").style.display = "block";
});
