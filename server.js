const express = require("express");
const axios = require("axios");
const fs = require("fs");
const path = require("path");

const app = express();

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");

  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }

  next();
});

app.use(express.json({ limit: "5mb" }));

const PORT = process.env.PORT || 3000;

const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const ACCESS_TOKEN = process.env.ACCESS_TOKEN;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const GRAPH_VERSION = process.env.GRAPH_VERSION || "v23.0";

const IG_USER_ID = process.env.IG_USER_ID || "17841404016367067";

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const CAMPAIGNS_FILE = path.join(DATA_DIR, "campaigns.json");
const PROCESSED_FILE = path.join(DATA_DIR, "processed.json");

const DEFAULT_PUBLIC_REPLY = "Link Sent! 📩";

const DEFAULT_CAMPAIGNS = {
  "17890183584544713": {
    title: "Glowing Outline",
    keyword: "glowy",
    publicReply: "Link Sent! 📩",
    youtubeUrl: "https://youtu.be/jmAcISprIec",
    dmText: `Glowing Outline
    
https://youtu.be/jmAcISprIec

Subscribe to the channel, and don’t forget to like and comment!

Your support helps the channel grow – thank you! 🤩`
  },

  "17900779947445796": {
    title: "Energy Trail Effect",
    keyword: "trail",
    publicReply: "Link Sent! 📩",
    youtubeUrl: "https://youtu.be/WTA53SzZmsE",
    dmText: `Energy Trail Effect
    
https://youtu.be/WTA53SzZmsE

Subscribe to the channel, and don’t forget to like and comment!

Your support helps the channel grow – thank you! 🤩`
  },

  "18122010127643817": {
    title: "Sky Original Lens Distortion",
    keyword: "sky",
    publicReply: "Link Sent! 📩",
    youtubeUrl: "https://youtu.be/WpTfDTfgYh0",
    dmText: `Sky Original Lens Distortion
    
https://youtu.be/WpTfDTfgYh0

Subscribe to the channel, and don’t forget to like and comment!

Your support helps the channel grow – thank you! 🤩`
  },

  "17947925259172437": {
    title: "Liquid Frosted GLASS WWDC25",
    keyword: "frost",
    publicReply: "Link Sent! 📩",
    youtubeUrl: "https://youtu.be/KMPLrdxkCDc",
    dmText: `Liquid Frosted GLASS WWDC25
    
https://youtu.be/KMPLrdxkCDc

Subscribe to the channel, and don’t forget to like and comment!

Your support helps the channel grow – thank you! 🤩`
  },

  "18111860119873169": {
    title: "Earth Tutorial",
    keyword: "earth",
    publicReply: "Link Sent! 📩",
    youtubeUrl: "https://youtu.be/r7EFPS1qWz8?si=--FVDjq00pb3_ukd",
    dmText: `Earth Tutorial
    
https://youtu.be/r7EFPS1qWz8?si=--FVDjq00pb3_ukd

Subscribe to the channel, and don’t forget to like and comment!

Your support helps the channel grow – thank you! 🤩`
  },

  "17936354319252682": {
    title: "Wave Liquid Gradient",
    keyword: "wave",
    publicReply: "Link Sent! 📩",
    youtubeUrl: "https://youtu.be/6o02NYENEh0",
    dmText: `Wave Liquid Gradient
    
https://youtu.be/6o02NYENEh0

Subscribe to the channel, and don’t forget to like and comment!

Your support helps the channel grow – thank you! 🤩`
  },

  "17909832381405025": {
    title: "SaaS UI Button Animation",
    keyword: "saas",
    publicReply: "Link Sent! 📩",
    youtubeUrl: "https://youtu.be/3nbBEH5H-1E",
    dmText: `SaaS UI Button Animation
    
https://youtu.be/3nbBEH5H-1E

Subscribe to the channel, and don’t forget to like and comment!

Your support helps the channel grow – thanks mate! 🤩`
  },

  "18119126242642640": {
    title: "3D Carousel System",
    keyword: "carousel",
    publicReply: "Link Sent! 📩",
    youtubeUrl: "https://youtu.be/dS_g6cJW3As",
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

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(CAMPAIGNS_FILE)) {
    fs.writeFileSync(
      CAMPAIGNS_FILE,
      JSON.stringify(DEFAULT_CAMPAIGNS, null, 2),
      "utf8"
    );
  }

  if (!fs.existsSync(PROCESSED_FILE)) {
    fs.writeFileSync(PROCESSED_FILE, JSON.stringify({}, null, 2), "utf8");
  }
}

