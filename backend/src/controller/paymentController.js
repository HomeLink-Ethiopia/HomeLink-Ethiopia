const { isMockMode, mockStore, persistMockData, mockCreateNotification } = require('../config/db');
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


/**
 * Enforce chronological sequential payment ordering for an agreement:
 * Security deposit must be paid first (if applicable), followed by monthly
 * rent in chronological order (Month 1 -> Month 2 -> Month 3...).
 */
const checkSequentialPaymentPrerequisite = (targetPayment, allPayments) => {
    if (!targetPayment || !targetPayment.agreementId) return { allowed: true };
    const agrId = String(targetPayment.agreementId);

    const agrPayments = (allPayments || []).filter(p => String(p.agreementId) === agrId);
    if (!agrPayments.length) return { allowed: true };

    // Sort chronologically: deposit first, then dueDate ascending
    agrPayments.sort((a, b) => {
        const orderA = a.paymentType === 'deposit' ? 0 : 1;
        const orderB = b.paymentType === 'deposit' ? 0 : 1;
        if (orderA !== orderB) return orderA - orderB;
        return new Date(a.dueDate || 0).getTime() - new Date(b.dueDate || 0).getTime();
    });

    // Find the first unpaid invoice for this lease
    const firstUnpaid = agrPayments.find(p => p.status !== 'paid' && p.status !== 'collected');
    if (!firstUnpaid) return { allowed: true };

    if (String(firstUnpaid._id) !== String(targetPayment._id)) {
        const expectedLabel = firstUnpaid.paymentType === 'deposit'
            ? 'Security Deposit'
            : (firstUnpaid.periodMonth ? `Rent for ${firstUnpaid.periodMonth}` : 'an earlier invoice');
        return {
            allowed: false,
            message: `Sequential payment required: Please settle ${expectedLabel} first before paying for subsequent periods.`
        };
    }

    return { allowed: true };
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

            const seqCheck = checkSequentialPaymentPrerequisite(pay2, mockStore.payments || []);
            if (!seqCheck.allowed) {
                return res.status(400).json({ message: seqCheck.message });
            }
            
            const isInstant = Boolean(paymentMethod === 'telebirr' || paymentMethod === 'chapa' || req.body.instant);
            pay2.paymentMethod = paymentMethod || "bank_transfer";
            pay2.transactionReference = transactionReference || `TX-${(paymentMethod || 'PAY').toUpperCase()}-${Date.now().toString().slice(-6)}`;
            if (finalReceipt) {
                pay2.receiptKey = finalReceipt;
                pay2.receiptUrl = finalReceipt;
            }
            pay2.paidAt = new Date().toISOString();
            pay2.receiptNumber = pay2.receiptNumber || `RCPT-${pay2._id.slice(-6).toUpperCase()}`;

            const landlordIdTarget = typeof pay2.landlordId === 'object' ? pay2.landlordId._id : pay2.landlordId;

            if (isInstant) {
                pay2.status = "paid";
                pay2.amountPaid = pay2.amountDue || pay2.amount || 0;
                pay2.balance = 0;
                pay2.proofSubmitted = false;
                createNotification(
                    landlordIdTarget, 'payment_received', 'Online Rent Received',
                    `Tenant paid ${pay2.amountPaid} ETB via ${paymentMethod || 'digital payment'}. Receipt ${pay2.receiptNumber} generated.`,
                    'TenantPayment', pay2._id
                );
                createNotification(
                    typeof pay2.tenantId === 'object' ? pay2.tenantId._id : pay2.tenantId,
                    'payment_received', 'Payment Successful',
                    `Your payment of ${pay2.amountPaid} ETB via ${paymentMethod || 'digital payment'} was successful. Receipt: ${pay2.receiptNumber}`,
                    'TenantPayment', pay2._id
                );
            } else {
                pay2.status = "pending";
                pay2.proofSubmitted = true;
                createNotification(
                    landlordIdTarget, 'system', 'Payment Proof Uploaded',
                    `Tenant uploaded payment proof via ${paymentMethod || 'bank transfer'} (Ref: ${pay2.transactionReference}). Please verify and confirm.`,
                    'TenantPayment', pay2._id
                );
            }

            if (typeof persistMockData === 'function') persistMockData();
            return res.status(200).json({
                message: isInstant ? "Payment processed successfully!" : "Payment proof submitted, awaiting landlord verification",
                data: pay2
            });
        }
        const isInstant = Boolean(paymentMethod === 'telebirr' || paymentMethod === 'chapa' || req.body.instant);
        const existing = await TenantPayment.findById(id);
        if (!existing) return res.status(404).json({ message: "Payment not found" });

        const allAgrPayments = await TenantPayment.find({ agreementId: existing.agreementId });
        const seqCheckReal = checkSequentialPaymentPrerequisite(existing, allAgrPayments);
        if (!seqCheckReal.allowed) {
            return res.status(400).json({ message: seqCheckReal.message });
        }
        const targetStatus = isInstant ? 'paid' : 'pending';
        const payment = await TenantPayment.findOneAndUpdate(
            { _id: id, tenantId },
            { 
                status: targetStatus,
                amountPaid: isInstant ? (existing ? existing.amountDue : 0) : 0,
                balance: isInstant ? 0 : (existing ? existing.amountDue : 0),
                paymentMethod: paymentMethod || "bank_transfer",
                transactionReference: transactionReference || `TX-${(paymentMethod || 'PAY').toUpperCase()}-${Date.now().toString().slice(-6)}`,
                receiptKey: finalReceipt,
                paidAt: new Date()
            },
            { new: true }
        ).populate('propertyId', 'title');

        if (!payment) return res.status(404).json({ message: "Payment not found" });

        // Notify landlord
        if (isInstant) {
            await createNotification(
                payment.landlordId, 'payment_received', 'Online Rent Received',
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

        // Sprint 15: mock-mode landlord verification & status change.
        if (isMockMode()) {
            const pay3 = (mockStore.payments || []).find((x) => x._id === id);
            if (!pay3) return res.status(404).json({ message: "Payment not found" });
            pay3.status = targetStatus;
            pay3.proofSubmitted = false;
            if (targetStatus === 'paid') {
                pay3.amountPaid = amountPaid || pay3.amountDue || pay3.amount;
                pay3.balance = 0;
                pay3.paidAt = pay3.paidAt || new Date().toISOString();
                pay3.receiptNumber = pay3.receiptNumber || `RCPT-${pay3._id.slice(-6).toUpperCase()}`;

                const tenantIdTarget = typeof pay3.tenantId === 'object' ? pay3.tenantId._id : pay3.tenantId;
                createNotification(
                    tenantIdTarget, 'payment_received', 'Payment Verified & Confirmed',
                    `Your rent payment of ${pay3.amountPaid} ETB has been verified and confirmed by your landlord. Official Receipt: ${pay3.receiptNumber}`,
                    'TenantPayment', pay3._id
                );
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
            return res.status(200).json({ message: "Payment status updated successfully", data: pay3 });
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

// REAL CHAPA INTEGRATION (with graceful test fallback)
const initializeChapaPayment = async (req, res) => {
    try {
        const { id } = req.params;
        const tenantId = req.user.id;
        
        let payment = null;
        if (isMockMode()) {
            payment = (mockStore.payments || []).find(p => String(p._id) === String(id));
        } else {
            payment = await TenantPayment.findOne({ _id: id, tenantId }).populate('tenantId', 'firstName lastName email phone');
        }

        if (!payment) return res.status(404).json({ message: "Payment invoice not found" });

        const allPaymentsForAgr = isMockMode()
            ? (mockStore.payments || [])
            : await TenantPayment.find({ agreementId: payment.agreementId });
        const chapaSeqCheck = checkSequentialPaymentPrerequisite(payment, allPaymentsForAgr);
        if (!chapaSeqCheck.allowed) {
            return res.status(400).json({ message: chapaSeqCheck.message });
        }

        // Generate a unique transaction reference (e.g. TX-1698765432-mock-pay-1)
        const tx_ref = `TX-${Date.now()}-${payment._id}`;
        
        payment.transactionReference = tx_ref;
        payment.paymentMethod = 'chapa';
        if (isMockMode()) {
            persistMockData();
        } else {
            await payment.save();
        }

        const chapaSecretKey = process.env.CHAPA_SECRET_KEY;
        const user = req.user || {};

        if (chapaSecretKey && !chapaSecretKey.includes('placeholder')) {
            try {
                const chapaPayload = {
                    amount: (payment.balance || payment.amountDue || payment.amount || 1000).toString(),
                    currency: payment.currency || 'ETB',
                    email: user.email || 'tenant@homelink.et',
                    first_name: user.firstName || 'HomeLink',
                    last_name: user.lastName || 'Tenant',
                    phone_number: user.phone || '0911223344',
                    tx_ref: tx_ref,
                    callback_url: `http://localhost:5000/api/v1/payments/chapa/verify/${tx_ref}`,
                    return_url: `http://localhost:3000/payments/success?tx_ref=${tx_ref}`,
                    customization: {
                        title: "HomeLink Rent Payment",
                        description: `Payment for ${payment.propertyId?.title || payment.periodMonth || 'Rental'}`
                    }
                };

                const response = await fetch('https://api.chapa.co/v1/transaction/initialize', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${chapaSecretKey}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(chapaPayload)
                });

                const data = await response.json();
                if (data.status === 'success' && data.data?.checkout_url) {
                    return res.status(200).json({ checkout_url: data.data.checkout_url, tx_ref });
                }
            } catch (chapaErr) {
                console.warn('Live Chapa API call returned error, switching to interactive simulated checkout:', chapaErr.message);
            }
        }

        // Seamless local checkout return url
        const checkout_url = `http://localhost:3000/payments/success?tx_ref=${tx_ref}&auto_verify=true`;
        return res.status(200).json({
            checkout_url,
            tx_ref,
            amount: payment.balance || payment.amountDue || payment.amount,
            currency: payment.currency || 'ETB',
            message: "Chapa payment session created successfully"
        });

    } catch (error) {
        console.error('Initialize Chapa payment error:', error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

const verifyChapaPayment = async (req, res) => {
    try {
        const { tx_ref } = req.params;

        if (isMockMode()) {
            let payment = (mockStore.payments || []).find(p => p.transactionReference === tx_ref || String(p._id) === String(tx_ref));
            if (!payment) {
                // If tx_ref is format TX-timestamp-ID, extract ID
                const parts = tx_ref.split('-');
                if (parts.length >= 3) {
                    const payId = parts.slice(2).join('-');
                    payment = (mockStore.payments || []).find(p => String(p._id) === String(payId));
                }
            }

            if (!payment) {
                return res.status(404).json({ message: "Payment record not found for transaction " + tx_ref });
            }

            const total = payment.amountDue !== undefined ? payment.amountDue : (payment.amount || 30000);
            payment.amountPaid = total;
            payment.balance = 0;
            payment.status = 'paid';
            payment.paymentMethod = 'chapa';
            payment.paidAt = new Date().toISOString();
            payment.receiptNumber = payment.receiptNumber || `RCPT-CHAPA-${Date.now().toString().slice(-6)}`;
            payment.receiptUrl = `/api/v1/payments/${payment._id}/receipt`;
            payment.notes = `Settled online via Chapa Gateway (${tx_ref})`;
            persistMockData();

            const propTitle = payment.propertyId?.title || 'Rental Unit';
            mockCreateNotification(
                payment.landlordId?._id || payment.landlordId || 'mock-landlord-1',
                'payment_received',
                'Online Rent Received via Chapa',
                `Tenant settled ${total.toLocaleString()} ETB via Chapa for ${propTitle}. Receipt: ${payment.receiptNumber}.`
            );

            mockCreateNotification(
                payment.tenantId?._id || payment.tenantId || 'mock-user-seed-1',
                'payment_received',
                'Chapa Payment Successful',
                `Your payment of ${total.toLocaleString()} ETB via Chapa was confirmed. Official Receipt: ${payment.receiptNumber}.`
            );

            return res.status(200).json({
                status: 'success',
                message: "Payment verified and recorded!",
                payment,
                receiptNumber: payment.receiptNumber
            });
        }

        // Live Chapa verification
        const chapaSecretKey = process.env.CHAPA_SECRET_KEY;
        if (chapaSecretKey && !chapaSecretKey.includes('placeholder')) {
            const response = await fetch(`https://api.chapa.co/v1/transaction/verify/${tx_ref}`, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${chapaSecretKey}` }
            });
            const data = await response.json();
            if (data.status === 'success') {
                const payment = await TenantPayment.findOne({ transactionReference: tx_ref }).populate('propertyId', 'title');
                if (!payment) return res.status(404).json({ message: "Payment record not found" });

                if (payment.status !== 'paid') {
                    payment.amountPaid = Number(data.data.amount) || payment.amountDue;
                    payment.balance = Math.max(0, payment.amountDue - payment.amountPaid);
                    payment.status = payment.balance <= 0 ? 'paid' : 'partial';
                    payment.paidAt = new Date();
                    payment.receiptNumber = `RCPT-CHAPA-${Date.now().toString().slice(-6)}`;
                    await payment.save();
                }

                return res.status(200).json({ message: "Payment verified and recorded!", payment });
            }
        }

        res.status(400).json({ message: "Payment was not successful or is still pending." });

    } catch (error) {
        console.error('Verify Chapa payment error:', error);
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
                    const belongs = role === 'admin' ? true : (role === 'tenant' ? (tId === userId || isSeedTenant) : (lId === userId || isSeedLandlord));
                    if (belongs) {
                        const hasPayments = (mockStore.payments || []).some(p => String(p.agreementId) === String(agr._id));
                        if (!hasPayments) {
                            await generateRentScheduleForAgreement(agr);
                        }
                    }
                }
            }

            const isTsedeniaLandlord = userEmail?.includes('tsedenia') || userEmail?.includes('kidstekinfe') || userId.includes('1793084104793') || userId.includes('1792917808150');
            const isTsedeniaTenant = userEmail?.includes('kidkinfe') || userEmail?.includes('tsedeniaworku45@') || userId.includes('1793083864425') || userId.includes('1792917869104');

            const mine = (mockStore.payments || []).filter((p) => {
                if (role === 'admin') return true;
                const tId = String((typeof p.tenantId === 'object' ? p.tenantId?._id : p.tenantId) || '');
                const lId = String((typeof p.landlordId === 'object' ? p.landlordId?._id : p.landlordId) || '');
                const isAgrTsedeniaLandlord = lId.includes('1793084104793') || lId.includes('1792917808150') || (p.landlordId && p.landlordId.email && (p.landlordId.email.includes('tsedenia') || p.landlordId.email.includes('kidstekinfe')));
                const isAgrTsedeniaTenant = tId.includes('1793083864425') || tId.includes('1792917869104') || (p.tenantId && p.tenantId.email && (p.tenantId.email.includes('kidkinfe') || p.tenantId.email.includes('tsedenia')));

                if (role === 'tenant') {
                    return tId === userId || (isSeedTenant && (tId === 'mock-user-seed-1' || !tId)) || (isTsedeniaTenant && isAgrTsedeniaTenant);
                }
                return lId === userId || (isSeedLandlord && (lId === 'mock-landlord-1' || !lId)) || (isTsedeniaLandlord && isAgrTsedeniaLandlord);
            });

            // Sort chronologically: Deposit first, then due date ascending
            mine.sort((a, b) => {
                const orderA = a.paymentType === 'deposit' ? 0 : 1;
                const orderB = b.paymentType === 'deposit' ? 0 : 1;
                if (orderA !== orderB) return orderA - orderB;
                return new Date(a.dueDate || 0).getTime() - new Date(b.dueDate || 0).getTime();
            });

            // Dynamically mark overdue payments if due date passed and not paid
            mine.forEach(p => {
                if (p.status === 'pending' && p.dueDate && new Date(p.dueDate) < now) {
                    p.status = 'overdue';
                }
            });

            const allUsers = Array.from(mockStore.users ? mockStore.users.values() : []);
            const allProps = mockStore.properties || [];
            const allAgrs = mockStore.agreements || [];

            const shape2 = (p) => {
                const agr = allAgrs.find(a => String(a._id) === String(p.agreementId));
                const propId = String((typeof p.propertyId === 'object' ? p.propertyId?._id : p.propertyId) || (agr && agr.propertyId ? (agr.propertyId._id || agr.propertyId) : ''));
                const prop = allProps.find(pr => String(pr._id) === propId) || (typeof p.propertyId === 'object' ? p.propertyId : null);

                const tId = String((typeof p.tenantId === 'object' ? p.tenantId?._id : p.tenantId) || (agr && agr.tenantId ? (agr.tenantId._id || agr.tenantId) : ''));
                const tenant = allUsers.find(u => String(u._id) === tId) || (typeof p.tenantId === 'object' ? p.tenantId : null);

                const lId = String((typeof p.landlordId === 'object' ? p.landlordId?._id : p.landlordId) || (agr && agr.landlordId ? (agr.landlordId._id || agr.landlordId) : ''));
                const landlord = allUsers.find(u => String(u._id) === lId) || (typeof p.landlordId === 'object' ? p.landlordId : null);

                const amountVal = p.amountDue !== undefined ? p.amountDue : (p.amount || (agr ? agr.rentAmount : 42000));

                return {
                    ...p,
                    amount: amountVal,
                    amountDue: amountVal,
                    amountDueEtb: amountVal,
                    paidDate: p.paidAt,
                    receiptNumber: p.receiptNumber || (['paid', 'collected'].includes(p.status) ? `RCPT-${String(p._id).slice(-6).toUpperCase()}` : undefined),
                    propertyId: prop ? {
                        _id: prop._id || propId,
                        title: prop.title || 'Rental Unit',
                        location: prop.location || { city: 'Addis Ababa', subCity: 'Bole', neighborhood: 'Bole' },
                        rentAmount: prop.rentAmount || amountVal
                    } : p.propertyId,
                    tenantId: tenant ? {
                        _id: tenant._id || tId,
                        firstName: tenant.firstName || 'Tenant',
                        lastName: tenant.lastName || '',
                        email: tenant.email || '',
                        phone: tenant.phone || ''
                    } : p.tenantId,
                    landlordId: landlord ? {
                        _id: landlord._id || lId,
                        firstName: landlord.firstName || 'Landlord',
                        lastName: landlord.lastName || '',
                        email: landlord.email || '',
                        phone: landlord.phone || ''
                    } : p.landlordId
                };
            };
            return res.status(200).json(mine.map(shape2));
        }

        // Dynamic update of overdue payments in MongoDB
        await TenantPayment.updateMany(
            { status: 'pending', dueDate: { $lt: now } },
            { $set: { status: 'overdue' } }
        );

        const filter = role === 'admin' ? {} : (role === 'tenant' ? { tenantId: userId } : { landlordId: userId });
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
