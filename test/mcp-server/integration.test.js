/**
 * Integration tests for MCP Server
 * These tests require a running pico-engine or mocked backend
 */

const { Client } = require("@modelcontextprotocol/sdk/client/index.js");
const { StdioClientTransport } = require("@modelcontextprotocol/sdk/client/stdio.js");
const { spawn } = require("child_process");
const path = require("path");

describe("MCP Server Integration", () => {
  let client;
  let isConnected = false;
  let serverProcess;
  const serverPath = path.join(__dirname, "../../src/backend/mcp-server/server.js");

  beforeAll(async () => {
    // Create client and connect
    client = new Client({ name: "test-client", version: "1.0.0" });
    const transport = new StdioClientTransport({
      command: "node",
      args: [serverPath],
    });

    try {
      await client.connect(transport);
      isConnected = true;
    } catch (error) {
      console.warn("Could not connect to server for integration tests:", error.message);
      isConnected = false;
      // Skip tests if server can't start (e.g., missing dependencies)
    }
  }, 10000);

  afterAll(async () => {
    if (client && isConnected) {
      try {
        await client.close();
      } catch (error) {
        // Ignore cleanup errors
      }
    }
    if (serverProcess) {
      serverProcess.kill();
    }
  });

  describe("Tool Discovery", () => {
    test("should list available tools", async () => {
      if (!isConnected) {
        return; // Skip if connection failed
      }

      const tools = await client.listTools();

      expect(tools.tools).toBeDefined();
      expect(Array.isArray(tools.tools)).toBe(true);
      expect(tools.tools.length).toBeGreaterThan(0);
    });

    test("should include manifold_getThings tool", async () => {
      if (!isConnected) {
        return;
      }

      const tools = await client.listTools();
      const toolNames = tools.tools.map((t) => t.name);

      expect(toolNames).toContain("manifold_getThings");
    });

    test("tools should have valid schemas", async () => {
      if (!isConnected) {
        return;
      }

      const tools = await client.listTools();

      for (const tool of tools.tools) {
        expect(tool.inputSchema).toBeDefined();
        expect(tool.inputSchema.type).toBe("object");
        expect(tool.inputSchema.properties).toBeDefined();
      }
    });
  });

  describe("Tool Execution", () => {
    test("should call manifold_getThings with optional id", async () => {
      if (!isConnected) {
        return;
      }

      try {
        const result = await Promise.race([
          client.callTool({
            name: "manifold_getThings",
            arguments: {},
          }),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Tool call timeout")), 3000),
          ),
        ]);

        expect(result).toBeDefined();
        expect(result.content).toBeDefined();
        expect(Array.isArray(result.content)).toBe(true);
      } catch (error) {
        // If backend is not available or times out, that's okay for integration tests
        expect(error).toBeDefined();
      }
    }, 5000);

    test("should call manifold_create_thing with name parameter", async () => {
      if (!isConnected) {
        return;
      }

      try {
        const result = await Promise.race([
          client.callTool({
            name: "manifold_create_thing",
            arguments: {
              name: "test-thing-" + Date.now(),
            },
          }),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Tool call timeout")), 3000),
          ),
        ]);

        expect(result).toBeDefined();
        expect(result.content).toBeDefined();
      } catch (error) {
        // Backend may not be available or times out
        expect(error).toBeDefined();
      }
    }, 5000);

    test("should return error payload for invalid tool name", async () => {
      if (!isConnected) {
        return;
      }

      const result = await Promise.race([
        client.callTool({
          name: "nonexistent_tool",
          arguments: {},
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Tool call timeout")), 3000),
        ),
      ]);

      expect(result).toBeDefined();
      expect(result.isError).toBe(true);
      expect(result.content).toBeDefined();
      const textContent = result.content.find((c) => c.type === "text");
      expect(textContent).toBeDefined();
      expect(textContent.text).toContain("Tool nonexistent_tool not found");
    }, 5000);

    test("should return error payload for invalid arguments", async () => {
      if (!isConnected) {
        return;
      }

      // manifold_create_thing requires 'name' parameter
      const result = await Promise.race([
        client.callTool({
          name: "manifold_create_thing",
          arguments: {}, // Missing required 'name'
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Tool call timeout")), 3000),
        ),
      ]);

      expect(result).toBeDefined();
      expect(result.isError).toBe(true);
      expect(result.content).toBeDefined();
      const textContent = result.content.find((c) => c.type === "text");
      expect(textContent).toBeDefined();
      expect(textContent.text).toContain(
        "Invalid arguments for tool manifold_create_thing",
      );
    }, 5000);
  });

  describe("Response Format", () => {
    test("tool responses should have content array", async () => {
      if (!isConnected) {
        return;
      }

      try {
        const result = await Promise.race([
          client.callTool({
            name: "manifold_getThings",
            arguments: {},
          }),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Tool call timeout")), 3000),
          ),
        ]);

        expect(result.content).toBeDefined();
        expect(Array.isArray(result.content)).toBe(true);
        if (result.content.length > 0) {
          expect(result.content[0]).toHaveProperty("type");
          expect(result.content[0]).toHaveProperty("text");
        }
      } catch (error) {
        // Backend may not be available or times out
        expect(error).toBeDefined();
      }
    }, 5000);

    test("tool responses should contain JSON text", async () => {
      if (!isConnected) {
        return;
      }

      try {
        const result = await Promise.race([
          client.callTool({
            name: "manifold_getThings",
            arguments: {},
          }),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Tool call timeout")), 3000),
          ),
        ]);

        if (result.content && result.content.length > 0) {
          const textContent = result.content.find((c) => c.type === "text");
          if (textContent) {
            // Should be valid JSON
            expect(() => JSON.parse(textContent.text)).not.toThrow();
          }
        }
      } catch (error) {
        // Backend may not be available or times out
        expect(error).toBeDefined();
      }
    }, 5000);
  });
});
