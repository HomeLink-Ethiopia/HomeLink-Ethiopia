const TenantPayment = require('../models/TenantPayment');
const PaymentTransaction =require("../models/PaymentTransaction");
const RentalAgreement = require('../models/RentalAgreement');
const Notification = require('../models/Notification');

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
                status: 'pending', // Still pending until landlord verifies, unless it's Chapa (handled separately)
                paymentMethod,
                transactionReference,
                receiptKey: receiptFile
            },
            { new: true }
        ).populate('propertyId', 'title');

        if (!payment) return res.status(404).json({ message: "Payment not found" });

        // Notify landlord to verify
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
        const { amountPaid, paymentMethod } = req.body; // Landlord confirms the actual amount they received

        const payment = await TenantPayment.findOne({ _id: id, landlordId }).populate('propertyId', 'title');
        if (!payment) return res.status(404).json({ message: "Payment not found" });

        payment.amountPaid = amountPaid || payment.amountDue;
        payment.balance = payment.amountDue - payment.amountPaid;
        payment.status = payment.balance <= 0 ? 'paid' : 'partial';
        payment.paidAt = new Date();
        
        // If landlord manually specifies it was cash, update it. Otherwise keep the tenant's chosen method (e.g. cbe)
        if (paymentMethod) {
            payment.paymentMethod = paymentMethod;
        }

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

// REAL CHAPA INTEGRATION (using the keys you added to .env)

const initializeChapaPayment = async (req, res) => {
    try {
        const { id } = req.params;
        const tenantId = req.user.id;

        if (!process.env.CHAPA_SECRET_KEY) {
            return res.status(500).json({
                message: "Chapa is not configured on the server"
            });
        }

        const payment = await TenantPayment.findOne({
            _id: id,
            tenantId
        }).populate("tenantId", "firstName lastName email phone");

        if (!payment) {
            return res.status(404).json({
                message: "Payment invoice not found"
            });
        }

        if (payment.status === "paid" || payment.balance <= 0) {
            return res.status(400).json({
                message: "This invoice has no outstanding balance"
            });
        }

        if (!Number.isFinite(payment.balance) || payment.balance <= 0) {
            return res.status(400).json({
                message: "Invalid outstanding payment balance"
            });
        }

        if (!payment.tenantId?.email) {
            return res.status(400).json({
                message: "Your account needs a valid email address"
            });
        }

        // Generate a reference for this checkout attempt.
        const tx_ref = `HL-${payment._id}-${Date.now()}`;

        const chapaPayload = {
            amount: String(payment.balance),
            currency: payment.currency || "ETB",
            email: payment.tenantId.email,
            first_name: payment.tenantId.firstName || "HomeLink",
            last_name: payment.tenantId.lastName || "Tenant",
            tx_ref,
            return_url:
                `${process.env.FRONTEND_URL || "http://localhost:3000"}` +
                `/payments/success?tx_ref=${encodeURIComponent(tx_ref)}`,
            customization: {
                title: "HomeLink Payment",
                description: `Payment for ${payment.paymentType}`
            }
        };

        if (payment.tenantId.phone) {
            chapaPayload.phone_number = payment.tenantId.phone;
        }

        if (process.env.CHAPA_CALLBACK_URL) {
            chapaPayload.callback_url = process.env.CHAPA_CALLBACK_URL;
        }

        const response = await fetch(
            "https://api.chapa.co/v1/transaction/initialize",
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${process.env.CHAPA_SECRET_KEY}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(chapaPayload)
            }
        );

        const data = await response.json();

        if (!response.ok || data.status !== "success" ||
            !data.data?.checkout_url) {
            console.error("Chapa initialization failed:", data.message);

            return res.status(502).json({
                message: "Could not initialize Chapa checkout",
                error: data.message || "Chapa returned an unsuccessful response"
            });
        }

        // Store the reference only after Chapa accepts the initialization.
        payment.transactionReference = tx_ref;
        payment.paymentMethod = "chapa";
        await payment.save();

        return res.status(200).json({
            message: "Chapa checkout initialized",
            checkout_url: data.data.checkout_url,
            tx_ref
        });
    } catch (error) {
        console.error("Chapa initialization error:", error.message);

        return res.status(500).json({
            message: "Could not initialize payment"
        });
    }
};



