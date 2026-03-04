import React, { useState, useEffect, useRef } from "react";
import io from "socket.io-client";

const API_URL = "http://localhost:3001";
const socket = io(API_URL);

const ChatComponent = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    socket.on("assistant-status", (data) => setStatus(data.message));
    socket.on("assistant-tool", (data) =>
      setStatus(`Executing: ${data.name}...`),
    );
    return () => {
      socket.off("assistant-status");
      socket.off("assistant-tool");
    };
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status]);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = { role: "user", text: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    setStatus("Thinking...");

    try {
      const response = await fetch(`${API_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: input }),
      });

      const data = await response.json();
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: data.success ? data.answer : `Error: ${data.error}`,
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: "Connection error." },
      ]);
    } finally {
      setIsLoading(false);
      setStatus("");
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.headerText}>Manifold Assistant</h2>
        <div style={styles.onlineBadge}>● Online</div>
      </div>

      <div style={styles.chatWindow}>
        {messages.length === 0 && (
          <div style={styles.emptyState}>
            Ask me to create, list, or tag your things!
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            style={{
              ...styles.messageRow,
              justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
            }}
          >
            <div
              style={{
                ...styles.bubble,
                backgroundColor: msg.role === "user" ? "#007AFF" : "#E9E9EB",
                color: msg.role === "user" ? "white" : "black",
                borderRadius:
                  msg.role === "user"
                    ? "18px 18px 2px 18px"
                    : "18px 18px 18px 2px",
              }}
            >
              {msg.text}
            </div>
          </div>
        ))}

        {status && (
          <div style={styles.statusRow}>
            <div style={styles.typingIndicator}>{status}</div>
          </div>
        )}
        <div ref={scrollRef} />
      </div>

      <form onSubmit={sendMessage} style={styles.inputArea}>
        <input
          style={styles.input}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
          disabled={isLoading}
        />
        <button type="submit" disabled={isLoading} style={styles.sendButton}>
          {isLoading ? "..." : "Send"}
        </button>
      </form>
    </div>
  );
};

const styles = {
  container: {
    display: "flex",
    flexDirection: "column",
    height: "90vh",
    maxWidth: "600px",
    margin: "20px auto",
    border: "1px solid #ddd",
    borderRadius: "12px",
    overflow: "hidden",
    boxShadow: "0 4px 15px rgba(0,0,0,0.1)",
    backgroundColor: "white",
  },
  header: {
    padding: "15px 20px",
    backgroundColor: "#f8f9fa",
    borderBottom: "1px solid #eee",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerText: { margin: 0, fontSize: "18px", color: "#333" },
  onlineBadge: { fontSize: "12px", color: "#28a745", fontWeight: "bold" },
  chatWindow: {
    flex: 1,
    overflowY: "auto",
    padding: "20px",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    backgroundColor: "#fff",
  },
  messageRow: { display: "flex", width: "100%" },
  bubble: {
    maxWidth: "75%",
    padding: "10px 16px",
    fontSize: "15px",
    lineHeight: "1.4",
    boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
  },
  statusRow: { alignSelf: "flex-start", margin: "5px 0" },
  typingIndicator: { fontSize: "12px", color: "#888", fontStyle: "italic" },
  emptyState: {
    textAlign: "center",
    color: "#aaa",
    marginTop: "50px",
    fontSize: "14px",
  },
  inputArea: {
    display: "flex",
    padding: "15px",
    borderTop: "1px solid #eee",
    gap: "10px",
    backgroundColor: "#f8f9fa",
  },
  input: {
    flex: 1,
    padding: "10px 15px",
    borderRadius: "20px",
    border: "1px solid #ccc",
    outline: "none",
  },
  sendButton: {
    backgroundColor: "#007AFF",
    color: "white",
    border: "none",
    padding: "8px 20px",
    borderRadius: "20px",
    cursor: "pointer",
    fontWeight: "600",
  },
};

export default ChatComponent;
