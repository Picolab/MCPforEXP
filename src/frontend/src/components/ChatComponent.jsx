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
    setStatus("Claude is thinking...");

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
              Ready for your Manifold queries. Try asking "what things do I
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
        className="p-4 bg-white border-t border-gray-100 flex items-end gap-2"
      >
        <div className="relative flex-1">
          <textarea
            ref={textareaRef} // ✅ Attach ref
            className="w-full bg-gray-100 text-gray-800 text-sm rounded-full px-5 py-3 pr-12 border-none focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder:text-gray-400 resize-none overflow-hidden"
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
          {/* Voice Button inside input */}
          <div className="absolute right-2 top-1/2 -translate-y-1/2">
            <VoiceInput onTranscript={handleTranscript} disabled={isLoading} />
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white w-10 h-10 rounded-full flex items-center justify-center transition-colors shadow-md active:scale-95"
        >
          {isLoading ? (
            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              className="w-5 h-5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 10l9-4 8 4-9 4-8-4z M3 10l9 4 8-4"
              />
            </svg>
          )}
        </button>
      </form>
    </div>
  );
};

export default ChatComponent;
