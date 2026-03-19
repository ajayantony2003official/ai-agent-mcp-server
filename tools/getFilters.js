const axios = require("axios");
const {
    buildFilterGuide,
    decorateLocalFilters,
    formatLocalDate
} = require("../utils/filterInference");

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

async function getFilters(args, context) {

    const { stageId } = args;
    const { accessToken } = context;

    const headers = {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
    };

    const res = await axios.post(
        `https://adv-mob.idamtat.in/get_sample_data_by_stageid/${stageId}?page_size=1&page_number=1`,
        {},
        { headers }
    );

    const rawFilters = res.data?.data?.local_filters || [];
    const sampleData = res.data?.data?.sample_data || [];
    const filters = decorateLocalFilters(rawFilters, sampleData);
    const filterGuide = buildFilterGuide(filters);

    return {
        stageId,
        current_date: formatLocalDate(new Date()),
        local_filters: filters,
        filter_guide: filterGuide,
        guidance: [
            "Never assume filter keys. Always inspect local_filters and use the exact keys returned for that stage.",
            "For any matching date range pair such as from_* and to_*, use the expected_format or example_value returned for that stage when building getStageLeads.filters.",
            "If a filter exposes selectable values, use the exact option returned in local_filters."
        ]
    };
}

module.exports.handler = getFilters;
