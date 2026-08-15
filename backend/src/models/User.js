const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: true,
      trim: true,
    },

    lastName: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    emailVerified:{
      type: Boolean,
      default: false,
    },

    emailVerificationCode:{
      type: String,
      default: null,
    },

    emailVerificationExpires:{
      type: Date,
      default: null,
    },

    passwordResetCode:{
      type: String,
      default: null,
    },

    passwordResetExpires:{
      type: String,
      default:null,
    },

    phone: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    password: {
      type: String,
      required: true,
      minlength: 8,
    },

    role: {
      type: String,
      enum: ["tenant", "landlord", "admin"],
      default: "tenant",
    },

    profileImage: {
      type: String,
      default: "",
    },

    identityStatus: {
      type: String,
      enum: ["pending", "verified", "rejected"],
      default: "pending",
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("User", userSchema);