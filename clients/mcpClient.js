const axios = require("axios");

const MCP_URL = process.env.MCP_EXECUTE_URL || "http://localhost:4000/execute";

async function callMCP(toolName, args = {}, options = {}) {
    const headers = {};

    if (options.accessToken) {
        headers["x-access-token"] = options.accessToken;
    }

    const response = await axios.post(
        MCP_URL,
        {
            toolName,
            args
        },
        { headers }
    );

    return response.data;
}

module.exports = {
    callMCP
};
