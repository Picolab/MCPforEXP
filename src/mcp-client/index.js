const {
  BedrockRuntimeClient,
  ConverseCommand,
} = require("@aws-sdk/client-bedrock-runtime");
const { Client } = require("@modelcontextprotocol/sdk/client/index.js");
const {
  StdioClientTransport,
} = require("@modelcontextprotocol/sdk/client/stdio.js");
const EventEmitter = require("events");
const dotenv = require("dotenv");
const fs = require("fs");
const path = require("path");
// Ensure dotenv finds the .env at the project root
dotenv.config({ path: path.join(__dirname, "../../.env") });
const {
  getManifoldContext,
  updateManifoldContext,
} = require("../backend/llm/llm-context.js");
const {
  getToolsForSkills,
} = require("../backend/skills-tool-bank.js");

class MCPClient extends EventEmitter {
  constructor() {
    super();
    this.bedrock = new BedrockRuntimeClient({
      region: process.env.AWS_REGION || "us-east-2",
    });

    this.mcp = new Client({ name: "mcp-web-client", version: "1.0.0" });
    this.tools = [];
    this.serverScriptPath = null;
    this.isConnected = false;
    this._connectingPromise = null;
    /**
     * Logical Skills currently available for the active Thing / context.
     * By default, every Thing has the core Manifold skills and safeandmine.
     * The "journal" Skill is optional and can be added when the Journal
     * ruleset is installed on a Thing.
     *
     * Example values: ["manifold_core", "safeandmine", "journal"]
     */
    this.currentSkills = ["manifold_core", "safeandmine"];
    this.modelId = "us.anthropic.claude-3-5-sonnet-20241022-v2:0";
  }

  async refreshTools() {
    console.log("Refreshing available tools...");
    const toolsResult = await this.mcp.listTools();

    this.tools = toolsResult.tools.map((tool) => {
      // Ensure inputSchema is a valid JSON Schema object for Bedrock
      let inputSchema = tool.inputSchema;

      // If inputSchema is completely missing or invalid, this is a critical issue
      if (!inputSchema) {
        console.warn(
          `[WARN] Tool ${tool.name} has no inputSchema from MCP SDK!`,
        );
      }

      // If inputSchema is missing, null, undefined, or not an object, provide a default
      // This handles cases where MCP SDK fails to convert Zod schemas to JSON Schema
      if (
        !inputSchema ||
        typeof inputSchema !== "object" ||
        Array.isArray(inputSchema)
      ) {
        console.warn(
          `[WARN] Tool ${tool.name}: inputSchema is missing or invalid, using default empty schema`,
        );
        inputSchema = {
          type: "object",
          properties: {},
        };
      }

      // If it's an empty object (no keys), provide default structure
      if (Object.keys(inputSchema).length === 0) {
        console.warn(
          `[WARN] Tool ${tool.name}: inputSchema is empty object, using default structure`,
        );
        inputSchema = {
          type: "object",
          properties: {},
        };
      }

      // Check if the schema looks like it failed conversion (e.g., has wrong type)
      if (
        inputSchema.type &&
        inputSchema.type !== "object" &&
        inputSchema.type !== "array"
      ) {
        console.warn(
          `[WARN] Tool ${tool.name}: inputSchema has unexpected type "${inputSchema.type}", forcing to object`,
        );
        inputSchema = {
          type: "object",
          properties: inputSchema.properties || {},
        };
      }

      // Ensure it has type: "object" for Bedrock compatibility
      if (!inputSchema.type) {
        inputSchema = {
          type: "object",
          ...inputSchema,
          properties: inputSchema.properties || {},
        };
      }

      // Validate that properties exists and is an object (not array, not null)
      if (
        !inputSchema.properties ||
        typeof inputSchema.properties !== "object" ||
        Array.isArray(inputSchema.properties)
      ) {
        inputSchema.properties = {};
      }

      // Create a clean copy to avoid any prototype issues
      // Ensure properties is always a plain object (not null, not array)
      const properties =
        inputSchema.properties &&
        typeof inputSchema.properties === "object" &&
        !Array.isArray(inputSchema.properties)
          ? { ...inputSchema.properties }
          : {};

      // Build the clean schema for Bedrock
      // IMPORTANT: Bedrock doesn't like $schema field, so we exclude it
      // Bedrock expects: { type, properties, optional: required, additionalProperties }
      const cleanSchema = {
        type: "object",
        properties: properties,
      };

      // Only add optional fields if they exist and are valid
      if (
        inputSchema.required &&
        Array.isArray(inputSchema.required) &&
        inputSchema.required.length > 0
      ) {
        cleanSchema.required = [...inputSchema.required];
      }

      // CRITICAL: Remove $schema field - Bedrock doesn't need/want JSON Schema metadata
      // Also remove additionalProperties if it's false - Bedrock may reject schemas with additionalProperties: false
      // Only include additionalProperties if it's explicitly true
      if (inputSchema.additionalProperties === true) {
        cleanSchema.additionalProperties = true;
      }
      // Explicitly do NOT include additionalProperties: false - omit the field entirely

      // Final validation: ensure the schema is not empty
      if (!cleanSchema.type || !cleanSchema.properties) {
        console.error(
          `[ERROR] Tool ${tool.name}: Schema validation failed after processing`,
        );
        throw new Error(`Invalid schema for tool ${tool.name}`);
      }

      return {
        toolSpec: {
          name: tool.name,
          description: tool.description || `Tool: ${tool.name}`,
          inputSchema: cleanSchema,
        },
      };
    });
    console.log(
      `Loaded ${this.tools.length} tools: ${this.tools.map((t) => t.toolSpec.name).join(", ")}`,
    );
  }

