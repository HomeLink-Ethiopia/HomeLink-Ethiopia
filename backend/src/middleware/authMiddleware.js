const jwt = require("jsonwebtoken");

const authMiddleware = (req, res, next) => {
  try {
    console.log("HEADERS:", req.headers);
    console.log("AUTHORIZATION:", req.headers.authorization);

    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        message: "Access denied. No token provided",
      });
    }

    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        message: "Invalid authorization format",
      });
    }

    const token = authHeader.split(" ")[1];

console.log("TOKEN EXISTS:", !!token);
console.log("JWT SECRET EXISTS:", !!process.env.JWT_SECRET);

const decoded = jwt.verify(token, process.env.JWT_SECRET);

console.log("DECODED USER:", decoded);

    req.user = decoded;

    next();
  } catch (error) {
    console.error("Authentication error:", error.message);

    return res.status(401).json({
      message: "Invalid or expired token",
    });
  }
};

module.exports = authMiddleware;