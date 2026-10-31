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
router.post("/logout",authMiddleware, logoutUser);

const User = require("../models/User");
const { isMockMode, mockStore, persistMockUsers } = require("../config/db");

// Universal session check for all roles (tenant, landlord, admin)
router.get("/me", authMiddleware, (req, res) => {
    const userId = req.user.id || req.user.userId || req.user._id;
    if (isMockMode()) {
        const user = Array.from(mockStore.users.values()).find(u => 
            String(u._id) === String(userId) || 
            String(u.email).toLowerCase() === String(req.user.email || '').toLowerCase()
        );
        if (!user) {
            return res.status(200).json({
                message: "You are authenticated",
                user: {
                    id: userId,
                    role: req.user.role || 'tenant',
                    email: req.user.email || '',
                    identityStatus: 'verified',
                    verificationStatus: 'verified',
                    emailVerified: true
                }
            });
        }
        return res.status(200).json({
            message: "You are authenticated",
            user: {
                id: user._id,
                _id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'User',
                email: user.email,
                phone: user.phone,
                role: user.role,
                identityStatus: user.identityStatus || (user.role === 'admin' ? 'verified' : 'unverified'),
                verificationStatus: user.verificationStatus || user.identityStatus || (user.role === 'admin' ? 'verified' : 'unverified'),
                emailVerified: user.emailVerified ?? true,
                profileImage: user.profileImage || '',
                isActive: user.isActive ?? true
            }
        });
    }

    User.findById(userId).select('-password').then(user => {
        if (!user) return res.status(404).json({ message: "User not found" });
        res.status(200).json({
            message: "You are authenticated",
            user: {
                id: user._id,
                _id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'User',
                email: user.email,
                phone: user.phone,
                role: user.role,
                identityStatus: user.identityStatus || 'pending',
                verificationStatus: user.verificationStatus || user.identityStatus || 'unverified',
                emailVerified: user.emailVerified ?? true,
                profileImage: user.profileImage || '',
                isActive: user.isActive ?? true
            }
        });
    }).catch(err => {
        res.status(500).json({ message: "Server error", error: err.message });
    });
});

// Profile endpoints (used by ProfilePage.tsx across all dashboards)
router.get("/profile", authMiddleware, (req, res) => {
    const userId = req.user.id || req.user.userId || req.user._id;
    if (isMockMode()) {
        const user = Array.from(mockStore.users.values()).find(u => 
            String(u._id) === String(userId) || 
            String(u.email).toLowerCase() === String(req.user.email || '').toLowerCase()
        );
        if (!user) return res.status(404).json({ message: "User not found" });
        const userPayload = {
            id: user._id,
            _id: user._id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            phone: user.phone,
            role: user.role,
            identityStatus: user.identityStatus || 'verified',
            verificationStatus: user.verificationStatus || user.identityStatus || 'verified',
            emailVerified: user.emailVerified ?? true
        };
        return res.status(200).json({ data: userPayload, user: userPayload });
    }
    User.findById(userId).select('-password').then(user => {
        if (!user) return res.status(404).json({ message: "User not found" });
        res.status(200).json({ data: user, user });
    }).catch(() => res.status(500).json({ message: "Server error" }));
});

router.put("/profile", authMiddleware, (req, res) => {
    const userId = req.user.id || req.user.userId || req.user._id;
    const { firstName, lastName, phone } = req.body;
    if (isMockMode()) {
        const user = Array.from(mockStore.users.values()).find(u => 
            String(u._id) === String(userId) || 
            String(u.email).toLowerCase() === String(req.user.email || '').toLowerCase()
        );
        if (!user) return res.status(404).json({ message: "User not found" });
        if (firstName) user.firstName = firstName;
        if (lastName) user.lastName = lastName;
        if (phone) user.phone = phone;
        persistMockUsers();
        const userPayload = {
            id: user._id,
            _id: user._id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            phone: user.phone,
            role: user.role,
            identityStatus: user.identityStatus || 'verified',
            verificationStatus: user.verificationStatus || user.identityStatus || 'verified',
            emailVerified: user.emailVerified ?? true
        };
        const apiUser = {
            id: user._id,
            name: `${user.firstName} ${user.lastName}`.trim(),
            email: user.email,
            role: user.role,
            verificationStatus: user.verificationStatus || user.identityStatus || 'verified'
        };
        return res.status(200).json({ message: "Profile updated", data: userPayload, user: userPayload, apiUser });
    }
    User.findByIdAndUpdate(userId, { firstName, lastName, phone }, { new: true }).select('-password').then(user => {
        if (!user) return res.status(404).json({ message: "User not found" });
        const apiUser = {
            id: user._id,
            name: `${user.firstName} ${user.lastName}`.trim(),
            email: user.email,
            role: user.role,
            verificationStatus: user.verificationStatus || user.identityStatus || 'verified'
        };
        res.status(200).json({ message: "Profile updated", data: user, user, apiUser });
    }).catch(() => res.status(500).json({ message: "Server error" }));
});

module.exports = router;