  async connectToServer(serverScriptPath) {
    try {
      this.serverScriptPath = serverScriptPath;
      const command = serverScriptPath.endsWith(".py")
        ? process.platform === "win32"
          ? "python"
          : "python3"
        : process.execPath;
      this.transport = new StdioClientTransport({
        command,
        args: [serverScriptPath],
      });
      await this.mcp.connect(this.transport);
      await this.refreshTools();
      this.isConnected = true;
    } catch (e) {
      this.isConnected = false;
      console.error("Failed to connect to server:", e);
      throw e;
    }
  }

  /**
   * Best-effort guard to keep the MCP transport alive in long-running web deployments.
   * Stdio transports can die if the child process exits or the host restarts.
   */
  async ensureConnected() {
    if (this.isConnected) return;
    if (!this.serverScriptPath) {
      throw new Error("MCP serverScriptPath not set; call connectToServer first");
    }
    if (this._connectingPromise) {
      await this._connectingPromise;
      return;
    }
    this._connectingPromise = (async () => {
      await this.connectToServer(this.serverScriptPath);
    })();
    try {
      await this._connectingPromise;
    } finally {
      this._connectingPromise = null;
    }
  }

  async processQuery(query) {
    // If MCP dropped between requests, try to restore it before starting the tool loop.
    await this.ensureConnected().catch(() => {
      // If this fails, tool calls will surface the concrete error; the API proxy will return 500.
    });

    // 1. Fetch history and the system prompt
    const fullHistory = await getManifoldContext();
    const history = Array.isArray(fullHistory) ? fullHistory.slice(-10) : [];
    const systemPrompt = this.getSystemPrompt("v0.2.0"); // Matches your file versioning

    // 2. Format history for Bedrock
    let messages = [...history, { role: "user", content: [{ text: query }] }];
    if (messages.length > 0 && messages[0].role !== "user") {
      messages.shift();
    }

    try {
      let loopCount = 0;
      const maxLoops = 5;
      let assistantResponse = "";

      let command = new ConverseCommand({
        modelId: this.modelId,
        system: [{ text: systemPrompt }],
        messages,
        toolConfig: { tools: this.prepareToolsForBedrock() },
      });

      while (loopCount < maxLoops) {
        // Notify UI: We are waiting for the LLM
        this.emit("status", { message: "Claude is thinking..." });

        const response = await this.bedrock.send(command);
        const outputMessage = response.output?.message;
        if (!outputMessage) break;

        messages.push(outputMessage);
        const toolCalls = outputMessage.content.filter((c) => c.toolUse);
        const textParts = outputMessage.content
          .filter((c) => c.text)
          .map((c) => c.text);

        if (textParts.length > 0) {
          assistantResponse +=
            (assistantResponse ? "\n" : "") + textParts.join("\n");
        }

        if (toolCalls.length === 0) break;

        const toolResults = [];
        for (const content of toolCalls) {
          const { name, input, toolUseId } = content.toolUse;

          // CRITICAL FOR UI: Tell the user EXACTLY what tool is running
          this.emit("tool-use", { name, input });

          try {
            // Tool use is where "Not connected" typically surfaces; attempt a one-time reconnect.
            await this.ensureConnected();
            const result = await this.mcp.callTool({ name, arguments: input });
            let text = result.content
              ? result.content
                  .filter((c) => c.type === "text")
                  .map((c) => c.text)
                  .join("\n")
              : JSON.stringify(result);

            // If we just derived Skills for a Thing, update currentSkills immediately
            // so subsequent tool selection in this same query uses the correct subset.
            if (name === "manifold_getThingSkills") {
              try {
                const parsed = JSON.parse(text);
                const skills = parsed?.data?.skills;
                if (Array.isArray(skills) && skills.length > 0) {
                  this.setCurrentSkills(skills);
                }
              } catch (_) {
                // Ignore parsing errors; tool result is still passed back to the LLM
              }
            }

            toolResults.push({
              toolResult: {
                toolUseId,
                content: [{ text }],
                status: result.isError ? "error" : "success",
              },
            });
          } catch (toolErr) {
            this.isConnected = false;
            toolResults.push({
              toolResult: {
                toolUseId,
                content: [{ text: `Error: ${toolErr.message}` }],
                status: "error",
              },
            });
          }
        }

        messages.push({ role: "user", content: toolResults });
        command = new ConverseCommand({
          modelId: this.modelId,
          system: [{ text: systemPrompt }],
          messages,
          toolConfig: { tools: this.prepareToolsForBedrock() },
        });
        loopCount++;
      }

      await updateManifoldContext([
        ...history,
        { role: "user", content: [{ text: query }] },
        { role: "assistant", content: [{ text: assistantResponse }] },
      ]);

      return assistantResponse;
    } catch (e) {
      throw e; // Let the Express API handle the error response
    }
  }

