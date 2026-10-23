import { API_URL, AUTH_CONNECTION_ERROR, readApiResponse, apiErrorMessage } from "./api.js";

export function initAuth() {
// 1. Registration Handler
const signupForm = document.getElementById("signup-form");
if (signupForm) {
  const usernameInput = document.getElementById("signup-username");
  const emailInput = document.getElementById("signup-email");
  const passwordInput = document.getElementById("signup-password");
  const confirmPasswordInput = document.getElementById(
    "signup-confirm-password",
  );
  const signupFeedback = document.getElementById("signup-feedback");
  const submitButton = signupForm.querySelector("button[type='submit']");

  const updatePasswordGuidance = () => {
    const password = passwordInput.value;
    const hasMinimumLength = password.length >= 8;
    const hasLettersAndNumbers =
      /[A-Za-z]/.test(password) && /\d/.test(password);
    const rules = signupForm.querySelectorAll(".password-rules [data-rule]");
    rules.forEach((rule) => {
      const passed =
        rule.dataset.rule === "length"
          ? hasMinimumLength
          : hasLettersAndNumbers;
      rule.classList.toggle("passed", passed);
    });

    const meter = document.getElementById("password-meter-fill");
    const strength =
      Number(hasMinimumLength) +
      Number(hasLettersAndNumbers) +
      Number(password.length >= 12);
    meter.dataset.strength = password ? String(strength) : "0";

    const matchMessage = document.getElementById("password-match");
    if (!confirmPasswordInput.value) {
      matchMessage.textContent = "Re-enter your password to confirm it.";
      matchMessage.classList.remove("is-valid", "is-invalid");
    } else {
      const matches = password === confirmPasswordInput.value;
      matchMessage.textContent = matches
        ? "Passwords match."
        : "Passwords do not match.";
      matchMessage.classList.toggle("is-valid", matches);
      matchMessage.classList.toggle("is-invalid", !matches);
    }
  };

  passwordInput.addEventListener("input", updatePasswordGuidance);
  confirmPasswordInput.addEventListener("input", updatePasswordGuidance);
  signupForm.querySelectorAll("[data-password-toggle]").forEach((toggle) => {
    toggle.addEventListener("click", () => {
      const input = document.getElementById(toggle.dataset.passwordToggle);
      const showPassword = input.type === "password";
      input.type = showPassword ? "text" : "password";
      toggle.setAttribute(
        "aria-label",
        showPassword ? "Hide password" : "Show password",
      );
      toggle.title = showPassword ? "Hide password" : "Show password";
      toggle.innerHTML = `<i class="fa-regular fa-eye${showPassword ? "-slash" : ""}" aria-hidden="true"></i>`;
    });
  });

  signupForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = usernameInput.value.trim();
    const email = emailInput.value.trim().toLowerCase();
    const password = passwordInput.value;
    const confirmPassword = confirmPasswordInput.value;
    signupFeedback.textContent = "";
    signupFeedback.className = "form-feedback";

    if (username.length < 3 || username.length > 24) {
      signupFeedback.textContent =
        "Username must be between 3 and 24 characters.";
      signupFeedback.classList.add("is-error");
      usernameInput.focus();
      return;
    }
    if (!emailInput.validity.valid) {
      signupFeedback.textContent = "Enter a valid email address.";
      signupFeedback.classList.add("is-error");
      emailInput.focus();
      return;
    }
    if (
      password.length < 8 ||
      !/[A-Za-z]/.test(password) ||
      !/\d/.test(password)
    ) {
      signupFeedback.textContent =
        "Use at least 8 characters, including a letter and a number.";
      signupFeedback.classList.add("is-error");
      passwordInput.focus();
      return;
    }
    if (new TextEncoder().encode(password).length > 72) {
      signupFeedback.textContent = "Password must be 72 bytes or fewer.";
      signupFeedback.classList.add("is-error");
      passwordInput.focus();
      return;
    }
    if (password !== confirmPassword) {
      signupFeedback.textContent = "Those passwords do not match yet.";
      signupFeedback.classList.add("is-error");
      confirmPasswordInput.focus();
      return;
    }

    const signupUrl = `${API_URL}/api/signup`;
    try {
      submitButton.disabled = true;
      submitButton.querySelector("span").textContent = "Creating account...";
      const res = await fetch(signupUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          email,
          password,
          confirm_password: confirmPassword,
        }),
      });
      const data = await readApiResponse(res);
      if (res.ok) {
        localStorage.setItem("user_id", data.user_id);
        localStorage.setItem("username", data.username);
        window.location.href = "index.html";
      } else {
        signupFeedback.textContent = apiErrorMessage(
          data,
          `Registration failed (${res.status}). Please try again.`,
        );
        signupFeedback.classList.add("is-error");
      }
    } catch (err) {
      console.error(`Registration request failed: ${signupUrl}`, err);
      signupFeedback.textContent = AUTH_CONNECTION_ERROR;
      signupFeedback.classList.add("is-error");
    } finally {
      submitButton.disabled = false;
      submitButton.querySelector("span").textContent = "Create account";
    }
  });
}

