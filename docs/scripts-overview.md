# Scripts

This directory contains utility scripts used to install test, and manage the lifecycle of the Pico engine with Manifold.

## Overview

These scripts are intended to simplify local development and ensure a consistent enviornment when working with the Pico engine.

## Available Scripts

### setup.sh

Installs and configures the Pico engine with Manifold.

- Performs initial enviornment setup
- Installs required dependencies
- Prepares the system for development or testing

#### How to Run

Run the following command from the root of the project:

```bash
npm run setup
```

### teardown.sh

Resets the Pico engine to its base state.

- Removes installed components
- Cleans up enviornment changes
- Returns system to a fresh state

#### How to run

After running this, you must run setup.sh again before using the system.

Run the following ocmmand from the root of the project

```bash
npm run teardown
```

### install-manifold.js

Handles the installation of Manifold. Essentially, the logic for setup .sh.

The reason why we seperated it into a .js file has to do with the asyncronous nature of the repo.

This file wasn't intended to run outside of the setup script.

### docker-test-runner.sh

Runs the tests inside a Docker container

- Ensures tests run in a consistent enviornment
- Avoids local machine dependency issues.

Requirements:

- Docker must be installed
- Docker must be running

#### How to run

From the root of the project run:

```bash
npm run test:docker
```

## Example Workflow

```bash
# Initial setup
npm run setup

# Run tests
npm run test:docker

# Reset enviornemnt
npm run teardown

# Reinstall after teardown
npm run setup
```
