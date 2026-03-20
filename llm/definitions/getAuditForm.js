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
