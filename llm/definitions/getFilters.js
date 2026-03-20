module.exports = {
    name: "getFilters",
    description: "Discover the dynamic local filters for a stage before calling getStageLeads. Filter keys can change by stage, so use this tool first whenever the user asks for filter-based search and the exact keys are unknown.",
    parameters: {
        type: "object",
        properties: {
            stageId: {
                type: "number",
                description: "Stage ID to fetch available filters"
            }
        },
        required: ["stageId"]
    }
};
