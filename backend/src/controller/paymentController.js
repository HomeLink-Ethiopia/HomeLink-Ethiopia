const TenantPayment = require('../models/TenantPayment');
const RentalAgreement = require('../models/RentalAgreement');
const Notification = require('../models/Notification');
const crypto = require("crypto");
const PaymentTransaction = require("../models/PaymentTransaction");

// ─── Chapa base URL ───────────────────────────────────────────────────────────
// Chapa test/live both use v1 for transaction verify, v1 for initialize
const CHAPA_BASE = "https://api.chapa.co/v1";

const createNotification = async (userId, type, title, body, entityType, entityId) => {
    try {
        await Notification.create({
            userId, type, title, body,
            relatedEntity: { entityType, entityId },
            channels: ['in_app']
        });
    } catch (error) {
        console.error("Failed to create notification:", error);
    }
};

const generateInvoice = async (req, res) => {
    try {
        const landlordId = req.user.id;
        const { agreementId, paymentType, periodMonth, dueDate, amountDue, notes } = req.body;

        const agreement = await RentalAgreement.findById(agreementId).populate('propertyId', 'title');
        if (!agreement || agreement.landlordId.toString() !== landlordId) {
            return res.status(403).json({ message: "Unauthorized or agreement not found" });
        }

        const invoice = await TenantPayment.create({
            agreementId,
            tenantId: agreement.tenantId,
            landlordId,
            propertyId: agreement.propertyId._id,
            paymentType,
            periodMonth,
            dueDate,
            amountDue,
            balance: amountDue,
            notes
        });

        await createNotification(
            agreement.tenantId, 'rent_due', 'New Invoice Generated',
            `A new invoice for ${amountDue} ETB is due on ${new Date(dueDate).toLocaleDateString()} for ${agreement.propertyId.title}.`,
            'TenantPayment', invoice._id
        );

        res.status(201).json({ message: "Invoice generated", invoice });
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

const recordPayment = async (req, res) => {
    try {
        const { id } = req.params;
        const tenantId = req.user.id;
        const { paymentMethod, transactionReference } = req.body;
        const receiptFile = req.file ? req.file.path : null;

        if (!transactionReference && !receiptFile) {
            return res.status(400).json({ message: "Must provide either a transaction reference code or a receipt image" });
        }

        const payment = await TenantPayment.findOneAndUpdate(
            { _id: id, tenantId },
            {
                status: 'pending',
                paymentMethod,
                transactionReference,
                receiptKey: receiptFile
            },
            { new: true }
        ).populate('propertyId', 'title');

        if (!payment) return res.status(404).json({ message: "Payment not found" });

        await createNotification(
            payment.landlordId, 'system', 'Payment Proof Uploaded',
            `Tenant has uploaded payment proof for ${payment.propertyId.title}. Please verify the receipt or reference code.`,
            'TenantPayment', payment._id
        );

        res.status(200).json({ message: "Payment proof recorded. Waiting for landlord verification.", payment });
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

const verifyPayment = async (req, res) => {
    try {
        const { id } = req.params;
        const landlordId = req.user.id;
        const { amountPaid, paymentMethod } = req.body;

        const payment = await TenantPayment.findOne({ _id: id, landlordId }).populate('propertyId', 'title');
        if (!payment) return res.status(404).json({ message: "Payment not found" });

        payment.amountPaid = amountPaid || payment.amountDue;
        payment.balance = payment.amountDue - payment.amountPaid;
        payment.status = payment.balance <= 0 ? 'paid' : 'partial';
        payment.paidAt = new Date();

        if (paymentMethod) payment.paymentMethod = paymentMethod;

        await payment.save();

        await createNotification(
            payment.tenantId, 'payment_received', 'Payment Verified',
            `Your payment of ${payment.amountPaid} ETB for ${payment.propertyId.title} has been verified by the landlord!`,
            'TenantPayment', payment._id
        );

        res.status(200).json({ message: "Payment verified successfully", payment });
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// ─── Chapa: Initialize checkout ───────────────────────────────────────────────
const initializeChapaPayment = async (req, res) => {
    let transaction;

    try {
        const { id } = req.params;
        const tenantId = req.user.id;
        const secretKey = process.env.CHAPA_SECRET_KEY;

        if (!secretKey) {
            return res.status(503).json({ message: "Chapa private key is not configured." });
        }

        // Populate tenant user fields (Account model uses firstName/lastName)
        const payment = await TenantPayment.findOne({ _id: id, tenantId })
            .populate("tenantId", "firstName lastName email phone");

        if (!payment) {
            return res.status(404).json({ message: "Payment invoice not found." });
        }

        // Chapa expects ETB as a plain decimal number, not minor units
        const amountETB = Number(payment.balance);
        const currency = String(payment.currency || "ETB").toUpperCase();

        if (payment.status === "paid" || !Number.isFinite(amountETB) || amountETB <= 0) {
            return res.status(400).json({ message: "This invoice has no valid outstanding balance." });
        }

        if (currency !== "ETB") {
            return res.status(400).json({ message: "Only ETB payments are currently supported." });
        }

        if (amountETB < 1) {
            return res.status(400).json({ message: "Minimum Chapa payment is 1 ETB." });
        }

        const tenant = payment.tenantId;
        if (!tenant?.email) {
            return res.status(400).json({ message: "Your account needs a valid email address to use Chapa." });
        }

        // Unique tx_ref for this checkout attempt (Chapa field name: tx_ref)
        const tx_ref = `HL-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;

        // Store as amountMinorUnits for backwards compat but store ETB too
        transaction = await PaymentTransaction.create({
            paymentId: payment._id,
            provider: "chapa",
            merchantReference: tx_ref,
            // Store ETB * 100 as minor units for record keeping
            amountMinorUnits: Math.round(amountETB * 100),
            currency,
            status: "pending"
        });

        const firstName = tenant.firstName || "HomeLink";
        const lastName = tenant.lastName || "Tenant";

        const payload = {
            amount: String(amountETB),          // Chapa expects a string decimal
            currency,
            tx_ref,                             // Chapa's field is tx_ref, not merchant_reference
            first_name: firstName,
            last_name: lastName,
            email: tenant.email,
            ...(tenant.phone ? { phone_number: String(tenant.phone) } : {}),
            title: "HomeLink Rent Payment",
            description: `Payment for ${payment.paymentType || "rent"}`,
            meta: {
                homeLinkPaymentId: String(payment._id),
                homeLinkTransactionId: String(transaction._id)
            }
        };

        // Only add return/callback URLs if they are real https URLs
        const frontendUrl = (process.env.FRONTEND_URL || "").trim();
        if (frontendUrl.startsWith("https://")) {
            payload.return_url = `${frontendUrl}/payments/success?tx_ref=${encodeURIComponent(tx_ref)}`;
        }

        const callbackUrl = (process.env.CHAPA_CALLBACK_URL || "").trim();
        if (callbackUrl.startsWith("https://")) {
            payload.callback_url = callbackUrl;
        }

        console.log("[Chapa Init] Sending to Chapa:", {
            endpoint: `${CHAPA_BASE}/transaction/initialize`,
            tx_ref,
            amount: payload.amount,
            email: payload.email
        });

        const response = await fetch(`${CHAPA_BASE}/transaction/initialize`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${secretKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok || data.status !== "success") {
            transaction.status = "failed";
            transaction.failureReason = data.message || "Chapa initialization failed";
            await transaction.save();

            console.error("[Chapa Init] Failed:", { httpStatus: response.status, body: data });
            return res.status(502).json({
                message: "Could not initialize Chapa checkout.",
                providerMessage: data.message || "Unexpected Chapa response.",
                providerError: data
            });
        }

        const checkoutUrl = data.data?.checkout_url;
        if (!checkoutUrl) {
            transaction.status = "failed";
            transaction.failureReason = "No checkout_url in Chapa response";
            await transaction.save();
            return res.status(502).json({ message: "Chapa did not return a checkout URL." });
        }

        await transaction.save();

        return res.status(200).json({
            message: "Chapa checkout initialized.",
            checkout_url: checkoutUrl,
            tx_ref,
        });

    } catch (error) {
        if (transaction) {
            transaction.status = "failed";
            transaction.failureReason = error.message;
            await transaction.save().catch(() => {});
        }
        console.error("[Chapa Init] Error:", error.message);
        return res.status(500).json({ message: "Could not initialize payment.", error: error.message });
    }
};

// ─── Chapa: Verify & record payment ──────────────────────────────────────────
const verifyChapaPayment = async (req, res) => {
    let session;

    try {
        const { tx_ref } = req.params;
        const userId = String(req.user.id);
        const role = req.user.role;
        const secretKey = process.env.CHAPA_SECRET_KEY;

        if (!secretKey) return res.status(503).json({ message: "Chapa key is not configured." });
        if (!tx_ref) return res.status(400).json({ message: "Payment reference (tx_ref) is required." });

        // Find our transaction record by tx_ref (we store it as merchantReference)
        const transaction = await PaymentTransaction.findOne({
            $or: [
                { merchantReference: tx_ref },
                { chapaReference: tx_ref }
            ]
        });

        if (!transaction) {
            return res.status(404).json({ message: "Payment attempt not found. Make sure you used the correct tx_ref." });
        }

        const payment = await TenantPayment.findById(transaction.paymentId);
        if (!payment) return res.status(404).json({ message: "The invoice for this payment was not found." });

        // Authorization check
        if (role === "tenant" && String(payment.tenantId) !== userId) {
            return res.status(403).json({ message: "You cannot verify another tenant's payment." });
        }
        if (role === "landlord" && String(payment.landlordId) !== userId) {
            return res.status(403).json({ message: "You cannot verify this payment." });
        }

        // Already processed — return cached result (idempotent)
        if (transaction.status === "recorded") {
            const updatedPayment = await TenantPayment.findById(payment._id);
            return res.status(200).json({
                message: "This transaction has already been recorded.",
                tx_ref: transaction.merchantReference,
                payment: updatedPayment
            });
        }

        if (transaction.status === "failed") {
            return res.status(400).json({ message: "This checkout attempt was marked as failed." });
        }

        // ─── Call Chapa v1 transaction verify ────────────────────────────────
        // Chapa v1 endpoint: GET /v1/transaction/verify/{tx_ref}
        // Always use our tx_ref (merchantReference) since that's what we sent in initialize
        const verifyRef = encodeURIComponent(transaction.merchantReference);

        console.log("[Chapa Verify] Calling:", `${CHAPA_BASE}/transaction/verify/${verifyRef}`);

        const response = await fetch(
            `${CHAPA_BASE}/transaction/verify/${verifyRef}`,
            {
                method: "GET",
                headers: { Authorization: `Bearer ${secretKey}` }
            }
        );

        const result = await response.json().catch(() => ({}));

        console.log("[Chapa Verify] Response:", {
            httpStatus: response.status,
            status: result.status,
            data: result.data
        });

        if (!response.ok || result.status !== "success" || !result.data) {
            return res.status(400).json({
                message: "Chapa verification failed.",
                providerMessage: result.message || "Payment not confirmed by Chapa.",
                providerError: result
            });
        }

        const verified = result.data;

        // Chapa returns status as "success" (lowercase) in the data object
        const chapaStatus = String(verified.status || "").toLowerCase();
        if (chapaStatus !== "success") {
            return res.status(400).json({
                message: `Payment not yet completed. Chapa status: ${verified.status}`,
                transactionStatus: verified.status
            });
        }

        // Verify amount — Chapa returns ETB amount as a number
        const verifiedAmountETB = Number(verified.amount);
        const expectedAmountETB = transaction.amountMinorUnits / 100;

        if (Math.abs(verifiedAmountETB - expectedAmountETB) > 1) {
            // Allow 1 ETB tolerance for rounding
            return res.status(400).json({
                message: `Verified amount (${verifiedAmountETB} ETB) does not match expected (${expectedAmountETB} ETB).`
            });
        }

        // ─── Idempotent recording via MongoDB transaction ─────────────────────
        session = await TenantPayment.startSession();
        await session.withTransaction(async () => {
            const currentTx = await PaymentTransaction.findById(transaction._id).session(session);
            if (!currentTx || currentTx.status === "recorded") return; // Already done

            const currentPayment = await TenantPayment.findById(payment._id).session(session);
            if (!currentPayment) throw new Error("Invoice no longer exists.");

            currentPayment.amountPaid = Number(currentPayment.amountPaid || 0) + verifiedAmountETB;
            currentPayment.balance = Math.max(0, Number(currentPayment.amountDue) - currentPayment.amountPaid);
            currentPayment.status = currentPayment.balance === 0 ? "paid" : "partial";
            currentPayment.paidAt = new Date();
            currentPayment.paymentMethod = "chapa";

            currentTx.status = "recorded";
            currentTx.verifiedAt = new Date();
            currentTx.recordedAt = new Date();
            if (verified.reference) currentTx.chapaReference = verified.reference;

            await currentPayment.save({ session });
            await currentTx.save({ session });
        });

        await session.endSession();
        session = null;

        const updatedPayment = await TenantPayment.findById(payment._id);

        await createNotification(
            payment.landlordId, "payment_received", "Online Payment Received",
            `A Chapa payment of ${verifiedAmountETB} ETB was verified.`,
            "TenantPayment", payment._id
        );
        await createNotification(
            payment.tenantId, "payment_received", "Payment Successful",
            `Your Chapa payment of ${verifiedAmountETB} ETB was verified.`,
            "TenantPayment", payment._id
        );

        return res.status(200).json({
            message: "Payment verified and recorded.",
            tx_ref: transaction.merchantReference,
            payment: updatedPayment
        });

    } catch (error) {
        console.error("[Chapa Verify] Error:", error.message);
        return res.status(500).json({ message: "Could not verify payment.", error: error.message });
    } finally {
        if (session) await session.endSession().catch(() => {});
    }
};

const getPayments = async (req, res) => {
    try {
        const userId = req.user.id;
        const role = req.user.role;
        const filter = role === 'tenant' ? { tenantId: userId } : { landlordId: userId };

        const payments = await TenantPayment.find(filter)
            .populate('propertyId', 'title')
            .populate('agreementId', 'startDate endDate')
            .sort({ dueDate: -1 });

        res.status(200).json(payments);
    } catch (error) {
        console.error('[getPayments] Error:', error.message);
        res.status(500).json({ message: 'Server error' });
    }
};

const getPaymentById = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const role = req.user.role;

        const payment = await TenantPayment.findById(id)
            .populate('propertyId', 'title location images')
            .populate('agreementId', 'startDate endDate')
            .populate('tenantId', 'firstName lastName email phone')
            .populate('landlordId', 'firstName lastName email phone');

        if (!payment) return res.status(404).json({ message: "Payment not found" });

        if (role === 'tenant' && payment.tenantId._id.toString() !== userId) {
            return res.status(403).json({ message: "Unauthorized" });
        }
        if (role === 'landlord' && payment.landlordId._id.toString() !== userId) {
            return res.status(403).json({ message: "Unauthorized" });
        }

        res.status(200).json(payment);
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

const sendReminder = async (req, res) => {
    try {
        const { id } = req.params;
        const landlordId = req.user.id;

        const payment = await TenantPayment.findOne({ _id: id, landlordId })
            .populate('propertyId', 'title');
        if (!payment) return res.status(404).json({ message: "Payment not found or unauthorized" });
        if (payment.status === 'paid') return res.status(400).json({ message: "Payment is already paid" });

        payment.remindersSent.push({ sentAt: new Date(), channel: 'in_app' });
        await payment.save();

        await createNotification(
            payment.tenantId, 'rent_overdue', 'Payment Reminder',
            `Friendly reminder: You have an outstanding balance of ${payment.balance} ETB for ${payment.propertyId.title}.`,
            'TenantPayment', payment._id
        );

        res.status(200).json({ message: "Reminder sent successfully", payment });
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

module.exports = {
    generateInvoice,
    recordPayment,
    verifyPayment,
    initializeChapaPayment,
    verifyChapaPayment,
    getPayments,
    getPaymentById,
    sendReminder
};
