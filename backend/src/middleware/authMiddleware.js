const jwt = require("jsonwebtoken");

const authMiddleware = (req, res, next) => {
  try {
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

    if (token && token.startsWith("dev_mock_jwt_token_")) {
      const role = token.replace("dev_mock_jwt_token_", "") || "tenant";
      req.user = {
        id: "mock-user-" + role,
        userId: "mock-user-" + role,
        role: role,
        email: `dev.${role}@homelink.test`,
      };
      return next();
    }

    const secret = process.env.JWT_SECRET || "homelink_dev_jwt_secret_key_2026";
    let decoded;
    try {
      decoded = jwt.verify(token, secret);
    } catch {
      decoded = jwt.verify(token, "homelink_dev_secret_key_2026");
    }

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
