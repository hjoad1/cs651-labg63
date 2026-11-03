
require("dotenv").config();

const express = require("express");
const path = require("path");
const { randomUUID } = require("crypto");
const { GoogleAuth } = require("google-auth-library");

const app = express();
const auth = new GoogleAuth({
  scopes: ["https://www.googleapis.com/auth/cloud-platform"],
});

const PORT = process.env.PORT || 8080;
const AGENT_RESOURCE_NAME =
  process.env.AGENT_RESOURCE_NAME ||
  "projects/996191667483/locations/us-central1/reasoningEngines/7078715508127694848";

const API_URL =
  `https://us-central1-aiplatform.googleapis.com/v1/${AGENT_RESOURCE_NAME}:streamQuery?alt=sse`;

app.use(express.json({ limit: "2mb" }));

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "SmartCodeChecker Express API",
  });
});

function extractEventText(event) {
  const parts = event?.content?.parts || [];
  return parts
    .filter((part) => typeof part.text === "string")
    .map((part) => part.text)
    .join("");
}

function parseAgentEvents(responseText) {
  const events = [];

  // Supports SSE (data: {...}) and newline-delimited JSON.
  for (const line of responseText.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith(":") || trimmed === "data: [DONE]") {
      continue;
    }

    const payload = trimmed.startsWith("data:")
      ? trimmed.slice(5).trim()
      : trimmed;

    if (!payload.startsWith("{")) continue;

    try {
      const parsed = JSON.parse(payload);
      if (parsed.error) {
        throw new Error(JSON.stringify(parsed.error));
      }
      events.push(parsed);
    } catch (error) {
      if (error.message.startsWith("{")) throw error;
    }
  }

  // Prefer final agent responses over intermediate tool output.
  const finalTexts = events
    .filter((event) => event.is_final_response === true)
    .map(extractEventText)
    .filter(Boolean);

  if (finalTexts.length > 0) {
    return finalTexts[finalTexts.length - 1];
  }

  const textEvents = events
    .map(extractEventText)
    .filter(Boolean);

  return textEvents[textEvents.length - 1] || "";
}

async function queryAgent(code) {
  const client = await auth.getClient();
  const accessToken = await client.getAccessToken();

  const prompt = [
    "Review this source code carefully.",
    "Identify syntax errors, bugs, logic problems, style issues,",
    "edge cases, and recommended improvements.",
    "",
    "Respond in this Markdown structure:",
    "## Code Review",
    "Give your assessment and key findings.",
    "## Complete Fixed Code",
    "Provide a complete corrected version in one fenced code block.",
    "## What Was Fixed",
    "Explain the changes using bullet points.",
    "",
    "Original code:",
    "```",
    code,
    "```",
  ].join("\n");

  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken.token}`,
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify({
      class_method: "async_stream_query",
      input: {
        user_id: `web-user-${randomUUID()}`,
        message: prompt,
      },
    }),
    signal: AbortSignal.timeout(590000),
  });

  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(
      `Agent Engine HTTP ${response.status}: ${responseText.slice(0, 1500)}`
    );
  }

  const result = parseAgentEvents(responseText);

  if (!result) {
    throw new Error(
      "Agent Engine returned no readable text. " +
      `Response preview: ${responseText.slice(0, 500)}`
    );
  }

  return result;
}

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

  try {
    const result = await queryAgent(code.trim());
    res.json({ result });
  } catch (error) {
    console.error("Agent Engine request failed:", error);

    res.status(502).json({
      error: "Code analysis failed.",
      detail: error.message,
    });
  }
});

// Serve the production React build from Express.
const frontendPath = path.join(__dirname, "../frontend-react/dist");

app.use(express.static(frontendPath));

app.get("/{*path}", (req, res) => {
  res.sendFile(path.join(frontendPath, "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`SmartCodeChecker running on port ${PORT}`);
});
