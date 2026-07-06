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

    const destination = urlObj.originalUrl;

    // Serve a clean loader page matching frontend UI (slate-50 bg, white card, indigo accents)
    return res.status(200).send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Redirecting… — Brevly</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
        <style>
          *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

          body {
            font-family: 'Inter', -apple-system, sans-serif;
            background: #F8FAFC;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
          }

          /* ── Card ── */
          .card {
            background: #ffffff;
            border: 1px solid #E2E8F0;
            border-radius: 24px;
            padding: 48px 40px 44px;
            width: 100%;
            max-width: 420px;
            text-align: center;
            box-shadow: 0 4px 24px rgba(0,0,0,0.04);
            animation: cardEntry 0.6s cubic-bezier(0.22, 1, 0.36, 1) both;
          }
          @keyframes cardEntry {
            from { opacity: 0; transform: translateY(20px) scale(0.97); }
            to   { opacity: 1; transform: translateY(0) scale(1); }
          }

          /* ── Orbiting loader ── */
          .loader-wrapper {
            width: 72px;
            height: 72px;
            margin: 0 auto 28px;
            position: relative;
          }
          .orbit {
            position: absolute;
            inset: 0;
            border-radius: 50%;
            animation: spin 2s linear infinite;
          }
          .orbit:nth-child(1) { animation-duration: 2.4s; }
          .orbit:nth-child(2) { animation-duration: 1.8s; animation-direction: reverse; }
          .orbit:nth-child(3) { animation-duration: 3s; }

          .orbit::before {
            content: '';
            position: absolute;
            width: 10px;
            height: 10px;
            border-radius: 50%;
            top: 0;
            left: 50%;
            margin-left: -5px;
          }
          .orbit:nth-child(1)::before {
            background: #4F46E5;
            box-shadow: 0 0 10px rgba(79,70,229,0.4);
          }
          .orbit:nth-child(2)::before {
            background: #6366F1;
            box-shadow: 0 0 10px rgba(99,102,241,0.35);
            width: 8px; height: 8px; margin-left: -4px;
          }
          .orbit:nth-child(3)::before {
            background: #818CF8;
            box-shadow: 0 0 10px rgba(129,140,248,0.3);
            width: 6px; height: 6px; margin-left: -3px;
          }
          @keyframes spin {
            to { transform: rotate(360deg); }
          }

          /* ── Center dot ── */
          .center-dot {
            position: absolute;
            top: 50%; left: 50%;
            width: 12px; height: 12px;
            margin: -6px 0 0 -6px;
            border-radius: 50%;
            background: #4F46E5;
            box-shadow: 0 0 16px rgba(79,70,229,0.3);
            animation: pulse 2s ease-in-out infinite;
          }
          @keyframes pulse {
            0%, 100% { transform: scale(1); opacity: 0.7; }
            50%      { transform: scale(1.3); opacity: 1; }
          }

          /* ── Brand icon ── */
          .brand-icon {
            width: 36px;
            height: 36px;
            background: #4F46E5;
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 20px;
          }
          .brand-icon svg {
            width: 18px;
            height: 18px;
            color: white;
          }

          /* ── Text ── */
          h1 {
            font-size: 20px;
            font-weight: 800;
            color: #0F172A;
            margin-bottom: 6px;
          }
          .subtitle {
            font-size: 14px;
            color: #64748B;
            line-height: 1.5;
            margin-bottom: 28px;
          }

          /* ── Progress bar ── */
          .progress-track {
            width: 100%;
            height: 4px;
            background: #F1F5F9;
            border-radius: 999px;
            overflow: hidden;
            margin-bottom: 16px;
          }
          .progress-fill {
            height: 100%;
            width: 0%;
            border-radius: 999px;
            background: linear-gradient(90deg, #4F46E5, #818CF8);
            animation: fillBar 5s linear forwards;
          }
          @keyframes fillBar {
            to { width: 100%; }
          }

          /* ── Countdown ── */
          .countdown {
            font-size: 13px;
            color: #94A3B8;
            font-weight: 500;
          }
          .countdown span {
            color: #4F46E5;
            font-weight: 700;
            font-variant-numeric: tabular-nums;
          }

          /* ── Destination link ── */
          .dest-link {
            display: inline-block;
            margin-top: 20px;
            font-size: 12px;
            color: #64748B;
            text-decoration: none;
            padding: 8px 16px;
            border-radius: 10px;
            border: 1px solid #E2E8F0;
            background: #F8FAFC;
            transition: all 0.2s;
            max-width: 100%;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }
          .dest-link:hover {
            color: #4F46E5;
            border-color: #C7D2FE;
            background: #EEF2FF;
          }

          @media (max-width: 480px) {
            .card { margin: 16px; padding: 36px 24px 32px; }
          }
        </style>
      </head>
      <body>
        <div class="card">
          <!-- Orbiting loader -->
          <div class="loader-wrapper">
            <div class="orbit"></div>
            <div class="orbit"></div>
            <div class="orbit"></div>
            <div class="center-dot"></div>
          </div>

          <!-- Brand icon -->
          <div class="brand-icon">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
            </svg>
          </div>

          <h1>Redirecting You</h1>
          <p class="subtitle">Please wait while we securely take you to your destination.</p>

          <!-- Progress bar -->
          <div class="progress-track">
            <div class="progress-fill"></div>
          </div>

          <div class="countdown">Redirecting in <span id="timer">5</span>s</div>

          <a class="dest-link" href="${destination}" title="${destination}">
            ${destination.length > 55 ? destination.substring(0, 55) + '…' : destination}
          </a>
        </div>

        <script>
          (function() {
            var seconds = 5;
            var el = document.getElementById('timer');
            var interval = setInterval(function() {
              seconds--;
              if (el) el.textContent = seconds;
              if (seconds <= 0) {
                clearInterval(interval);
                window.location.href = ${JSON.stringify(destination)};
              }
            }, 1000);
          })();
        </script>
      </body>
      </html>
    `);
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
