const mongoose = require("mongoose");

const urlSchema = new mongoose.Schema(
  {
    originalUrl: {
      type: String,
      required: true,
      trim: true,
    },
    shortCode: {
      type: String,
      required: true,
      trim: true,
    },
    clicks: {
      type: Number,
      default: 0,
    },
    active: {
      type: Boolean,
      default: true,
    },
    password: {
      type: String,
      default: null,
    },
    expiresAt: {
      type: Date,
      default: null,
    },
    clickLogs: [
      {
        ip: {
          type: String,
          default: null,
        },
        userAgent: {
          type: String,
          default: null,
        },
        referer: {
          type: String,
          default: null,
        },
        country: {
          type: String,
          default: "unknown",
        },
        countryCode: {
          type: String,
          default: "unknown",
        },
        clickedAt: {
          type: Date,
          default: Date.now,
        },
        classification: {
          type: String,
          default: "Human Browser",
        },
        secFetchSite: {
          type: String,
          default: null,
        },
        secFetchMode: {
          type: String,
          default: null,
        },
        secFetchDest: {
          type: String,
          default: null,
        },
        xForwardedFor: {
          type: String,
          default: null,
        },
      },
    ],
  },
  { timestamps: true }
);

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    otp: {
      type: String,
      default: null,
    },
    otpExpiry: {
      type: Date,
      default: null,
    },
    urls: [urlSchema],
  },
  { timestamps: true }
);

// Ensure that shortCode is unique across all user records globally
userSchema.index({ "urls.shortCode": 1 }, { unique: true, sparse: true });

// Store in "Testing" database → "User" collection (matches Atlas exactly)
const User = mongoose.model("User", userSchema, "User");

module.exports = User;
