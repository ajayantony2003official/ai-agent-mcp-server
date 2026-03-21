require("dotenv").config();
const cors = require("cors");
const express = require("express");
const agentRoutes = require("./routes/agentRoutes");

const PORT = Number(process.env.PORT || 3000);

const app = express();

app.use(cors());
app.use(express.json({ limit: "2mb" }));

app.get("/health", (_req, res) => {
    res.json({
        success: true,
        message: "AI server is running"
    });
});

app.use("/agent", agentRoutes);

app.listen(PORT, "0.0.0.0", () => {
    console.log(`AI HTTP server running on http://0.0.0.0:${PORT}`);
    console.log(`Streaming endpoint: http://0.0.0.0:${PORT}/agent/chat/stream`);
});
