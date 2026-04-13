const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

function checkENVVariable(variable, variableName) {
  if (variable) {
    return variable;
  }
  console.error(`CRITICAL: ${variableName} is missing. Check your .env file!`);
  throw new Error(`The environment variable ${variableName} is missing.`);
}

// Get the URL once at the top level
const PICO_BASE_URL = checkENVVariable(
  process.env.PICO_ENGINE_BASE_URL,
  "PICO_ENGINE_BASE_URL",
);

async function getFetchRequest(requestEndpoint) {
  const requestURL = new URL(requestEndpoint, PICO_BASE_URL).href;
  try {
    const response = await fetch(requestURL);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response;
  } catch (err) {
    console.error("Fetch Logic Failed:", err.message);
    throw err;
  }
}

async function postFetchRequest(requestEndpoint, requestBody) {
  const requestURL = new URL(requestEndpoint, PICO_BASE_URL).href;
  try {
    const response = await fetch(requestURL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response;
  } catch (err) {
    console.error("Fetch Logic Failed: ", err.message);
    throw err;
  }
}

module.exports = { getFetchRequest, postFetchRequest };
