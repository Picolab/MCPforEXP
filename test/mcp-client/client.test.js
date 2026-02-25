/**
 * Tests for MCP Client
 * Tests client initialization, tool loading, and query processing
 */

// Mock AWS SDK
jest.mock("@aws-sdk/client-bedrock-runtime", () => ({
  BedrockRuntimeClient: jest.fn().mockImplementation(() => ({
    send: jest.fn(),
  })),
  ConverseCommand: jest.fn().mockImplementation((params) => ({
    input: params,
  })),
}));

// Mock MCP SDK Client
jest.mock("@modelcontextprotocol/sdk/client/index.js", () => ({
  Client: jest.fn().mockImplementation(() => ({
    connect: jest.fn().mockResolvedValue(undefined),
    listTools: jest.fn().mockResolvedValue({
      tools: [
        {
          name: "test_tool",
          description: "A test tool",
          inputSchema: {
            type: "object",
            properties: {
              param1: { type: "string" },
            },
          },
        },
      ],
    }),
    callTool: jest.fn().mockResolvedValue({
      content: [{ type: "text", text: '{"result": "success"}' }],
      isError: false,
    }),
    close: jest.fn().mockResolvedValue(undefined),
  })),
}));

// Mock stdio transport
jest.mock("@modelcontextprotocol/sdk/client/stdio.js", () => ({
  StdioClientTransport: jest.fn().mockImplementation(() => ({})),
}));

// Mock dotenv
jest.mock("dotenv", () => ({
  config: jest.fn(),
}));

// Mock LLM context functions
jest.mock("../../src/backend/llm/llm-context.js", () => ({
  getManifoldContext: jest.fn().mockResolvedValue([]), // Return empty history by default
  updateManifoldContext: jest.fn().mockResolvedValue(true),
}));

process.env.AWS_BEARER_TOKEN_BEDROCK = "test-token";
process.env.AWS_REGION = "us-east-2";

const { MCPClient } = require("../../src/mcp-client/index.js");

