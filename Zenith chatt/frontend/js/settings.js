export function initSettings() {
// 4. Settings Page (`settings.html`)
const saveSettingsBtn = document.getElementById("save-settings");
if (saveSettingsBtn) {
  const username = localStorage.getItem("username");
  if (!username) {
    window.location.href = "login.html";
    return;
  }
  document.getElementById("settings-username").value = username;
  document.getElementById("settings-avatar-seed").value =
    localStorage.getItem("avatar_seed") || username;

  saveSettingsBtn.addEventListener("click", () => {
    const newSeed = document
      .getElementById("settings-avatar-seed")
      .value.trim();
    if (newSeed) {
      localStorage.setItem("avatar_seed", newSeed);
      alert("Settings saved successfully!");
      window.location.href = "index.html";
    }
  });

  document.getElementById("back-to-chat").addEventListener("click", () => {
    window.location.href = "index.html";
  });
}
}