const verifyChapaPayment = async (req, res) => {
    try {
        const { tx_ref } = req.params;
        const tenantId = req.user.id;
        const role = req.user.role;

        if (!process.env.CHAPA_SECRET_KEY) {
            return res.status(500).json({
                message: "Chapa is not configured on the server"
            });
        }

        if (!tx_ref) {
            return res.status(400).json({
                message: "Transaction reference is required"
            });
        }

        // Find the invoice and make sure this user can access it.
        const payment = await TenantPayment.findOne({
            transactionReference: tx_ref
        }).populate("propertyId", "title");

        if (!payment) {
            return res.status(404).json({
                message: "Payment record not found"
            });
        }

        if (
            role === "tenant" &&
            payment.tenantId.toString() !== tenantId
        ) {
            return res.status(403).json({
                message: "You cannot verify another tenant's payment"
            });
        }

        if (
            role === "landlord" &&
            payment.landlordId.toString() !== tenantId
        ) {
            return res.status(403).json({
                message: "You cannot verify this payment"
            });
        }

        // Ask Chapa for the authoritative transaction status.
        const response = await fetch(
            `https://api.chapa.co/v1/transaction/verify/${encodeURIComponent(tx_ref)}`,
            {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${process.env.CHAPA_SECRET_KEY}`
                }
            }
        );

        const result = await response.json();

        if (!response.ok || result.status !== "success" || !result.data) {
            return res.status(502).json({
                message: "Chapa could not verify this transaction",
                providerMessage: result.message || "Verification failed"
            });
        }

        const verified = result.data;

        // Require the returned transaction reference to match.
        if (verified.tx_ref !== tx_ref) {
            return res.status(400).json({
                message: "Transaction reference mismatch"
            });
        }

        if (String(verified.status).toLowerCase() !== "success") {
            return res.status(400).json({
                message: "Chapa has not confirmed a successful payment",
                transactionStatus: verified.status
            });
        }

        // Amount must equal the outstanding balance that was charged.
        // This basic implementation supports one full checkout per invoice.
        const verifiedAmount = Number(verified.amount);
        const expectedAmount = Number(payment.balance);

        if (
            !Number.isFinite(verifiedAmount) ||
            !Number.isFinite(expectedAmount) ||
            verifiedAmount <= 0 ||
            Math.abs(verifiedAmount - expectedAmount) > 0.001
        ) {
            console.error("Chapa amount mismatch", {
                tx_ref,
                verifiedAmount,
                expectedAmount
            });

            return res.status(400).json({
                message: "Verified amount does not match the invoice balance"
            });
        }

        if (
            String(verified.currency).toUpperCase() !==
            String(payment.currency || "ETB").toUpperCase()
        ) {
            return res.status(400).json({
                message: "Verified currency does not match the invoice"
            });
        }

        // Do not credit the same invoice twice.
        if (payment.status === "paid") {
            return res.status(200).json({
                message: "This invoice has already been marked as paid",
                payment
            });
        }

        // This controller stores one successful full payment per invoice.
        // It does not yet support a transaction ledger for partial payments.
        payment.amountPaid = verifiedAmount;
        payment.balance = Math.max(
            0,
            Number(payment.amountDue) - verifiedAmount
        );
        payment.status = payment.balance === 0 ? "paid" : "partial";
        payment.paidAt = new Date();
        payment.paymentMethod = "chapa";

        await payment.save();

        await createNotification(
            payment.landlordId,
            "payment_received",
            "Online Payment Received",
            `A Chapa payment of ${verifiedAmount} ETB was verified.`,
            "TenantPayment",
            payment._id
        );

        await createNotification(
            payment.tenantId,
            "payment_received",
            "Payment Successful",
            `Your Chapa payment of ${verifiedAmount} ETB was verified.`,
            "TenantPayment",
            payment._id
        );

        return res.status(200).json({
            message: "Payment verified and recorded",
            payment
        });
    } catch (error) {
        console.error("Chapa verification error:", error.message);

        return res.status(500).json({
            message: "Could not verify payment"
        });
    }
};


const getPayments = async (req, res) => {
    try {
        const userId = req.user.id;
        const role = req.user.role;

        const filter =
            role === 'tenant'
                ? { tenantId: userId }
                : { landlordId: userId };

        console.log('[getPayments] role:', role);
        console.log('[getPayments] userId:', userId);
        console.log('[getPayments] filter:', filter);

        const payments = await TenantPayment.find(filter)
            .populate('propertyId', 'title')
            .populate('agreementId', 'startDate endDate')
            .sort({ dueDate: -1 });

        console.log('[getPayments] matched count:', payments.length);

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

        // Security check
        if (role === 'tenant' && payment.tenantId._id.toString() !== userId) return res.status(403).json({ message: "Unauthorized" });
        if (role === 'landlord' && payment.landlordId._id.toString() !== userId) return res.status(403).json({ message: "Unauthorized" });

        res.status(200).json(payment);
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

const sendReminder = async (req, res) => {
    try {
        const { id } = req.params;
        const landlordId = req.user.id;

        const payment = await TenantPayment.findOne({ _id: id, landlordId }).populate('propertyId', 'title');
        if (!payment) return res.status(404).json({ message: "Payment not found or unauthorized" });

        if (payment.status === 'paid') return res.status(400).json({ message: "Payment is already paid" });

        // Record the reminder in the database array
        payment.remindersSent.push({
            sentAt: new Date(),
            channel: 'in_app'
        });
        await payment.save();

        // Send the actual notification to the tenant
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
