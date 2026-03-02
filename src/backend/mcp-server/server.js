const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../../.env") });
const fs = require("fs");

// MCP SDK (installed via npm): @modelcontextprotocol/sdk
const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js");
const {
  StdioServerTransport,
} = require("@modelcontextprotocol/sdk/server/stdio.js");

async function main() {
  const server = new McpServer({
    name: "mcpforexp-manifold",
    version: "1.0.0",
  });

  const skillsPath = path.join(__dirname, "skills");

  // 1. Scan the /skills directory
  const skillFiles = fs
    .readdirSync(skillsPath)
    .filter((file) => file.endsWith(".js"));

  console.error(
    `Initializing MCP Server... Found ${skillFiles.length} skill modules.`,
  );

  // 2. Load and Register each skill
  skillFiles.forEach((file) => {
    try {
      const tools = require(path.join(skillsPath, file));

      tools.forEach((tool) => {
        server.tool(tool.name, tool.description, tool.schema, async (args) => {
          console.error(`[Executing] ${tool.name}`); // Log to stderr so it doesn't break stdio
          const result = await tool.handler(args);
          return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          };
        });
      });
      console.error(`  ✅ Loaded skill: ${file}`);
    } catch (err) {
      console.error(`  ❌ Failed to load skill ${file}:`, err.message);
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
