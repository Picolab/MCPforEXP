# README

This is a repository for the MCPforEXP project. The project aims to create a conversational interface for Manifold. 


## Project Structure
The project is structured to clearly separate concerns and support scalability and testing. Source code lives under src/, with backend logic divided between server functionality and LLM/MCP integration, and the UI isolated in its own directory. Tests mirror the source structure under test/, making it easy to locate and maintain test coverage alongside corresponding components. Supporting scripts are kept in scripts/ to keep automation and tooling separate from application logic. This layout was chosen to improve readability, encourage modular development, and make the system easier to extend as the MCP and LLM integrations evolve.

```text
├── scripts/
├── src/
│   ├── backend/
│   │   ├── server/
│   │   └── llm/
│   └── ui/
├── test/
│   ├── backend/
│   │   ├── server/
│   │   └── llm/
│   └── ui/
```

## Usage

This project comes with convenient npm scripts to manage setup, teardown, and tests.

### Install Dependencies

Make sure you’ve installed project dependencies:

```bash
npm install
```

### Setup

Run the full project setup. This will install the manifold ruleset to the pico.
After running the setup script you can then start the pico engine at will.

```bash
npm run setup
pico-engine
```
The *npm run setup command* runs the scripts/setup.sh script.

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