const urlService = require("../services/url.service");

const createShortUrl = async (req, res) => {
  try {
    const userId = req.user.id; // from authMiddleware
    const { originalUrl, customAlias, password, expiresAt } = req.body;

    if (!originalUrl) {
      return res.status(400).json({ success: false, message: "Destination URL is required." });
    }

    const newUrl = await urlService.addShortUrl(userId, {
      originalUrl,
      customAlias,
      password,
      expiresAt,
    });

    return res.status(201).json({
      success: true,
      message: "Short URL created successfully!",
      url: newUrl,
    });
  } catch (error) {
    console.error("Create short URL error:", error);
    return res.status(400).json({ success: false, message: error.message });
  }
};

const getMyUrls = async (req, res) => {
  try {
    const userId = req.user.id;
    const urls = await urlService.getUserUrls(userId);
    return res.status(200).json({ success: true, urls });
  } catch (error) {
    console.error("Get URLs error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

const deleteUrl = async (req, res) => {
  try {
    const userId = req.user.id;
    const { shortCode } = req.params;
    await urlService.deleteUserUrl(userId, shortCode);
    return res.status(200).json({ success: true, message: "Link deleted successfully." });
  } catch (error) {
    console.error("Delete URL error:", error);
    return res.status(400).json({ success: false, message: error.message });
  }
};

const toggleUrlActive = async (req, res) => {
  try {
    const userId = req.user.id;
    const { shortCode } = req.params;
    const url = await urlService.toggleUserUrlActive(userId, shortCode);
    return res.status(200).json({
      success: true,
      message: `Link ${url.active ? "enabled" : "disabled"} successfully.`,
      url,
    });
  } catch (error) {
    console.error("Toggle active state error:", error);
    return res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * Direct redirect — resolves the short URL, records the click, and
 * immediately redirects the visitor to the original destination.
 * No captcha or intermediate page required.
 */
const handleRedirect = async (req, res) => {
  const { shortCode } = req.params;

  try {
    // Only validates the link — does NOT record a click
    const urlObj = await urlService.resolveShortUrl(shortCode, {
      enteredPassword: null,
    });

    // Forward query params to destination so UTM tracking works on the target page
    let destinationUrl = urlObj.originalUrl;
    const queryParams = req.query;
    if (queryParams && Object.keys(queryParams).length > 0) {
      try {
        const urlObjParsed = new URL(destinationUrl);
        Object.entries(queryParams).forEach(([key, val]) => {
          urlObjParsed.searchParams.set(key, val);
        });
        destinationUrl = urlObjParsed.toString();
      } catch (e) {
        const sep = destinationUrl.includes("?") ? "&" : "?";
        const qs = new URLSearchParams(queryParams).toString();
        destinationUrl = `${destinationUrl}${sep}${qs}`;
      }
    }

    // Pass the utm_source along so the track endpoint can use it
    const utmSource = req.query.utm_source || "";
    const apiBase = process.env.BACK_END_URL || "";

    return res.status(200).send(buildRedirectPage(destinationUrl, shortCode, utmSource, apiBase));
  } catch (error) {
    if (error.passwordRequired) {
      const frontendUrl = process.env.FRONT_END_URL;
      return res.redirect(302, `${frontendUrl}/password/${shortCode}`);
    }
    return res.status(404).json({ success: false, message: error.message || "Link unavailable." });
  }
};

/**
 * POST /api/track/:shortCode
 * Called by the loader page JS after the 3-second countdown completes.
 * This is the ONLY place a click is recorded.
 */
const trackClick = async (req, res) => {
  const { shortCode } = req.params;
  const ip = req.headers["x-forwarded-for"] || req.ip || req.socket.remoteAddress;
  const userAgent = req.headers["user-agent"];
  const utmSource = req.body?.utmSource || req.query.utm_source || null;

  try {
    await urlService.trackClick(shortCode, {
      ip,
      userAgent,
      headers: req.headers,
      utmSource,
    });
    return res.status(200).json({ success: true });
  } catch (error) {
    // Non-critical — don’t break the redirect experience
    console.error("Track click error:", error);
    return res.status(200).json({ success: true });
  }
};

function buildRedirectPage(destinationUrl, shortCode, utmSource, apiBase) {
  const safeUrl = destinationUrl.replace(/"/g, "&quot;");
  const safeCode = (shortCode || "").replace(/[^a-zA-Z0-9_-]/g, "");
  const safeUtm = (utmSource || "").replace(/"/g, "&quot;");
  const safeApi = (apiBase || "").replace(/"/g, "&quot;");

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8" />
<title>Redirecting…</title>
<style>
  body {
    margin: 0;
    height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #F9FAFB;
    font-family: 'Inter', sans-serif;
  }
  .loader-wrap {
    text-align: center;
  }
  .spinner {
    width: 48px;
    height: 48px;
    margin: 0 auto 16px;
    border: 4px solid #E5E7EB;
    border-top: 4px solid #2563EB;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  .redirect-text {
    font-size: 15px;
    color: #374151;
    font-weight: 500;
  }
  .dots::after {
    content: '';
    animation: dots 1.2s steps(4, end) infinite;
  }
  @keyframes dots {
    0% { content: ''; }
    25% { content: '.'; }
    50% { content: '..'; }
    75% { content: '...'; }
    100% { content: ''; }
  }
</style>
</head>
<body>
  <div class="loader-wrap">
    <div class="spinner"></div>
  </div>

<script>
  // Track the click ONLY after the full 3-second countdown fires.
  // If the user closes the tab before this runs, no click is recorded.
  setTimeout(function () {
    var trackUrl = "${safeApi}/api/track/${safeCode}";
    var payload = JSON.stringify({ utmSource: "${safeUtm}" });

    // sendBeacon is fire-and-forget and survives page unload
    if (navigator.sendBeacon) {
      var blob = new Blob([payload], { type: 'application/json' });
      navigator.sendBeacon(trackUrl, blob);
    } else {
      // Fallback: synchronous XHR so it fires before window.location.replace
      var xhr = new XMLHttpRequest();
      xhr.open('POST', trackUrl, false); // false = synchronous
      xhr.setRequestHeader('Content-Type', 'application/json');
      try { xhr.send(payload); } catch(e) {}
    }

    window.location.replace("${safeUrl}");
  }, 3000);
</script>
</body>
</html>`;
}


module.exports = {
  createShortUrl,
  getMyUrls,
  deleteUrl,
  toggleUrlActive,
  handleRedirect,
  trackClick,
};
