module.exports = {
    name: "getTemplateData",
    description: `
Fetch recipient options and message preview for an Email or SMS template for a specific lead.

IMPORTANT:
- Use this only after getAuditForm confirms the communication action is available and the template list is not empty.
- type must be email or sms.
- If multiple templates are available, ask the user which template they want before calling this tool.
- After this tool returns recipient options, ask which recipient address or number to use before calling submitTemplateData.
`,
    parameters: {
        type: "object",
        properties: {
            stageId: {
                type: "number",
                description: "Stage ID for the lead"
            },
            transUniqueId: {
                type: "string",
                description: "Lead trans unique id"
            },
            type: {
                type: "string",
                description: "Communication type. Use only email or sms."
            },
            templateName: {
                type: "string",
                description: "Exact template name chosen by the user"
            }
        },
        required: ["stageId", "transUniqueId", "type", "templateName"]
    }
};
