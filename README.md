# README

This is a repository for the MCPforEXP project. The project aims to create a conversational interface for Manifold.

## Project Structure

```text
├── github/workflows
├── Manifold-api/           # .krl rules for the pico engine (MCP logic)
├── prompts/                # Prompt templates used by the MCP / LLM
├── scripts/                # Automation scripts (setup, teardown, testing)
├── src/                    # Application source code (frontend + backend)
│   ├── backend/
│   │   ├── mcp-server/
│   │   ├── utility/
│   │   └── llm/
│   ├── mcp-client/
│   └── frontend/
├── test/                   # Test suites
│   ├── backend/
│   │   ├── server/
│   │   ├── llm/
│   │   └── mcp/
│   └── frontend/
```

## Prerequisites

Make sure you have the following installed:

- Node.js (v20+ recommended)
- npm
- Docker (required for test scripts)

Verify installations:

```bash
node -v
npm -v
docker -v
```

## Usage

### Install Dependencies

Make sure you’ve installed project dependencies:

```bash
npm install
```

### Environment Variables

Create a .env file with the following variables:

AWS_REGION='us-east-2'
PICO_ENGINE_BASE_URL=http://localhost:3000
VITE_API_URL=http://manny.picolabs.io:3001

### Setup

Run the full project setup. This will install the manifold ruleset to the pico.
After running the setup script you can then start the pico engine at will.

```bash
npm run setup
pico-engine
```

The _npm run setup command_ runs the scripts/setup.sh script.

### Teardown

Stop servers and clean up any temporary processes or files:

```bash
npm run teardown
```

This runs the scripts/teardown.sh script.

### Running Tests

To run the Jest test suite:

```bash
npm test
```

Or equivalently:

```bash
npm run test
```

## Running the Frontend

To test or use our frontend component for interacting with the MCP client/LLM, you will need two terminals open and running.

1. Run `npm run dev` to open vite
2. Run `npm run proxy` to connect to the mcp server

Alternatively, open `http://18.217.240.202:3005/` in your browser to see the chatbot or `http://18.217.240.202:3000/` to see the associated pico-engine.

NOTE: As it's currently configured, no matter which way the chatbot is opened, it will connect to the pico-engine instance running on the EC2 server. Any interactions you make with the pico-engine will be recorded and show up for any othe user. Multi-tenancy will be the next step.
