set -euo pipefail

echo "Starting teardown"
# Remove the entire pico engine
echo "Removing pico engine"

if ! rm -r ~/.pico-engine 2>/dev/null; then
    echo "Error: failed to reset pico-engine"
    exit 1
fi

echo "Teardown complete"