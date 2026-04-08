const {
  BedrockRuntimeClient,
  ConverseStreamCommand,
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
const { getToolsForSkills } = require("../backend/skills-tool-bank.js");

class MCPClient extends EventEmitter {
  constructor() {
    super();
    this.bedrock = new BedrockRuntimeClient({
      region: process.env.AWS_REGION || "us-east-2",
    });

    this.mcp = new Client({ name: "mcp-web-client", version: "1.0.0" });
    this.tools = [];
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
    } catch (e) {
      console.error("Failed to connect to server:", e);
      throw e;
    }
  }

  // 1. Add onChunk as a parameter so the Proxy can receive the stream
  async processQuery(query, onChunk) {
    const fullHistory = await getManifoldContext();
    const history = Array.isArray(fullHistory) ? fullHistory.slice(-10) : [];
    const systemPrompt = this.getSystemPrompt("v0.1.0");

    let messages = [...history, { role: "user", content: [{ text: query }] }];
    if (messages.length > 0 && messages[0].role !== "user") {
      messages.shift();
    }

    try {
      let loopCount = 0;
      const maxLoops = 5;
      let assistantResponse = "";

      while (loopCount < maxLoops) {
        this.emit("status", { message: "Manny is thinking..." });

        const command = new ConverseStreamCommand({
          modelId: this.modelId,
          system: [{ text: systemPrompt }],
          messages,
          toolConfig: { tools: this.prepareToolsForBedrock() },
        });

        const response = await this.bedrock.send(command);

        let currentToolUse = null;
        let streamedText = "";
        let toolCallsFound = [];

        // --- STREAM PROCESSING LOOP ---
        for await (const chunk of response.stream) {
          // Handle Text
          if (chunk.contentBlockDelta?.delta?.text) {
            const text = chunk.contentBlockDelta.delta.text;

            // 1. ADD THIS BACK: To see it in the SSH terminal
            console.log("DEBUG - CHUNK EMITTED:", text);

            streamedText += text;
            assistantResponse += text;

            if (onChunk) {
              onChunk(text);
              // 2. THE HACK: Push 2KB of spaces to force the AWS Load Balancer to flush
              onChunk(" ".repeat(2048));
            }
          }

          // Handle Tool Use Start
          if (chunk.contentBlockStart?.start?.toolUse) {
            currentToolUse = {
              ...chunk.contentBlockStart.start.toolUse,
              input: "",
            };
          }

          // Handle Tool Input (Deltas)
          if (chunk.contentBlockDelta?.delta?.toolUse?.input) {
            currentToolUse.input += chunk.contentBlockDelta.delta.toolUse.input;
          }

          // Handle Tool Use End/Complete
          if (chunk.contentBlockStop) {
            if (currentToolUse) {
              toolCallsFound.push(currentToolUse);
              currentToolUse = null;
            }
          }
        }

        // --- RECONSTRUCT MESSAGE FOR HISTORY ---
        // Bedrock needs the EXACT response back to continue the loop
        const assistantMessageContent = [];
        if (streamedText) assistantMessageContent.push({ text: streamedText });

        toolCallsFound.forEach((tc) => {
          assistantMessageContent.push({
            toolUse: {
              toolUseId: tc.toolUseId,
              name: tc.name,
              input: JSON.parse(tc.input || "{}"),
            },
          });
        });

        const outputMessage = {
          role: "assistant",
          content: assistantMessageContent,
        };
        messages.push(outputMessage);

        // If no tools were called, we are done
        if (toolCallsFound.length === 0) break;

        // --- EXECUTE TOOLS ---
        const toolResults = [];
        for (const toolCall of toolCallsFound) {
          const { name, toolUseId } = toolCall;
          const input = JSON.parse(toolCall.input || "{}");

          this.emit("tool-use", { name, input });

          try {
            const result = await this.mcp.callTool({ name, arguments: input });
            let text = result.content
              ? result.content
                  .filter((c) => c.type === "text")
                  .map((c) => c.text)
                  .join("\n")
              : JSON.stringify(result);

            // Handle Skill Refresh logic
            if (name === "manifold_getThingSkills") {
              try {
                const parsed = JSON.parse(text);
                const skills = parsed?.data?.skills;
                if (Array.isArray(skills)) this.setCurrentSkills(skills);
              } catch (_) {}
            }

            toolResults.push({
              toolResult: {
                toolUseId,
                content: [{ text }],
                status: result.isError ? "error" : "success",
              },
            });
          } catch (toolErr) {
            toolResults.push({
              toolResult: {
                toolUseId,
                content: [{ text: `Error: ${toolErr.message}` }],
                status: "error",
              },
            });
          }
        }

        // Push results and loop
        messages.push({ role: "user", content: toolResults });
        loopCount++;
      }

      // Update the persistent database/file context
      await updateManifoldContext([
        ...history,
        { role: "user", content: [{ text: query }] },
        { role: "assistant", content: [{ text: assistantResponse }] },
      ]);

      return assistantResponse;
    } catch (e) {
      console.error("Critical Error in processQuery:", e);
      throw e;
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

  getSystemPrompt(version = "v0.1.0") {
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
