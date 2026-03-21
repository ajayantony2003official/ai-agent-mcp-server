const { callMCP } = require("../clients/mcpClient");
const { inferFiltersFromMessage } = require("../utils/filterInference");
const { findMatchedStage } = require("../utils/messageUtils");

function normalizeStageId(value) {
    if (value === undefined || value === null || value === "") {
        return null;
    }

    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : null;
}

function resolveStageId({ args = {}, message = "", runtimeContext = {} }) {
    const explicitStageId = normalizeStageId(args.stageId);
    if (explicitStageId) {
        return explicitStageId;
    }

    const auditPayloadStageId = normalizeStageId(
        args.auditPayload?.StageId ??
        args.auditPayload?.stageId ??
        args.audit_obj?.StageId ??
        args.audit_obj?.stageId
    );
    if (auditPayloadStageId) {
        return auditPayloadStageId;
    }

    const matchedStage = findMatchedStage(message, runtimeContext);
    if (matchedStage?.id !== undefined && matchedStage?.id !== null) {
        return normalizeStageId(matchedStage.id);
    }

    return normalizeStageId(runtimeContext.selected_stage_id);
}

function resolveReminderAuditPayload(args = {}) {
    return (
        args.auditPayload ||
        args.auditObj ||
        args.audit_obj ||
        args.auditPayloadData ||
        null
    );
}

function buildReminderArgs(nextArgs, stageId, runtimeContext = {}) {
    const auditPayload = resolveReminderAuditPayload(nextArgs);

    if (auditPayload) {
        if (nextArgs.auditPayload === undefined) {
            nextArgs.auditPayload = auditPayload;
        }

        if (nextArgs.auditObj === undefined) {
            nextArgs.auditObj = auditPayload;
        }
    }

    if (stageId && nextArgs.stageId === undefined) {
        nextArgs.stageId = stageId;
    }

    if (nextArgs.userId === undefined) {
        nextArgs.userId = runtimeContext.user_id || runtimeContext.userId || null;
    }

    if (nextArgs.fcmToken === undefined) {
        nextArgs.fcmToken =
            runtimeContext.fcm_token ||
            runtimeContext.fcmToken ||
            runtimeContext.firebase_token ||
            null;
    }

    if (!nextArgs.title) {
        nextArgs.title = "Lead follow-up reminder";
    }

    return nextArgs;
}

function buildToolArgs({
    toolCall,
    args = {},
    message = "",
    runtimeContext = {},
    discoveredFiltersByStage
}) {
    const nextArgs = { ...(args || {}) };
    const stageId = resolveStageId({
        args: nextArgs,
        message,
        runtimeContext
    });

    if (
        stageId &&
        ["getFilters", "getStageLeads", "getAuditForm", "setReminder"].includes(toolCall.name) &&
        nextArgs.stageId === undefined
    ) {
        nextArgs.stageId = stageId;
    }

    if (toolCall.name === "getStageLeads" && stageId && discoveredFiltersByStage instanceof Map) {
        const localFilters = discoveredFiltersByStage.get(stageId) || [];
        const inferredFilters = inferFiltersFromMessage(message, localFilters);

        if (Object.keys(inferredFilters).length > 0 || nextArgs.filters) {
            nextArgs.filters = {
                ...inferredFilters,
                ...(nextArgs.filters || {})
            };
        }
    }

    if (toolCall.name === "setReminder") {
        buildReminderArgs(nextArgs, stageId, runtimeContext);
    }

    return nextArgs;
}

function rememberDiscoveredFilters(toolName, toolArgs, toolResult, discoveredFiltersByStage) {
    if (
        toolName !== "getFilters" ||
        !(discoveredFiltersByStage instanceof Map) ||
        !toolArgs.stageId ||
        !Array.isArray(toolResult?.local_filters)
    ) {
        return;
    }

    discoveredFiltersByStage.set(Number(toolArgs.stageId), toolResult.local_filters);
}

async function executeViaMCP({
    toolCall,
    args,
    message,
    runtimeContext,
    discoveredFiltersByStage,
    accessToken
}) {
    const toolArgs = buildToolArgs({
        toolCall,
        args,
        message,
        runtimeContext,
        discoveredFiltersByStage
    });

    const result = await callMCP(toolCall.name, toolArgs, { accessToken });

    rememberDiscoveredFilters(
        toolCall.name,
        toolArgs,
        result,
        discoveredFiltersByStage
    );

    return result;
}

function createMCPInvoker(toolName, accessToken) {
    return async (args = {}) => callMCP(toolName, args, { accessToken });
}

module.exports = {
    executeViaMCP,
    createMCPInvoker,
    resolveStageId
};
