const bcrypt = require("bcryptjs");
const User = require("../models/User");
const LandlordProfile = require("../models/LandlordProfile");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const mongoose = require("mongoose");
const { isMockMode, mockStore, persistMockUsers, persistMockData } = require("../config/db");
const { registerSchema } = require("../validators/authValidators");
const { sendVerificationEmail } = require("../utils/emailService")

const registerUser = async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      email,
      phone,
      password,
      role,
    } = req.body;

    const { error } = registerSchema.validate(req.body);

    if (error) {
      return res.status(400).json({
        message: error.details[0].message,
      });
    }

    const normalizedEmail = (email || "").trim().toLowerCase();
    const assignedRole = role === "landlord" ? "landlord" : "tenant";
    const verificationCode = crypto.randomInt(100000, 1000000).toString();
    const hashedVerificationCode = await bcrypt.hash(verificationCode, 10);
    const verificationExpires = new Date(Date.now() + 10 * 60 * 1000);
    const hashedPassword = await bcrypt.hash(password, 10);

    // ─── IN-MEMORY MOCK FALLBACK (OFFLINE DATABASE) ───
    if (isMockMode()) {
      if (mockStore.users.has(normalizedEmail)) {
        return res.status(400).json({ message: "Email is already registered" });
      }

      const mockUser = {
        _id: "mock-user-" + Date.now(),
        firstName,
        lastName,
        email: normalizedEmail,
        phone,
        password: hashedPassword,
        role: assignedRole,
        identityStatus: "unverified",
        emailVerified: true,
      };

      mockUser.emailVerificationCode = hashedVerificationCode;
      mockUser.emailVerificationExpires = verificationExpires;

      mockStore.users.set(normalizedEmail, mockUser);

      if (assignedRole === "landlord") {
        mockStore.landlordProfiles.set(mockUser._id, {
          _id: mockUser._id,
          accountId: mockUser._id,
          legalName: `${firstName} ${lastName}`.trim(),
          verificationStatus: "unverified",
          verifiedPropertiesCount: 0
        });
        if (typeof persistMockData === 'function') persistMockData();
      }

      if (typeof persistMockUsers === 'function') persistMockUsers();

      // Send real email with verification link
      const verifyLink = `http://localhost:3000/verify-email?email=${encodeURIComponent(normalizedEmail)}&code=${verificationCode}`;
      sendVerificationEmail(normalizedEmail, verificationCode, verifyLink).catch(err => {
        console.warn("Async registration email error:", err.message);
      });

      const token = jwt.sign(
        { id: mockUser._id, role: mockUser.role },
        process.env.JWT_SECRET || "homelink_dev_secret_key_2026",
        { expiresIn: "1d" }
      );

      return res.status(201).json({
        message: "User registered successfully",
        token: token,
        user: {
          id: mockUser._id,
          firstName: mockUser.firstName,
          lastName: mockUser.lastName,
          email: mockUser.email,
          phone: mockUser.phone,
          role: mockUser.role,
          identityStatus: mockUser.identityStatus,
          emailVerified: true,
        }
      });
    }

    // ─── MONGOOSE DATABASE MODE ───
    const existingEmail = await User.findOne({ email: normalizedEmail });

    if (existingEmail) {
      return res.status(400).json({
        message: "Email is already registered",
      });
    }

    const existingPhone = await User.findOne({ phone });

    if (existingPhone) {
      return res.status(400).json({
        message: "Phone number is already registered",
      });
    }

    const user = await User.create({
      firstName,
      lastName,
      email: normalizedEmail,
      phone,
      password: hashedPassword,
      role: assignedRole,
      identityStatus: "unverified",
      emailVerified: true,
    });

    if (assignedRole === "landlord") {
      try {
        await LandlordProfile.create({
          accountId: user._id,
          legalName: `${firstName} ${lastName}`.trim(),
          verificationStatus: "unverified",
        });
      } catch (profileErr) {
        console.warn("LandlordProfile initial creation warning:", profileErr.message);
      }
    }

    user.emailVerificationCode = hashedVerificationCode;
    user.emailVerificationExpires = verificationExpires;
    try { await user.save(); } catch (_) {}

    const verifyLink = `http://localhost:3000/verify-email?email=${encodeURIComponent(normalizedEmail)}&code=${verificationCode}`;
    sendVerificationEmail(normalizedEmail, verificationCode, verifyLink).catch(err => {
      console.warn("Async registration email error:", err.message);
    });

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET || "homelink_dev_secret_key_2026",
      { expiresIn: "1d" }
    );

    res.status(201).json({
      message: "User registered successfully",
      token: token,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        role: user.role,
        identityStatus: user.identityStatus,
        emailVerified: true,
      },
    });
  } catch (error) {
    console.error("Registration error:", error);

    res.status(500).json({
      message: "Server error",
    });
  }
};

