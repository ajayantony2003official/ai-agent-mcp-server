const axios = require("axios");
const readline = require("readline");

async function run() {
    const response = await axios.post(
        "http://127.0.0.1:3000/agent/chat/stream",
        {
            sessionId: `test_${Date.now()}`,
            message: "Get lead details for Ajay",
            runtimeContext: {}
        },
        {
            responseType: "stream",
            headers: {
                Accept: "application/x-ndjson"
            }
        }
    );

    const lineReader = readline.createInterface({
        input: response.data
    });

    lineReader.on("line", (line) => {
        if (!line.trim()) {
            return;
        }

        try {
            console.log(JSON.parse(line));
        } catch (error) {
            console.error("Failed to parse line:", line, error.message);
        }
    });

    lineReader.on("close", () => {
        console.log("Stream completed");
    });
}

run().catch((error) => {
    console.error("Test failed:", error.response?.data || error.message);
});
