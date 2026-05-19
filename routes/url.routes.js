const express = require("express");
const router = express.Router();
const urlController = require("../controllers/url.controller");

// All routes here are already prefixed with /api/urls and protected by authMiddleware
router.post("/", urlController.createShortUrl);
router.get("/", urlController.getMyUrls);
router.delete("/:shortCode", urlController.deleteUrl);
router.patch("/:shortCode/toggle", urlController.toggleUrlActive);

module.exports = router;
