const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../.env") });
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const { MCPClient } = require("./index.js"); // Path to your refactored client
const app = express();
const server = http.createServer(app);

// Configure Socket.io with CORS for your EC2 setup
const io = new Server(server, {
  path: "/socket.io",
  cors: {
    origin: process.env.VITE_API_URL || "*",
    methods: ["GET", "POST"],
  },
});

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;
const HOST = process.env.NODE_ENV === "production" ? "0.0.0.0" : "localhost";

// 1. Initialize the "Brain"
const client = new MCPClient();

// 2. Connect to the MCP Server immediately on startup
const MCP_SERVER_PATH = path.join(__dirname, "../backend/mcp-server/server.js");
client
  .connectToServer(MCP_SERVER_PATH)
  .then(() => console.error("✅ Connected to MCP Server"))
  .catch((err) => console.error("❌ MCP Connection Failed:", err));

// 3. Setup Socket.io Event Forwarding
io.on("connection", (socket) => {
  console.error(`New client connected: ${socket.id}`);

  // We create a unique listener for this specific socket
  const statusListener = (status) => socket.emit("assistant-status", status);
  const toolListener = (tool) => socket.emit("assistant-tool", tool);

  // Attach listeners to the MCPClient emitters
  client.on("status", statusListener);
  client.on("tool-use", toolListener);

  socket.on("disconnect", () => {
    // Clean up listeners to prevent memory leaks
    client.off("status", statusListener);
    client.off("tool-use", toolListener);
    console.error("Client disconnected");
  });
});

// 4. The Main Chat Endpoint
app.post("/api/chat", async (req, res) => {
  const { message } = req.body;

  if (!message) {
    return res.status(400).json({ error: "Message is required" });
  }

  try {
    // This triggers the agentic loop we built
    const result = await client.processQuery(message);
    res.json({ success: true, answer: result });
  } catch (error) {
    console.error("API Error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

server.listen(PORT, HOST, () => {
  console.error(`🚀 API Proxy & Socket server running on ${HOST}:${PORT}`);
});
