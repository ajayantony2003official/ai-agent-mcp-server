const { GoogleGenerativeAI } = require("@google/generative-ai");
const genAI = new GoogleGenerativeAI("AIzaSyBQ78Lt6w4cF5FjQlU_6s_P0ZYNaDZUpHg");
async function test() {
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const res = await model.generateContent("hello");
        console.log("Success with gemini-1.5-flash:", res.response.text());
    } catch(e) {
        console.log("Error generated:", e.status, e.message);
    }
}
test();
