import { initAuth } from "./js/auth.js";
import { initDashboard } from "./js/dashboard.js";
import { initSettings } from "./js/settings.js";

document.addEventListener("DOMContentLoaded", () => {
  initAuth();
  initDashboard();
  initSettings();
});
