const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
dotenv.config();
const env = require("./config.js/env");
const connectDB = require("./config.js/db");
const authMiddleware = require("./middleware/auth.middleware");
const authRoutes = require("./modules/auth.routes");
const urlRoutes = require("./routes/url.routes");
const urlController = require("./controllers/url.controller");

const app = express();

app.use(
  cors({
    origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(",") : [],
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));


app.get("/", (req, res) => {
  res.json({ success: true, message: "Bravely is Live!" });
});


/* ── Public Auth Routes ── */
app.use("/api/auth", authRoutes);

/* ── Protected Route Example ── */
app.get("/api/dashboard", authMiddleware, (req, res) => {
  res.json({ success: true, message: "Welcome to Dashboard!", user: req.user });
});

/* ── Protected Url Management Routes ── */
app.use("/api/urls", authMiddleware, urlRoutes);

/* ── Public Short Code Redirection ── */
app.get("/:shortCode", urlController.handleRedirect);
app.post("/:shortCode", urlController.handleRedirect);

/* ── Connect DB & Start Server ── */
connectDB();

app.listen(env.PORT, () => {
  console.log(`✅ Server Started: http://localhost:${env.PORT}`);
});

module.exports = app;
