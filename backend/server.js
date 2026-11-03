require("dotenv").config();

const express = require("express");

const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.json({ limit: "2mb" }));

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "SmartCodeChecker Express API",
  });
});

app.post("/analyze", async (req, res) => {
  const { code } = req.body || {};

  if (typeof code !== "string") {
    return res.status(400).json({
      error: 'Missing "code" in request body.',
    });
  }

  if (!code.trim()) {
    return res.status(400).json({
      error: "Code must not be empty.",
    });
  }

  if (!process.env.AGENT_RESOURCE_NAME) {
    return res.status(503).json({
      error: "Agent not configured.",
      detail: "The ADK Agent Engine deployment is not connected yet.",
    });
  }

  // Agent Engine integration will be added after deployment.
  return res.status(503).json({
    error: "Agent integration pending.",
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`SmartCodeChecker API running on port ${PORT}`);
});
