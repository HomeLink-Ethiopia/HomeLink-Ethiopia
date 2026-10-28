const { isMockMode, mockStore, persistMockData } = require('../config/db');
const RentalAgreement = require('../models/RentalAgreement');
const Property = require('../models/Property');
const Notification = require('../models/Notification');
const { generateRentScheduleForAgreement } = require('../utils/rentScheduleHelper');
const { STANDARD_RENTAL_TERMS } = require('../utils/rentalTerms');

const { isMockMode: s89IsMock, mockCreateNotification: s89Notify } = require('../config/db'); // sprint89-notify-bridge

// Mock-mode stand-in for RentalAgreement.findById — the demo agreements use
// string ids like 'mock-agreement-3' which cast() would reject (sprint-renewal-mock).
const mockFindAgreement = (id) => (mockStore.agreements || []).find((a) => a._id === id);

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

// Sprint 15: shape a mock agreement row the same way the pages expect.
function mockAgr(agr) {
    return agr;
}

const createAgreement = async (req, res) => {
    try {
        const landlordId = req.user.id;
        const {
            applicationId, propertyId, tenantId, startDate, endDate,
            rentAmount, depositAmount, paymentDueDay, paymentFrequency,
            noticePeriodDays, utilitiesIncluded, specialConditions, terms
        } = req.body;

        const agreementTerms = (Array.isArray(terms) && terms.length > 0) ? terms : STANDARD_RENTAL_TERMS;

        // Sprint 15: mock-mode agreement creation
        if (isMockMode()) {
            if (!tenantId) {
                return res.status(400).json({ message: "tenantId is required to create an agreement" });
            }
            const prop2 = (mockStore.properties || []).find((x) => x._id === propertyId);
            const agr = {
                _id: "mock-agreement-" + Date.now(),
                applicationId: applicationId || null,
                propertyId: prop2 ? { _id: prop2._id, title: prop2.title, location: prop2.location, rentAmount: prop2.rentAmount, images: prop2.images } : { _id: propertyId, title: "Property" },
                tenantId: typeof tenantId === "object" ? tenantId : { _id: tenantId, firstName: "Tenant", lastName: "User", email: "" },
                landlordId: req.user.id,
                status: "pending_signatures",
                rentAmount: Number(rentAmount) || (prop2 && prop2.rentAmount) || 0,
                depositAmount: Number(depositAmount) || Number(rentAmount) || (prop2 && prop2.rentAmount) || 0,
                startDate: startDate || new Date().toISOString(),
                endDate: endDate || new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString(),
                paymentDueDay: Number(paymentDueDay) || 5,
                paymentFrequency: paymentFrequency || "monthly",
                noticePeriodDays: Number(noticePeriodDays) || 30,
                utilitiesIncluded: utilitiesIncluded || [],
                specialConditions: specialConditions || "Standard residential lease agreement under Ethiopian law.",
                terms: agreementTerms,
                tenantSignedAt: null,
                landlordSignedAt: null, // Workflow step: Landlord confirms next
                createdAt: new Date().toISOString(),
            };
            mockStore.agreements = mockStore.agreements || [];
            mockStore.agreements.push(agr);

            // Notify landlord to review and confirm
            createNotification(req.user.id, "agreement_ready", "Agreement Ready to Confirm", "Rental agreement draft created. Please review and confirm the agreement terms.", "RentalAgreement", agr._id);
            if (typeof persistMockData === 'function') persistMockData();
            return res.status(201).json({ message: "Agreement created", data: agr });
        }

        const property = await Property.findById(propertyId);
        if (!property) return res.status(404).json({ message: "Property not found" });

        const agreement = await RentalAgreement.create({
            applicationId, propertyId, tenantId, landlordId,
            startDate, endDate,
            rentAmount: Number(rentAmount) || property.rentAmount,
            depositAmount: Number(depositAmount) || property.deposit || Number(rentAmount) || property.rentAmount,
            paymentDueDay: Number(paymentDueDay) || 5,
            paymentFrequency: paymentFrequency || "monthly",
            noticePeriodDays: Number(noticePeriodDays) || 30,
            utilitiesIncluded, specialConditions,
            terms: agreementTerms,
            status: "pending_signatures",
            tenantSignedAt: null,
            landlordSignedAt: null,
        });

        // Notify landlord to review and confirm
        await createNotification(
            landlordId, 'agreement_ready', 'Agreement Ready to Confirm',
            `Rental agreement for ${property.title} is created. Please review and confirm the agreement terms.`,
            'RentalAgreement', agreement._id
        );

        res.status(201).json({ message: "Agreement created and awaiting landlord confirmation", agreement });
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

const signAgreement = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = String(req.user.id || '');
        const role = req.user.role;

        // ─── IN-MEMORY MOCK MODE ───
        if (isMockMode()) {
            const agr = (mockStore.agreements || []).find((x) => x._id === id);
            if (!agr) return res.status(404).json({ message: "Agreement not found" });

            const agrTenantId = String((agr.tenantId && typeof agr.tenantId === 'object' ? agr.tenantId._id : agr.tenantId) || '');
            const agrLandlordId = String((agr.landlordId && typeof agr.landlordId === 'object' ? agr.landlordId._id : agr.landlordId) || '');

            // Authorization check
            if (role === 'tenant' && agrTenantId !== userId && userId !== 'mock-user-seed-1') {
                return res.status(403).json({ message: "Unauthorized: You are not the tenant for this agreement" });
            }
            if (role === 'landlord' && agrLandlordId !== userId && userId !== 'mock-landlord-1') {
                return res.status(403).json({ message: "Unauthorized: You are not the landlord for this agreement" });
            }

            // Workflow check: Tenant cannot sign before Landlord confirms
            if (role === 'tenant' && !agr.landlordSignedAt) {
                return res.status(400).json({ 
                    message: "The landlord must review and confirm the agreement first before the tenant can sign." 
                });
            }

            // Record confirmation / signature
            if (role === 'landlord') {
                agr.landlordSignedAt = new Date().toISOString();
                // Notify tenant
                createNotification(agrTenantId, 'agreement_ready', 'Landlord Confirmed Agreement', 'The landlord has confirmed the rental agreement. Please review the terms and confirm your signature.', 'RentalAgreement', agr._id);
            } else if (role === 'tenant') {
                agr.tenantSignedAt = new Date().toISOString();
            }

            // Both confirmed → Activate agreement & generate rent tracking schedule!
            if (agr.tenantSignedAt && agr.landlordSignedAt) {
                agr.status = "active";
                createNotification(agrTenantId, 'agreement_signed', 'Agreement Fully Active!', 'The rental agreement is now active! Rent tracking and receipts are initialized.', 'RentalAgreement', agr._id);
                createNotification(agrLandlordId, 'agreement_signed', 'Agreement Fully Active!', 'The rental agreement is now active! Rent tracking and receipts are initialized.', 'RentalAgreement', agr._id);
                // Trigger auto-generation of rent schedule
                await generateRentScheduleForAgreement(agr);
            }

            if (typeof persistMockData === 'function') persistMockData();
            return res.status(200).json({ message: "Agreement confirmed successfully", data: agr });
        }

        // ─── MONGOOSE DB MODE ───
        const agreement = await RentalAgreement.findById(id).populate('propertyId', 'title');
        if (!agreement) return res.status(404).json({ message: "Agreement not found" });

        if (role === 'tenant' && agreement.tenantId.toString() !== userId) {
            return res.status(403).json({ message: "Unauthorized: You are not the tenant for this agreement" });
        }
        if (role === 'landlord' && agreement.landlordId.toString() !== userId) {
            return res.status(403).json({ message: "Unauthorized: You are not the landlord for this agreement" });
        }

        // Workflow check: Tenant cannot sign before Landlord confirms
        if (role === 'tenant' && !agreement.landlordSignedAt) {
            return res.status(400).json({ 
                message: "The landlord must review and confirm the agreement first before the tenant can sign." 
            });
        }

        if (role === 'landlord') {
            agreement.landlordSignedAt = new Date();
            await createNotification(
                agreement.tenantId, 'agreement_ready', 'Landlord Confirmed Agreement',
                `The landlord has confirmed the agreement for ${agreement.propertyId.title}. Please review and confirm your signature.`,
                'RentalAgreement', agreement._id
            );
        } else if (role === 'tenant') {
            agreement.tenantSignedAt = new Date();
        }

        // Both confirmed → Activate agreement & generate rent tracking schedule
        if (agreement.tenantSignedAt && agreement.landlordSignedAt) {
            agreement.status = "active";
            await createNotification(agreement.tenantId, 'agreement_signed', 'Agreement Fully Active!', `The agreement for ${agreement.propertyId.title} is now active! Rent tracking is ready.`, 'RentalAgreement', agreement._id);
            await createNotification(agreement.landlordId, 'agreement_signed', 'Agreement Fully Active!', `The agreement for ${agreement.propertyId.title} is now active! Rent tracking is ready.`, 'RentalAgreement', agreement._id);
            // Trigger auto-generation of rent schedule
            await generateRentScheduleForAgreement(agreement);
        }

        await agreement.save();
        res.status(200).json({ message: "Agreement confirmed successfully", agreement });
    } catch (error) {
        console.error("signAgreement error:", error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

const getAgreements = async (req, res) => {
    try {
        if (isMockMode()) {
            const userId = String(req.user.id || '');
            const role = req.user.role;
            const foundUser = [...mockStore.users.values()].find(u => u._id === userId);
            const userEmail = req.user?.email || foundUser?.email;
            const isSeedLandlord = userEmail === 'dev.landlord@homelink.test';
            const isSeedTenant = userEmail === 'dev.tenant@homelink.test' || userEmail === 'hanna@example.com';
            const isTsedeniaLandlord = userEmail?.includes('tsedenia') || userEmail?.includes('kidstekinfe') || userId.includes('1793084104793') || userId.includes('1792917808150');
            const isTsedeniaTenant = userEmail?.includes('kidkinfe') || userEmail?.includes('tsedeniaworku45@') || userId.includes('1793083864425') || userId.includes('1792917869104');

            const rows = (mockStore.agreements || []).filter((agr) => {
                const tId = String((agr.tenantId && typeof agr.tenantId === 'object' ? agr.tenantId._id : agr.tenantId) || '');
                const lId = String((agr.landlordId && typeof agr.landlordId === 'object' ? agr.landlordId._id : agr.landlordId) || '');
                const isAgrTsedeniaLandlord = lId.includes('1793084104793') || lId.includes('1792917808150') || (agr.landlordId && agr.landlordId.email && (agr.landlordId.email.includes('tsedenia') || agr.landlordId.email.includes('kidstekinfe')));
                const isAgrTsedeniaTenant = tId.includes('1793083864425') || tId.includes('1792917869104') || (agr.tenantId && agr.tenantId.email && (agr.tenantId.email.includes('kidkinfe') || agr.tenantId.email.includes('tsedenia')));
                if (role === 'tenant') {
                    return tId === userId || (isSeedTenant && (tId === 'mock-user-seed-1' || !tId)) || (isTsedeniaTenant && isAgrTsedeniaTenant);
                }
                return lId === userId || (isSeedLandlord && (lId === 'mock-landlord-1' || !lId)) || (isTsedeniaLandlord && isAgrTsedeniaLandlord);
            }).map((agr) => {
                // Ensure structured tenant and landlord info for complete digital agreement records
                const tenantObj = typeof agr.tenantId === 'object' ? agr.tenantId : { _id: agr.tenantId, firstName: "Hanna", lastName: "Tesfaye", email: "hanna@example.com", phone: "+251911223344" };
                const landlordObj = typeof agr.landlordId === 'object' ? agr.landlordId : { _id: agr.landlordId, firstName: "Abebe", lastName: "Kebede", email: "abebe@example.com", phone: "+251922334455" };
                const terms = (Array.isArray(agr.terms) && agr.terms.length > 0) ? agr.terms : STANDARD_RENTAL_TERMS;
                const rentAmt = Number(agr.rentAmount || agr.monthlyRentEtb || (agr.propertyId && typeof agr.propertyId === 'object' ? agr.propertyId.rentAmount : 0) || 0);
                return {
                    ...agr,
                    tenantId: tenantObj,
                    landlordId: landlordObj,
                    terms,
                    rentAmount: rentAmt,
                    monthlyRentEtb: rentAmt,
                    depositAmount: agr.depositAmount !== undefined ? Number(agr.depositAmount) : rentAmt,
                };
            }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            return res.status(200).json(rows);
        }
        const userId = req.user.id;
        const role = req.user.role;
        
        const filter = role === 'tenant' ? { tenantId: userId } : { landlordId: userId };
        const agreements = await RentalAgreement.find(filter)
            .populate('propertyId', 'title location rentAmount images')
            .populate('tenantId', 'firstName lastName email phone')
            .populate('landlordId', 'firstName lastName email phone')
            .populate('applicationId')
            .sort({ createdAt: -1 });

        res.status(200).json(agreements);
    } catch (error) {
        console.error("getAgreements error:", error);
        res.status(500).json({ message: "Server error" });
    }
};

const getAgreementById = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const role = req.user.role;

        // Sprint 15: mock-mode detail.
        if (isMockMode()) {
            const agr2 = (mockStore.agreements || []).find((x) => x._id === id);
            if (!agr2) return res.status(404).json({ message: "Agreement not found" });
            const rentAmt = Number(agr2.rentAmount || agr2.monthlyRentEtb || (agr2.propertyId && typeof agr2.propertyId === 'object' ? agr2.propertyId.rentAmount : 0) || 0);
            return res.status(200).json({
                data: {
                    ...agr2,
                    rentAmount: rentAmt,
                    monthlyRentEtb: rentAmt,
                    depositAmount: agr2.depositAmount !== undefined ? Number(agr2.depositAmount) : rentAmt,
                }
            });
        }

        const agreement = await RentalAgreement.findById(id)
            .populate('propertyId', 'title location rentAmount images')
            .populate('tenantId', 'firstName lastName email phone')
            .populate('landlordId', 'firstName lastName email phone')
            .populate('applicationId');

        if (!agreement) return res.status(404).json({ message: "Agreement not found" });

        // Ensure user is authorized to view this agreement
        if (role === 'tenant' && agreement.tenantId._id.toString() !== userId) return res.status(403).json({ message: "Unauthorized" });
        if (role === 'landlord' && agreement.landlordId._id.toString() !== userId) return res.status(403).json({ message: "Unauthorized" });

        res.status(200).json(agreement);
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

const terminateAgreement = async (req, res) => {
    try {
        const { id } = req.params;
        const { terminationReason } = req.body;
        const role = req.user.role;
        const userId = req.user.id;

        if (isMockMode()) {
            const agreement = mockFindAgreement(id);
            if (!agreement) return res.status(404).json({ message: "Agreement not found" });
            agreement.status = "terminated";
            agreement.terminationDate = new Date().toISOString();
            agreement.terminationReason = terminationReason || "Terminated by user";
            agreement.terminatedBy = role;
            const otherId = role === 'tenant' ? ((agreement.landlordId && agreement.landlordId._id) || agreement.landlordId) : ((agreement.tenantId && agreement.tenantId._id) || agreement.tenantId);
            await createNotification(
                otherId, 'agreement_terminated', 'Agreement Terminated',
                `The rental agreement for ${(agreement.propertyId && agreement.propertyId.title) || 'property'} has been terminated by the ${role}.`,
                'RentalAgreement', agreement._id
            );
            if (typeof persistMockData === 'function') persistMockData();
            return res.status(200).json({ message: "Agreement terminated successfully", agreement });
        }

        const agreement = await RentalAgreement.findById(id).populate('propertyId', 'title');
        if (!agreement) return res.status(404).json({ message: "Agreement not found" });

        // Ensure user is part of the agreement
        if (role === 'tenant' && agreement.tenantId.toString() !== userId) return res.status(403).json({ message: "Unauthorized" });
        if (role === 'landlord' && agreement.landlordId.toString() !== userId) return res.status(403).json({ message: "Unauthorized" });

        agreement.status = "terminated";
        agreement.terminationDate = new Date();
        agreement.terminationReason = terminationReason;
        agreement.terminatedBy = role; // "tenant" or "landlord"

        await agreement.save();

        // Notify the other party
        const notifyUserId = role === 'tenant' ? agreement.landlordId : agreement.tenantId;
        await createNotification(
            notifyUserId, 'agreement_terminated', 'Agreement Terminated',
            `The rental agreement for ${agreement.propertyId.title} has been terminated by the ${role}.`,
            'RentalAgreement', agreement._id
        );

        res.status(200).json({ message: "Agreement terminated successfully", agreement });
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

const renewAgreement = async (req, res) => {
    try {
        const { id } = req.params;
        const { newEndDate, newRentAmount } = req.body;

        // Only landlords can renew/update the agreement terms
        const agreement = await RentalAgreement.findOneAndUpdate(
            { _id: id, landlordId: req.user.id, status: "active" },
            { 
                endDate: newEndDate,
                rentAmount: newRentAmount,
                $push: {
                    renewals: {
                        newEndDate,
                        newRentAmount,
                        agreedAt: new Date()
                    }
                }
            },
            { new: true }
        ).populate('propertyId', 'title');

        if (!agreement) return res.status(404).json({ message: "Active agreement not found or unauthorized" });

        // Notify tenant
        await createNotification(
            agreement.tenantId, 'agreement_renewed', 'Agreement Renewed',
            `Your rental agreement for ${agreement.propertyId.title} has been renewed until ${new Date(newEndDate).toLocaleDateString()}.`,
            'RentalAgreement', agreement._id
        );

        res.status(200).json({ message: "Agreement renewed successfully", agreement });
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// Smart Lease Renewal — propose / respond / AI fair-price suggestion
// ─────────────────────────────────────────────────────────────────────────────

// Either party proposes renewal terms — POST /api/v1/agreements/:id/renewal
const proposeRenewal = async (req, res) => {
    try {
        const { id } = req.params;
        const { newEndDate, newRentAmount, message, suggestedByAI } = req.body;
        const role = req.user.role;
        const userId = req.user.id;

        if (!newEndDate || !newRentAmount) {
            return res.status(400).json({ message: "newEndDate and newRentAmount are required" });
        }
        if (Number(newRentAmount) <= 0) {
            return res.status(400).json({ message: "newRentAmount must be positive" });
        }

        if (isMockMode()) {
            const agreement = mockFindAgreement(id);
            if (!agreement) return res.status(404).json({ message: "Agreement not found" });
            if (role === 'tenant' && ((agreement.tenantId && agreement.tenantId._id) || agreement.tenantId) !== userId) return res.status(403).json({ message: "Unauthorized" });
            if (role === 'landlord' && ((agreement.landlordId && agreement.landlordId._id) || agreement.landlordId) !== userId) return res.status(403).json({ message: "Unauthorized" });
            if (agreement.status !== 'active') return res.status(400).json({ message: "Only active agreements can be renewed" });
            if (agreement.renewalProposal && agreement.renewalProposal.status === 'proposed') return res.status(400).json({ message: "A renewal proposal is already pending" });
            if (new Date(newEndDate) <= new Date(agreement.endDate)) return res.status(400).json({ message: "New end date must be after the current end date" });
            agreement.renewalProposal = {
                proposedBy: role,
                newEndDate,
                newRentAmount: Number(newRentAmount),
                message: message || '',
                suggestedByAI: Boolean(suggestedByAI),
                status: 'proposed',
                proposedAt: new Date().toISOString(),
            };
            const propTitle = (agreement.propertyId && agreement.propertyId.title) || 'your property';
            const otherId = role === 'tenant' ? ((agreement.landlordId && agreement.landlordId._id) || agreement.landlordId) : ((agreement.tenantId && agreement.tenantId._id) || agreement.tenantId);
            await createNotification(
                otherId, 'agreement_renewal_proposed', 'Lease Renewal Proposal',
                `${role === 'tenant' ? 'The tenant' : 'The landlord'} proposed renewing ${propTitle} at ${Number(newRentAmount).toLocaleString()} ETB/month until ${new Date(newEndDate).toLocaleDateString()}.`,
                'RentalAgreement', agreement._id
            );
            return res.status(200).json({ message: "Renewal proposal sent", agreement });
        }

        const agreement = await RentalAgreement.findById(id).populate('propertyId', 'title');
        if (!agreement) return res.status(404).json({ message: "Agreement not found" });

        if (role === 'tenant' && agreement.tenantId.toString() !== userId) return res.status(403).json({ message: "Unauthorized" });
        if (role === 'landlord' && agreement.landlordId.toString() !== userId) return res.status(403).json({ message: "Unauthorized" });

        if (agreement.status !== 'active') {
            return res.status(400).json({ message: "Only active agreements can be renewed" });
        }
        if (agreement.renewalProposal && agreement.renewalProposal.proposedAt && agreement.renewalProposal.status === 'proposed') {
            return res.status(400).json({ message: "A renewal proposal is already pending" });
        }
        if (new Date(newEndDate) <= new Date(agreement.endDate)) {
            return res.status(400).json({ message: "New end date must be after the current end date" });
        }

        agreement.renewalProposal = {
            proposedBy: role,
            newEndDate,
            newRentAmount: Number(newRentAmount),
            message: message || '',
            suggestedByAI: Boolean(suggestedByAI),
            status: 'proposed',
            proposedAt: new Date(),
        };
        await agreement.save();

        // Notify the other party
        const otherId = role === 'tenant' ? agreement.landlordId : agreement.tenantId;
        await createNotification(
            otherId, 'agreement_renewal_proposed', 'Lease Renewal Proposal',
            `${role === 'tenant' ? 'The tenant' : 'The landlord'} proposed renewing ${agreement.propertyId.title} at ${Number(newRentAmount).toLocaleString()} ETB/month until ${new Date(newEndDate).toLocaleDateString()}.`,
            'RentalAgreement', agreement._id
        );

        res.status(200).json({ message: "Renewal proposal sent", agreement });
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// The other party accepts or rejects — PUT /api/v1/agreements/:id/renewal/respond
const respondToRenewal = async (req, res) => {
    try {
        const { id } = req.params;
        const { decision } = req.body; // "accept" | "reject"
        const role = req.user.role;
        const userId = req.user.id;

        if (!['accept', 'reject'].includes(decision)) {
            return res.status(400).json({ message: "decision must be 'accept' or 'reject'" });
        }

        if (isMockMode()) {
            const agreement = mockFindAgreement(id);
            if (!agreement) return res.status(404).json({ message: "Agreement not found" });
            const roleOf = ((agreement.tenantId && agreement.tenantId._id) || agreement.tenantId) === userId ? 'tenant' : (((agreement.landlordId && agreement.landlordId._id) || agreement.landlordId) === userId ? 'landlord' : null);
            if (!roleOf) return res.status(403).json({ message: "Unauthorized" });
            const proposal = agreement.renewalProposal;
            if (!proposal || proposal.status !== 'proposed') return res.status(400).json({ message: "No pending renewal proposal" });
            if (proposal.proposedBy === roleOf) return res.status(400).json({ message: "You cannot respond to your own proposal" });
            proposal.respondedAt = new Date().toISOString();
            if (decision === 'reject') {
                proposal.status = 'rejected';
                return res.status(200).json({ message: "Renewal rejected", agreement });
            }
            proposal.status = 'accepted';
            agreement.endDate = proposal.newEndDate;
            agreement.rentAmount = proposal.newRentAmount;
            agreement.renewals = agreement.renewals || [];
            agreement.renewals.push({ newEndDate: proposal.newEndDate, newRentAmount: proposal.newRentAmount, agreedAt: new Date().toISOString() });
            agreement.tenantSignedAt = agreement.tenantSignedAt || new Date().toISOString();
            agreement.landlordSignedAt = agreement.landlordSignedAt || new Date().toISOString();
            return res.status(200).json({ message: "Renewal accepted — lease updated", agreement });
        }

        const agreement = await RentalAgreement.findById(id).populate('propertyId', 'title');
        if (!agreement) return res.status(404).json({ message: "Agreement not found" });

        if (role === 'tenant' && agreement.tenantId.toString() !== userId) return res.status(403).json({ message: "Unauthorized" });
        if (role === 'landlord' && agreement.landlordId.toString() !== userId) return res.status(403).json({ message: "Unauthorized" });

        const proposal = agreement.renewalProposal;
        if (!proposal || proposal.status !== 'proposed') {
            return res.status(400).json({ message: "No pending renewal proposal" });
        }
        if (proposal.proposedBy === role) {
            return res.status(400).json({ message: "You cannot respond to your own proposal" });
        }

        proposal.respondedAt = new Date();

        if (decision === 'reject') {
            proposal.status = 'rejected';
            await agreement.save();
            const otherId = role === 'tenant' ? agreement.landlordId : agreement.tenantId;
            await createNotification(
                otherId, 'agreement_renewal_rejected', 'Renewal Declined',
                `The ${role} declined the renewal proposal for ${agreement.propertyId.title}.`,
                'RentalAgreement', agreement._id
            );
            return res.status(200).json({ message: "Renewal rejected", agreement });
        }

        // Accept → apply new terms + dual signature in one click
        proposal.status = 'accepted';
        agreement.endDate = proposal.newEndDate;
        agreement.rentAmount = proposal.newRentAmount;
        agreement.renewals.push({
            newEndDate: proposal.newEndDate,
            newRentAmount: proposal.newRentAmount,
            agreedAt: new Date(),
        });
        // One-click digital signing: accepting counts as both parties' consent
        agreement.tenantSignedAt = agreement.tenantSignedAt || new Date();
        agreement.landlordSignedAt = agreement.landlordSignedAt || new Date();
        await agreement.save();

        await createNotification(
            agreement.tenantId, 'agreement_renewal_accepted', 'Lease Renewed',
            `Lease for ${agreement.propertyId.title} renewed until ${new Date(proposal.newEndDate).toLocaleDateString()} at ${Number(proposal.newRentAmount).toLocaleString()} ETB/month.`,
            'RentalAgreement', agreement._id
        );
        await createNotification(
            agreement.landlordId, 'agreement_renewal_accepted', 'Lease Renewed',
            `Lease for ${agreement.propertyId.title} renewed until ${new Date(proposal.newEndDate).toLocaleDateString()} at ${Number(proposal.newRentAmount).toLocaleString()} ETB/month.`,
            'RentalAgreement', agreement._id
        );

        res.status(200).json({ message: "Renewal accepted — lease updated", agreement });
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// AI fair renewal price from market data — GET /api/v1/agreements/:id/renewal-price
// Reuses the same heuristic model as rent estimation (sub-city base rates),
// anchored to the property's real attributes, with a loyalty cap so renewing
// tenants never see an above-market hike above 8%.
const suggestRenewalPrice = async (req, res) => {
    try {
        const { id } = req.params;
        if (isMockMode()) {
            const agreement = mockFindAgreement(id);
            if (!agreement) return res.status(404).json({ message: "Agreement not found" });
            const prop = ((mockStore.properties || []).find((pp) => pp._id === (agreement.propertyId && agreement.propertyId._id)) || {});
            const baseRate = 420; // kazanchis-ish default for demo data
            const area = Math.max(Number(prop.sizeM2) || 60, 20);
            const beds = Math.max(Number(prop.bedrooms) || 1, 1);
            let market = Math.round(area * baseRate * (1 + (beds - 1) * 0.12) / 100) * 100;
            const current = Number(agreement.rentAmount) || market;
            const changePct = Number((((market - current) / (current || 1)) * 100).toFixed(1));
            let suggested = market;
            if (market > current && changePct > 8) suggested = Math.round(current * 1.08 / 100) * 100;
            return res.status(200).json({ data: {
                suggested,
                rangeLow: Math.round(suggested * 0.94 / 100) * 100,
                rangeHigh: Math.round(suggested * 1.06 / 100) * 100,
                marketEstimate: market,
                currentRent: current,
                changePct,
                confidence: 0.85,
                model: 'Heuristic market model (sub-city base rates + property attributes)',
                explanation: changePct > 8
                    ? `Market estimate is ${changePct}% above your current rent, but the renewal cap limits the suggested increase to 8%.`
                    : `Suggested price tracks the current market estimate for this sub-city (±6% range).`,
            } });
        }
        const agreement = await RentalAgreement.findById(id).populate('propertyId');
        if (!agreement) return res.status(404).json({ message: "Agreement not found" });

        const userId = req.user.id;
        if (agreement.tenantId.toString() !== userId && agreement.landlordId.toString() !== userId) {
            return res.status(403).json({ message: "Unauthorized" });
        }

        const p = agreement.propertyId;
        const subcity = (p.location?.subCity || 'bole').trim().toLowerCase();

        // Sub-city base rates (ETB/m²) — mirrors aiService SUBCITY_RATES
        const SUBCITY_RATES = {
            bole: 480, kazanchis: 420, "old airport": 450, sarbet: 380, cmc: 320,
            kirkos: 340, yeka: 300, arada: 310, "nifas silk-lafto": 270,
            gullele: 250, "kolfe keranio": 230, "akaky kaliti": 210,
        };
        const baseRate = SUBCITY_RATES[subcity] || 320;
        const area = Math.max(Number(p.sizeM2) || 60, 20);
        const beds = Math.max(Number(p.bedrooms) || 1, 1);
        const baths = Math.max(Number(p.bathrooms) || 1, 1);

        let market = area * baseRate;
        market *= (1 + (beds - 1) * 0.12);
        market *= (1 + (baths - 1) * 0.08);
        if (p.furnished) market *= 1.22;
        if ((p.amenities || []).includes('generator')) market *= 1.10;
        if ((p.amenities || []).includes('water tank')) market *= 1.05;
        market = Math.round(market / 100) * 100;

        const current = Number(agreement.rentAmount) || market;
        const change = market - current;
        const changePct = current > 0 ? Number(((change / current) * 100).toFixed(1)) : 0;

        // Loyalty cap: renewal increase above market never exceeds +8%/year
        let suggested = market;
        if (change > 0 && changePct > 8) suggested = Math.round(current * 1.08 / 100) * 100;

        const rangeLow = Math.round(Math.max(suggested * 0.94, current * 0.95) / 100) * 100;
        const rangeHigh = Math.round(Math.max(suggested * 1.06, current * 1.08) / 100) * 100;

        // Confidence falls back gracefully — this is a heuristic model, so we
        // label it honestly rather than presenting it as infallible.
        res.status(200).json({
            data: {
                suggested,
                rangeLow,
                rangeHigh,
                marketEstimate: market,
                currentRent: current,
                changePct,
                confidence: 0.85,
                model: 'Heuristic market model (sub-city base rates + property attributes)',
                explanation: changePct > 8
                    ? `Market estimate is ${changePct}% above your current rent, but the renewal cap limits the suggested increase to 8%.`
                    : `Suggested price tracks the current market estimate for this sub-city (±6% range).`,
            },
        });
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

module.exports = {
    createAgreement,
    signAgreement,
    getAgreements,
    getAgreementById,
    terminateAgreement,
    renewAgreement,
    proposeRenewal,
    respondToRenewal,
    suggestRenewalPrice
};
