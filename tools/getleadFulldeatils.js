const axios = require("axios");

module.exports = {
    name: "getAuditForm",

    description: `
Fetch full audit form details for a given lead.

IMPORTANT:
- From the API response, ONLY return "Section A" and "Section B" for UI rendering.
- Include the same audit payload and stage id in the tool result so mobile can open the audit form, call the lead, or schedule reminders.
- Ignore all remaining sections when preparing the AI-facing response.
`,

    parameters: {
        type: "object",
        properties: {
            stageId: {
                type: "number",
                description: "Stage ID to fetch audit form"
            },
            auditPayload: {
                type: "object",
                description: "Request body payload required by API (same as auditObj from mobile app)"
            }
        },
        required: ["stageId", "auditPayload"]
    }
};

function readValue(value) {
    if (value === null || value === undefined) {
        return null;
    }

    const text = String(value).trim();
    return text.length ? text : null;
}

function buildSummary(secA, secB) {
    const secAFields = Array.isArray(secA) ? secA : [];
    const secBBlocks = Array.isArray(secB) ? secB : [];

    const lookupFromFields = (fields, keywords) => {
        const lowerKeywords = keywords.map((keyword) => keyword.toLowerCase());
        for (const field of fields) {
            const key = String(field?.key || "").toLowerCase();
            if (!lowerKeywords.some((keyword) => key.includes(keyword))) {
                continue;
            }

            const value = readValue(field?.value) || readValue(field?.actual_value);
            if (value) {
                return value;
            }
        }

        return null;
    };

    const lookupFromBlocks = (blocks, keywords) => {
        for (const block of blocks) {
            const value = lookupFromFields(block?.block_data || [], keywords);
            if (value) {
                return value;
            }
        }

        return null;
    };

    const leadName = lookupFromFields(secAFields, ["customer name", "lead name", "customer", "name"]);
    const interestedModel = lookupFromBlocks(secBBlocks, ["interested model", "model"]);
    const interestedVariant = lookupFromBlocks(secBBlocks, ["interested variant", "variant"]);
    const qualification = lookupFromFields(secAFields, ["lead qualification"]);
    const nextAction = lookupFromFields(secAFields, ["crc lead next action", "next action"]);

    const parts = [];

    if (interestedModel) {
        parts.push(
            `${leadName || "Lead"} is interested in ${interestedModel}${interestedVariant ? ` (${interestedVariant})` : ""}.`
        );
    }

    if (qualification) {
        parts.push(`Qualification: ${qualification}.`);
    }

    if (nextAction) {
        parts.push(`Next action: ${nextAction}.`);
    }

    if (parts.length === 0) {
        return "Section A and Section B data fetched successfully.";
    }

    return parts.join(" ");
}

async function getAuditForm(args, context) {
    try {
        const { stageId, auditPayload = {} } = args;
        const { accessToken } = context;

        if (!stageId) {
            throw new Error("stageId is required");
        }

        const headers = {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json"
        };

        const url = `https://adv-mob.idamtat.in/get_audit_form/${stageId}`;

        const res = await axios.post(url, auditPayload, { headers });
        const responseData = res.data?.data || {};
        const secA = Array.isArray(responseData.sec_a) ? responseData.sec_a : [];
        const secB = Array.isArray(responseData.sec_b) ? responseData.sec_b : [];

        return {
            success: true,
            stageId,
            auditPayload,
            audit_obj: auditPayload,
            trans_unique_id:
                responseData.trans_unique_id ??
                auditPayload.Trans_Unique_Id ??
                auditPayload.trans_unique_id ??
                null,
            ticket_id:
                responseData.ticket_id ??
                auditPayload.TicketId ??
                auditPayload.ticket_id ??
                null,
            data: {
                sec_a: secA,
                sec_b: secB,
                sec_a_hidden: responseData.sec_a_hidden ?? false,
                sec_b_hidden: responseData.sec_b_hidden ?? false,
                trans_unique_id: responseData.trans_unique_id ?? null,
                ticket_id: responseData.ticket_id ?? null
            },
            summary: buildSummary(secA, secB),
            message: "Audit form fetched successfully"
        };
    } catch (error) {
        return {
            success: false,
            error: error.response?.data || error.message,
            message: "Failed to fetch audit form"
        };
    }
}

module.exports.handler = getAuditForm;
