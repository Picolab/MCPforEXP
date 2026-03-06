import React, { useState, useEffect, useRef } from "react";
import io from "socket.io-client";

const API_URL = "http://18.189.3.146:3001";
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
      setStatus(`Running: ${data.name}...`),
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
    setStatus("Claude is thinking...");

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
            className={`flex w-full ${msg.role === "user" ? "justify-end" : "justify-start"}`}
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

        {/* Bouncing Dots Status */}
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
        className="p-4 bg-white border-t border-gray-100 flex items-center gap-3"
      >
        <input
          className="flex-1 bg-gray-100 text-gray-800 text-sm rounded-full px-5 py-3 border-none focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder:text-gray-400"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Message Manifold..."
          disabled={isLoading}
        />
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
              viewBox="0 0 24 24"
              fill="currentColor"
              className="w-5 h-5"
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
