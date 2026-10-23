const fs = require('fs');

let p = 'backend/src/controller/agreementController.js';
let raw = fs.readFileSync(p, 'utf8');
const eol = raw.includes('\r\n') ? '\r\n' : '\n';
let s = raw.replace(/\r\n/g, '\n');

// 0. helper: in-memory agreement lookup for mock mode
const helperAnchor = "const { isMockMode: s89IsMock, mockCreateNotification: s89Notify } = require('../config/db'); // sprint89-notify-bridge";
if (!s.includes(helperAnchor)) throw new Error('helper anchor not found');
if (!s.includes('mockFindAgreement')) {
  const helper = helperAnchor + eol + eol +
    "// Mock-mode stand-in for RentalAgreement.findById — the demo agreements use" + eol +
    "// string ids like 'mock-agreement-3' which cast() would reject (sprint-renewal-mock)." + eol +
    "const mockFindAgreement = (id) => (mockStore.agreements || []).find((a) => a._id === id);" + eol;
  s = s.replace(helperAnchor, helper);
}

// 1. suggestRenewalPrice — mock branch right after "const { id } = req.params;" in that function
const priceBlock = [
  "        if (isMockMode()) {",
  "            const agreement = mockFindAgreement(id);",
  "            if (!agreement) return res.status(404).json({ message: \"Agreement not found\" });",
  "            const prop = ((mockStore.properties || []).find((pp) => pp._id === (agreement.propertyId && agreement.propertyId._id)) || {});",
  "            const baseRate = 420; // kazanchis-ish default for demo data",
  "            const area = Math.max(Number(prop.sizeM2) || 60, 20);",
  "            const beds = Math.max(Number(prop.bedrooms) || 1, 1);",
  "            let market = Math.round(area * baseRate * (1 + (beds - 1) * 0.12) / 100) * 100;",
  "            const current = Number(agreement.rentAmount) || market;",
  "            const changePct = Number((((market - current) / (current || 1)) * 100).toFixed(1));",
  "            let suggested = market;",
  "            if (market > current && changePct > 8) suggested = Math.round(current * 1.08 / 100) * 100;",
  "            return res.status(200).json({ data: {",
  "                suggested,",
  "                rangeLow: Math.round(suggested * 0.94 / 100) * 100,",
  "                rangeHigh: Math.round(suggested * 1.06 / 100) * 100,",
  "                marketEstimate: market,",
  "                currentRent: current,",
  "                changePct,",
  "                confidence: 0.85,",
  "                model: 'Heuristic market model (sub-city base rates + property attributes)',",
  "                explanation: changePct > 8",
  "                    ? `Market estimate is ${changePct}% above your current rent, but the renewal cap limits the suggested increase to 8%.`",
  "                    : `Suggested price tracks the current market estimate for this sub-city (±6% range).`,",
  "            } });",
  "        }",
];
s = s.replace(
  "const suggestRenewalPrice = async (req, res) => {\n    try {\n        const { id } = req.params;\n        const agreement = await RentalAgreement.findById(id).populate('propertyId');",
  "const suggestRenewalPrice = async (req, res) => {\n    try {\n        const { id } = req.params;\n" + priceBlock.join('\n') + "\n        const agreement = await RentalAgreement.findById(id).populate('propertyId');"
);

