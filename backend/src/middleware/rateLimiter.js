const rateLimit = require("express-rate-limit");
const { ipKeyGenerator } = require("express-rate-limit");

// Key login attempts by the attempted EMAIL (fallback: IP) and only count
// FAILED logins. This stops one wrong-password spree from locking out every
// other account behind the same NAT/office IP — while still brute-forcing
// the attacker.
const loginLimiter = rateLimit({
    windowMs: 15*60*1000,

    limit:10,

    message:{
        message:"Too many login attempts. Please try again later.",
    },

    standardHeaders:true,
    legacyHeaders: false,

    skipSuccessfulRequests: true,

    keyGenerator: (req, res) => {
        const email = (req.body && typeof req.body.email === "string" ? req.body.email : "").toLowerCase().trim();
        if (email) return "email:" + email;
        return ipKeyGenerator(req.ip);
    },

    // Reject non-string email early (NoSQL-injection style objects) so the
    // keyGenerator always returns a stable string key.
    skip: (req) => !req.body || typeof req.body.email !== "string",
});

const verificationLimiter = rateLimit({
    windowMs: 10*60*1000,

    limit:5,

    message:{
        message:"Too many verification attempts... Please try agin later.",
    },

    standardHeaders: true,
    legacyHeaders: false,
});

const passwordResetLimiter = rateLimit({
    windowMs: 15*60*1000,
    limit: 3,
    message:{
        message:"Too many password reset requests. Please try again later.",
    },

    standardHeaders: true,
    legacyHeaders: false,
})

module.exports={
    loginLimiter,
    verificationLimiter,
    passwordResetLimiter
};