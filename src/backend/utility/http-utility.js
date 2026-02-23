async function checkENVVariable(variable, variableName) {
  if (variable) {
    return variable;
  } else {
    console.error(
      `CRITICAL: ${variableName} is ${typeof variable}. Check your .env file!`,
    );
    throw new Error(`The environment variable ${variableName} is missing.`);
  }
}

async function getFetchRequest(requestEndpoint) {
  const baseURL = await checkENVVariable(
    process.env.PICO_ENGINE_BASE_URL,
    "PICO_ENGINE_BASE_URL",
  );

  // This automatically manages slashes safely
  const requestURL = new URL(requestEndpoint, baseURL).href;

  console.error("getFetchRequest attempting:", requestURL);

  try {
    const response = await fetch(requestURL);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response;
  } catch (err) {
    console.error("Fetch Logic Failed:", err.message);
    throw err;
  }
}

module.exports = {
  getFetchRequest,
};
