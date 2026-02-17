#!/usr/bin/env bash

# Fail fast on errors
set -e

echo "=== Journal API Test ==="

read -p "Enter ECI: " ECI
read -p "Enter Note Title: " TITLE
read -p "Enter Note Content: " CONTENT

echo ""
echo "Adding note..."
node <<EOF
(async () => {
  const { addNote, getNote } = require("../src/backend/api-wrapper");

  try {
    await addNote("$ECI", "$TITLE", "$CONTENT");
    console.log("✅ addNote completed");

    console.log("Fetching note...");
    await getNote("$ECI", "$TITLE");
    console.log("✅ getNote completed");
  } catch (err) {
    console.error("❌ Test failed:", err);
    process.exit(1);
  }
})();
EOF
