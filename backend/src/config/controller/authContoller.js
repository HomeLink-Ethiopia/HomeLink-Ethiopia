const bcrypt = require("bcryptjs");
const User = require("../models/User");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { registerSchema } = require("../validators/authValidators");
const { sendVerificationEmail } = require("../utils/emailService")

// =========================
// REGISTER USER
// =========================

const registerUser = async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      email,
      phone,
      password,
    } = req.body;

    // Validate input
    const { error } = registerSchema.validate(req.body);

    if (error) {
      return res.status(400).json({
        message: error.details[0].message,
      });
    }

    // Check if email already exists
    const existingEmail = await User.findOne({ email });

    if (existingEmail) {
      return res.status(400).json({
        message: "Email is already registered",
      });
    }

    // Check if phone already exists
    const existingPhone = await User.findOne({ phone });

    if (existingPhone) {
      return res.status(400).json({
        message: "Phone number is already registered",
      });
    }

    // Generate 6-digit verification code
    const verificationCode = crypto
      .randomInt(100000, 1000000)
      .toString();

    // Hash verification code before storing it
    const hashedVerificationCode = await bcrypt.hash(
      verificationCode,
      10
    );

    // Code expires after 10 minutes
    const verificationExpires = new Date(
      Date.now() + 10 * 60 * 1000
    );

    // Hash password
    const hashedPassword = await bcrypt.hash(
      password,
      10
    );

    // Create user
    const user = await User.create({
      firstName,
      lastName,
      email,
      phone,
      password: hashedPassword,
      role: "tenant",

      // Store HASH, not the real code
      emailVerificationCode: hashedVerificationCode,
      emailVerificationExpires: verificationExpires,
    });

    // Development only
    // Later this will be replaced by real email sending
  
    const emailSent = await sendVerificationEmail(
      email,
      verificationCode
    );

    console.log("VERIFICATION CODE:", verificationCode);

    if(!emailSent){
      return res.status(500).json({
        message:"Failed to send verification email",
      });
    }
  
    res.status(201).json({
      message: "User registered successfully",

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


// =========================
// VERIFY EMAIL
// =========================

const verifyEmail = async (req, res) => {
  try {
    const { email, code } = req.body;

    // Check required fields
    if (!email || !code) {
      return res.status(400).json({
        message: "Email and verification code are required",
      });
    }

    // Find user
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    // Check if already verified
    if (user.emailVerified) {
      return res.status(400).json({
        message: "Email is already verified",
      });
    }

    // Check if code has expired
    if (
      !user.emailVerificationExpires ||
      user.emailVerificationExpires < new Date()
    ) {
      return res.status(400).json({
        message: "Verification code is expired",
      });
    }

    // Compare entered code with hashed code
    const isCodeCorrect = await bcrypt.compare(
      code,
      user.emailVerificationCode
    );

    // Reject incorrect code
    if (!isCodeCorrect) {
      return res.status(400).json({
        message: "Invalid verification code",
      });
    }

    // Verify email
    user.emailVerified = true;

    // Remove verification code after successful verification
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


// =========================
// RESEND EMAIL CODE
// =========================

const resendEmailCode = async (req, res) => {
  try {
    const { email } = req.body;

    // Check email
    if (!email) {
      return res.status(400).json({
        message: "Email is required",
      });
    }

    // Find user
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    // Check if already verified
    if (user.emailVerified) {
      return res.status(400).json({
        message: "Email already verified",
      });
    }

    // Generate new 6-digit code
    const verificationCode = crypto
      .randomInt(100000, 1000000)
      .toString();

    // Hash the new code
    const hashedVerificationCode = await bcrypt.hash(
      verificationCode,
      10
    );

    // New expiration time
    const verificationExpires = new Date(
      Date.now() + 10 * 60 * 1000
    );

    // Replace old code with new HASH
    user.emailVerificationCode =
      hashedVerificationCode;

    user.emailVerificationExpires =
      verificationExpires;

    await user.save();


   const emailSent = await sendVerificationEmail(
    email,
    verificationCode
   );

   if(!emailSent){

    return res.status(500).json({
      message:"Failed to send verification email",
    });
   }


    res.status(200).json({
      message:
        "A new verification code has been sent to your email",
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
      return re.status(400).json({
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

    const isCodeCorrect =  await bcrypt.compare(
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

    // Find user
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    // Check if account is active
    if (!user.isActive) {
      return res.status(400).json({
        message: "Your account is inactive",
      });
    }

    // Check password
    const isPasswordCorrect = await bcrypt.compare(
      password,
      user.password
    );

    if (!isPasswordCorrect) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    // Create JWT
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

    // Send response
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
    console.error("Loginout error:", error);

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