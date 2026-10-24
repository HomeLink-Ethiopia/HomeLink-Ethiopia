const { isMockMode, mockStore, persistMockData } = require('../config/db');
const TenantPayment = require('../models/TenantPayment');
const RentalAgreement = require('../models/RentalAgreement');
const Notification = require('../models/Notification');
const { generateRentScheduleForAgreement } = require('../utils/rentScheduleHelper');

const { isMockMode: s89IsMock, mockCreateNotification: s89Notify } = require('../config/db'); // sprint89-notify-bridge
const createNotification = async (userId, type, title, body, entityType, entityId) => {
    if (s89IsMock && s89IsMock()) { s89Notify(userId, type, title, body, entityType, entityId); return; }
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
        const { paymentMethod, transactionReference, receiptUrl } = req.body;
        const path = require('path');
        const receiptFile = req.file ? `/uploads/${path.basename(req.file.path)}` : null;
        const finalReceipt = receiptFile || receiptUrl || req.body.receiptKey;

        if (!transactionReference && !finalReceipt) {
            return res.status(400).json({ message: "Must provide either a transaction reference code or a receipt image" });
        }

        // Sprint 15: mock-mode payment recording.
        if (isMockMode()) {
            const pay2 = (mockStore.payments || []).find((x) => x._id === id);
            if (!pay2) return res.status(404).json({ message: "Payment not found" });
            pay2.status = "pending";
            pay2.paymentMethod = paymentMethod || "bank_transfer";
            pay2.transactionReference = transactionReference;
            if (finalReceipt) {
                pay2.receiptKey = finalReceipt;
                pay2.receiptUrl = finalReceipt;
            }
            pay2.paidAt = new Date().toISOString();
            pay2.receiptNumber = pay2.receiptNumber || `RCPT-${pay2._id.slice(-6).toUpperCase()}`;
            if (typeof persistMockData === 'function') persistMockData();
            return res.status(200).json({ message: "Payment recorded, awaiting landlord verification", data: pay2 });
        }
        const payment = await TenantPayment.findOneAndUpdate(
            { _id: id, tenantId },
            { 
                status: 'pending', // Still pending until landlord verifies, unless it's Chapa (handled separately)
                paymentMethod: paymentMethod || "bank_transfer",
                transactionReference,
                receiptKey: finalReceipt
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
        const { amountPaid, paymentMethod, status, receiptKey, notes } = req.body;

        const targetStatus = status === 'collected' ? 'paid' : (status || 'paid');

        // Sprint 15: mock-mode landlord verification & status change.
        if (isMockMode()) {
            const pay3 = (mockStore.payments || []).find((x) => x._id === id);
            if (!pay3) return res.status(404).json({ message: "Payment not found" });
            pay3.status = targetStatus;
            if (targetStatus === 'paid') {
                pay3.amountPaid = amountPaid || pay3.amountDue || pay3.amount;
                pay3.balance = 0;
                pay3.paidAt = pay3.paidAt || new Date().toISOString();
                pay3.receiptNumber = pay3.receiptNumber || `RCPT-${pay3._id.slice(-6).toUpperCase()}`;
            } else if (targetStatus === 'pending' || targetStatus === 'overdue') {
                pay3.amountPaid = 0;
                pay3.balance = pay3.amountDue || pay3.amount;
                pay3.paidAt = null;
            }
            if (paymentMethod) pay3.paymentMethod = paymentMethod;
            if (receiptKey) {
                pay3.receiptKey = receiptKey;
                pay3.receiptUrl = receiptKey;
            }
            if (notes !== undefined) pay3.notes = notes;
            if (typeof persistMockData === 'function') persistMockData();
            return res.status(200).json({ message: "Payment status updated", data: pay3 });
        }
        const payment = await TenantPayment.findOne({ _id: id, landlordId }).populate('propertyId', 'title');
        if (!payment) return res.status(404).json({ message: "Payment not found" });

        payment.status = targetStatus;
        if (targetStatus === 'paid') {
            payment.amountPaid = amountPaid || payment.amountDue;
            payment.balance = 0;
            payment.paidAt = payment.paidAt || new Date();
        } else if (targetStatus === 'pending' || targetStatus === 'overdue') {
            payment.amountPaid = 0;
            payment.balance = payment.amountDue;
            payment.paidAt = null;
        }
        if (paymentMethod) payment.paymentMethod = paymentMethod;
        if (receiptKey) payment.receiptKey = receiptKey;
        if (notes !== undefined) payment.notes = notes;

        await payment.save();
        res.status(200).json({ message: "Payment updated successfully", payment });
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

const uploadPaymentReceipt = async (req, res) => {
    try {
        const { id } = req.params;
        const path = require('path');
        if (!req.file) {
            return res.status(400).json({ message: "No receipt file uploaded" });
        }
        const fileUrl = `/uploads/${path.basename(req.file.path)}`;

        if (isMockMode()) {
            const pay = (mockStore.payments || []).find((x) => x._id === id);
            if (!pay) return res.status(404).json({ message: "Payment not found" });
            pay.receiptKey = fileUrl;
            pay.receiptUrl = fileUrl;
            return res.status(200).json({ message: "Receipt uploaded successfully", receiptUrl: fileUrl, data: pay });
        }

        const payment = await TenantPayment.findById(id);
        if (!payment) return res.status(404).json({ message: "Payment not found" });
        payment.receiptKey = fileUrl;
        await payment.save();
        res.status(200).json({ message: "Receipt uploaded successfully", receiptUrl: fileUrl, payment });
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// REAL CHAPA INTEGRATION (using the keys you added to .env)
const initializeChapaPayment = async (req, res) => {
    try {
        const { id } = req.params;
        const tenantId = req.user.id;
        
        const payment = await TenantPayment.findOne({ _id: id, tenantId }).populate('tenantId', 'firstName lastName email phone');
        if (!payment) return res.status(404).json({ message: "Payment invoice not found" });

        // Generate a unique transaction reference (e.g. TX-1698765432-64b1f...)
        const tx_ref = `TX-${Date.now()}-${payment._id}`;
        
        // Save it to the database so we can verify it later
        payment.transactionReference = tx_ref;
        payment.paymentMethod = 'chapa';
        await payment.save();

        const chapaPayload = {
            amount: payment.balance.toString(), // Chapa requires amount as string
            currency: payment.currency,
            email: payment.tenantId.email,
            first_name: payment.tenantId.firstName,
            last_name: payment.tenantId.lastName,
            phone_number: payment.tenantId.phone,
            tx_ref: tx_ref,
            callback_url: `https://webhook.site/placeholder`, // Chapa pings this when done
            return_url: `http://localhost:3000/payments/success?tx_ref=${tx_ref}`, // Where the user goes after paying
            customization: {
                title: "HomeLink Rent Payment",
                description: `Payment for ${payment.paymentType}`
            }
        };

        const response = await fetch('https://api.chapa.co/v1/transaction/initialize', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.CHAPA_SECRET_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(chapaPayload)
        });

        const data = await response.json();
        
        if (data.status === 'success') {
            res.status(200).json({ checkout_url: data.data.checkout_url });
        } else {
            res.status(400).json({ message: "Chapa initialization failed", error: data.message });
        }

    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

const verifyChapaPayment = async (req, res) => {
    try {
        const { tx_ref } = req.params;
        
        const response = await fetch(`https://api.chapa.co/v1/transaction/verify/${tx_ref}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${process.env.CHAPA_SECRET_KEY}`
            }
        });

        const data = await response.json();

        if (data.status === 'success') {
            const payment = await TenantPayment.findOne({ transactionReference: tx_ref }).populate('propertyId', 'title');
            if (!payment) return res.status(404).json({ message: "Payment record not found in our database" });

            // Only update if it wasn't already marked paid by a webhook
            if (payment.status !== 'paid') {
                payment.amountPaid = data.data.amount;
                payment.balance = payment.amountDue - payment.amountPaid;
                payment.status = payment.balance <= 0 ? 'paid' : 'partial';
                payment.paidAt = new Date();
                
                await payment.save();

                // Notify Landlord
                await createNotification(
                    payment.landlordId, 'payment_received', 'Online Rent Received', 
                    `Tenant paid ${payment.amountPaid} ETB online via Chapa for ${payment.propertyId.title}.`, 
                    'TenantPayment', payment._id
                );

                // Notify Tenant (Receipt)
                await createNotification(
                    payment.tenantId, 'payment_received', 'Payment Successful', 
                    `Your online payment of ${payment.amountPaid} ETB via Chapa was successfully verified.`, 
                    'TenantPayment', payment._id
                );
            }

            res.status(200).json({ message: "Payment verified and recorded!", payment });
        } else {
            res.status(400).json({ message: "Payment was not successful or is still pending." });
        }

    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

const getPayments = async (req, res) => {
    try {
        const userId = String(req.user.id || '');
        const role = req.user.role;
        const now = new Date();

        if (isMockMode()) {
            const foundUser = [...mockStore.users.values()].find(u => u._id === userId);
            const userEmail = req.user?.email || foundUser?.email;
            const isSeedLandlord = userEmail === 'dev.landlord@homelink.test';
            const isSeedTenant = userEmail === 'dev.tenant@homelink.test' || userEmail === 'hanna@example.com';

            // Ensure active agreements have their rent schedules generated
            for (const agr of (mockStore.agreements || [])) {
                if (agr.status === 'active') {
                    const tId = String((agr.tenantId && typeof agr.tenantId === 'object' ? agr.tenantId._id : agr.tenantId) || '');
                    const lId = String((agr.landlordId && typeof agr.landlordId === 'object' ? agr.landlordId._id : agr.landlordId) || '');
                    const belongs = role === 'tenant' ? (tId === userId || isSeedTenant) : (lId === userId || isSeedLandlord);
                    if (belongs) {
                        const hasPayments = (mockStore.payments || []).some(p => String(p.agreementId) === String(agr._id));
                        if (!hasPayments) {
                            await generateRentScheduleForAgreement(agr);
                        }
                    }
                }
            }

            const mine = (mockStore.payments || []).filter((p) => {
                const tId = String((typeof p.tenantId === 'object' ? p.tenantId?._id : p.tenantId) || '');
                const lId = String((typeof p.landlordId === 'object' ? p.landlordId?._id : p.landlordId) || '');
                if (role === 'tenant') {
                    return tId === userId || (isSeedTenant && (tId === 'mock-user-seed-1' || !tId));
                }
                return lId === userId || (isSeedLandlord && (lId === 'mock-landlord-1' || !lId));
            });

            // Dynamically mark overdue payments if due date passed and not paid
            mine.forEach(p => {
                if (p.status === 'pending' && p.dueDate && new Date(p.dueDate) < now) {
                    p.status = 'overdue';
                }
            });

            const shape2 = (p) => ({
                ...p,
                amount: p.amountDue,
                amountDueEtb: p.amountDue,
                paidDate: p.paidAt,
                receiptNumber: p.receiptNumber || (['paid', 'collected'].includes(p.status) ? `RCPT-${String(p._id).slice(-6).toUpperCase()}` : undefined),
            });
            return res.status(200).json(mine.map(shape2));
        }

        // Dynamic update of overdue payments in MongoDB
        await TenantPayment.updateMany(
            { status: 'pending', dueDate: { $lt: now } },
            { $set: { status: 'overdue' } }
        );

        const filter = role === 'tenant' ? { tenantId: userId } : { landlordId: userId };
        const payments = await TenantPayment.find(filter)
            .populate('propertyId', 'title location images')
            .populate('agreementId', 'startDate endDate rentAmount depositAmount terms status')
            .populate('tenantId', 'firstName lastName email phone')
            .populate('landlordId', 'firstName lastName email phone')
            .sort({ dueDate: -1 });

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

        // (sprintproposal-remind) FR-08: rent reminders work in mock mode too
        if (isMockMode()) {
            const payR = (mockStore.payments || []).find((x) => x._id === id);
            if (!payR) return res.status(404).json({ message: "Payment not found or unauthorized" });
            if (payR.status === "paid") return res.status(400).json({ message: "Payment is already paid" });
            payR.remindersSent = payR.remindersSent || [];
            payR.remindersSent.push({ sentAt: new Date().toISOString(), channel: "in_app" });
            const tenantIdR = typeof payR.tenantId === "object" ? payR.tenantId._id : payR.tenantId;
            createNotification(tenantIdR, "rent_overdue", "Payment Reminder", "Friendly reminder: you have an outstanding balance of " + (payR.balance || payR.amountDue) + " ETB.", "TenantPayment", payR._id);
            return res.status(200).json({ message: "Reminder sent successfully", data: payR });
        }

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
    sendReminder,
    uploadPaymentReceipt
};