// 2. proposeRenewal — mock branch after body validation, before findById
const proposeMock = [
  "        if (isMockMode()) {",
  "            const agreement = mockFindAgreement(id);",
  "            if (!agreement) return res.status(404).json({ message: \"Agreement not found\" });",
  "            if (role === 'tenant' && ((agreement.tenantId && agreement.tenantId._id) || agreement.tenantId) !== userId) return res.status(403).json({ message: \"Unauthorized\" });",
  "            if (role === 'landlord' && ((agreement.landlordId && agreement.landlordId._id) || agreement.landlordId) !== userId) return res.status(403).json({ message: \"Unauthorized\" });",
  "            if (agreement.status !== 'active') return res.status(400).json({ message: \"Only active agreements can be renewed\" });",
  "            if (agreement.renewalProposal && agreement.renewalProposal.status === 'proposed') return res.status(400).json({ message: \"A renewal proposal is already pending\" });",
  "            if (new Date(newEndDate) <= new Date(agreement.endDate)) return res.status(400).json({ message: \"New end date must be after the current end date\" });",
  "            agreement.renewalProposal = {",
  "                proposedBy: role,",
  "                newEndDate,",
  "                newRentAmount: Number(newRentAmount),",
  "                message: message || '',",
  "                suggestedByAI: Boolean(suggestedByAI),",
  "                status: 'proposed',",
  "                proposedAt: new Date().toISOString(),",
  "            };",
  "            const propTitle = (agreement.propertyId && agreement.propertyId.title) || 'your property';",
  "            const otherId = role === 'tenant' ? ((agreement.landlordId && agreement.landlordId._id) || agreement.landlordId) : ((agreement.tenantId && agreement.tenantId._id) || agreement.tenantId);",
  "            await createNotification(",
  "                otherId, 'agreement_renewal_proposed', 'Lease Renewal Proposal',",
  "                `${role === 'tenant' ? 'The tenant' : 'The landlord'} proposed renewing ${propTitle} at ${Number(newRentAmount).toLocaleString()} ETB/month until ${new Date(newEndDate).toLocaleDateString()}.`,",
  "                'RentalAgreement', agreement._id",
  "            );",
  "            return res.status(200).json({ message: \"Renewal proposal sent\", agreement });",
  "        }",
];
// insert proposeMock after the validation checks (before findById in proposeRenewal)
s = s.replace(
  "        if (Number(newRentAmount) <= 0) {\n            return res.status(400).json({ message: \"newRentAmount must be positive\" });\n        }\n\n        const agreement = await RentalAgreement.findById(id).populate('propertyId', 'title');",
  "        if (Number(newRentAmount) <= 0) {\n            return res.status(400).json({ message: \"newRentAmount must be positive\" });\n        }\n\n" + proposeMock.join('\n') + "\n\n        const agreement = await RentalAgreement.findById(id).populate('propertyId', 'title');"
);

// 3. respondToRenewal — mock branch after decision validation
const respondMock = [
  "        if (isMockMode()) {",
  "            const agreement = mockFindAgreement(id);",
  "            if (!agreement) return res.status(404).json({ message: \"Agreement not found\" });",
  "            const roleOf = ((agreement.tenantId && agreement.tenantId._id) || agreement.tenantId) === userId ? 'tenant' : (((agreement.landlordId && agreement.landlordId._id) || agreement.landlordId) === userId ? 'landlord' : null);",
  "            if (!roleOf) return res.status(403).json({ message: \"Unauthorized\" });",
  "            const proposal = agreement.renewalProposal;",
  "            if (!proposal || proposal.status !== 'proposed') return res.status(400).json({ message: \"No pending renewal proposal\" });",
  "            if (proposal.proposedBy === roleOf) return res.status(400).json({ message: \"You cannot respond to your own proposal\" });",
  "            proposal.respondedAt = new Date().toISOString();",
  "            if (decision === 'reject') {",
  "                proposal.status = 'rejected';",
  "                return res.status(200).json({ message: \"Renewal rejected\", agreement });",
  "            }",
  "            proposal.status = 'accepted';",
  "            agreement.endDate = proposal.newEndDate;",
  "            agreement.rentAmount = proposal.newRentAmount;",
  "            agreement.renewals = agreement.renewals || [];",
  "            agreement.renewals.push({ newEndDate: proposal.newEndDate, newRentAmount: proposal.newRentAmount, agreedAt: new Date().toISOString() });",
  "            agreement.tenantSignedAt = agreement.tenantSignedAt || new Date().toISOString();",
  "            agreement.landlordSignedAt = agreement.landlordSignedAt || new Date().toISOString();",
  "            return res.status(200).json({ message: \"Renewal accepted — lease updated\", agreement });",
  "        }",
];
s = s.replace(
  "        if (!['accept', 'reject'].includes(decision)) {\n            return res.status(400).json({ message: \"decision must be 'accept' or 'reject'\" });\n        }\n\n        const agreement = await RentalAgreement.findById(id).populate('propertyId', 'title');",
  "        if (!['accept', 'reject'].includes(decision)) {\n            return res.status(400).json({ message: \"decision must be 'accept' or 'reject'\" });\n        }\n\n" + respondMock.join('\n') + "\n\n        const agreement = await RentalAgreement.findById(id).populate('propertyId', 'title');"
);

fs.writeFileSync(p, s);
console.log('agreementController.js patched with mock branches (price/propose/respond)');
