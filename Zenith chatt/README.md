# NexusApp

NexusApp is a browser-based chat application with a static HTML/CSS/JavaScript frontend and a Python FastAPI backend. It uses SQLite for local data storage and WebSockets for live chat updates.

## Features

- Create an account and sign in with a username or email.
- Optionally configure Google, GitHub, or X OAuth sign-in.
- Create and browse chat rooms, including group and channel-style conversations.
- Send messages and receive live updates.
- Search conversations, archive rooms, and manage profile settings.
- Choose a theme and use chat tools such as emoji, image, and voice-note controls.

## Project structure

```text
NexusApp/
├── backend/
│   ├── main.py
│   ├── database.py
│   ├── models.py
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── app.js
│   └── templates/
│       ├── index.html
│       ├── login.html
│       ├── register.html
│       ├── settings.html
│       └── style.css
└── chat_app.db
```

## Requirements

- Python 3.10 or newer.
- A modern web browser.
- A static web server for the frontend, such as the VS Code Live Server extension. The frontend does not have a separate package-manager build step.

## Run locally on Windows

Open PowerShell in the project root (the directory containing `backend` and `frontend`).

1. Create and activate a virtual environment:

   ```powershell
   py -m venv .venv
   .\.venv\Scripts\Activate.ps1
   ```

   If PowerShell prevents activation, use the virtual environment's Python directly in the following commands: `.\.venv\Scripts\python.exe`.

2. Install backend dependencies:

   ```powershell
   python -m pip install -r backend\requirements.txt
   ```

3. Start the API from the project root:

   ```powershell
   python -m uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000
   ```

   Keep this terminal open while using the app. The API documentation is available at <http://127.0.0.1:8000/docs>.

4. Serve `frontend` as static files. For example, open `frontend\templates\login.html` with Live Server. The default API configuration expects the backend at `http://127.0.0.1:8000` when the frontend is served locally on another port.

5. Create an account or sign in through the page opened by the frontend server.

The database uses SQLite and is created or updated by the backend at startup. Run the backend from the project root so its default database URL resolves to the project-root `chat_app.db`.

## Optional OAuth setup

OAuth credentials are optional; username-and-password registration and sign-in do not require them.

1. Copy `backend\.env.example` to `backend\.env`.
2. Set the credentials for the provider or providers you want to enable.
3. Register each provider's callback URL with that provider:
   - Google: `http://127.0.0.1:8000/auth/google/callback`
   - GitHub: `http://127.0.0.1:8000/auth/github/callback`
   - X: `http://127.0.0.1:8000/auth/x/callback`
4. Replace `SESSION_SECRET` with a long, random value. Keep `.env` private and do not commit real credentials.

For a deployed HTTPS environment, set `COOKIE_HTTPS_ONLY=true` and update `FRONTEND_ORIGINS` to include the actual frontend origin.

## Troubleshooting

- **The sign-in or account-creation page cannot connect:** Make sure the API terminal is still running and the backend is listening on port `8000`.
- **The frontend is served on a different machine or port:** Configure the frontend's `window.NEXUS_API_URL` to point to the API and add the frontend origin to the backend's `FRONTEND_ORIGINS` setting. The previous `window.ZENITH_API_URL` name remains supported for existing deployments.
- **OAuth sign-in is unavailable:** Confirm the corresponding provider credentials and callback URL are set; OAuth providers without credentials are not enabled.
- **The database appears in an unexpected location:** Start Uvicorn from the project root, since the default SQLite URL is relative to the current working directory.
