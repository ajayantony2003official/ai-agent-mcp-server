module.exports = {
    name: "getStageLeads",
    description: "Fetch leads from a stage with optional filters. After calling getFilters, pass the exact dynamic filter keys returned for that stage in the filters object. For date range filters, use the matching from_* and to_* keys with the expected_format discovered by getFilters.",
    parameters: {
        type: "object",
        properties: {
            stageId: {
                type: "number",
                description: "Stage ID"
            },
            filters: {
                type: "object",
                description: "Dynamic filters like from_CreatedOn, to_CreatedOn etc"
            }
        },
        required: ["stageId"]
    }
};