function loadCampaigns() {
  ensureDataFile();

  try {
    const raw = fs.readFileSync(CAMPAIGNS_FILE, "utf8");
    return JSON.parse(raw || "{}");
  } catch (error) {
    log("Error loading campaigns:", error.message);
    return {};
  }
}

function saveCampaigns(campaigns) {
  ensureDataFile();
  fs.writeFileSync(CAMPAIGNS_FILE, JSON.stringify(campaigns, null, 2), "utf8");
}

function loadProcessed() {
  ensureDataFile();

  try {
    const raw = fs.readFileSync(PROCESSED_FILE, "utf8");
    return JSON.parse(raw || "{}");
  } catch (error) {
    log("Error loading processed:", error.message);
    return {};
  }
}

function saveProcessed(processed) {
  ensureDataFile();
  fs.writeFileSync(PROCESSED_FILE, JSON.stringify(processed, null, 2), "utf8");
}

function getUserCampaignKey(event, campaign) {
  const userId =
    event.raw.from?.id ||
    event.raw.from?.username ||
    event.raw.username ||
    "unknown";

  const key = `${userId}_${event.mediaId}_${campaign.keyword}`;

  return { userId, key };
}

function isUserCampaignProcessed(key) {
  const processed = loadProcessed();
  return Boolean(processed[key]);
}

function markUserCampaignProcessed(key, data) {
  const processed = loadProcessed();

  processed[key] = {
    ...data,
    processedAt: new Date().toISOString()
  };

  saveProcessed(processed);
}

function normalizeText(text) {
  return String(text || "").trim().toLowerCase();
}

function isOldComment(value) {
  const timestamp = value.created_time || value.timestamp;
  if (!timestamp) return false;

  const commentTime = new Date(timestamp).getTime();
  const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;

  return commentTime < twentyFourHoursAgo;
}

function matchesKeyword(text, keyword) {
  const clean = normalizeText(text);
  const cleanKeyword = normalizeText(keyword);
  if (!cleanKeyword) return false;
  return clean.includes(cleanKeyword);
}

function requireAdmin(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const sentPassword = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : "";

  if (!ADMIN_PASSWORD) {
    return res.status(500).json({
      ok: false,
      error: "ADMIN_PASSWORD is not configured on Railway."
    });
  }

  if (sentPassword !== ADMIN_PASSWORD) {
    return res.status(401).json({
      ok: false,
      error: "Unauthorized"
    });
  }

  next();
}

