const { isMockMode, mockStore, persistMockData, mockCreateNotification } = require('../config/db');
const TenantPayment = require('../models/TenantPayment');
const RentalAgreement = require('../models/RentalAgreement');
const Notification = require('../models/Notification');
const crypto = require("crypto");
const PaymentTransaction = require("../models/PaymentTransaction");

// Chapa base URL
const CHAPA_BASE = "https://api.chapa.co/v1";

const createNotification = async (userId, type, title, body, entityType, entityId) => {
    if (isMockMode && isMockMode()) { 
        if (typeof mockCreateNotification === 'function') mockCreateNotification(userId, type, title, body, entityType, entityId); 
        return; 
    }
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
            agreement.tenantId, 'system', 'New Invoice Generated',
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
        const { paymentMethod, transactionReference, receiptUrl } = req.body;
        const path = require('path');
        const receiptFile = req.file ? `/uploads/${path.basename(req.file.path)}` : null;
        const finalReceipt = receiptFile || receiptUrl || req.body.receiptKey;

        if (!transactionReference && !finalReceipt) {
            return res.status(400).json({ message: "Must provide either a transaction reference code or a receipt image" });
        }

        const isInstant = Boolean(paymentMethod === 'telebirr' || paymentMethod === 'chapa' || req.body.instant);
        const existing = await TenantPayment.findById(id);
        if (!existing) return res.status(404).json({ message: "Payment not found" });

        const targetStatus = isInstant ? 'paid' : 'pending';
        
        const payment = await TenantPayment.findOneAndUpdate(
            { _id: id, tenantId },
            { 
                status: targetStatus,
                amountPaid: isInstant ? existing.amountDue : 0,
                balance: isInstant ? 0 : existing.amountDue,
                paymentMethod: paymentMethod || "bank_transfer",
                transactionReference: transactionReference || `TX-${(paymentMethod || 'PAY').toUpperCase()}-${Date.now().toString().slice(-6)}`,
                receiptKey: finalReceipt,
                paidAt: new Date()
            },
            { new: true }
        ).populate('propertyId', 'title');

        if (!payment) return res.status(404).json({ message: "Payment not found" });

        if (isInstant) {
            await createNotification(
                payment.landlordId, 'system', 'Online Rent Received', // ✅ Changed to 'system'
                `Tenant paid ${payment.amountPaid} ETB via ${paymentMethod || 'digital payment'} for ${payment.propertyId.title}.`,
                'TenantPayment', payment._id
            );
        } else {
            await createNotification(
                payment.landlordId, 'system', 'Payment Proof Uploaded',
                `Tenant has uploaded payment proof for ${payment.propertyId.title}. Please verify the receipt or reference code.`,
                'TenantPayment', payment._id
            );
        }

        res.status(200).json({
            message: isInstant ? "Payment processed successfully!" : "Payment proof recorded. Waiting for landlord verification.",
            payment
        });
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

const verifyPayment = async (req, res) => {
    try {
        const { id } = req.params;
        const landlordId = req.user.id;
        const { amountPaid, paymentMethod, status, receiptKey, notes } = req.body;

        const targetStatus = status === 'collected' ? 'paid' : (status || 'paid');
        const payment = await TenantPayment.findOne({ _id: id, landlordId }).populate('propertyId', 'title');
        
        if (!payment) return res.status(404).json({ message: "Payment not found" });

        payment.status = targetStatus;
        if (targetStatus === 'paid') {
            payment.amountPaid = amountPaid || payment.amountDue;
            payment.balance = 0;
            payment.paidAt = payment.paidAt || new Date();
payment.receiptNumber = payment.receiptNumber || `RCPT-${payment._id.toString().slice(-6).toUpperCase()}`;        } else if (targetStatus === 'pending' || targetStatus === 'overdue') {
            payment.amountPaid = 0;
            payment.balance = payment.amountDue;
            payment.paidAt = null;
        }
        
        if (paymentMethod) payment.paymentMethod = paymentMethod;
        if (receiptKey) payment.receiptKey = receiptKey;
        if (notes !== undefined) payment.notes = notes;

        await payment.save();

        if (targetStatus === 'paid') {
             await createNotification(
                payment.tenantId, 'system', 'Payment Verified & Confirmed', // ✅ Changed to 'system'
                `Your rent payment of ${payment.amountPaid} ETB has been verified by your landlord. Receipt: ${payment.receiptNumber}`,
                'TenantPayment', payment._id
            );
        }

        res.status(200).json({ message: "Payment updated successfully", payment });
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

const uploadPaymentReceipt = async (req, res) => {
    try {
        const { id } = req.params;
        const path = require('path');
        if (!req.file) return res.status(400).json({ message: "No receipt file uploaded" });
        
        const fileUrl = `/uploads/${path.basename(req.file.path)}`;
        const payment = await TenantPayment.findById(id);
        if (!payment) return res.status(404).json({ message: "Payment not found" });
        
        payment.receiptKey = fileUrl;
        await payment.save();
        res.status(200).json({ message: "Receipt uploaded successfully", receiptUrl: fileUrl, payment });
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

        if (!secretKey) return res.status(503).json({ message: "Chapa private key is not configured." });

        const payment = await TenantPayment.findOne({ _id: id, tenantId }).populate("tenantId", "firstName lastName email phone");
        if (!payment) return res.status(404).json({ message: "Payment invoice not found." });

        const amountETB = Number(payment.balance);
        const currency = String(payment.currency || "ETB").toUpperCase();

        if (payment.status === "paid" || !Number.isFinite(amountETB) || amountETB <= 0) {
            return res.status(400).json({ message: "This invoice has no valid outstanding balance." });
        }

        const tenant = payment.tenantId;
        if (!tenant?.email) return res.status(400).json({ message: "Your account needs a valid email address to use Chapa." });

        const tx_ref = `HL-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;

        transaction = await PaymentTransaction.create({
            paymentId: payment._id,
            provider: "chapa",
            merchantReference: tx_ref,
            amountMinorUnits: Math.round(amountETB * 100),
            currency,
            status: "pending"
        });

        const payload = {
            amount: String(amountETB),
            currency,
            tx_ref,
            first_name: tenant.firstName || "HomeLink",
            last_name: tenant.lastName || "Tenant",
            email: tenant.email,
            ...(tenant.phone ? { phone_number: String(tenant.phone) } : {}),
            title: "HomeLink Rent Payment",
            description: `Payment for ${payment.paymentType || "rent"}`
        };

        const response = await fetch(`${CHAPA_BASE}/transaction/initialize`, {
            method: "POST",
            headers: { Authorization: `Bearer ${secretKey}`, "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok || data.status !== "success") {
            transaction.status = "failed";
            await transaction.save();
            return res.status(502).json({ message: "Could not initialize Chapa checkout.", providerMessage: data.message });
        }

        transaction.chapaReference = data.data?.tx_ref;
        await transaction.save();

        return res.status(200).json({ message: "Chapa checkout initialized.", checkout_url: data.data?.checkout_url, tx_ref });

    } catch (error) {
        if (transaction) { transaction.status = "failed"; await transaction.save().catch(() => {}); }
        return res.status(500).json({ message: "Could not initialize payment.", error: error.message });
    }
};

// ─── Chapa: Verify & record payment ──────────────────────────────────────────
const verifyChapaPayment = async (req, res) => {
    try {
        const { tx_ref } = req.params;
        const secretKey = process.env.CHAPA_SECRET_KEY;

        if (!secretKey) return res.status(503).json({ message: "Chapa key is not configured." });

        const transaction = await PaymentTransaction.findOne({ merchantReference: tx_ref });
        if (!transaction) return res.status(404).json({ message: "Payment attempt not found." });

        if (transaction.status === "recorded") {
            return res.status(200).json({ message: "This transaction has already been recorded." });
        }

        const response = await fetch(`${CHAPA_BASE}/transaction/verify/${tx_ref}`, {
            method: "GET",
            headers: { Authorization: `Bearer ${secretKey}` }
        });

        const result = await response.json().catch(() => ({}));
        if (!response.ok || result.status !== "success" || !result.data) {
            return res.status(400).json({ message: "Chapa verification failed.", providerMessage: result.message });
        }

        const verified = result.data;
        if (String(verified.status).toLowerCase() !== "success") {
            return res.status(400).json({ message: `Payment not yet completed. Status: ${verified.status}` });
        }

        const verifiedAmountETB = Number(verified.amount);
        const payment = await TenantPayment.findById(transaction.paymentId);
        
        if (payment) {
            payment.amountPaid = Number(payment.amountPaid || 0) + verifiedAmountETB;
            payment.balance = Math.max(0, Number(payment.amountDue) - payment.amountPaid);
            payment.status = payment.balance === 0 ? "paid" : "partial";
            payment.paidAt = new Date();
            payment.paymentMethod = "chapa";
            await payment.save();

            // Notify Landlord that they got paid
            await createNotification(
                payment.landlordId, 'system', 'Online Payment Received',
                `A Chapa payment of ${verifiedAmountETB} ETB was received for your property.`,
                'TenantPayment', payment._id
            );
        }

        transaction.status = "recorded";
        await transaction.save();

        return res.status(200).json({ message: "Payment verified and recorded.", payment });

    } catch (error) {
        return res.status(500).json({ message: "Could not verify payment.", error: error.message });
    }
};

const getPayments = async (req, res) => {
    try {
        const userId = req.user.id;
        const role = req.user.role;

        // Build the filter safely
        const filter = role === 'admin' ? {} : (role === 'tenant' ? { tenantId: userId } : { landlordId: userId });

        const payments = await TenantPayment.find(filter)
            .populate('propertyId', 'title location images')
            .populate('tenantId', 'firstName lastName email phone')
            .populate('landlordId', 'firstName lastName email phone')
            .sort({ createdAt: -1 });

        res.status(200).json(payments);
        
    } catch (error) {
        console.error("getPayments error:", error);
        res.status(500).json({ message: "Server error", error: error.message });
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

        payment.remindersSent.push({ sentAt: new Date(), channel: 'in_app' });
        await payment.save();

        await createNotification(
            payment.tenantId, 'system', 'Payment Reminder',
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
    sendReminder,
    uploadPaymentReceipt
};