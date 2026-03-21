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

    return `${message}\n\nRuntime context:\n${contextEntries.map((entry) => `- ${entry}`).join("\n")}\n\nUse this context whenever the user refers to the current lead, current stage, or current screen.`;
}

module.exports = {
    normalizeText,
    findMatchedStage,
    buildUserPrompt
};
