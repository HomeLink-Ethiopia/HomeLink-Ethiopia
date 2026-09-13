const express = require("express");
const { registerUser,
        loginUser,
        verifyEmail,
        resendEmailCode,
        forgotPassword,
        verifyResetCode,
        resetPassword,
        logoutUser
} =require("../controller/authContoller");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const { rateLimiter, loginLimiter,
        verificationLimiter,
        passwordResetLimiter
 } = require("../middleware/rateLimiter");

const router = express.Router();

router.post("/register", registerUser);
router.post("/login", loginLimiter, loginUser);
router.post("/verify-email",verificationLimiter, verifyEmail);
router.post("/resend-email-code", resendEmailCode);
router.post("/reset-password", resetPassword);
router.post("/verify-reset-code", verificationLimiter, verifyResetCode);
router.post("/forgot-password",passwordResetLimiter, forgotPassword);
router.post("/logout",authMiddleware, logoutUser)

router.get("/me", authMiddleware ,
                  roleMiddleware("tenant"),
    (req,res) =>{
    res.status(200).json({
        message:"You are authenticated",
        user:req.user,
    });
});

module.exports = router;