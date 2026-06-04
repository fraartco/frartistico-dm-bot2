const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json({ limit: "2mb" }));

const PORT = process.env.PORT || 3000;

const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const ACCESS_TOKEN = process.env.ACCESS_TOKEN;
const KEYWORD = (process.env.KEYWORD || "").trim().toLowerCase();
const PUBLIC_REPLY = process.env.PUBLIC_REPLY || "Ti ho inviato il link in DM 📩";
const DM_TEXT = process.env.DM_TEXT || "Ciao! Ecco il link che mi hai richiesto:";
const GRAPH_VERSION = process.env.GRAPH_VERSION || "v23.0";

const processedComments = new Set();

function log(...args) {
  console.log(new Date().toISOString(), ...args);
}

function normalizeText(text) {
  return String(text || "").trim().toLowerCase();
}

function matchesKeyword(text) {
  const clean = normalizeText(text);
  if (!KEYWORD) return false;

  // Match semplice: accetta keyword da sola o dentro una frase.
  // Esempio: "glowy", "GLowy", "link glowy please".
  return clean.includes(KEYWORD);
}

async function graphPost(endpoint, data) {
  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${endpoint}`;
  const response = await axios.post(url, data, {
    params: { access_token: ACCESS_TOKEN },
    timeout: 15000
  });
  return response.data;
}

async function replyToComment(commentId) {
  return graphPost(`${commentId}/replies`, { message: PUBLIC_REPLY });
}

async function sendPrivateReply(commentId) {
  // Instagram Private Reply: manda 1 DM privato collegato al commento.
  return graphPost(`${commentId}/private_replies`, { message: DM_TEXT });
}

function extractCommentEvents(body) {
  const events = [];

  for (const entry of body.entry || []) {
    for (const change of entry.changes || []) {
      if (change.field !== "comments") continue;

      const value = change.value || {};
      const commentId = value.id || value.comment_id;
      const text = value.text || value.message || "";

      if (commentId) {
        events.push({
          commentId,
          text,
          raw: value
        });
      }
    }
  }

  return events;
}

// Health check
app.get("/", (req, res) => {
  res.status(200).send("Frartistico DM Bot is running.");
});

// Meta webhook verification
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    log("Webhook verified");
    return res.status(200).send(challenge);
  }

  return res.sendStatus(403);
});

// Meta webhook receiver
app.post("/webhook", async (req, res) => {
  // Rispondiamo subito a Meta per evitare timeout.
  res.sendStatus(200);

  if (!ACCESS_TOKEN) {
    log("Missing ACCESS_TOKEN env variable");
    return;
  }

  const events = extractCommentEvents(req.body);

  for (const event of events) {
    const { commentId, text } = event;

    if (processedComments.has(commentId)) {
      log("Already processed:", commentId);
      continue;
    }

    if (!matchesKeyword(text)) {
      log("Ignored comment:", commentId, `"${text}"`);
      continue;
    }

    processedComments.add(commentId);

    try {
      log("Keyword matched:", commentId, `"${text}"`);

      await replyToComment(commentId);
      log("Public reply sent:", commentId);

      await sendPrivateReply(commentId);
      log("Private DM sent:", commentId);
    } catch (error) {
      log("Error processing comment:", commentId);
      if (error.response) {
        log("Meta error:", JSON.stringify(error.response.data));
      } else {
        log(error.message);
      }
    }
  }
});

// Manual test endpoint: utile per verificare che token e commentId funzionino.
// POST /test-private-reply con JSON: { "commentId": "ID_COMMENTO_INSTAGRAM" }
app.post("/test-private-reply", async (req, res) => {
  try {
    const { commentId } = req.body || {};
    if (!commentId) return res.status(400).json({ error: "Missing commentId" });

    const publicResult = await replyToComment(commentId);
    const dmResult = await sendPrivateReply(commentId);

    res.json({ ok: true, publicResult, dmResult });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.response?.data || error.message
    });
  }
});

app.listen(PORT, () => {
  log(`Bot running on port ${PORT}`);
  log(`Keyword: ${KEYWORD || "(not set)"}`);
});