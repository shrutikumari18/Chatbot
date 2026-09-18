

A browser-based chatbot. Flask keeps the API key safely on the server; the React + Vite frontend provides the chat UI.

## Run locally

1. Create an API key from your AI provider.
2. Copy `.env.example` to `.env`.
3. Set `AI_API_KEY` in `.env`. Keep this file private; it is ignored by Git.
4. In the first PowerShell terminal, install Python packages and start Flask:

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe app.py
```

5. In a second terminal, start the React development server:

```powershell
cd frontend
npm.cmd install
npm.cmd run dev
```

Open http://127.0.0.1:5173. Vite forwards `/api` requests to Flask at port 5000.

<<<<<<< HEAD
## Future Scope
- Chat history
- Authentication
- Deployment
=======
## Production build

Build the React UI, then Flask will serve it directly at http://127.0.0.1:5000:

```powershell
cd frontend
npm.cmd run build
```

## Configuration

- `AI_API_KEY` — required API key.
- `AI_MODEL` — optional model override.
- `FLASK_SECRET_KEY` — use a long random value before deploying.

The browser keeps the last 20 chat messages in its own local storage. The API key stays on the server and is never exposed to the browser.
>>>>>>> 5161e56 (added new thingd)