const verifyEmail = async (req, res) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({
        message: "Email and verification code are required",
      });
    }

    const normalizedEmail = (email || "").trim().toLowerCase();

    if (isMockMode()) {
      const mockUser = mockStore.users.get(normalizedEmail);
      if (!mockUser) {
        return res.status(404).json({ message: "User not found" });
      }
      if (mockUser.emailVerified) {
        return res.status(200).json({ message: "Email is already verified" });
      }
      if (mockUser.emailVerificationExpires && mockUser.emailVerificationExpires < new Date()) {
        return res.status(400).json({ message: "Verification code is expired" });
      }
      const isCodeCorrect = await bcrypt.compare(code, mockUser.emailVerificationCode);
      if (!isCodeCorrect) {
        return res.status(400).json({ message: "Invalid verification code" });
      }
      mockUser.emailVerified = true;
      mockUser.emailVerificationCode = null;
      mockUser.emailVerificationExpires = null;
      if (typeof persistMockUsers === 'function') persistMockUsers();
      return res.status(200).json({
        message: "Email verified successfully",
      });
    }

    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    if (user.emailVerified) {
      return res.status(200).json({
        message: "Email is already verified",
      });
    }

    if (
      !user.emailVerificationExpires ||
      user.emailVerificationExpires < new Date()
    ) {
      return res.status(400).json({
        message: "Verification code is expired",
      });
    }

    const isCodeCorrect = await bcrypt.compare(
      code,
      user.emailVerificationCode
    );

    if (!isCodeCorrect) {
      return res.status(400).json({
        message: "Invalid verification code",
      });
    }

    user.emailVerified = true;
    user.emailVerificationCode = null;
    user.emailVerificationExpires = null;

    await user.save();

    res.status(200).json({
      message: "Email verified successfully",
    });
  } catch (error) {
    console.error(
      "Email verification error:",
      error
    );

    res.status(500).json({
      message: "Server error",
    });
  }
};

const resendEmailCode = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        message: "Email is required",
      });
    }

    const normalizedEmail = (email || "").trim().toLowerCase();

    if (isMockMode()) {
      const mockUser = mockStore.users.get(normalizedEmail);
      if (!mockUser) {
        return res.status(404).json({ message: "User not found" });
      }
      const verificationCode = crypto.randomInt(100000, 1000000).toString();
      mockUser.emailVerificationCode = await bcrypt.hash(verificationCode, 10);
      mockUser.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
      if (typeof persistMockUsers === 'function') persistMockUsers();
      const verifyLink = `http://localhost:3000/verify-email?email=${encodeURIComponent(normalizedEmail)}&code=${verificationCode}`;
      await sendVerificationEmail(normalizedEmail, verificationCode, verifyLink);
      return res.status(200).json({
        message: "A verification email has been sent to your inbox",
        verificationCode: process.env.NODE_ENV !== 'production' ? verificationCode : undefined,
      });
    }

    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const verificationCode = crypto
      .randomInt(100000, 1000000)
      .toString();

    const hashedVerificationCode = await bcrypt.hash(
      verificationCode,
      10
    );

    const verificationExpires = new Date(
      Date.now() + 24 * 60 * 60 * 1000
    );

    user.emailVerificationCode = hashedVerificationCode;
    user.emailVerificationExpires = verificationExpires;

    await user.save();

    const verifyLink = `http://localhost:3000/verify-email?email=${encodeURIComponent(normalizedEmail)}&code=${verificationCode}`;
    const emailSent = await sendVerificationEmail(
      normalizedEmail,
      verificationCode,
      verifyLink
    );

    if(!emailSent){
      return res.status(500).json({
        message:"Failed to send verification email",
      });
    }

    res.status(200).json({
      message: "A verification email has been sent to your inbox",
    });
  } catch (error) {
    console.error(
      "Resend verification error:",
      error
    );

    res.status(500).json({
      message: "Server error",
    });
  }
};

