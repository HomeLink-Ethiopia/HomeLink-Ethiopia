const bcrypt = require("bcryptjs");
const User = require("../models/User");
const LandlordProfile = require("../models/LandlordProfile");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const mongoose = require("mongoose");
const { isMockMode, mockStore } = require("../config/db");
const { persistMockUsers } = require("../config/db"); // sprint-persist-mock-users
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

    const assignedRole = role === "landlord" ? "landlord" : "tenant";
    const verificationCode = crypto.randomInt(100000, 1000000).toString();
    const hashedVerificationCode = await bcrypt.hash(verificationCode, 10);
    const verificationExpires = new Date(Date.now() + 10 * 60 * 1000);
    const hashedPassword = await bcrypt.hash(password, 10);

    // ─── IN-MEMORY MOCK FALLBACK (OFFLINE DATABASE) ───
    if (isMockMode()) {
      if (mockStore.users.has(email)) {
        return res.status(400).json({ message: "Email is already registered" });
      }
      // (sprint2-phone-dup) spec: duplicate phone checking
      if (phone && Array.from(mockStore.users.values()).some((u) => u.phone === phone)) {
        return res.status(400).json({ message: "Phone is already registered" });
      }

      const mockUser = {
        _id: "mock-user-" + Date.now(),
        firstName,
        lastName,
        email,
        phone,
        password: hashedPassword,
        role: assignedRole,
        emailVerificationCode: hashedVerificationCode,
        emailVerificationExpires: verificationExpires,
        identityStatus: "verified",
        emailVerified: true
      };

      mockStore.users.set(email, mockUser);

      if (assignedRole === "landlord") {
        mockStore.landlordProfiles.set(mockUser._id, {
          _id: mockUser._id,
          accountId: mockUser._id,
          legalName: `${firstName} ${lastName}`.trim(),
          verificationStatus: "unverified",
          verifiedPropertiesCount: 0
        });
      }

      console.log(`⚡ [MOCK DB] User registered: ${email} (${assignedRole}) | Verification Code: ${verificationCode}`);
      persistMockUsers(); // sprint-persist-mock-users

      const emailResult = await sendVerificationEmail(email, verificationCode);
      console.log("[MOCK DB] register: email delivered =", emailResult.delivered);
      return res.status(201).json({
        message: "User registered successfully",
        ...(emailResult.delivered ? {} : { devVerificationCode: verificationCode }), // formal verification: code by email only
        emailSent: emailResult.delivered,
        user: {
          id: mockUser._id,
          firstName: mockUser.firstName,
          lastName: mockUser.lastName,
          email: mockUser.email,
          phone: mockUser.phone,
          role: mockUser.role,
          identityStatus: mockUser.identityStatus,
          emailVerified: mockUser.emailVerified,
        }
      });
    }

    // ─── MONGOOSE DATABASE MODE ───
    const existingEmail = await User.findOne({ email });

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
      email,
      phone,
      password: hashedPassword,
      role: assignedRole,
      emailVerificationCode: hashedVerificationCode,
      emailVerificationExpires: verificationExpires,
    });

    if (assignedRole === "landlord") {
      try {
        await LandlordProfile.create({
          accountId: user._id,
          legalName: `${firstName} ${lastName}`.trim(),
        });
      } catch (profileErr) {
        console.warn("LandlordProfile initial creation warning:", profileErr.message);
      }
    }

    const emailResult = await sendVerificationEmail(
      email,
      verificationCode
    );

    console.log("VERIFICATION CODE:", verificationCode);

    if(!emailResult.ok){
      return res.status(500).json({
        message:"Failed to send verification email",
      });
    }

    res.status(201).json({
      message: "User registered successfully",
      // Non-production: always return the code so signup can complete even
      // when Resend free-tier blocks delivery to the user's address.
      ...(emailResult.delivered ? {} : { devVerificationCode: verificationCode }), // nodemailer merge: dev rescue only when email delivery failed
      emailSent: emailResult.delivered,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        role: user.role,
        identityStatus: user.identityStatus,
        emailVerified: user.emailVerified,
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

    if (isMockMode()) {
      const mockUser = mockStore.users.get(email);
      if (mockUser) {
        mockUser.emailVerified = true;
      }
      return res.status(200).json({
        message: "Email verified successfully",
      });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    if (user.emailVerified) {
      return res.status(400).json({
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
    // (sprint2-resend-mock) resend works in mock mode too
    if (isMockMode()) {
      const mockUser = mockStore.users.get(email);
      if (!mockUser) return res.status(404).json({ message: "User not found" });
      const verificationCode = crypto.randomInt(100000, 1000000).toString();
      mockUser.emailVerificationCode = verificationCode;
      mockUser.emailVerificationExpires = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      console.log("⚡ [MOCK DB] New verification code for " + email + ": " + verificationCode);
      persistMockUsers(); // sprint-persist-mock-users
      const emailResult = await sendVerificationEmail(email, verificationCode);
      console.log("[MOCK DB] resend: email delivered =", emailResult.delivered);
      return res.status(200).json({
        message: "Verification code sent",
        ...(emailResult.delivered ? {} : { devVerificationCode: verificationCode }), // formal verification: code by email only
        emailSent: emailResult.delivered,
      });
    }

    if (!email) {
      return res.status(400).json({
        message: "Email is required",
      });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    if (user.emailVerified) {
      return res.status(400).json({
        message: "Email already verified",
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
      Date.now() + 10 * 60 * 1000
    );

    user.emailVerificationCode = hashedVerificationCode;
    user.emailVerificationExpires = verificationExpires;

    await user.save();

    const emailResult = await sendVerificationEmail(
      email,
      verificationCode
    );

    if(!emailResult.ok){
      return res.status(500).json({
        message:"Failed to send verification email",
      });
    }

    res.status(200).json({
      message: "A new verification code has been sent to your email",
      // Non-production: surface the code so signup completes when Resend
      // free-tier blocks delivery to the user's address.
      ...(emailResult.delivered ? {} : { devVerificationCode: verificationCode }), // nodemailer merge: dev rescue only when email delivery failed
      emailSent: emailResult.delivered,
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
    // (sprint2-mock-recovery) password recovery works in mock mode too
    if (isMockMode()) {
      const mockUser = mockStore.users.get(email);
      if (!mockUser) return res.status(404).json({ message: "User not found" });
      const resetCode = String(Math.floor(100000 + Math.random() * 900000));
      mockUser.passwordResetCode = resetCode; // plain in mock: dev convenience, real DB hashes it
      mockUser.passwordResetExpires = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      console.log(`\u26a1 [MOCK DB] Password reset code for ${email}: ${resetCode}`);
      persistMockUsers(); // sprint-persist-mock-users
      const emailResult = await sendVerificationEmail(email, resetCode);
      console.log("[MOCK DB] forgot: email delivered =", emailResult.delivered);
      return res.status(200).json({
        message: "Password reset code sent to your email",
        ...(emailResult.delivered ? {} : { devResetCode: resetCode }), // formal verification: code by email only
        emailSent: emailResult.delivered,
      });
    }
    if(!email){
      return res.status(400).json({
        message: "Email is required",
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

    const emailResult = await sendVerificationEmail(
      email,
      resetCode
    );

    if(!emailResult.ok){
      return res.status(500).json({
        message:"Failed to send password reset email",
      });
    }

    res.status(200).json({
      message:"Password reset code sent to your email",
      ...(emailResult.delivered ? {} : { devResetCode: resetCode }), // nodemailer merge: dev rescue only when email delivery failed
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
    // (sprint2-mock-recovery)
    if (isMockMode()) {
      const mockUser = mockStore.users.get(email);
      if (!mockUser) return res.status(404).json({ message: "User not found" });
      if (!mockUser.passwordResetCode) return res.status(400).json({ message: "No password reset request found" });
      if (!mockUser.passwordResetExpires || new Date(mockUser.passwordResetExpires) < new Date()) {
        return res.status(400).json({ message: "Password reset code is expired" });
      }
      if (String(code) !== String(mockUser.passwordResetCode)) {
        return res.status(400).json({ message: "Invalid password reset code" });
      }
      return res.status(200).json({ message: "Password reset code is valid" });
    }

    if(!email||!code){
      return res.status(400).json({
        message:"Email and reset code are required",
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
    // (sprint2-mock-recovery)
    if (isMockMode()) {
      const mockUser = mockStore.users.get(email);
      if (!mockUser) return res.status(404).json({ message: "User not found" });
      if (!newPassword || newPassword.length < 8) return res.status(400).json({ message: "Password must be at least 8 characters" });
      if (!mockUser.passwordResetCode) return res.status(400).json({ message: "No password reset request found" });
      if (!mockUser.passwordResetExpires || new Date(mockUser.passwordResetExpires) < new Date()) {
        return res.status(400).json({ message: "Password reset code expired" });
      }
      if (String(code) !== String(mockUser.passwordResetCode)) {
        return res.status(400).json({ message: "Invalid password reset code" });
      }
      mockUser.password = await bcrypt.hash(newPassword, 10);
      mockUser.passwordResetCode = null;
      mockUser.passwordResetExpires = null;
      return res.status(200).json({ message: "Password reset successfully" });
    }

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

    if (typeof email !== "string" || typeof password !== "string" || !email || !password) {
      return res.status(400).json({
        message: "Email and password must be non-empty strings",
      });
    }
    const { loginSchema } = require("../validators/authValidators");
    const loginCheck = loginSchema.validate({ email, password });
    if (loginCheck.error) {
      return res.status(400).json({ message: loginCheck.error.details[0].message });
    }

    if (isMockMode()) {
      // Sprint 14: mock login is real authentication now — only accounts that
      // were registered (seeded dev accounts or sign-ups) can log in. Logging
      // in with an unknown email or a wrong password returns 401 like prod.
      // Sprint 14: seed the three dev demo accounts (fixed password) so the
      // demo works without the old auto-provision bypass.
      if (!mockStore.users.has("dev.tenant@homelink.test")) {
        const demoHash = await bcrypt.hash("Password123!", 10);
        const mk = (_id, email, role, firstName, lastName) => mockStore.users.set(email, {
          _id, firstName, lastName, email, phone: "0911223344", password: demoHash,
          role, emailVerified: true, identityStatus: "verified",
        });
        mk("mock-user-seed-1", "dev.tenant@homelink.test", "tenant", "Dev", "Tenant");
        mk("mock-landlord-1", "dev.landlord@homelink.test", "landlord", "Dev", "Landlord");
        mk("mock-admin-1", "dev.admin@homelink.test", "admin", "Dev", "Admin");
      }
      const mockUser = mockStore.users.get(email);
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
          emailVerified: mockUser.emailVerified,
        }
      });
    }

    const user = await User.findOne({ email });

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

    const token = jwt.sign(
      {
        id: user._id,
        role: user.role,
      },
      process.env.JWT_SECRET,
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
        emailVerified: user.emailVerified,
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
