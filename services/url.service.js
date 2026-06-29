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
 * Maps the X-Requested-With header (the launching app's Android package name,
 * set by many WebView-based in-app browsers) to a platform name.
 * This is a stronger signal than UA/Referer sniffing since it can't be spoofed
 * by privacy-stripped referrers, but only fires for WebView-based in-app
 * browsers — Custom Tabs (used by newer WhatsApp/Telegram builds) don't set it.
 */
const ANDROID_PACKAGE_SOURCE_MAP = {
  "com.whatsapp": "WhatsApp",
  "com.whatsapp.w4b": "WhatsApp",
  "com.facebook.katana": "Facebook",
  "com.facebook.lite": "Facebook",
  "com.facebook.orca": "Messenger",
  "com.instagram.android": "Instagram",
  "com.instagram.lite": "Instagram",
  "org.telegram.messenger": "Telegram",
  "org.telegram.messenger.web": "Telegram",
  "com.twitter.android": "Twitter",
  "com.linkedin.android": "LinkedIn",
  "com.zhiliaoapp.musically": "TikTok",
  "com.ss.android.ugc.trill": "TikTok",
  "com.snapchat.android": "Snapchat",
  "com.pinterest": "Pinterest",
  "com.discord": "Discord",
  "com.reddit.frontpage": "Reddit",
  "com.Slack": "Slack",
};

function getSourceFromRequestedWith(xRequestedWith) {
  if (!xRequestedWith) return null;
  return ANDROID_PACKAGE_SOURCE_MAP[xRequestedWith.trim()] || null;
}

/**
 * Detects if the request is from a standard web browser.
 * Also uses headers to filter out API tools and programmatic background fetches.
 */
function getSource(ua, referer, xRequestedWith) {
  const fromPackage = getSourceFromRequestedWith(xRequestedWith);
  if (fromPackage) return fromPackage;

  ua = (ua || "").toLowerCase();
  referer = (referer || "").toLowerCase();

  if (referer.includes("whatsapp.com") || ua.includes("whatsapp")) return "WhatsApp";
  if (ua.includes("messenger")) return "Messenger";
  if (referer.includes("facebook.com") || ua.includes("fbav") || ua.includes("fban") || ua.includes("fb_iab")) return "Facebook";
  if (referer.includes("instagram.com") || ua.includes("instagram")) return "Instagram";
  if (referer.includes("tiktok.com") || ua.includes("tiktok") || ua.includes("bytedance")) return "TikTok";
  if (referer.includes("youtube.com") || referer.includes("youtu.be") || ua.includes("youtube")) return "YouTube";
  if (referer.includes("linkedin.com") || ua.includes("linkedin")) return "LinkedIn";
  if (referer.includes("twitter.com") || referer.includes("t.co") || ua.includes("twitter")) return "Twitter";
  if (referer.includes("reddit.com") || ua.includes("reddit")) return "Reddit";
  if (referer.includes("pinterest.com") || ua.includes("pinterest")) return "Pinterest";
  if (referer.includes("snapchat.com") || ua.includes("snapchat")) return "Snapchat";
  if (referer.includes("discord.com") || ua.includes("discord")) return "Discord";
  if (referer.includes("telegram.org") || referer.includes("t.me") || ua.includes("telegram")) return "Telegram";
  if (referer.includes("teams.microsoft")) return "Teams";
  if (referer.includes("slack.com") || ua.includes("slack")) return "Slack";
  if (referer.includes("mail.google.com")) return "Gmail";
  if (referer.includes("outlook.live.com") || referer.includes("outlook")) return "Outlook";
  if (referer.includes("wechat.com") || ua.includes("wechat") || ua.includes("micromessenger")) return "WeChat";
  if (referer.includes("line.me") || ua.includes("line")) return "Line";
  if (referer.includes("viber.com") || ua.includes("viber")) return "Viber";

  if (ua.includes("hola")) return "Hola Browser";
  if (ua.includes("opr") || ua.includes("opera")) return "Opera";
  if (ua.includes("edg")) return "Edge";
  if (ua.includes("brave")) return "Brave";
  if (ua.includes("torbrowser")) return "Tor";
  if (ua.includes("fxios") || ua.includes("firefox")) return "Firefox";
  if (ua.includes("trident") || ua.includes("msie")) return "Internet Explorer";
  if (ua.includes("crios") || ua.includes("chrome")) return "Chrome";
  if (ua.includes("safari") && ua.includes("mobile")) return "iOS Safari";
  if (ua.includes("safari")) return "Safari";

  return "Direct";
}

function isWebBrowser(userAgent, headers = {}) {
  const ua = (userAgent || "").toLowerCase();

  // 1. Exclude known bots, scanners, preview agents
  const botPattern = /bot|crawler|spider|slurp|fetch|headless|chrome-lighthouse|puppeteer|safelinks|microsoft|proofpoint|mimecast|barracuda|virus|scan|security|audit|analyze|facebookexternalhit|facebot|twitterbot|slackbot|telegrambot|linkedinbot|discordbot|skypeuripreview|googlebot|bingbot|yandexbot|pinterestbot|redditbot|vkshare|embedly|quora|showyoubot|outbrain|developers\.google\.com|google-read-aloud|mediapartners-google|adsbot-google|baiduspider|duckduckbot|ia_archiver|mj12bot|sogoubot|bitlybot|postman|curl|insomnia|axios|wget|libwww|httpclient|java|go-http-client|ruby|python-requests/i;

  if (botPattern.test(ua)) {
    return false;
  }

  // Allow standard browsers and mobile in-app browsers
  return true;
}

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

  // ── Browser check ──
  const ua = userAgent || "";
  if (!isWebBrowser(ua, headers)) {
    return urlObj; // Skip tracking entirely for non-browsers (like Teams scanners or API tools)
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
    const xRequestedWith = headers?.["x-requested-with"] || null;
    const source = getSource(ua, referer, xRequestedWith);

    urlObj.clicks += 1;

    urlObj.clickLogs.push({
      ip: ip || "unknown",
      userAgent: ua || "unknown",
      referer: referer,
      xRequestedWith: xRequestedWith,
      source: source,
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
