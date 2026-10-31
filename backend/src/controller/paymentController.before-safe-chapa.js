const TenantPayment = require('../models/TenantPayment');
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
        const secretKey = process.env.CHAPA_SECRET_KEY;

        if (!secretKey || !secretKey.startsWith("CHAPA_TEST_")) {
            return res.status(503).json({
                message: "A Chapa test private key is not configured."
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

        if (
            payment.status === "paid" ||
            !Number.isFinite(Number(payment.balance)) ||
            Number(payment.balance) <= 0
        ) {
            return res.status(400).json({
                message: "This invoice has no valid outstanding balance"
            });
        }

        if (!payment.tenantId?.email) {
            return res.status(400).json({
                message: "Your account needs a valid email address"
            });
        }

        // HomeLink stores money in ETB; Chapa v2 expects minor units.
        const amountInMinorUnits = Math.round(Number(payment.balance) * 100);

        if (
            !Number.isSafeInteger(amountInMinorUnits) ||
            amountInMinorUnits < 100
        ) {
            return res.status(400).json({
                message: "The payment amount is invalid for Chapa"
            });
        }

        // Keep merchant_reference at 20 characters or fewer.
        const merchantReference =
            `HL${String(payment._id).slice(-16)}`;

        const frontendUrl = process.env.FRONTEND_URL || "";

        const payload = {
            amount: amountInMinorUnits,
            currency: payment.currency || "ETB",
            merchant_reference: merchantReference,
            customer: {
                first_name: payment.tenantId.firstName || "HomeLink",
                last_name: payment.tenantId.lastName || "Tenant",
                email: payment.tenantId.email,
                ...(payment.tenantId.phone
                    ? { phone_number: payment.tenantId.phone }
                    : {})
            },
            customization: {
                title: "HomeLink Payment",
                description: `Payment for ${payment.paymentType}`
            },
            meta: {
                homeLinkPaymentId: String(payment._id)
            }
        };

        // Chapa's hosted checkout documentation specifies HTTPS URLs.
        if (frontendUrl.startsWith("https://")) {
            payload.return_url =
                `${frontendUrl}/payments/success?reference=` +
                encodeURIComponent(merchantReference);
        }

        if (
            process.env.CHAPA_CALLBACK_URL?.startsWith("https://")
        ) {
            payload.callback_url = process.env.CHAPA_CALLBACK_URL;
        }

        const response = await fetch(
            "https://api.chapa.global/v2/payments/hosted",
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${secretKey}`,
                    "Content-Type": "application/json",
                    "Idempotency-Key": `homelink-payment-${payment._id}`
                },
                body: JSON.stringify(payload)
            }
        );

        const data = await response.json().catch(() => ({}));

        if (
            !response.ok ||
            data.status !== "success" ||
            !data.data?.checkout_url
        ) {
            console.error("Chapa v2 initialization failed:", {
                httpStatus: response.status,
                message: data.message,
                error: data.error?.code
            });

            return res.status(502).json({
                message: "Could not initialize Chapa checkout",
                error: data.message || "Unexpected Chapa response"
            });
        }

        payment.transactionReference = merchantReference;
        payment.paymentMethod = "chapa";
        await payment.save();

        return res.status(200).json({
            message: "Chapa checkout initialized",
            checkout_url: data.data.checkout_url,
            tx_ref: merchantReference
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
        const tenantId = String(req.user.id);
        const role = req.user.role;
        const secretKey = process.env.CHAPA_SECRET_KEY;

        if (!secretKey || !secretKey.startsWith("CHAPA_TEST_")) {
            return res.status(503).json({
                message: "Chapa test key is not configured."
            });
        }

        if (!tx_ref) {
            return res.status(400).json({
                message: "Chapa reference is required."
            });
        }

        // Verify using the Chapa reference, e.g. HCVlYSZdn5Ub.
        const response = await fetch(
            `https://api.chapa.global/v2/payments/${encodeURIComponent(tx_ref)}/verify`,
            {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${secretKey}`
                }
            }
        );

        const result = await response.json().catch(() => ({}));

        if (!response.ok || result.status !== "success" || !result.data) {
            return res.status(502).json({
                message: "Chapa could not verify this transaction.",
                providerMessage: result.message || "Verification failed."
            });
        }

        const verified = result.data;

        if (
            verified.status !== "SUCCESS" ||
            !verified.merchant_reference ||
            !Number.isSafeInteger(Number(verified.amount)) ||
            Number(verified.amount) <= 0
        ) {
            return res.status(400).json({
                message: "Chapa has not confirmed a valid successful payment.",
                transactionStatus: verified.status
            });
        }

        // Resolve the invoice using the merchant reference returned by Chapa.
        const payment = await TenantPayment.findOne({
            transactionReference: verified.merchant_reference
        });

        if (!payment) {
            return res.status(404).json({
                message: "No HomeLink invoice matches this Chapa transaction."
            });
        }

        if (
            role === "tenant" &&
            String(payment.tenantId) !== tenantId
        ) {
            return res.status(403).json({
                message: "You cannot verify another tenant's payment."
            });
        }

        if (
            role === "landlord" &&
            String(payment.landlordId) !== tenantId
        ) {
            return res.status(403).json({
                message: "You cannot verify this payment."
            });
        }

        const verifiedAmountETB = Number(verified.amount) / 100;
        const currency = String(payment.currency || "ETB").toUpperCase();

        if (
            String(verified.currency).toUpperCase() !== currency ||
            Math.round(Number(payment.balance) * 100) !==
                Number(verified.amount)
        ) {
            return res.status(400).json({
                message: "Verified amount or currency does not match the invoice."
            });
        }

        if (payment.status === "paid") {
            return res.status(200).json({
                message: "This invoice has already been marked as paid.",
                payment
            });
        }

        // Record only the verified payment amount.
        payment.amountPaid =
            Number(payment.amountPaid || 0) + verifiedAmountETB;

        payment.balance = Math.max(
            0,
            Number(payment.amountDue) - payment.amountPaid
        );

        payment.status = payment.balance === 0 ? "paid" : "partial";
        payment.paidAt = new Date();
        payment.paymentMethod = "chapa";

        await payment.save();

        await createNotification(
            payment.landlordId,
            "payment_received",
            "Online Payment Received",
            `A Chapa payment of ${verifiedAmountETB} ETB was verified.`,
            "TenantPayment",
            payment._id
        );

        await createNotification(
            payment.tenantId,
            "payment_received",
            "Payment Successful",
            `Your Chapa payment of ${verifiedAmountETB} ETB was verified.`,
            "TenantPayment",
            payment._id
        );

        return res.status(200).json({
            message: "Payment verified and recorded.",
            chapa_reference: verified.chapa_reference,
            merchant_reference: verified.merchant_reference,
            payment
        });
    } catch (error) {
        console.error("Chapa verification error:", error.message);

        return res.status(500).json({
            message: "Could not verify payment."
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
