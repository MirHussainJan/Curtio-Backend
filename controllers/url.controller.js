const urlService = require("../services/url.service");
const svgCaptcha = require("svg-captcha");
const crypto = require("crypto");

// ── CAPTCHA ENCRYPTION UTILS ──
const getEncryptionKey = () => {
  const secret = process.env.JWT_SECRET || "brevly_super_secret_jwt_key_2025";
  return crypto.scryptSync(secret, "salt", 32);
};

const encryptCaptcha = (text) => {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", getEncryptionKey(), iv);
  let encrypted = cipher.update(text.toLowerCase(), "utf8", "hex");
  encrypted += cipher.final("hex");
  return iv.toString("hex") + ":" + encrypted;
};

const decryptCaptcha = (hash) => {
  try {
    const textParts = hash.split(":");
    const iv = Buffer.from(textParts.shift(), "hex");
    const encryptedText = Buffer.from(textParts.join(":"), "hex");
    const decipher = crypto.createDecipheriv("aes-256-cbc", getEncryptionKey(), iv);
    let decrypted = decipher.update(encryptedText, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch (error) {
    return null;
  }
};
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

const generateCaptcha = (req, res) => {
  const captcha = svgCaptcha.create({
    size: 5,
    noise: 3,
    color: true,
  });
  const hash = encryptCaptcha(captcha.text);
  res.json({ success: true, svg: captcha.data, hash });
};

const verifyAndResolve = async (req, res) => {
  const { shortCode } = req.params;
  const { password, captchaText, captchaHash } = req.body;

  if (!captchaText || !captchaHash) {
    return res.status(400).json({ success: false, message: "Captcha is required." });
  }

  const decrypted = decryptCaptcha(captchaHash);
  if (!decrypted || decrypted !== captchaText.toLowerCase()) {
    return res.status(400).json({ success: false, message: "Invalid Captcha. Please try again." });
  }

  const ip = req.headers["x-forwarded-for"] || req.ip || req.socket.remoteAddress;
  const userAgent = req.headers["user-agent"];

  try {
    const urlObj = await urlService.resolveShortUrl(shortCode, {
      ip,
      userAgent,
      enteredPassword: password || null,
      headers: req.headers,
    });

    return res.status(200).json({ success: true, originalUrl: urlObj.originalUrl });
  } catch (error) {
    if (error.passwordRequired) {
      return res.status(403).json({ success: false, passwordRequired: true, message: "Password required." });
    }
    return res.status(404).json({ success: false, message: error.message || "Link unavailable." });
  }
};


const handleRedirect = async (req, res) => {
  const { shortCode } = req.params;
  const frontendUrl = process.env.FRONT_END_URL;
  return res.redirect(302, `${frontendUrl}/captcha/${shortCode}`);
};

module.exports = {
  createShortUrl,
  getMyUrls,
  deleteUrl,
  toggleUrlActive,
  generateCaptcha,
  verifyAndResolve,
  handleRedirect,
};
