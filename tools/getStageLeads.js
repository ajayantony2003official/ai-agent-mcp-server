const axios = require("axios");

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

async function getStageLeads(args, context) {

    const { stageId, filters } = args;
    const { accessToken } = context;

    const headers = {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
    };

    const body = filters || {};

    console.log("API Body:", body);

    //----------------------------------
    // STEP 1 — GET TOTAL COUNT
    //----------------------------------

    const countRes = await axios.post(
        `https://adv-mob.idamtat.in/get_sample_count_by_stageid/${stageId}`,
        body,
        { headers }
    );

    const totalCount = Number(
        Object.values(countRes.data?.data?.sample_count || {})[0] || 0
    );

    if (totalCount === 0) {
        return {
            total_count: 0,
            filters_used: body,
            leads: []
        };
    }

    //----------------------------------
    // STEP 2 — PAGINATION
    //----------------------------------

    const pageSize = 50;
    const totalPages = Math.ceil(totalCount / pageSize);

    let allLeads = [];
    let columnMap = null;

    //----------------------------------
    // STEP 3 — FETCH ALL PAGES
    //----------------------------------

    for (let page = 1; page <= totalPages; page++) {

        const res = await axios.post(
            `https://adv-mob.idamtat.in/get_sample_data_by_stageid/${stageId}?page_size=${pageSize}&page_number=${page}`,
            body,
            { headers }
        );

        const leads = res.data?.data?.sample_data || [];

        // Build column map once
        if (!columnMap) {
            const columns = res.data?.data?.columns || [];

            columnMap = {};

            columns.forEach(col => {
                columnMap[col.field_name] = col.label_name;
            });
        }

        for (const lead of leads) {

            const tableObj = lead.table_obj;
            const parsedRow = {};

            for (const key in tableObj) {
                const label = columnMap[key] || key;
                parsedRow[label] = tableObj[key]?.masked_value;
            }

            allLeads.push({
                parsed: parsedRow,
                audit_obj: lead.audit_obj
            });

        }

    }

    //----------------------------------
    // RETURN ALL LEADS
    //----------------------------------

    return {
        total_count: totalCount,
        filters_used: body,

        leads: allLeads,

        guidance: {
            ui_usage: {
                table_data: "Use parsed object to render leads in list/table UI",
                detail_data: "Use audit_obj to open full lead details screen"
            },

            next_api: {
                description: "Use audit_obj fields for further API calls like open lead, update lead, or allocate lead",
                body_example: {
                    StageId: "audit_obj.StageId",
                    TicketId: "audit_obj.TicketId",
                    Trans_Unique_Id: "audit_obj.Trans_Unique_Id"
                }
            }
        }
    };

}

module.exports.handler = getStageLeads;
