const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const { MCPClient } = require("./index.js"); // Path to your refactored client
const path = require("path");

const app = express();
const server = http.createServer(app);

// Configure Socket.io with CORS for your EC2 setup
const io = new Server(server, {
  cors: {
    origin: "*", // In production, replace with your EC2 public IP or Domain
    methods: ["GET", "POST"],
  },
});

app.use(cors());
app.use(express.json());

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

  // 1. Set headers for streaming
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  try {
    // 2. Your LLM logic needs to support a callback for chunks
    await client.processQuery(message, (chunk) => {
      // 3. Write each chunk to the response immediately
      res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
    });

    res.end();
  } catch (error) {
    res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
    res.end();
  }
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, "0.0.0.0", () => {
  console.error(`🚀 API Proxy & Socket server running on port ${PORT}`);
});
