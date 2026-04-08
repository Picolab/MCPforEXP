import React, { useState, useEffect, useRef } from "react";
import io from "socket.io-client";
import VoiceInput from "./VoiceComponent";

// In production, prefer same-origin so `/api` and `/socket.io` can be reverse-proxied
// by the web server hosting the UI (e.g., manny.picolabs.io:3005 -> backend :3001).
const DEFAULT_BASE_URL =
  typeof window !== "undefined" ? window.location.origin : "";
const API_URL = import.meta.env.VITE_API_URL || DEFAULT_BASE_URL;

const ChatComponent = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef(null);
  const textareaRef = useRef(null);

  const handleTranscript = (text) => {
    if (!text.trim()) return;
    setInput(text);
    setTimeout(() => {
      sendMessage(null, text);
    }, 2000);
  };

  useEffect(() => {
    // Create the socket connection on mount to avoid stale global connections.
    const socket = io(API_URL, {
      path: "/socket.io",
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelayMax: 5000,
    });

    socket.on("assistant-status", (data) => setStatus(data.message));
    socket.on("assistant-tool", (data) =>
      setStatus(`Running: ${data.name}...`),
    );
    socket.on("connect_error", () => {
      // Keep it short; the chat request itself will show a concrete error if it fails.
      setStatus("Realtime connection lost; retrying...");
    });
    return () => {
      socket.off("assistant-status");
      socket.off("assistant-tool");
      socket.off("connect_error");
      socket.disconnect();
    };
  }, []);

  // ✅ Resize textarea whenever input changes (typing or voice)
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"; // reset
      textareaRef.current.style.height =
        textareaRef.current.scrollHeight + "px";
    }
  }, [input]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status]);

  const sendMessage = async (e, overridingText = null) => {
    if (e) e.preventDefault();

    // Use the provided text OR the current state input
    const messageToSend = overridingText || input;

    if (!messageToSend.trim() || isLoading) return;

    const userMessage = { role: "user", text: messageToSend };
    setMessages((prev) => [...prev, userMessage]);
    setInput(""); // Clear the input field
    setIsLoading(true);
    setStatus("Manny is thinking...");

    try {
      const endpoint = API_URL ? `${API_URL}/api/chat` : "/api/chat";
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: messageToSend }), // Use the same variable here
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
        { role: "assistant", text: "Failed to connect to backend." },
      ]);
    } finally {
      setIsLoading(false);
      setStatus("");
    }
  };

  return (
    <div className="flex flex-col h-[90vh] max-w-2xl mx-auto my-8 bg-white border border-gray-200 rounded-2xl shadow-xl overflow-hidden font-sans">
      {/* Header */}
      <header className="px-6 py-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
        <div className="text-left">
          <h1 className="text-lg font-bold text-gray-800">
            Manifold Assistant
          </h1>
          <p className="text-xs text-gray-500">Pico-Engine AI Agent</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
          <span className="text-sm font-medium text-green-600">Online</span>
        </div>
      </header>

      {/* Chat Window */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50/30">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <p className="text-sm italic text-center px-12">
              Ready for your Manifold queries. Try asking, "What things do I
              have?"
            </p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex w-full ${
              msg.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`max-w-[85%] px-4 py-2.5 shadow-sm text-left ${
                msg.role === "user"
                  ? "bg-blue-600 text-white rounded-2xl rounded-tr-none"
                  : "bg-white text-gray-800 border border-gray-100 rounded-2xl rounded-tl-none"
              }`}
            >
              <p className="text-[14.5px] leading-relaxed whitespace-pre-wrap text-left">
                {msg.text}
              </p>
            </div>
          </div>
        ))}

        {/* Status Bouncing Dots */}
        {status && (
          <div className="flex justify-start items-center">
            <div className="bg-white border border-gray-100 px-4 py-2 rounded-full shadow-sm flex items-center gap-2">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></span>
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0.4s]"></span>
              </div>
              <span className="text-xs font-medium text-gray-500 italic">
                {status}
              </span>
            </div>
          </div>
        )}
        <div ref={scrollRef} />
      </div>

      {/* Input Area */}
      <form
        onSubmit={sendMessage}
        className="p-4 bg-white border-t border-gray-100 flex items-end gap-3" // Increased gap to 3
      >
        <div className="relative flex-1">
          <textarea
            ref={textareaRef}
            className="w-full bg-gray-100 text-gray-800 text-sm rounded-2xl px-5 py-3 pr-12 border-none focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder:text-gray-400 resize-none overflow-hidden"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage(e);
              }
            }}
            placeholder="Message Manifold..."
            disabled={isLoading}
            rows={1}
            style={{ lineHeight: "1.5rem" }}
          />

          {/* Voice Button - Stays inside, pinned to the right */}
          <VoiceInput onTranscript={handleTranscript} disabled={isLoading} />
        </div>

        {/* Send Button - Now outside the relative div, sits to the right of the bar */}
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="flex items-center justify-center transition-transform active:scale-90 disabled:opacity-30 mb-2" // Added mb-2 to align with the first line of text
          style={{
            background: "none",
            border: "none",
            padding: "4px",
            outline: "none",
            boxShadow: "none",
            appearance: "none",
          }}
        >
          {isLoading ? (
            <span className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></span>
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="w-7 h-7 text-blue-600" // Slightly larger to be the main focal point
            >
              <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
            </svg>
          )}
        </button>
      </form>
    </div>
  );
};

export default ChatComponent;
