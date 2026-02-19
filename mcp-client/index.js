const { BedrockRuntimeClient, ConverseCommand } = require("@aws-sdk/client-bedrock-runtime");
const { Client } = require("@modelcontextprotocol/sdk/client/index.js");
const { StdioClientTransport } = require("@modelcontextprotocol/sdk/client/stdio.js");
const readline = require("readline");
const { promisify } = require("util");
const dotenv = require("dotenv");
const path = require("path");
// Ensure dotenv finds the .env at the project root
dotenv.config({ path: path.join(__dirname, "../.env") });
class MCPClient {
    mcp;
    bedrock;
    transport = null;
    tools = [];
    // Correct Inference Profile ID for Claude 3.5 Sonnet v2
    modelId = "us.anthropic.claude-3-5-sonnet-20241022-v2:0";
    constructor() {
        const token = process.env.AWS_BEARER_TOKEN_BEDROCK;
        if (!token) {
            throw new Error("AWS_BEARER_TOKEN_BEDROCK is missing from .env file");
        }
        const region = process.env.AWS_REGION || "us-east-2";
        // Configure Bedrock client with bearer token authentication
        // Note: This uses a custom token configuration - adjust if using standard AWS credentials
        this.bedrock = new BedrockRuntimeClient({
            region: region,
            token: { token: token }
        });
        this.mcp = new Client({ name: "mcp-client-cli", version: "1.0.0" });
    }
    async refreshTools() {
        console.log("Refreshing available tools...");
        const toolsResult = await this.mcp.listTools();
        
        this.tools = toolsResult.tools.map((tool) => {
            // Ensure inputSchema is a valid JSON Schema object for Bedrock
            let inputSchema = tool.inputSchema;
            
            // If inputSchema is completely missing or invalid, this is a critical issue
            if (!inputSchema) {
                console.warn(`[WARN] Tool ${tool.name} has no inputSchema from MCP SDK!`);
            }
            
            // If inputSchema is missing, null, undefined, or not an object, provide a default
            // This handles cases where MCP SDK fails to convert Zod schemas to JSON Schema
            if (!inputSchema || typeof inputSchema !== 'object' || Array.isArray(inputSchema)) {
                console.warn(`[WARN] Tool ${tool.name}: inputSchema is missing or invalid, using default empty schema`);
                inputSchema = {
                    type: "object",
                    properties: {}
                };
            }
            
            // If it's an empty object (no keys), provide default structure
            if (Object.keys(inputSchema).length === 0) {
                console.warn(`[WARN] Tool ${tool.name}: inputSchema is empty object, using default structure`);
                inputSchema = {
                    type: "object",
                    properties: {}
                };
            }
            
            // Check if the schema looks like it failed conversion (e.g., has wrong type)
            if (inputSchema.type && inputSchema.type !== "object" && inputSchema.type !== "array") {
                console.warn(`[WARN] Tool ${tool.name}: inputSchema has unexpected type "${inputSchema.type}", forcing to object`);
                inputSchema = {
                    type: "object",
                    properties: inputSchema.properties || {}
                };
            }
            
            // Ensure it has type: "object" for Bedrock compatibility
            if (!inputSchema.type) {
                inputSchema = {
                    type: "object",
                    ...inputSchema,
                    properties: inputSchema.properties || {}
                };
            }
            
            // Validate that properties exists and is an object (not array, not null)
            if (!inputSchema.properties || typeof inputSchema.properties !== 'object' || Array.isArray(inputSchema.properties)) {
                inputSchema.properties = {};
            }
            
            // Create a clean copy to avoid any prototype issues
            // Ensure properties is always a plain object (not null, not array)
            const properties = (inputSchema.properties && typeof inputSchema.properties === 'object' && !Array.isArray(inputSchema.properties))
                ? { ...inputSchema.properties }
                : {};
            
            // Build the clean schema for Bedrock
            // IMPORTANT: Bedrock doesn't like $schema field, so we exclude it
            // Bedrock expects: { type, properties, optional: required, additionalProperties }
            const cleanSchema = {
                type: "object",
                properties: properties
            };
            
            // Only add optional fields if they exist and are valid
            if (inputSchema.required && Array.isArray(inputSchema.required) && inputSchema.required.length > 0) {
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
                console.error(`[ERROR] Tool ${tool.name}: Schema validation failed after processing`);
                throw new Error(`Invalid schema for tool ${tool.name}`);
            }
            
            return {
                toolSpec: {
                    name: tool.name,
                    description: tool.description || `Tool: ${tool.name}`,
                    inputSchema: cleanSchema
                }
            };
        });
        console.log(`Loaded ${this.tools.length} tools: ${this.tools.map(t => t.toolSpec.name).join(", ")}`);
    }
    async connectToServer(serverScriptPath) {
        try {
            const command = serverScriptPath.endsWith(".py") ?
                (process.platform === "win32" ? "python" : "python3") : process.execPath;
            this.transport = new StdioClientTransport({
                command,
                args: [serverScriptPath],
            });
            await this.mcp.connect(this.transport);
            await this.refreshTools();
        }
        catch (e) {
            console.error("Failed to connect to server:", e);
            throw e;
        }
    }
    async processQuery(query) {
        let messages = [{ role: "user", content: [{ text: query }] }];
        try {
            // Validate tools before sending to Bedrock
            if (!this.tools || this.tools.length === 0) {
                return "Error: No tools available. Try /refresh to reload tools.";
            }
            
            // Validate each tool's inputSchema before sending
            const invalidTools = this.tools.filter(tool => {
                const schema = tool.toolSpec?.inputSchema;
                return !schema || typeof schema !== 'object' || !schema.type || !schema.properties;
            });
            
            if (invalidTools.length > 0) {
                console.error(`[ERROR] Found ${invalidTools.length} tools with invalid schemas:`, 
                    invalidTools.map(t => t.toolSpec?.name).join(", "));
                // Filter out invalid tools
                this.tools = this.tools.filter(tool => {
                    const schema = tool.toolSpec?.inputSchema;
                    return schema && typeof schema === 'object' && schema.type && schema.properties;
                });
                if (this.tools.length === 0) {
                    return "Error: All tools have invalid schemas. Please check the MCP server configuration.";
                }
            }
            
            // Create a deep copy of tools to ensure no reference issues
            // Also ensure each schema is a plain object with no prototype chain issues
            const toolsForBedrock = this.tools.map(tool => {
                const schema = tool.toolSpec.inputSchema;
                
                // Bedrock REQUIRES these three specific fields to be present
                const cleanInputSchema = {
                    type: "object",
                    properties: (schema && schema.properties && Object.keys(schema.properties).length > 0) 
                        ? { ...schema.properties } 
                        : {},
                    // Bedrock often fails if 'required' is missing, even if empty
                    required: (schema && Array.isArray(schema.required)) ? [...schema.required] : []
                };
            
                return {
                    toolSpec: {
                        name: tool.toolSpec.name,
                        description: tool.toolSpec.description || "Manifold Tool",
                        inputSchema: { json: cleanInputSchema } // MUST be wrapped in 'json' for the Converse API
                    }
                };
            });
            
            try {
                const command = new ConverseCommand({
                    modelId: this.modelId,
                    messages,
                    toolConfig: { tools: toolsForBedrock }
                });
                
                const response = await this.bedrock.send(command);
                const finalText = [];
                const outputMessage = response.output?.message;
                if (!outputMessage)
                    return "Error: No response from model.";
                messages.push(outputMessage);
                for (const content of outputMessage.content || []) {
                    if (content.text) {
                        finalText.push(content.text);
                    }
                    else if (content.toolUse) {
                        const toolName = content.toolUse.name;
                        const toolArgs = content.toolUse.input ?? {};
                        console.log(`[Tool Call: ${toolName}]`);
                        const result = await this.mcp.callTool({
                            name: toolName,
                            arguments: toolArgs,
                        });
                        // Extract text content from MCP tool result
                        let toolResultText = "";
                        if (result.content && Array.isArray(result.content)) {
                            const textParts = result.content
                                .filter(c => c.type === "text")
                                .map(c => c.text);
                            toolResultText = textParts.join("\n");
                        } else {
                            toolResultText = JSON.stringify(result, null, 2);
                        }
                        const toolResult = {
                            role: "user",
                            content: [{
                                    toolResult: {
                                        toolUseId: content.toolUse.toolUseId,
                                        content: [{ text: toolResultText }],
                                        status: result.isError ? "error" : "success"
                                    }
                                }]
                        };
                        messages.push(toolResult);
                        const finalResponse = await this.bedrock.send(new ConverseCommand({
                            modelId: this.modelId,
                            messages,
                            toolConfig: { tools: toolsForBedrock }
                        }));
                        // Safely extract text from the final response
                        const lastContent = finalResponse.output?.message?.content?.[0];
                        if (lastContent?.text) {
                            finalText.push(lastContent.text);
                        }
                        else {
                            finalText.push("[Tool execution successful, but no follow-up text provided]");
                        }
                    }
                }
                return finalText.length > 0 ? finalText.join("\n") : "Model provided no text response.";
            } catch (e) {
                return `Error processing query: ${e.message}`;
            }
        } catch (e) {
            return `Error processing query: ${e.message}`;
        }
    }
    async chatLoop() {
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        const question = (query) => new Promise((resolve) => rl.question(query, resolve));
        console.log("\nMCP Client Started! Ready for your Manifold queries.");
        console.log("Type 'quit' to exit, '/refresh' to reload tools.\n");
        try {
            while (true) {
                const message = await question("\nQuery: ");
                if (!message || message.toLowerCase() === "quit" || message.toLowerCase() === "exit") {
                    break;
                }
                if (message.toLowerCase() === "/refresh") {
                    await this.refreshTools();
                    continue;
                }
                const response = await this.processQuery(message);
                console.log("\n" + response);
            }
        } finally {
            rl.close();
        }
    }
    async cleanup() {
        await this.mcp.close();
    }
}
async function main() {
    const serverPath = process.argv[2] || "src/mcp-server/server.js";
    if (process.argv.length < 3) {
        console.log(`Usage: node mcp-client/index.js <path_to_server_script>`);
        console.log(`Using default server path: ${serverPath}`);
    }
    const client = new MCPClient();
    try {
        await client.connectToServer(serverPath);
        await client.chatLoop();
    }
    catch (e) {
        console.error("Main Error:", e);
        process.exit(1);
    }
    finally {
        await client.cleanup();
    }
}
main();
