const { GoogleGenerativeAI } = require("@google/generative-ai");
const { toolRegistry } = require("../llm/toolRegistry");
const { SYSTEM_PROMPT } = require("../utils/prompts/systemPrompt");

let genAI = null;

function getGenAI() {
    if (!genAI) {
        genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    }
    return genAI;
}

function createModel() {
    return getGenAI().getGenerativeModel({
        model: "gemini-3-flash-preview",
        systemInstruction: SYSTEM_PROMPT(),
        tools: [
            {
                functionDeclarations: toolRegistry
            }
        ]
    });
}

module.exports = {
    getGenAI,
    createModel
};
