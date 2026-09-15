const User = require('../../models/User');
const Property = require('../../models/Property');
const LandlordProfile = require('../../models/LandlordProfile');
const RentalAgreement = require('../../models/RentalAgreement');
const Application = require('../../models/Application');
const FraudReport = require('../../models/FraudReport');
const Dispute = require('../../models/Dispute');

const getKPIs = async (req, res) => {
    try {
        const [
            totalUsers,
            totalLandlords,
            totalTenants,
            totalProperties,
            verifiedProperties,
            pendingVerifications,
            activeRentals,
            totalApplications,
            openFraudReports,
            openDisputes
        ] = await Promise.all([
            User.countDocuments(),
            User.countDocuments({ role: 'landlord' }),
            User.countDocuments({ role: 'tenant' }),
            Property.countDocuments(),
            Property.countDocuments({ verificationStatus: 'verified' }),
            LandlordProfile.countDocuments({ verificationStatus: 'pending' }),
            RentalAgreement.countDocuments({ status: 'active' }),
            Application.countDocuments(),
            FraudReport.countDocuments({ status: { $in: ['open', 'under_review'] } }),
            Dispute.countDocuments({ status: { $in: ['open', 'under_review', 'mediation'] } })
        ]);

        res.status(200).json({
            data: {
                totalUsers,
                totalLandlords,
                totalTenants,
                totalProperties,
                verifiedProperties,
                pendingVerifications,
                activeRentals,
                totalApplications,
                openFraudReports,
                openDisputes
            }
        });
    } catch (error) {
        console.error("KPI generation error:", error);
        res.status(500).json({ message: "Server error generating KPIs" });
    }
};

const getChartData = async (req, res) => {
    try {
        // 1. Properties by City/SubCity
        const propertiesByLocation = await Property.aggregate([
            { $group: { _id: { city: "$location.city", subCity: "$location.subCity" }, count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 10 }
        ]);

        // 2. Users by Role
        const usersByRole = await User.aggregate([
            { $group: { _id: "$role", count: { $sum: 1 } } }
        ]);

        // 3. Properties by Price Range
        // Using $bucket to create histogram of property prices
        const propertiesByPrice = await Property.aggregate([
            {
                $bucket: {
                    groupBy: "$price",
                    boundaries: [0, 10000, 20000, 30000, 50000, 100000, 500000],
                    default: "500000+",
                    output: { count: { $sum: 1 } }
                }
            }
        ]);

        // 4. Verification Statistics (Landlord verification status)
        const verificationStats = await LandlordProfile.aggregate([
            { $group: { _id: "$verificationStatus", count: { $sum: 1 } } }
        ]);

        // 5. Fraud Reports by Category
        const fraudByCategory = await FraudReport.aggregate([
            { $group: { _id: "$category", count: { $sum: 1 } } }
        ]);

        // 6. Application Trends (last 6 months)
        // Groups applications by YYYY-MM
        const applicationTrends = await Application.aggregate([
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
                    count: { $sum: 1 }
                }
            },
            { $sort: { "_id": 1 } },
            { $limit: 12 }
        ]);

        res.status(200).json({
            data: {
                propertiesByLocation,
                usersByRole,
                propertiesByPrice,
                verificationStats,
                fraudByCategory,
                applicationTrends
            }
        });
    } catch (error) {
        console.error("Chart data generation error:", error);
        res.status(500).json({ message: "Server error generating chart data" });
    }
};

module.exports = {
    getKPIs,
    getChartData
};
