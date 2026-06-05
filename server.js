const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json({ limit: "2mb" }));

const PORT = process.env.PORT || 3000;

const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const ACCESS_TOKEN = process.env.ACCESS_TOKEN;
const GRAPH_VERSION = process.env.GRAPH_VERSION || "v23.0";

const GLOBAL_KEYWORD = (process.env.KEYWORD || "").trim().toLowerCase();
const GLOBAL_PUBLIC_REPLY = process.env.PUBLIC_REPLY || "Link Sent! 📩";
const GLOBAL_DM_TEXT = process.env.DM_TEXT || "Here we go:";

const CAMPAIGNS = {
  "17890183584544713": {
    keyword: "glowy",
    publicReply: "Link Sent! 📩",
    dmText: `Glowing Outline
    
https://youtu.be/jmAcISprIec

Subscribe to the channel, and don’t forget to like and comment!

Your support helps the channel grow – thank you! 🤩`
  },

  "17900779947445796": {
    keyword: "trail",
    publicReply: "Link Sent! 📩",
    dmText: `Energy Trail Effect
    
https://youtu.be/WTA53SzZmsE

Subscribe to the channel, and don’t forget to like and comment!

Your support helps the channel grow – thank you! 🤩`
  },

  "18122010127643817": {
    keyword: "sky",
    publicReply: "Link Sent! 📩",
    dmText: `Sky Original Lens Distortion
    
https://youtu.be/WpTfDTfgYh0

Subscribe to the channel, and don’t forget to like and comment!

Your support helps the channel grow – thank you! 🤩`
  },

  "17947925259172437": {
    keyword: "frost",
    publicReply: "Link Sent! 📩",
    dmText: `Liquid Frosted GLASS WWDC25
    
https://youtu.be/KMPLrdxkCDc

Subscribe to the channel, and don’t forget to like and comment!

Your support helps the channel grow – thank you! 🤩`
  },

  "18111860119873169": {
    keyword: "earth",
    publicReply: "Link Sent! 📩",
    dmText: `Earth Tutorial
    
https://youtu.be/r7EFPS1qWz8?si=--FVDjq00pb3_ukd

Subscribe to the channel, and don’t forget to like and comment!

Your support helps the channel grow – thank you! 🤩`
  },

  "17936354319252682": {
    keyword: "wave",
    publicReply: "Link Sent! 📩",
    dmText: `Wave Liquid Gradient
    
https://youtu.be/6o02NYENEh0

Subscribe to the channel, and don’t forget to like and comment!

Your support helps the channel grow – thank you! 🤩`
  },

  "17909832381405025": {
    keyword: "saas",
    publicReply: "Link Sent! 📩",
    dmText: `SaaS UI Button Animation
    
https://youtu.be/3nbBEH5H-1E

Subscribe to the channel, and don’t forget to like and comment!

Your support helps the channel grow – thanks mate! 🤩`
  },

  "18119126242642640": {
    keyword: "carousel",
    publicReply: "Link Sent! 📩",
    dmText: `3D Carousel System
    
https://youtu.be/dS_g6cJW3As

Subscribe to the channel, and don’t forget to like and comment!

Your support helps the channel grow – thank you! 🤩`
  }
};

const processedComments = new Set();
const processedUserCampaigns = new Set();

function log(...args) {
  console.log(new Date().toISOString(), ...args);
}

function normalizeText(text) {
  return String(text || "").trim().toLowerCase();
}

function matchesKeyword(text, keyword) {
  const clean = normalizeText(text);
  const cleanKeyword = normalizeText(keyword);
  if (!cleanKeyword) return false;
  return clean.includes(cleanKeyword);
}

async function graphPost(endpoint, data) {
  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${endpoint}`;
  const response = await axios.post(url, data, {
    params: { access_token: ACCESS_TOKEN },
    timeout: 15000
  });
  return response.data;
}

async function replyToComment(commentId, message) {
  return graphPost(`${commentId}/replies`, { message });
}

async function sendPrivateReply(commentId, message) {
  return graphPost("me/messages", {
    recipient: {
      comment_id: commentId
    },
    message: {
      text: message
    }
  });
}

function extractCommentEvents(body) {
  const events = [];

  for (const entry of body.entry || []) {
    for (const change of entry.changes || []) {
      if (change.field !== "comments") continue;

      const value = change.value || {};
      const commentId = value.id || value.comment_id;
      const text = value.text || value.message || "";
      const mediaId = value.media?.id || value.media_id || null;

      if (commentId) {
        events.push({
          commentId,
          text,
          mediaId,
          raw: value
        });
      }
    }
  }

  return events;
}

function getCampaignForEvent(event) {
  if (event.mediaId && CAMPAIGNS[event.mediaId]) {
    return {
      mediaId: event.mediaId,
      ...CAMPAIGNS[event.mediaId]
    };
  }

  if (GLOBAL_KEYWORD) {
    return {
      mediaId: event.mediaId || "global",
      keyword: GLOBAL_KEYWORD,
      publicReply: GLOBAL_PUBLIC_REPLY,
      dmText: GLOBAL_DM_TEXT
    };
  }

  return null;
}

app.get("/", (req, res) => {
  res.status(200).send("Frartistico DM Bot is running.");
});

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

app.post("/webhook", async (req, res) => {
  res.sendStatus(200);

  log("WEBHOOK BODY:", JSON.stringify(req.body, null, 2));

  if (!ACCESS_TOKEN) {
    log("Missing ACCESS_TOKEN env variable");
    return;
  }

  const events = extractCommentEvents(req.body);

  for (const event of events) {
    const { commentId, text, mediaId } = event;

    if (processedComments.has(commentId)) {
      log("Already processed:", commentId);
      continue;
    }

    const campaign = getCampaignForEvent(event);

    if (!campaign) {
      log("No campaign configured:", {
        commentId,
        mediaId,
        text
      });
      continue;
    }

if (!matchesKeyword(text, campaign.keyword)) {
  log("Ignored comment:", {
    commentId,
    mediaId,
    keyword: campaign.keyword,
    text
  });
  continue;
}

const userId = event.raw.from?.id || event.raw.username || "unknown";
const userCampaignKey = `${userId}_${mediaId}_${campaign.keyword}`;

if (processedUserCampaigns.has(userCampaignKey)) {
  log("User already received this campaign:", {
    userId,
    mediaId,
    keyword: campaign.keyword
  });
  continue;
}

processedUserCampaigns.add(userCampaignKey);
processedComments.add(commentId);

try {
      log("Keyword matched:", {
        commentId,
        mediaId,
        keyword: campaign.keyword,
        text
      });

      await replyToComment(commentId, campaign.publicReply);
      log("Public reply sent:", commentId);

      await sendPrivateReply(commentId, campaign.dmText);
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

app.post("/test-private-reply", async (req, res) => {
  try {
    const { commentId, message } = req.body || {};
    if (!commentId) return res.status(400).json({ error: "Missing commentId" });

    const publicResult = await replyToComment(commentId, GLOBAL_PUBLIC_REPLY);
    const dmResult = await sendPrivateReply(
      commentId,
      message || GLOBAL_DM_TEXT
    );

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
  log(`Global keyword: ${GLOBAL_KEYWORD || "(not set)"}`);
  log(`Campaigns loaded: ${Object.keys(CAMPAIGNS).length}`);
});