async function graphGet(endpoint, params = {}) {
  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${endpoint}`;
  const response = await axios.get(url, {
    params: {
      ...params,
      access_token: ACCESS_TOKEN
    },
    timeout: 15000
  });
  return response.data;
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

      if (isOldComment(value)) {
        log("Old comment ignored:", {
          commentId: value.id || value.comment_id,
          timestamp: value.created_time || value.timestamp
        });
        continue;
      }

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
  const campaigns = loadCampaigns();

  if (event.mediaId && campaigns[event.mediaId]) {
    return {
      mediaId: event.mediaId,
      ...campaigns[event.mediaId]
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
      log("No campaign configured:", { commentId, mediaId, text });
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

    const { userId, key: userCampaignKey } = getUserCampaignKey(
      event,
      campaign
    );

    if (
      processedUserCampaigns.has(userCampaignKey) ||
      isUserCampaignProcessed(userCampaignKey)
    ) {
      log("User already received this campaign:", {
        userId,
        mediaId,
        keyword: campaign.keyword
      });

      processedComments.add(commentId);
      continue;
    }

    processedComments.add(commentId);

    try {
      log("Keyword matched:", {
        commentId,
        mediaId,
        keyword: campaign.keyword,
        text
      });

      await replyToComment(commentId, campaign.publicReply || DEFAULT_PUBLIC_REPLY);
      log("Public reply sent:", commentId);

      await sendPrivateReply(commentId, campaign.dmText);
      log("Private DM sent:", commentId);

      processedUserCampaigns.add(userCampaignKey);

      markUserCampaignProcessed(userCampaignKey, {
        userId,
        mediaId,
        keyword: campaign.keyword,
        commentId,
        text
      });
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

app.get("/api/campaigns", requireAdmin, (req, res) => {
  res.json({
    ok: true,
    campaigns: loadCampaigns()
  });
});

app.post("/api/campaigns", requireAdmin, (req, res) => {
  const {
    mediaId,
    keyword,
    publicReply,
    dmText,
    title,
    youtubeUrl
  } = req.body || {};

  if (!mediaId || !keyword || !dmText) {
    return res.status(400).json({
      ok: false,
      error: "mediaId, keyword and dmText are required."
    });
  }

  const campaigns = loadCampaigns();

  campaigns[String(mediaId).trim()] = {
    title: String(title || "").trim(),
    keyword: String(keyword).trim().toLowerCase(),
    publicReply: String(publicReply || DEFAULT_PUBLIC_REPLY),
    youtubeUrl: String(youtubeUrl || "").trim(),
    dmText: String(dmText)
  };

  saveCampaigns(campaigns);

  res.json({
    ok: true,
    campaigns
  });
});

app.delete("/api/campaigns/:mediaId", requireAdmin, (req, res) => {
  const campaigns = loadCampaigns();
  const mediaId = String(req.params.mediaId || "").trim();

  if (!campaigns[mediaId]) {
    return res.status(404).json({
      ok: false,
      error: "Campaign not found."
    });
  }

  delete campaigns[mediaId];
  saveCampaigns(campaigns);

  res.json({
    ok: true,
    campaigns
  });
});

app.get("/api/media", requireAdmin, async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit || 25), 50);
    const after = req.query.after || undefined;

    const data = await graphGet(`${IG_USER_ID}/media`, {
      fields: "id,caption,permalink,timestamp,media_type,media_product_type",
      limit,
      after
    });

    res.json({
      ok: true,
      data: data.data || [],
      paging: data.paging || null
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.response?.data || error.message
    });
  }
});

app.get("/api/processed", requireAdmin, (req, res) => {
  res.json({
    ok: true,
    processed: loadProcessed()
  });
});

app.delete("/api/processed", requireAdmin, (req, res) => {
  saveProcessed({});
  processedUserCampaigns.clear();

  res.json({
    ok: true,
    processed: {}
  });
});

app.post("/test-private-reply", async (req, res) => {
  try {
    const { commentId, message } = req.body || {};
    if (!commentId) return res.status(400).json({ error: "Missing commentId" });

    const publicResult = await replyToComment(commentId, DEFAULT_PUBLIC_REPLY);
    const dmResult = await sendPrivateReply(commentId, message || "Here we go:");

    res.json({ ok: true, publicResult, dmResult });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.response?.data || error.message
    });
  }
});

app.listen(PORT, () => {
  ensureDataFile();
  const campaigns = loadCampaigns();
  const processed = loadProcessed();

  log(`Bot running on port ${PORT}`);
  log(`Campaigns loaded: ${Object.keys(campaigns).length}`);
  log(`Processed users loaded: ${Object.keys(processed).length}`);
  log(`Campaigns file: ${CAMPAIGNS_FILE}`);
  log(`Processed file: ${PROCESSED_FILE}`);
});