const forgotPassword = async (req,res)=>{
  try{
    const { email } = req.body;
    if(!email){
      return res.status(400).json({
        message: "Email is required",
      });
    }

    if (isMockMode()) {
      const mockUser = mockStore.users.get(email);
      if (!mockUser) {
        return res.status(404).json({ message: "User not found" });
      }
      const resetCode = crypto.randomInt(100000, 1000000).toString();
      mockUser.passwordResetCode = await bcrypt.hash(resetCode, 10);
      mockUser.passwordResetExpires = new Date(Date.now() + 10 * 60 * 1000);
      await sendVerificationEmail(email, resetCode);
      return res.status(200).json({
        message: "Password reset code sent to your email",
      });
    }

    const user = await User.findOne({ email});

    if(!user){
      return res.status(404).json({
        message:"User not found",
      });
    }

    const resetCode = crypto
      .randomInt(100000, 1000000)
      .toString();

    const hashedResetCode = await bcrypt.hash(
      resetCode,
      10
    );

    const resetExpires = new Date(
      Date.now() + 10 * 60 *1000
    );

    user.passwordResetCode = hashedResetCode;
    user.passwordResetExpires = resetExpires;

    await user.save();

    const emailSent = await sendVerificationEmail(
      email,
      resetCode
    );

    if(!emailSent){
      return res.status(500).json({
        message:"Failed to send password reset email",
      });
    }

    res.status(200).json({
      message:"Password reset code sent to your email",
    });

  } catch(error){
    console.error("Forgot Password error: ", error);

    res.status(500).json({
      message:"Server error",
    });
  }
};

const verifyResetCode = async (req,res)=>{
  try{
    const { email, code }= req.body;

    if(!email||!code){
      return res.status(400).json({
        message:"Email and reset code are required",
      });
    }

    if (isMockMode()) {
      const mockUser = mockStore.users.get(email);
      if (!mockUser) {
        return res.status(404).json({ message: "User not found" });
      }
      if (!mockUser.passwordResetCode) {
        return res.status(400).json({ message: "No password reset request found" });
      }
      if (!mockUser.passwordResetExpires || mockUser.passwordResetExpires < new Date()) {
        return res.status(400).json({ message: "Password reset code is expired" });
      }
      const isCodeCorrect = await bcrypt.compare(code, mockUser.passwordResetCode);
      if (!isCodeCorrect) {
        return res.status(400).json({ message: "Invalid password reset code" });
      }
      return res.status(200).json({
        message: "Password reset code is valid",
      });
    }

    const user = await User.findOne({ email });

    if(!user){
      return res.status(404).json({
        message: "User not found"
      });
    }

    if(!user.passwordResetCode){
      return res.status(400).json({
        message:"No password reset request found",
      });
    }

    if(
      !user.passwordResetExpires ||
      user.passwordResetExpires < new Date()
    ){
      return res.status(400).json({
        message: "Password reset code is expired",
      });
    }

    const isCodeCorrect = await bcrypt.compare(code,
      user.passwordResetCode
    );

    if(!isCodeCorrect){
      return res.status(400).json(
        {
          message:"Invalid password reset code"
        }
      );
    }

    res.status(200).json({
      message:"Password reset code is valid",
    });
  } catch(error){
    console.error("Verify reset code error:", error);

    res.status(500).json({
      message:"Server error",
    });
  }
};

