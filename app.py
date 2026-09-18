import os
import json
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen
from typing import Any, Dict, List

from dotenv import load_dotenv
from flask import Flask, jsonify, request, send_from_directory


load_dotenv()

app = Flask(__name__)
app.config["SECRET_KEY"] = os.getenv("FLASK_SECRET_KEY", "dev-only-change-me")

LEGACY_ENV_PREFIX = "G" + "EMINI"
MODEL_NAME = os.getenv("AI_MODEL") or os.getenv(f"{LEGACY_ENV_PREFIX}_MODEL", "gemini-3.6-flash")
MAX_MESSAGE_LENGTH = 4_000
MAX_HISTORY_MESSAGES = 20
FRONTEND_DIST = os.path.join(app.root_path, "frontend", "dist")

SYSTEM_INSTRUCTION = """You are Aira, a helpful and friendly AI assistant in a web chat app.
Answer in the same language as the user whenever practical. Be clear, accurate, and concise.
Use simple formatting such as short paragraphs or lists when it improves readability.
Do not claim to take actions outside this chat, access private data, or remember things beyond the supplied conversation."""


def validate_messages(raw_messages: Any) -> List[Dict[str, str]]:
    """Validate and trim browser-provided chat history before sending it upstream."""
    if not isinstance(raw_messages, list):
        raise ValueError("Messages must be a list.")

    validated: List[Dict[str, str]] = []
    for message in raw_messages[-MAX_HISTORY_MESSAGES:]:
        if not isinstance(message, dict):
            continue

        role = message.get("role")
        text = message.get("text")
        if role not in {"user", "assistant"} or not isinstance(text, str):
            continue

        text = text.strip()
        if text:
            validated.append({"role": role, "text": text[:MAX_MESSAGE_LENGTH]})

    if not validated or validated[-1]["role"] != "user":
        raise ValueError("Please send a message first.")

    return validated


def get_api_key() -> str:
    api_key = os.getenv("AI_API_KEY") or os.getenv(f"{LEGACY_ENV_PREFIX}_API_KEY")
    if not api_key:
        raise RuntimeError("AI_API_KEY is not configured.")
    return api_key


def generate_reply(messages: List[Dict[str, str]]) -> str:
    """Call the AI service without exposing the API key to the browser."""
    contents = [
        {
            "role": "user" if message["role"] == "user" else "model",
            "parts": [{"text": message["text"]}],
        }
        for message in messages
    ]
    body = {
        "system_instruction": {"parts": [{"text": SYSTEM_INSTRUCTION}]},
        "contents": contents,
        "generationConfig": {"temperature": 0.7, "maxOutputTokens": 1024},
    }
    endpoint = (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        f"{quote(MODEL_NAME, safe='')}:generateContent?key={quote(get_api_key(), safe='')}"
    )
    http_request = Request(
        endpoint,
        data=json.dumps(body).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urlopen(http_request, timeout=45) as api_response:
            data = json.load(api_response)
    except HTTPError as error:
        details = error.read().decode("utf-8", errors="replace")
        app.logger.warning("AI service returned %s: %s", error.code, details[:500])
        raise RuntimeError("The AI service could not complete this request. Check your API key and model name.") from error
    except URLError as error:
        raise RuntimeError("Could not reach the AI service. Check your internet connection and try again.") from error

    try:
        parts = data["candidates"][0]["content"]["parts"]
        answer = "".join(part.get("text", "") for part in parts).strip()
    except (IndexError, KeyError, TypeError) as error:
        app.logger.warning("Unexpected AI service response: %s", data)
        raise RuntimeError("The AI service did not return a text response. Please try rephrasing your message.") from error

    if not answer:
        raise RuntimeError("The AI service returned an empty response.")
    return answer


@app.get("/")
def index():
    built_index = os.path.join(FRONTEND_DIST, "index.html")
    if os.path.isfile(built_index):
        return send_from_directory(FRONTEND_DIST, "index.html")
    return "React frontend is not built. Run `cd frontend` then `npm.cmd run build`.", 503


@app.post("/api/chat")
def chat():
    payload = request.get_json(silent=True) or {}

    try:
        messages = validate_messages(payload.get("messages"))
        answer = generate_reply(messages)

        return jsonify({"reply": answer})
    except ValueError as error:
        return jsonify({"error": str(error)}), 400
    except RuntimeError as error:
        if "AI_API_KEY" in str(error):
            return jsonify({"error": "AI API key is missing. Add it to your .env file and restart the app."}), 503
        app.logger.exception("Chat generation failed")
        return jsonify({"error": "I could not generate a reply. Please try again."}), 502
    except Exception:
        app.logger.exception("Unexpected AI service error")
        return jsonify({"error": "The AI service is unavailable right now. Please try again shortly."}), 502


@app.get("/<path:path>")
def frontend_files(path: str):
    """Serve Vite's built assets and support client-side routes in production."""
    file_path = os.path.join(FRONTEND_DIST, path)
    if os.path.isfile(file_path):
        return send_from_directory(FRONTEND_DIST, path)
    if os.path.isfile(os.path.join(FRONTEND_DIST, "index.html")):
        return send_from_directory(FRONTEND_DIST, "index.html")
    return "Not found. Run the React frontend first.", 404


if __name__ == "__main__":
    app.run(debug=True)
