require("dotenv").config();
const cors = require("cors");
const express = require("express");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const getStageLeadsTool = require("./tools/getStageLeads");
const getStageLeads = require("./tools/getStageLeads").handler;
const getFiltersTool = require("./tools/getFilters");
const getFilters = require("./tools/getFilters").handler;
const getAuditFormTool = require("./tools/getleadFulldeatils");
const getAuditForm = require("./tools/getleadFulldeatils").handler;
const { toolRegistry } = require("./mcp/toolRegistry");
const {
    formatLocalDate,
    inferFiltersFromMessage
} = require("./utils/filterInference");
const { runDeterministicFallback } = require("./utils/fallbackSearch");

const PORT = Number(process.env.PORT || 3000);
const DEFAULT_ACCESS_TOKEN =
    process.env.ACCESS_TOKEN ||
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoyNjgzLCJleHAiOjE3NzM0MTU1MDcuNjIxNzI4NywidXNlcm5hbWUiOiJDb3JwX2VucV9hcGkiLCJvcmdfaWQiOjIsImRvdG5ldF90b2tlbiI6ImV5SmhiR2NpT2lKSVV6STFOaUlzSW5SNWNDSTZJa3BYVkNKOS5leUoxYm1seGRXVmZibUZ0WlNJNklrTnZjbkJmWlc1eFgyRndhU0lzSWxWelpYSkpaQ0k2SWpJMk9ETWlMQ0pQY21kSlJDSTZJalFpTENKVVlYSm5aWFJFWWs1aGJXVWlPaUp3ZG5Oc1gyOXlaeUlzSWxSaGNtZGxkRUZzWTJobGJYbEVZazVoYldVaU9pSndkbk5zWDI5eVp5SXNJbEp2YkdWSlpDSTZJakU0SWl3aVFXTmpaWE56Vkhsd1pTSTZJakFpTENKQlkyTmxjM05NWlhabGJDSTZJakFpTENKeWIyeGxJam9pUkZORklpd2libUptSWpveE56Y3pNemM1TlRBM0xDSmxlSEFpT2pFM056TTBNakkzTURjc0ltbGhkQ0k2TVRjM016TTNPVFV3TjMwLnJ4ZENxSkxJY0F0cjRNM2RycThibnB3Q1ZZTnB3dDVNNi0zMGRmVGE3UFUiLCJhZHZhaXRhX3VybCI6Imh0dHBzOi8vcHZzbC55b2NveWEuaW46ODAwMiIsInJlcG9ydF91cmwiOiJodHRwczovL3B2c2wueW9jb3lhLmluOjgwMDEifQ.RwYbh3TAUhxtoZESUOYKWy0T8FkqiRTuepbdHsVGZRs";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const app = express();
const SESSION_TTL_MS = Number(process.env.SESSION_TTL_MS || 30 * 60 * 1000);
const sessionStore = new Map();

app.use(cors());
app.use(express.json({ limit: "2mb" }));

const SYSTEM_PROMPT = `
You are an AI assistant for a CRM system.
Today is ${formatLocalDate(new Date())}.

Your job is to help users search, filter, open leads, and summarize lead details from Section A and Section B.

Available tools:

1. getFilters
Use this tool to discover available local filters for a stage.

2. getStageLeads
Use this tool to fetch leads from a stage using filters.

3. getAuditForm
Use this tool after identifying the exact lead when the user wants detailed lead information, Section A / Section B details, call actions, or reminder actions.

Workflow:
- First identify the correct stage from the user request or the previous conversation.
- If the user request contains any filtering condition such as date, created on, enquiry date, before, after, between, today, yesterday, tomorrow, this week, last week, this month, last month, status, source, enquiry type, model, or any other filterable condition, call getFilters first.
- Filter keys are dynamic per stage. Never assume fixed keys.
- Always inspect local_filters and filter_guide returned by getFilters before building the filter body.
- For date range filters, use the exact from_* and to_* keys returned by getFilters.
- For date values, use the expected_format or example_value returned by getFilters.
- For selectable filters, use the exact option value returned by getFilters.
- After preparing filters, call getStageLeads with the correct stageId and filters.
- From the returned leads, identify the single most relevant lead based on the user query such as customer name, mobile number, model, ticket id, or transaction id.
- If runtime context includes available_stages, treat selected_stage_id as the current screen hint only, not as a hard restriction.
- You may search any stage listed in available_stages when the user explicitly mentions another stage.
- If the user asks for a lead by name but does not mention a stage, and available_stages exists, ask a short follow-up question for the stage name. Do not assume the currently selected stage.
- Never ask for a numeric stage ID when the stage name can be matched from available_stages.
- If the user replies with only a stage name, use the previous conversation context and continue the same task.
- If the user asks for lead details, Section A / Section B data, calling the lead, or setting a reminder, call getAuditForm for the selected lead using that lead's stage id and audit_obj.

Response rules:
- Return a natural, human-readable AI response, not raw JSON.
- If a matching lead is found, clearly mention only the requested details in short readable lines.
- Include useful fields like customer name, mobile number, interested model, ticket id, transaction id, and any useful Section A / Section B values returned by getAuditForm.
- Mention what filters were used if any.
- If no matching lead is found, clearly say that no matching lead was found.
- Do not dump the full raw object unless the user explicitly asks for raw data.
- If the user asks for only a mobile number, reply with only the name and mobile number.
- If the user asks to call someone, keep the text concise because the mobile app can show a call action.
- You may use short formatting like **Heading** or short bullet lists when it makes the answer easier to scan.
`;