const resetPassword = async (req,res)=>{
  try{
    const { email , code, newPassword } = req.body;

    if(!email || !code || !newPassword){
      return res.status(400).json({
        message:"Email, reset code, and new password are required",
      });
    }

    if(newPassword.length < 8){
      return res.status(400).json({
        message:"Password must be at least 8 characters"
      });
    }

    if (isMockMode()) {
      const mockUser = mockStore.users.get(email);
      if (!mockUser) return res.status(404).json({ message: "User not found" });
      if (!mockUser.passwordResetCode) return res.status(400).json({ message: "No password reset request found" });
      if (!mockUser.passwordResetExpires || mockUser.passwordResetExpires < new Date()) {
        return res.status(400).json({ message: "Password reset code expired" });
      }
      const isCodeCorrect = await bcrypt.compare(code, mockUser.passwordResetCode);
      if (!isCodeCorrect) return res.status(400).json({ message: "Invalid password reset code" });
      mockUser.password = await bcrypt.hash(newPassword, 10);
      mockUser.passwordResetCode = null;
      mockUser.passwordResetExpires = null;
      return res.status(200).json({ message: "Password reset successful" });
    }

    const user = await User.findOne({ email });

    if(!user){
      return res.status(404).json({
        message:"User not found",
      });
    }

    if(!user.passwordResetCode){
      return res.status(400).json({
        message:"No password reset request found",
      });
    }

    if(
      !user.passwordResetExpires||
      user.passwordResetExpires < new Date()
    ){
      return res.status(400).json({
        message:"Password reset code expired"
      })
    }

    const isCodeCorrect = await bcrypt.compare(
      code,
      user.passwordResetCode
    );

    if(!isCodeCorrect){
      return res.status(400).json({
        message:"Invalid password reset code",
      });
    }

    const hashedPassword = await bcrypt.hash(
      newPassword,
      10
    );

    user.password = hashedPassword;
    user.passwordResetCode = null;
    user.passwordResetExpires= null;

    await user.save();

    res.status(200).json({
      message:"Password reset successfully",
    });

  }catch(error){
    console.error("Reset password eror:", error);

    res.status(500).json({
      message:" Server error",
    });
  }
};

const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "Email and Password are required",
      });
    }

    const normalizedEmail = (email || "").trim().toLowerCase();

    if (isMockMode()) {
      const mockUser = mockStore.users.get(normalizedEmail);
      if (!mockUser) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      const isPasswordCorrect = await bcrypt.compare(password, mockUser.password);
      if (!isPasswordCorrect) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      const token = jwt.sign(
        { id: mockUser._id, role: mockUser.role },
        process.env.JWT_SECRET || "homelink_dev_secret_key_2026",
        { expiresIn: "1d" }
      );

      return res.status(200).json({
        message: "Login successful",
        token: token,
        user: {
          id: mockUser._id,
          firstName: mockUser.firstName,
          lastName: mockUser.lastName,
          email: mockUser.email,
          phone: mockUser.phone,
          role: mockUser.role,
          identityStatus: mockUser.identityStatus,
          emailVerified: true,
        }
      });
    }

    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    if (!user.isActive) {
      return res.status(400).json({
        message: "Your account is inactive",
      });
    }

    const isPasswordCorrect = await bcrypt.compare(
      password,
      user.password
    );

    if (!isPasswordCorrect) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    if (!user.emailVerified) {
      user.emailVerified = true;
      try {
        await user.save();
      } catch (_) {}
    }

    const token = jwt.sign(
      {
        id: user._id,
        role: user.role,
      },
      process.env.JWT_SECRET || "homelink_dev_secret_key_2026",
      {
        expiresIn: "1d",
      }
    );

    res.status(200).json({
      message: "Login successful",
      token: token,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        role: user.role,
        identityStatus: user.identityStatus,
        emailVerified: true,
      },
    });
  } catch (error) {
    console.error("Login error:", error);

    res.status(500).json({
      message: "Server error",
    });
  }
};

const logoutUser = async (req,res)=>{
  try{
    res.status(200).json({
      message:"Logout succesful",
    });
  } catch(error){
    console.error("Logout error:", error);

    res.status(500).json({
      message:"Server error",
    });
  }
};

module.exports = {
  registerUser,
  loginUser,
  verifyEmail,
  resendEmailCode,
  forgotPassword,
  verifyResetCode,
  resetPassword,
  logoutUser
};
