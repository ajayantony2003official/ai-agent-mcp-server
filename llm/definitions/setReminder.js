module.exports = {
    name: "setReminder",
    description: `
Create a server-side lead follow-up reminder that will trigger a Firebase push notification.

IMPORTANT:
- Use this only after you already know the exact lead.
- For lead reminders, first call getAuditForm so you have the correct stageId and auditPayload.
- Pass the same auditPayload returned by getAuditForm so mobile can reopen the audit form when the notification is tapped.
- For exact date/time reminders, use remindAt in ISO 8601 format.
- For relative reminders like "after 5 minutes", use relativeMinutes.
`,
    parameters: {
        type: "object",
        properties: {
            remindAt: {
                type: "string",
                description: "Exact reminder date-time in ISO 8601 format for explicit date/time reminders"
            },
            relativeMinutes: {
                type: "number",
                description: "Number of minutes from now for relative reminders like after 5 minutes"
            },
            stageId: {
                type: "number",
                description: "Stage ID for the lead reminder"
            },
            auditPayload: {
                type: "object",
                description: "The same auditPayload or audit_obj returned by getAuditForm"
            },
            title: {
                type: "string",
                description: "Short notification title for the reminder"
            },
            body: {
                type: "string",
                description: "Optional notification body text"
            }
        },
        required: ["stageId", "auditPayload"]
    }
};