// 2. Login Handler
const loginForm = document.getElementById("login-form");
if (loginForm) {
  const identifierInput = document.getElementById("login-identifier");
  const passwordInput = document.getElementById("login-password");
  const feedback = document.getElementById("login-feedback");
  const submitButton = loginForm.querySelector("button[type='submit']");

  loginForm.querySelectorAll("[data-password-toggle]").forEach((toggle) => {
    toggle.addEventListener("click", () => {
      const input = document.getElementById(toggle.dataset.passwordToggle);
      const showPassword = input.type === "password";
      input.type = showPassword ? "text" : "password";
      toggle.setAttribute(
        "aria-label",
        showPassword ? "Hide password" : "Show password",
      );
      toggle.title = showPassword ? "Hide password" : "Show password";
      toggle.innerHTML = `<i class="fa-regular fa-eye${showPassword ? "-slash" : ""}" aria-hidden="true"></i>`;
    });
  });

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const identifier = identifierInput.value.trim();
    const password = passwordInput.value;
    feedback.textContent = "";
    feedback.className = "form-feedback";

    if (!identifier || !password) {
      feedback.textContent = "Enter your username or email and password.";
      feedback.classList.add("is-error");
      (!identifier ? identifierInput : passwordInput).focus();
      return;
    }

    const loginUrl = `${API_URL}/api/login`;
    try {
      submitButton.disabled = true;
      submitButton.querySelector("span").textContent = "Signing in...";
      const res = await fetch(loginUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password }),
      });
      const data = await readApiResponse(res);
      if (res.ok) {
        localStorage.setItem("user_id", data.user_id);
        localStorage.setItem("username", data.username);
        window.location.href = "index.html";
      } else {
        feedback.textContent = apiErrorMessage(
          data,
          `Sign-in failed (${res.status}). Please try again.`,
        );
        feedback.classList.add("is-error");
      }
    } catch (err) {
      console.error(`Sign-in request failed: ${loginUrl}`, err);
      feedback.textContent = AUTH_CONNECTION_ERROR;
      feedback.classList.add("is-error");
    } finally {
      submitButton.disabled = false;
      submitButton.querySelector("span").textContent = "Sign in";
    }
  });
}

const socialAuthButtons = document.querySelectorAll("[data-auth-provider]");
if (socialAuthButtons.length) {
  const feedback = document.querySelector(
    "#login-feedback, #signup-feedback",
  );
  const backendOrigin = new URL(API_URL).origin;

  const showPopupMessage = (popup, heading, message) => {
    if (popup.closed) return;
    popup.document.open();
    popup.document.write(
      `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>NexusApp</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f2f5ed;color:#203126;font:16px Inter,Segoe UI,sans-serif}.notice{width:min(420px,calc(100% - 48px));padding:32px;background:#fff;border:1px solid #e1e8dc;border-radius:10px;box-shadow:0 18px 50px #20362618;text-align:center}.mark{margin:0 auto 18px;width:42px;height:42px;display:grid;place-items:center;border-radius:12px;background:#263a2b;color:#b8ed64;font-size:24px}.notice h1{font-size:20px;margin:0 0 10px}.notice p{margin:0;color:#78867b;line-height:1.6}.notice button{margin-top:22px;padding:10px 18px;border:0;border-radius:6px;background:#b8ed64;color:#203126;font-weight:700;cursor:pointer}</style></head><body><main class="notice"><div class="mark" aria-hidden="true">N</div><h1>${heading}</h1><p>${message}</p><button onclick="window.close()">Close window</button></main></body></html>`,
    );
    popup.document.close();
  };

  window.addEventListener("message", (event) => {
    if (
      event.origin !== backendOrigin ||
      event.data?.type !== "zenith-auth-success"
    ) {
      return;
    }
    localStorage.setItem("user_id", event.data.user.user_id);
    localStorage.setItem("username", event.data.user.username);
    window.location.href = "index.html";
  });

  socialAuthButtons.forEach((button) => {
    button.addEventListener("click", async () => {
      const provider = button.dataset.authProvider;
      const popup = window.open(
        "about:blank",
        "zenith-social-auth",
        "width=520,height=680,noopener=no",
      );
      if (!popup) {
        feedback.textContent =
          "Allow pop-ups to continue with social sign-in.";
        feedback.className = "form-feedback is-error";
        return;
      }
      showPopupMessage(
        popup,
        "Connecting to secure sign-in",
        `Checking whether ${provider} sign-in is ready. This window will continue automatically.`,
      );

      button.disabled = true;
      try {
        const response = await fetch(`${API_URL}/api/auth/providers`);
        const { providers = [] } = await response.json();
        if (!response.ok || !providers.includes(provider)) {
          const message = `${provider} sign-in is not configured yet. The app administrator must add its OAuth client credentials to the backend.`;
          showPopupMessage(
            popup,
            `${provider} sign-in is unavailable`,
            message,
          );
          feedback.textContent = message;
          feedback.className = "form-feedback is-error";
          return;
        }
        popup.location.href = `${API_URL}/auth/${provider}/login`;
      } catch (error) {
        console.error(error);
        const message = `Could not connect to the authentication server at ${API_URL}. Start the backend and try again.`;
        showPopupMessage(popup, "Authentication server unavailable", message);
        feedback.textContent = message;
        feedback.className = "form-feedback is-error";
      } finally {
        button.disabled = false;
      }
    });
  });
}


}
