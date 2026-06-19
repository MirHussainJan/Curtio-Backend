const User = require("../models/User");
const validator = require("validator");

/**
 * Generate a random short code of a given length.
 */
function generateRandomCode(length = 7) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Check if the original URL has a valid format (including protocol).
 */
const validateUrl = (url) => {
  if (!url) return false;
  return validator.isURL(url, {
    require_protocol: true,
    require_valid_protocol: true,
    protocols: ["http", "https"],
  });
};

/**
 * Generate a unique short code that does not exist in any user's records.
 */
const generateUniqueCode = async (length = 7) => {
  let attempts = 0;
  const maxAttempts = 100;

  while (attempts < maxAttempts) {
    const code = generateRandomCode(length);
    const existing = await User.findOne({ "urls.shortCode": code });
    if (!existing) {
      return code;
    }
    attempts++;
  }

  throw new Error("Failed to generate a unique short code after multiple attempts.");
};

/**
 * Add a new shortened URL to a user's record.
 */
const addShortUrl = async (userId, { originalUrl, customAlias, password, expiresAt }) => {
  // 1. Validate original URL
  if (!validateUrl(originalUrl)) {
    throw new Error("Invalid destination URL. Please include a valid protocol (http:// or https://).");
  }

  // 2. Find User
  const user = await User.findById(userId);
  if (!user) {
    throw new Error("User not found.");
  }

  // 3. Resolve short code (custom alias or unique generated)
  let shortCode;
  if (customAlias && customAlias.trim()) {
    const cleanAlias = customAlias.trim().replace(/[^a-zA-Z0-9_-]/g, "");
    if (!cleanAlias) {
      throw new Error("Invalid custom alias. Use only alphanumeric characters, dashes or underscores.");
    }

    // Check if the custom alias is already taken globally
    const existingAlias = await User.findOne({ "urls.shortCode": cleanAlias });
    if (existingAlias) {
      throw new Error("Custom alias already in use. Please choose another one.");
    }
    shortCode = cleanAlias;
  } else {
    shortCode = await generateUniqueCode();
  }

  // 4. Create and push the URL object
  const urlObject = {
    originalUrl,
    shortCode,
    clicks: 0,
    active: true,
    password: password || null,
    expiresAt: expiresAt ? new Date(expiresAt) : null,
    clickLogs: [],
  };

  user.urls.push(urlObject);
  await user.save();

  // Return the newly created URL object (the last item in the array)
  return user.urls[user.urls.length - 1];
};

/**
 * Regex to detect link-preview bots / URL scrapers.
 * These fire when you paste a URL in WhatsApp, Teams, Slack, etc.
 * We still redirect them, but do NOT count them as clicks.
 */
const LINK_PREVIEW_BOT_PATTERN =
  /WhatsApp|facebookexternalhit|Facebot|Twitterbot|Slackbot|TelegramBot|LinkedInBot|Discordbot|SkypeUriPreview|Googlebot|bingbot|YandexBot|PinterestBot|redditbot|vkShare|Embedly|Quora Link Preview|Showyoubot|outbrain|pinterest|developers\.google\.com|Google-Read-Aloud|Mediapartners-Google|AdsBot-Google|Baiduspider|DuckDuckBot|ia_archiver|MJ12bot|Sogoubot|bitlybot|tumblr|Viber|Line\//i;

/**
 * Fetch and resolve a short URL, increments clicks, and logs context.
 * Skips recording for link-preview bots and deduplicates same-visitor clicks.
 */
const resolveShortUrl = async (shortCode, { ip, userAgent, enteredPassword, headers }) => {
  const user = await User.findOne({ "urls.shortCode": shortCode });
  if (!user) {
    throw new Error("Short URL not found.");
  }

  const urlObj = user.urls.find((u) => u.shortCode === shortCode);
  if (!urlObj) {
    throw new Error("Short URL not found.");
  }

  if (!urlObj.active) {
    throw new Error("This link has been disabled by the owner.");
  }

  if (urlObj.expiresAt && new Date() > new Date(urlObj.expiresAt)) {
    throw new Error("This link has expired.");
  }

  // Check password protection if enabled
  if (urlObj.password && urlObj.password !== enteredPassword) {
    const err = new Error("Password required.");
    err.passwordRequired = true;
    throw err;
  }

  // ── Skip recording for link-preview bots (WhatsApp, Teams, Slack, etc.) ──
  const ua = userAgent || "";
  if (LINK_PREVIEW_BOT_PATTERN.test(ua)) {
    // Bot gets the redirect, but no click is recorded
    return urlObj;
  }

  // ── Deduplicate: skip recording if same visitor clicked within the last 10s ──
  const now = new Date();
  const DEDUP_WINDOW_MS = 10 * 1000; // 10 seconds
  const isDuplicate = urlObj.clickLogs.some((log) => {
    if (log.ip !== (ip || "unknown") || log.userAgent !== (ua || "unknown")) return false;
    return now - new Date(log.clickedAt) < DEDUP_WINDOW_MS;
  });

  if (!isDuplicate) {
    // Record click & log details
    const { getGeoData } = require("../utils/geoip");
    const geoData = await getGeoData(ip, headers);

    const referer = headers?.referer || headers?.referrer || null;

    urlObj.clicks += 1;
    urlObj.clickLogs.push({
      ip: ip || "unknown",
      userAgent: ua || "unknown",
      referer: referer,
      country: geoData.country,
      countryCode: geoData.countryCode,
      clickedAt: now,
    });

    await user.save();
  }

  return urlObj;
};

/**
 * Fetch all URLs belonging to a user.
 */
const getUserUrls = async (userId) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error("User not found.");
  }
  return user.urls;
};

/**
 * Delete a shortened URL from a user's record.
 */
const deleteUserUrl = async (userId, shortCode) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error("User not found.");
  }

  const urlIndex = user.urls.findIndex((u) => u.shortCode === shortCode);
  if (urlIndex === -1) {
    throw new Error("Short URL not found under this account.");
  }

  user.urls.splice(urlIndex, 1);
  await user.save();
  return true;
};

/**
 * Toggle the active state of a shortened URL.
 */
const toggleUserUrlActive = async (userId, shortCode) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error("User not found.");
  }

  const urlObj = user.urls.find((u) => u.shortCode === shortCode);
  if (!urlObj) {
    throw new Error("Short URL not found under this account.");
  }

  urlObj.active = !urlObj.active;
  await user.save();
  return urlObj;
};

module.exports = {
  validateUrl,
  addShortUrl,
  resolveShortUrl,
  getUserUrls,
  deleteUserUrl,
  toggleUserUrlActive,
};
