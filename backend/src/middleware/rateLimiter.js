const rateLimit = require("express-rate-limit");

const loginLimiter = rateLimit({
    windowMs: 15*60*1000,

    limit:5,
    message:{
        message:"Too many login attempts. Please try again later.",
    },

    standardHeaders:true,
    legacyHeaders: false,
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