function makeEvent({ type, turnId, sessionId, payload }) {
    return {
        type,
        timestamp: new Date().toISOString(),
        eventId: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        turnId,
        sessionId,
        payload
    };
}

function writeEvent(res, event) {
    res.write(`${JSON.stringify(event)}\n`);
}

function resolveAccessToken(runtimeContext = {}) {
    return runtimeContext.access_token || DEFAULT_ACCESS_TOKEN;
}

function createModel() {
    return genAI.getGenerativeModel({
        model: "gemini-3-flash-preview",
        systemInstruction: SYSTEM_PROMPT,
        tools: [
            {
                functionDeclarations: toolRegistry
            }
        ]
    });
}

function cleanupExpiredSessions() {
    const now = Date.now();

    for (const [sessionId, state] of sessionStore.entries()) {
        if (now - (state.lastActiveAt || 0) > SESSION_TTL_MS) {
            sessionStore.delete(sessionId);
        }
    }
}

function getSessionState(sessionId) {
    cleanupExpiredSessions();

    const resolvedSessionId = String(sessionId || `session_${Date.now()}`);
    let state = sessionStore.get(resolvedSessionId);

    if (!state) {
        state = {
            chat: createModel().startChat(),
            discoveredFiltersByStage: new Map(),
            lastActiveAt: Date.now()
        };
        sessionStore.set(resolvedSessionId, state);
    } else {
        state.lastActiveAt = Date.now();
    }

    return state;
}

