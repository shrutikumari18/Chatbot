import { useEffect, useRef, useState } from "react";

const HISTORY_KEY = "aira-react-chat-history";
const THEME_KEY = "aira-theme";
const MAX_HISTORY = 20;

const suggestions = [
  "Help me plan my week",
  "Explain a complex topic simply",
  "Brainstorm creative ideas",
];

function readHistory() {
  try {
    const parsed = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
    return Array.isArray(parsed)
      ? parsed.filter((item) => item && ["user", "assistant"].includes(item.role) && typeof item.text === "string").slice(-MAX_HISTORY)
      : [];
  } catch {
    return [];
  }
}

function Message({ message }) {
  const isUser = message.role === "user";
  return (
    <article className={`message ${isUser ? "user" : "assistant"}`}>
      <p className="message-label">{isUser ? "YOU" : "AIRA"}</p>
      <div className="message-text">{message.text}</div>
    </article>
  );
}

export default function App() {
  const [history, setHistory] = useState(readHistory);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLight, setIsLight] = useState(() => localStorage.getItem(THEME_KEY) === "light");
  const inputRef = useRef(null);
  const messagesRef = useRef(null);

  useEffect(() => {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    messagesRef.current?.scrollTo({ top: messagesRef.current.scrollHeight, behavior: "smooth" });
  }, [history, isLoading]);

  useEffect(() => {
    document.body.classList.toggle("light", isLight);
    localStorage.setItem(THEME_KEY, isLight ? "light" : "dark");
  }, [isLight]);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight, 160)}px`;
  }, [message]);

  async function sendMessage(value = message) {
    const text = value.trim();
    if (!text || isLoading) return;

    const nextHistory = [...history, { role: "user", text }].slice(-MAX_HISTORY);
    setHistory(nextHistory);
    setMessage("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextHistory }),
      });
      const rawBody = await response.text();
      let data = {};
      try {
        data = rawBody ? JSON.parse(rawBody) : {};
      } catch {
        throw new Error("The chat server returned an invalid response. Make sure Flask is running on port 5000.");
      }
      if (!response.ok) throw new Error(data.error || "The chat server is unavailable. Make sure Flask is running on port 5000.");
      if (!data.reply) throw new Error("The chat server did not return a reply. Please try again.");
      setHistory((current) => [...current, { role: "assistant", text: data.reply }].slice(-MAX_HISTORY));
    } catch (error) {
      setHistory((current) => [...current, { role: "assistant", text: `Sorry, ${error.message}` }].slice(-MAX_HISTORY));
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  }

  function startNewChat() {
    if (isLoading) return;
    if (!history.length || window.confirm("Start a new conversation?")) setHistory([]);
    inputRef.current?.focus();
  }

  function onSubmit(event) {
    event.preventDefault();
    sendMessage();
  }

  function onKeyDown(event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">*</span><span>Aira</span></div>
        <button className="new-chat" type="button" onClick={startNewChat}><span>+</span> New conversation</button>
      </aside>

      <section className="chat-panel">
        <header className="topbar">
          <div><p className="eyebrow">YOUR AI COMPANION</p><h1>How can I help?</h1></div>
          <button className="icon-button" type="button" aria-label="Toggle color theme" onClick={() => setIsLight((value) => !value)}>◐</button>
        </header>

        <div className="messages" ref={messagesRef} aria-live="polite">
          {history.length === 0 ? (
            <section className="welcome">
              <div className="welcome-orb">*</div>
              <p className="eyebrow">AI ASSISTANT</p>
              <h2>Thoughtful answers,<br />right when you need them.</h2>
              <p>Ask a question, plan an idea, or simply start a conversation.</p>
              <div className="suggestions">
                {suggestions.map((item) => <button key={item} type="button" onClick={() => sendMessage(item)}>{item}</button>)}
              </div>
            </section>
          ) : (
            history.map((item, index) => <Message key={`${item.role}-${index}-${item.text.slice(0, 20)}`} message={item} />)
          )}
          {isLoading && <article className="message assistant loading"><p className="message-label">AIRA</p><div className="typing"><i /><i /><i /></div></article>}
        </div>

        <form className="composer" onSubmit={onSubmit}>
          <label className="sr-only" htmlFor="message-input">Your message</label>
          <textarea ref={inputRef} id="message-input" rows="1" maxLength="4000" placeholder="Message Aira..." value={message} onChange={(event) => setMessage(event.target.value)} onKeyDown={onKeyDown} disabled={isLoading} autoFocus />
          <button className="send-button" type="submit" disabled={isLoading || !message.trim()} aria-label="Send message">↑</button>
          <p className="hint">Enter to send <span>-</span> Shift + Enter for a new line</p>
        </form>
      </section>
    </main>
  );
}
