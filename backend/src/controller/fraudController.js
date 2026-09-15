const FraudReport = require('../models/FraudReport');
const Notification = require('../models/Notification');

const Property = require('../models/Property');

const User = require('../models/User');
const LandlordProfile = require('../models/LandlordProfile');

// Real Risk Evaluation Engine combining heuristic signals + AI Score
const evaluateRiskSignals = async (reportData) => {
    let score = 0.2; // Base risk score
    let signals = [];

    // Check 1: Severe Categories
    if (reportData.category === 'scam' || reportData.category === 'fake_listing' || reportData.category === 'suspicious_payment_request') {
        score += 0.4;
        signals.push("severe_category_flag");
    }

    // Check 2: Historical Reports
    if (reportData.reportedPropertyId || reportData.reportedUserId) {
        const previousReports = await FraudReport.countDocuments({
            $or: [
                { reportedPropertyId: reportData.reportedPropertyId, status: { $ne: 'dismissed' } },
                { reportedUserId: reportData.reportedUserId, status: { $ne: 'dismissed' } }
            ]
        });
        
        if (previousReports > 0) {
            score += 0.3;
            signals.push(`multiple_historical_reports (${previousReports})`);
        }
    }

    // Check 3: Missing Evidence
    if (!reportData.evidenceKeys || reportData.evidenceKeys.length === 0) {
        score -= 0.1; // Less credible if no proof provided
        signals.push("lacking_evidence");
    }

    // Check 4: The Property's true AI Risk Score
    if (reportData.reportedPropertyId) {
        try {
            const property = await Property.findById(reportData.reportedPropertyId);
            if (property && property.fraudRiskScore) {
                // Determine if score is 0-100 or 0-1 scale depending on propertyController bug state
                const normalizedAiScore = property.fraudRiskScore > 1 ? (property.fraudRiskScore / 100) : property.fraudRiskScore;
                if (normalizedAiScore > 0.5) {
                    score += (normalizedAiScore * 0.4); 
                    signals.push(`high_ai_risk_score_from_listing_scan`);
                }
            }

            // Duplicate Property Information Check
            if (property && property.title) {
                const duplicateProperties = await Property.countDocuments({
                    title: property.title,
                    landlordId: { $ne: property.landlordId } // Different landlord using same title
                });
                if (duplicateProperties > 0) {
                    score += 0.20;
                    signals.push("duplicate_property_information_found");
                }
            }
        } catch (err) {
            console.error("Error fetching property AI score:", err);
        }
    }

    // Check 5: Account Behavior & Verification Status & Duplicate Phone
    if (reportData.reportedUserId) {
        try {
            const user = await User.findById(reportData.reportedUserId);
            if (user) {
                // Account Behavior: Created within the last 7 days?
                const sevenDaysAgo = new Date();
                sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
                if (user.createdAt && user.createdAt > sevenDaysAgo) {
                    score += 0.15;
                    signals.push("account_behavior_newly_created");
                }

                // Duplicate Phone
                if (user.phone) {
                    const duplicatePhones = await User.countDocuments({ phone: user.phone, _id: { $ne: user._id } });
                    if (duplicatePhones > 0) {
                        score += 0.25;
                        signals.push("duplicate_phone_number");
                    }
                }
            }

            // Verification Status
            const landlordProfile = await LandlordProfile.findOne({ accountId: reportData.reportedUserId });
            if (landlordProfile && landlordProfile.verificationStatus !== 'verified') {
                score += 0.15;
                signals.push("verification_status_unverified");
            }
        } catch (err) {
            console.error("Error checking user behavior:", err);
        }
    }

    // Cap score at 1.0
    score = Math.min(Math.max(score, 0), 1.0);

    // Assign Level
    let level = "LOW";
    if (score >= 0.60) level = "HIGH";
    else if (score >= 0.30) level = "MEDIUM";

    return { score, level, signals };
};

const reportFraud = async (req, res) => {
    try {
        const reportedBy = req.user.id;
        const { reportedPropertyId, reportedUserId, category, description } = req.body;
        
        const evidenceKeys = req.files ? req.files.map(file => file.path) : [];

        // 1. Run the AI Risk Engine calculation
        const riskAssessment = await evaluateRiskSignals({
            reportedPropertyId,
            reportedUserId,
            category,
            evidenceKeys
        });

        // 2. Save the report
        const report = await FraudReport.create({
            reportedBy,
            reportedPropertyId,
            reportedUserId,
            category,
            description,
            evidenceKeys,
            aiRiskScore: riskAssessment.score,
            aiRiskLevel: riskAssessment.level,
            aiSignals: riskAssessment.signals,
            history: [{
                status: 'open',
                note: `Report filed. AI Risk Assessed as ${riskAssessment.level}.`
            }]
        });

        res.status(201).json({ message: "Report submitted successfully.", reportId: report._id, riskLevel: riskAssessment.level });
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

const getAdminReports = async (req, res) => {
    try {
        // Fetch open/under_review reports, sorted by Risk Score descending (Highest Risk First)
        const reports = await FraudReport.find({ status: { $in: ['open', 'under_review'] } })
            .populate('reportedBy', 'firstName lastName')
            .populate('reportedPropertyId', 'title')
            .populate('reportedUserId', 'firstName lastName')
            .sort({ aiRiskScore: -1 });

        res.status(200).json(reports);
    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
};

module.exports = {
    reportFraud,
    getAdminReports
};