function normalizeText(value) {
    return String(value || "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
}

function findMatchedStage(message, runtimeContext = {}) {
    const availableStages = Array.isArray(runtimeContext.available_stages)
        ? runtimeContext.available_stages
        : [];

    const normalizedMessage = normalizeText(message);
    if (!normalizedMessage || availableStages.length === 0) {
        return null;
    }

    const containsStageWord = normalizedMessage.includes("stage");
    let bestMatch = null;

    for (const stage of availableStages) {
        const normalizedName = normalizeText(stage.name);
        if (!normalizedName) {
            continue;
        }

        const exactPhrase = normalizedMessage.includes(normalizedName);
        const withoutStageSuffix = containsStageWord
            ? normalizedMessage.includes(`${normalizedName} stage`) ||
            normalizedMessage.includes(`stage ${normalizedName}`)
            : false;

        if (exactPhrase || withoutStageSuffix) {
            return stage;
        }

        const tokens = normalizedName.split(" ").filter(Boolean);
        if (tokens.length === 0) {
            continue;
        }

        const matchedTokens = tokens.filter(
            (token) => token.length > 2 && normalizedMessage.includes(token)
        );

        if (matchedTokens.length === tokens.length) {
            return stage;
        }

        if (
            matchedTokens.length >= Math.max(2, Math.ceil(tokens.length * 0.6))
        ) {
            if (!bestMatch || matchedTokens.length > bestMatch.score) {
                bestMatch = {
                    score: matchedTokens.length,
                    stage
                };
            }
        }
    }

    return bestMatch?.stage || null;
}

function buildUserPrompt(message, runtimeContext = {}) {
    const contextEntries = [
        ["selected_stage_id", "Selected stage ID"],
        ["trans_unique_id", "Transaction ID"],
        ["master_id", "Master ID"],
        ["process_id", "Process ID"],
        ["sub_process_id", "Sub process ID"],
        ["sub_sub_process_id", "Sub sub process ID"],
        ["metadata_id", "Metadata ID"]
    ]
        .map(([key, label]) => {
            const value = runtimeContext[key];
            if (value === undefined || value === null || value === "") {
                return null;
            }

            return `${label}: ${value}`;
        })
        .filter(Boolean);

    const availableStages = Array.isArray(runtimeContext.available_stages)
        ? runtimeContext.available_stages
        : [];

    if (availableStages.length > 0) {
        contextEntries.push(
            `Available stages: ${availableStages
                .map(
                    (stage) =>
                        `${stage.name} [id: ${stage.id}, count: ${stage.count ?? 0}]`
                )
                .join(", ")}`
        );
        contextEntries.push(
            "Selected stage is only the current screen context. Use the stage name from available stages whenever the user asks for another stage. Do not ask the user for a stage ID if the stage name is already present in available stages."
        );
    }

    const matchedStage = findMatchedStage(message, runtimeContext);
    if (matchedStage) {
        contextEntries.push(
            `Matched requested stage from user message: ${matchedStage.name} [id: ${matchedStage.id}, count: ${matchedStage.count ?? 0}]`
        );
    }

    if (contextEntries.length === 0) {
        return message;
    }

    return `${message}

Runtime context:
${contextEntries.map((entry) => `- ${entry}`).join("\n")}

Use this context whenever the user refers to the current lead, current stage, or current screen.`;
}

async function executeTool({
    toolCall,
    args,
    message,
    runtimeContext,
    discoveredFiltersByStage,
    accessToken
}) {
    const matchedStage = findMatchedStage(message, runtimeContext);
    const selectedStageId = Number(runtimeContext.selected_stage_id);
    const argsStageId = Number(args.stageId);

    let enrichedArgs = { ...args };

    if (
        matchedStage &&
        (!args.stageId ||
            (!Number.isNaN(selectedStageId) &&
                argsStageId === selectedStageId &&
                String(matchedStage.id) !== String(selectedStageId)))
    ) {
        enrichedArgs.stageId = Number(matchedStage.id);
        console.log(
            `Resolved stage by name from user message: ${matchedStage.name} -> ${matchedStage.id}`
        );
    }

    if (toolCall.name === "getFilters") {
        const toolResult = await getFilters(enrichedArgs, { accessToken });

        discoveredFiltersByStage.set(
            String(enrichedArgs.stageId),
            toolResult.local_filters || []
        );

        return toolResult;
    }

    if (toolCall.name === "getStageLeads") {
        let availableFilters = discoveredFiltersByStage.get(
            String(enrichedArgs.stageId)
        );

        if (!availableFilters && enrichedArgs.stageId) {
            try {
                const filterResult = await getFilters(
                    { stageId: enrichedArgs.stageId },
                    { accessToken }
                );

                availableFilters = filterResult.local_filters || [];
                discoveredFiltersByStage.set(
                    String(enrichedArgs.stageId),
                    availableFilters
                );
                console.log(
                    "Auto-discovered filters for stage:",
                    enrichedArgs.stageId
                );
            } catch (error) {
                console.error("Auto-discovery failed:", error.message);
            }
        }

        const hasFilters =
            enrichedArgs.filters && Object.keys(enrichedArgs.filters).length > 0;

        if (!hasFilters && availableFilters?.length) {
            const inferredFilters = inferFiltersFromMessage(
                message,
                availableFilters
            );

            if (Object.keys(inferredFilters).length > 0) {
                enrichedArgs = {
                    ...args,
                    filters: inferredFilters
                };
                console.log("Inferred filters from user message:", inferredFilters);
            }
        }

        return getStageLeads(enrichedArgs, { accessToken });
    }

    if (toolCall.name === "getAuditForm") {
        return getAuditForm(enrichedArgs, { accessToken });
    }

    return {
        success: false,
        message: `Unknown tool: ${toolCall.name}`
    };
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

                const toolResult = await executeTool({
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
                getFilters,
                getStageLeads
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

app.get("/health", (_req, res) => {
    res.json({
        success: true,
        message: "AI server is running"
    });
});

app.post("/agent/chat/stream", async (req, res) => {
    const {
        sessionId = `session_${Date.now()}`,
        message = "",
        runtimeContext = {}
    } = req.body || {};

    if (!String(message).trim()) {
        return res.status(400).json({
            success: false,
            message: "message is required"
        });
    }

    const turnId = `turn_${Date.now()}`;

    res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    const emit = (type, payload) => {
        writeEvent(
            res,
            makeEvent({
                type,
                turnId,
                sessionId,
                payload
            })
        );
    };

    try {
        const output = await runAIStream({
            message: String(message),
            sessionId: String(sessionId),
            runtimeContext,
            emit
        });

        emit("assistant_message", {
            text: output.finalMessage || ""
        });

        emit("turn_completed", {
            finalMessage: output.finalMessage || "",
            usedTools: Array.from(new Set(output.usedTools || []))
        });
    } catch (error) {
        console.error("Agent stream error:", error);
        emit("turn_error", {
            message: error.message || "Agent execution failed"
        });
    } finally {
        res.end();
    }
});

app.listen(PORT, "0.0.0.0", () => {
    console.log(`AI HTTP server running on http://0.0.0.0:${PORT}`);
    console.log(`Streaming endpoint: http://0.0.0.0:${PORT}/agent/chat/stream`);
});
