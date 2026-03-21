const { getSessionState } = require("./sessionService");
const { buildUserPrompt } = require("../utils/messageUtils");
const { executeViaMCP, createMCPInvoker } = require("./mcpExecutionService");
const { runDeterministicFallback } = require("../utils/fallbackSearch");

const DEFAULT_ACCESS_TOKEN =
    process.env.ACCESS_TOKEN ||
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoyNjgzLCJleHAiOjE3NzM0MTU1MDcuNjIxNzI4NywidXNlcm5hbWUiOiJDb3JwX2VucV9hcGkiLCJvcmdfaWQiOjIsImRvdG5ldF90b2tlbiI6ImV5SmhiR2NpT2lKSVV6STFOaUlzSW5SNWNDSTZJa3BYVkNKOS5leUoxYm1seGRXVmZibUZ0WlNJNklrTnZjbkJmWlc1eFgyRndhU0lzSWxWelpYSkpaQ0k2SWpJMk9ETWlMQ0pQY21kSlJDSTZJalFpTENKVVlYSm5aWFJFWWs1aGJXVWlPaUp3ZG5Oc1gyOXlaeUlzSWxSaGNtZGxkRUZzWTJobGJYbEVZazVoYldVaU9pSndkbk5zWDI5eVp5SXNJbEp2YkdWSlpDSTZJakU0SWl3aVFXTmpaWE56Vkhsd1pTSTZJakFpTENKQlkyTmxjM05NWlhabGJDSTZJakFpTENKeWIyeGxJam9pUkZORklpd2libUptSWpveE56Y3pNemM1TlRBM0xDSmxlSEFpT2pFM056TTBNakkzTURjc0ltbGhkQ0k2TVRjM016TTNPVFV3TjMwLnJ4ZENxSkxJY0F0cjRNM2RycThibnB3Q1ZZTnB3dDVNNi0zMGRmVGE3UFUiLCJhZHZhaXRhX3VybCI6Imh0dHBzOi8vcHZzbC55b2NveWEuaW46ODAwMiIsInJlcG9ydF91cmwiOiJodHRwczovL3B2c2wueW9jb3lhLmluOjgwMDEifQ.RwYbh3TAUhxtoZESUOYKWy0T8FkqiRTuepbdHsVGZRs";

function resolveAccessToken(runtimeContext = {}) {
    return runtimeContext.access_token || DEFAULT_ACCESS_TOKEN;
}

async function runAIStream({
    message,
    sessionId,
    runtimeContext = {},
    emit
}) {
    const sessionState = getSessionState(sessionId);
    const { chat, discoveredFiltersByStage } = sessionState;
    const accessToken = resolveAccessToken(runtimeContext);
    const usedTools = [];

    try {
        emit("agent_status", {
            stage: "intent_detection",
            message: "Analyzing request"
        });

        let result = await chat.sendMessage(
            buildUserPrompt(message, runtimeContext)
        );

        while (true) {
            const response = result.response;
            const calls = response.functionCalls?.() || [];

            console.log("Tool calls:", calls.map((call) => call.name));
            console.log(
                "Tool body:",
                JSON.stringify(calls.map((call) => call.args), null, 2)
            );

            if (calls.length === 0) {
                return {
                    finalMessage: response.text(),
                    usedTools
                };
            }

            emit("agent_status", {
                stage: "tool_execution",
                message: "Running CRM tools"
            });

            const functionResponses = [];

            for (const toolCall of calls) {
                const args = toolCall.args || {};
                usedTools.push(toolCall.name);

                emit("tool_call", {
                    name: toolCall.name,
                    arguments: args
                });

                const toolResult = await executeViaMCP({
                    toolCall,
                    args,
                    message,
                    runtimeContext,
                    discoveredFiltersByStage,
                    accessToken
                });

                emit("tool_result", {
                    name: toolCall.name,
                    result: toolResult
                });

                functionResponses.push({
                    functionResponse: {
                        name: toolCall.name,
                        response: { result: toolResult }
                    }
                });
            }

            emit("agent_status", {
                stage: "response_generation",
                message: "Preparing final response"
            });

            result = await chat.sendMessage(functionResponses);
        }
    } catch (error) {
        if (error?.status === 429) {
            console.warn("Gemini quota exceeded. Falling back to deterministic search.");

            const fallbackResponse = await runDeterministicFallback(message, {
                accessToken,
                getFilters: createMCPInvoker("getFilters", accessToken),
                getStageLeads: createMCPInvoker("getStageLeads", accessToken)
            });

            if (fallbackResponse) {
                return {
                    finalMessage: fallbackResponse,
                    usedTools
                };
            }

            const retryDelay =
                error?.errorDetails?.find(
                    (detail) =>
                        detail["@type"] ===
                        "type.googleapis.com/google.rpc.RetryInfo"
                )?.retryDelay || null;

            return {
                finalMessage: retryDelay
                    ? `Gemini quota is exhausted right now. Retry after ${retryDelay}, or use a paid Gemini key.`
                    : "Gemini quota is exhausted right now. Use a paid Gemini key or wait for quota reset.",
                usedTools
            };
        }

        throw error;
    }
}

module.exports = {
    resolveAccessToken,
    runAIStream
};
