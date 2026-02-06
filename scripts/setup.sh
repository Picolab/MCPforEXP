set -euo pipefail

echo "Starting setup"

# Ensure dependecies are installed
if [ -d "node_modules" ]; then
    echo "Dependencies already installed"
else
    echo "Installing dependencies"
    npm install --silent
fi

# Install the pico engine
echo "Checking if pico engine is installed"
if ! command -v pico-engine &> /dev/null; then
    echo "Installing pico engine globally"
    npm install -g pico-engine --silent
else
    echo "Pico-engine already installed"
fi

# Start the pico engine as a background process
pico-engine &> /dev/null & # When the pico engine starts, the logging can just go to dev/null 
PICO_PID=$!
echo "Pico server started with PID: $PICO_PID"

# Call the install-manifold.js and it will do the following:
# 1. Call the pico, and grab the pico eci
# 2. Install the manifold-owner krl to the installed pico

echo "Calling install-manifold.js"

if ! node install-manifold.js > /dev/null 2>&1; then
    echo "ERROR: manifold failed to install"
    exit 1
fi
echo "Manifold installed"

# Shutting down pico engine
kill $PICO_PID


echo "Setup finished"