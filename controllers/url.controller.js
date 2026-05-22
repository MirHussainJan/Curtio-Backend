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

const handleRedirect = async (req, res) => {
  const { shortCode } = req.params;
  const enteredPassword = req.method === "POST" ? req.body.password : req.query.p || null;

  const ip = req.headers["x-forwarded-for"] || req.ip || req.socket.remoteAddress;
  const userAgent = req.headers["user-agent"];

  try {
    const urlObj = await urlService.resolveShortUrl(shortCode, {
      ip,
      userAgent,
      enteredPassword,
      headers: req.headers,
    });

    // Clean HTTP 302 redirection
    return res.redirect(302, urlObj.originalUrl);
  } catch (error) {
    if (error.passwordRequired) {
      // Render premium and beautiful HTML password form with glassmorphic styling
      return res.status(403).send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Password Protected Link - Brevly</title>
          <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Inter', sans-serif; }
            body {
              background: linear-gradient(135deg, #4f46e5 0%, #c2410c 100%);
              min-height: 100vh;
              display: flex;
              align-items: center;
              justify-content: center;
              padding: 20px;
            }
            .card {
              background: rgba(255, 255, 255, 0.95);
              backdrop-filter: blur(10px);
              border-radius: 24px;
              padding: 40px;
              width: 100%;
              max-width: 440px;
              box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
              text-align: center;
            }
            .icon {
              background: #eef2ff;
              color: #4f46e5;
              width: 64px;
              height: 64px;
              border-radius: 16px;
              display: flex;
              align-items: center;
              justify-content: center;
              margin: 0 auto 24px;
              font-size: 28px;
            }
            h1 { font-size: 24px; font-weight: 800; color: #0f172a; margin-bottom: 8px; }
            p { font-size: 14px; color: #64748b; margin-bottom: 24px; line-height: 1.5; }
            .form-group { text-align: left; margin-bottom: 20px; }
            label { display: block; font-size: 12px; font-weight: 600; color: #475569; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px; }
            input {
              width: 100%;
              padding: 14px 16px;
              border: 2px solid #e2e8f0;
              border-radius: 12px;
              font-size: 14px;
              color: #1e293b;
              outline: none;
              transition: all 0.2s;
            }
            input:focus { border-color: #4f46e5; box-shadow: 0 0 0 4px rgba(79, 70, 229, 0.15); }
            button {
              width: 100%;
              background: #4f46e5;
              color: white;
              border: none;
              padding: 14px;
              border-radius: 12px;
              font-size: 14px;
              font-weight: 600;
              cursor: pointer;
              transition: background 0.2s;
            }
            button:hover { background: #4338ca; }
            .error { color: #ef4444; font-size: 13px; font-weight: 500; margin-top: 12px; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="icon">🔒</div>
            <h1>Link Protected</h1>
            <p>This shortened link is password protected. Enter the password below to access the destination URL.</p>
            <form method="POST" action="/${shortCode}">
              <div class="form-group">
                <label for="password">Enter Password</label>
                <input type="password" id="password" name="password" placeholder="••••••••" required autofocus>
              </div>
              <button type="submit">Unlock Link</button>
            </form>
            ${enteredPassword ? '<div class="error">Incorrect password. Please try again.</div>' : ''}
          </div>
        </body>
        </html>
      `);
    }

    // Other errors
    return res.status(404).send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Link Not Found - Brevly</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Inter', sans-serif; }
          body {
            background: #f8fafc;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
          }
          .card {
            background: white;
            border: 1px solid #e2e8f0;
            border-radius: 24px;
            padding: 40px;
            width: 100%;
            max-width: 440px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.05);
            text-align: center;
          }
          .icon {
            background: #fef2f2;
            color: #ef4444;
            width: 64px;
            height: 64px;
            border-radius: 16px;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 24px;
            font-size: 28px;
          }
          h1 { font-size: 22px; font-weight: 800; color: #0f172a; margin-bottom: 8px; }
          p { font-size: 14px; color: #64748b; margin-bottom: 24px; line-height: 1.5; }
          a {
            display: inline-block;
            background: #4f46e5;
            color: white;
            text-decoration: none;
            padding: 12px 24px;
            border-radius: 12px;
            font-size: 14px;
            font-weight: 600;
            transition: background 0.2s;
          }
          a:hover { background: #4338ca; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="icon">⚠️</div>
          <h1>Link Unavailable</h1>
          <p>${error.message || "This link doesn't exist, is disabled, or has expired."}</p>
          <a href="http://localhost:5173">Go to Brevly</a>
        </div>
      </body>
      </html>
    `);
  }
};

module.exports = {
  createShortUrl,
  getMyUrls,
  deleteUrl,
  toggleUrlActive,
  handleRedirect,
};