  // Helper to keep processQuery clean
  prepareToolsForBedrock() {
    // Map current Skills to the subset of MCP tools that should be visible
    const allowedToolsForSkills = getToolsForSkills(this.currentSkills);
    const allowedNames = new Set(allowedToolsForSkills.map((t) => t.name));

    return this.tools
      .filter((tool) => allowedNames.has(tool.toolSpec.name))
      .map((tool) => ({
      toolSpec: {
        name: tool.toolSpec.name,
        description: tool.toolSpec.description,
        inputSchema: { json: tool.toolSpec.inputSchema },
      },
    }));
  }

  /**
   * Update the current Skills for the active Thing/context.
   * This controls which MCP tools are advertised to the LLM.
   *
   * @param {string[]} skillNames - e.g. ["manifold_core", "safeandmine", "journal"]
   */
  setCurrentSkills(skillNames) {
    if (Array.isArray(skillNames) && skillNames.length > 0) {
      this.currentSkills = skillNames;
    }
  }

  getSystemPrompt(version = "v0.2.0") {
    try {
      // Adjusted path to look for the 'prompts' folder at your project root
      const promptPath = path.join(
        __dirname,
        "../../prompts",
        `manifold_${version}.md`,
      );
      return fs.readFileSync(promptPath, "utf8");
    } catch (err) {
      console.warn(
        `[WARN] Could not load system prompt version ${version}. Using default.`,
      );
      return "You are a helpful AI assistant for the Manifold platform.";
    }
  }
}

// Export for testing
module.exports = { MCPClient };