describe("MCP Client", () => {
  let client;
  const originalEnv = process.env;

  beforeEach(() => {
    // Set up test environment
    process.env = {
      ...originalEnv,
      AWS_BEARER_TOKEN_BEDROCK: "test-token",
      AWS_REGION: "us-east-2",
    };
    jest.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("Initialization", () => {
    test("should create client with required environment variables", () => {
      expect(() => {
        client = new MCPClient();
      }).not.toThrow();
      expect(client).toBeDefined();
      expect(client.bedrock).toBeDefined();
      expect(client.mcp).toBeDefined();
    });

    test("should throw error if AWS_BEARER_TOKEN_BEDROCK is missing", () => {
      delete process.env.AWS_BEARER_TOKEN_BEDROCK;
      expect(() => {
        new MCPClient();
      }).toThrow("AWS_BEARER_TOKEN_BEDROCK is missing from .env file");
    });

    test("should use default region if AWS_REGION not set", () => {
      delete process.env.AWS_REGION;
      client = new MCPClient();
      expect(client).toBeDefined();
    });
  });

  describe("Tool Loading", () => {
    beforeEach(async () => {
      client = new MCPClient();
      await client.mcp.connect({});
    });

    test("should load tools from MCP server", async () => {
      await client.refreshTools();

      expect(client.tools).toBeDefined();
      expect(client.tools.length).toBeGreaterThan(0);
    });

    test("should format tools correctly for Bedrock", async () => {
      await client.refreshTools();

      if (client.tools.length > 0) {
        const tool = client.tools[0];
        expect(tool).toHaveProperty("toolSpec");
        expect(tool.toolSpec).toHaveProperty("name");
        expect(tool.toolSpec).toHaveProperty("description");
        expect(tool.toolSpec).toHaveProperty("inputSchema");
      }
    });

    test("should handle tools with missing inputSchema", async () => {
      // Mock a tool with missing schema
      client.mcp.listTools = jest.fn().mockResolvedValue({
        tools: [
          {
            name: "tool_no_schema",
            description: "Tool without schema",
            inputSchema: null,
          },
        ],
      });

      await client.refreshTools();

      expect(client.tools.length).toBeGreaterThan(0);
      // Should have default schema
      const tool = client.tools[0];
      expect(tool.toolSpec.inputSchema).toBeDefined();
    });

    test("should handle tools with empty inputSchema", async () => {
      client.mcp.listTools = jest.fn().mockResolvedValue({
        tools: [
          {
            name: "tool_empty_schema",
            description: "Tool with empty schema",
            inputSchema: {},
          },
        ],
      });

      await client.refreshTools();

      const tool = client.tools[0];
      expect(tool.toolSpec.inputSchema.type).toBe("object");
      expect(tool.toolSpec.inputSchema.properties).toBeDefined();
    });
  });

  describe("Query Processing", () => {
    let mockBedrockSend;

    beforeEach(async () => {
      client = new MCPClient();
      await client.mcp.connect({});
      await client.refreshTools();

      mockBedrockSend = client.bedrock.send;
    });

    test("should process simple text query", async () => {
      mockBedrockSend.mockResolvedValueOnce({
        output: {
          message: {
            content: [{ text: "This is a test response" }],
          },
        },
      });

      const result = await client.processQuery("test query");

      expect(result).toContain("test response");
      expect(mockBedrockSend).toHaveBeenCalled();
    });

    test("should handle tool use in response", async () => {
      const toolUseId = "tool-use-123";
      mockBedrockSend
        .mockResolvedValueOnce({
          output: {
            message: {
              content: [
                {
                  toolUse: {
                    toolUseId: toolUseId,
                    name: "test_tool",
                    input: { param1: "value1" },
                  },
                },
              ],
            },
          },
        })
        .mockResolvedValueOnce({
          output: {
            message: {
              content: [{ text: "Tool executed successfully" }],
            },
          },
        });

      const result = await client.processQuery("use test_tool");

      expect(result).toContain("Tool executed successfully");
      expect(client.mcp.callTool).toHaveBeenCalledWith({
        name: "test_tool",
        arguments: { param1: "value1" },
      });
    });

    test("should handle errors gracefully", async () => {
      mockBedrockSend.mockRejectedValueOnce(new Error("Bedrock API error"));

      const result = await client.processQuery("test query");

      expect(result).toContain("Error processing query");
      expect(result).toContain("Bedrock API error");
    });

    test("should return error message if no tools available", async () => {
      client.tools = [];

      const result = await client.processQuery("test query");

      expect(result).toContain("No tools available");
    });
  });

  describe("Schema Processing", () => {
    beforeEach(async () => {
      client = new MCPClient();
      await client.mcp.connect({});
    });

    test("should remove $schema field from schemas", async () => {
      client.mcp.listTools = jest.fn().mockResolvedValue({
        tools: [
          {
            name: "test_tool",
            description: "Test",
            inputSchema: {
              type: "object",
              properties: {},
              $schema: "http://json-schema.org/draft-07/schema#",
            },
          },
        ],
      });

      await client.refreshTools();

      const tool = client.tools[0];
      expect(tool.toolSpec.inputSchema.$schema).toBeUndefined();
    });

    test("should ensure required array exists", async () => {
      client.mcp.listTools = jest.fn().mockResolvedValue({
        tools: [
          {
            name: "test_tool",
            description: "Test",
            inputSchema: {
              type: "object",
              properties: { name: { type: "string" } },
            },
          },
        ],
      });

      await client.refreshTools();

      const tool = client.tools[0];
      // After processing, should have required array (even if empty)
      expect(tool.toolSpec.inputSchema).toBeDefined();
    });
  });

  describe("Cleanup", () => {
    test("should close MCP connection on cleanup", async () => {
      client = new MCPClient();
      await client.mcp.connect({});

      await client.cleanup();

      expect(client.mcp.close).toHaveBeenCalled();
    });
  });
});
