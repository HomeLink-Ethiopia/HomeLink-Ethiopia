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
        const userId = req.user.id;
        const role = req.user.role;
        
        const filter = role === 'tenant' ? { tenantId: userId } : { landlordId: userId };
        const payments = await TenantPayment.find(filter)
            .populate('propertyId', 'title')
            .populate('agreementId', 'startDate endDate')
            .sort({ dueDate: -1 });

        res.status(200).json(payments);
    } catch (error) {
        res.status(500).json({ message: "Server error" });
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
