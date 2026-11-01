
const mongoose = require("mongoose");

const paymentTransactionSchema = new mongoose.Schema(
  {
    paymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TenantPayment",
      required: true,
      index: true,
    },

    provider: {
      type: String,
      enum: ["chapa"],
      default: "chapa",
      required: true,
    },

    // HomeLink-generated reference for this checkout attempt.
    merchantReference: {
      type: String,
      required: true,
      unique: true,
    },

    // Chapa-generated reference, saved when it becomes available.
    chapaReference: {
      type: String,
      default: undefined,
      sparse: true,
      unique: true,
    },

    // Store the exact amount requested from Chapa in minor units.
    amountMinorUnits: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator: Number.isSafeInteger,
        message: "amountMinorUnits must be a safe integer",
      },
    },

    currency: {
      type: String,
      required: true,
      default: "ETB",
      uppercase: true,
    },

    status: {
      type: String,
      enum: ["pending", "verified", "recorded", "failed"],
      default: "pending",
      required: true,
    },

    verifiedAt: Date,
    recordedAt: Date,
    failureReason: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model(
  "PaymentTransaction",
  paymentTransactionSchema
);
