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
  const ip = req.headers["x-forwarded-for"] || req.ip || req.socket.remoteAddress;
  const userAgent = req.headers["user-agent"];

  // 5-second delay to deter fast bots/scanners before attempting redirect
  await new Promise((resolve) => setTimeout(resolve, 5000));

  try {
    const urlObj = await urlService.resolveShortUrl(shortCode, {
      ip,
      userAgent,
      enteredPassword: null,
      headers: req.headers,
    });

    return res.redirect(302, urlObj.originalUrl);
  } catch (error) {
    if (error.passwordRequired) {
      // If link is password-protected, redirect to frontend password page
      const frontendUrl = process.env.FRONT_END_URL;
      return res.redirect(302, `${frontendUrl}/password/${shortCode}`);
    }
    return res.status(404).json({ success: false, message: error.message || "Link unavailable." });
  }
};

module.exports = {
  createShortUrl,
  getMyUrls,
  deleteUrl,
  toggleUrlActive,
  handleRedirect,
};
