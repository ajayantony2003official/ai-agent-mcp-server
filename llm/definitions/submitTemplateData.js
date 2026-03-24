module.exports = {
    name: "submitTemplateData",
    description: `
Send an Email or SMS template to a chosen recipient for a specific lead.

IMPORTANT:
- Use this only after getAuditForm confirms the action is available.
- Use getTemplateData first to inspect recipient options and message preview.
- Ask the user which recipient address or number to use before calling this tool unless the user already gave it clearly in the conversation.
- type must be email or sms.
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
            },
            toAddress: {
                type: "string",
                description: "Recipient email address or mobile number selected by the user"
            }
        },
        required: ["stageId", "transUniqueId", "type", "templateName", "toAddress"]
    }
};
