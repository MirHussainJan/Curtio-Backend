const jwt = require("jsonwebtoken");
const env = require("../config.js/env");

/**
 * Generate a JWT token for a user.
 * Expires in 7 days. A new token is issued on every login / OTP verification.
 */
const generateToken = (user) => {
  return jwt.sign(
    {
      id: user._id,
      email: user.email,
      name: user.name,
    },
    env.JWT_SECRET,
    { expiresIn: "10d" }
  );
};

/**
 * Verify a JWT token. Returns the decoded payload or throws an error.
 */
const verifyToken = (token) => {
  return jwt.verify(token, env.JWT_SECRET);
};

module.exports = { generateToken, verifyToken };
