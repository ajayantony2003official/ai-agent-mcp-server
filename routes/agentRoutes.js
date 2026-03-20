const express = require("express");
const { runAIStream } = require("../services/agentService");
const { writeEvent, makeEvent } = require("../utils/eventUtils");

const router = express.Router();

router.post("/chat/stream", async (req, res) => {
    const {
        sessionId = `session_${Date.now()}`,
        message = "",
        runtimeContext = {}
    } = req.body || {};

    if (!String(message).trim()) {
        return res.status(400).json({
            success: false,
            message: "message is required"
        });
    }

    const turnId = `turn_${Date.now()}`;

    res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    const emit = (type, payload) => {
        writeEvent(
            res,
            makeEvent({
                type,
                turnId,
                sessionId,
                payload
            })
        );
    };

    try {
        const output = await runAIStream({
            message: String(message),
            sessionId: String(sessionId),
            runtimeContext,
            emit
        });

        emit("assistant_message", {
            text: output.finalMessage || ""
        });

        emit("turn_completed", {
            finalMessage: output.finalMessage || "",
            usedTools: Array.from(new Set(output.usedTools || []))
        });
    } catch (error) {
        console.error("Agent stream error:", error);
        emit("turn_error", {
            message: error.message || "Agent execution failed"
        });
    } finally {
        res.end();
    }
});

module.exports = router;
