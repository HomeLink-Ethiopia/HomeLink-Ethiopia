const User = require('../../models/User');
const Property = require('../../models/Property');
const LandlordProfile = require('../../models/LandlordProfile');
const RentalAgreement = require('../../models/RentalAgreement');
const Application = require('../../models/Application');
const FraudReport = require('../../models/FraudReport');
const Dispute = require('../../models/Dispute');
const { isMockMode, mockStore } = require('../../config/db');

// ─── Shared mock helpers ────────────────────────────────────────────────
// Dev-account rows are synthesized because mock logins create them lazily.
const mockUserRows = () => {
    const seen = new Set();
    const rows = [];
    for (const u of mockStore.users.values()) { rows.push(u); seen.add(u._id); }
    const synth = [
        { _id: 'mock-user-seed-1', firstName: 'Hanna', lastName: 'Tesfaye', email: 'hanna@example.com', role: 'tenant' },
        { _id: 'mock-user-seed-2', firstName: 'Mikias', lastName: 'Bekele', email: 'mikias@example.com', role: 'tenant' },
        { _id: 'mock-landlord-1', firstName: 'Dev', lastName: 'Landlord', email: 'dev.landlord@homelink.test', role: 'landlord' },
        { _id: 'mock-admin-1', firstName: 'Dev', lastName: 'Admin', email: 'dev.admin@homelink.test', role: 'admin' },
    ];
    for (const su of synth) if (!seen.has(su._id)) rows.push(su);
    return rows;
};
const idOf = (v) => String((v && v._id) || v || '');


const getKPIs = async (req, res) => {
    try {
        if (isMockMode()) {
            const users = mockUserRows();
            const props = mockStore.properties || [];
            const agreements = mockStore.agreements || [];
            const applications = mockStore.applications || [];
            const landlordProfiles = [...(mockStore.landlordProfiles || new Map()).values()];
            return res.status(200).json({ data: {
                totalUsers: users.length,
                totalLandlords: users.filter((u) => u.role === 'landlord').length,
                totalTenants: users.filter((u) => u.role === 'tenant').length,
                totalAdmins: users.filter((u) => u.role === 'admin').length,
                totalProperties: props.length,
                verifiedProperties: props.filter((pr) => pr.verificationStatus === 'verified').length,
                pendingVerification: landlordProfiles.filter((lp) => lp.verificationStatus === 'pending').length + (mockStore.propertyVerifications || []).filter((v) => ['submitted', 'under_review'].includes(v.status)).length,
                activeRentals: agreements.filter((a) => a.status === 'active').length,
                totalApplications: applications.length,
                pendingApplications: applications.filter((a) => ['under_review', 'pending'].includes(a.status)).length,
                fraudReports: (mockStore.fraudReports || []).filter((r) => ['open', 'under_review'].includes(r.status)).length,
                openDisputes: (mockStore.disputes || []).filter((d) => ['open', 'under_review', 'mediation'].includes(d.status)).length
            } });
        }
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
        if (isMockMode()) {
            const props = mockStore.properties || [];
            const users = mockUserRows();
            const profiles = [...(mockStore.landlordProfiles || new Map()).values()];
            const byCity = {};
            for (const pr of props) {
                const city = (pr.location && (pr.location.subCity || pr.location.city)) || 'Unknown';
                byCity[city] = (byCity[city] || 0) + 1;
            }
            const priceBuckets = [
                ['Under 20K', 0, 20000], ['20K\u201335K', 20000, 35000], ['35K\u201350K', 35000, 50000],
                ['50K\u201375K', 50000, 75000], ['75K+', 75000, Infinity]
            ].map(([label, lo, hi]) => ({ label, value: props.filter((pr) => (pr.rentAmount || 0) >= lo && (pr.rentAmount || 0) < hi).length }));
            const monthKey = (iso) => String(iso || '').slice(0, 7);
            const trendMap = {};
            for (const a of mockStore.applications || []) { const mk = monthKey(a.createdAt); if (mk) trendMap[mk] = (trendMap[mk] || 0) + 1; }
            const applicationTrend = Object.keys(trendMap).sort().slice(-6).map((mk) => ({ label: mk, value: trendMap[mk] }));
            return res.status(200).json({ data: {
                propertiesByCity: Object.entries(byCity).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value),
                usersByRole: ['tenant', 'landlord', 'admin'].map((role) => ({ label: role, value: users.filter((u) => u.role === role).length })),
                propertiesByPriceRange: priceBuckets,
                verificationStats: ['verified', 'pending', 'rejected', 'unverified', 'under_review'].map((st) => ({ label: st, value: profiles.filter((lp) => (lp.verificationStatus || 'unverified') === st).length })),
                fraudByType: (mockStore.fraudReports || []).reduce((acc, r) => { const c = acc.find((x) => x.label === r.category); if (c) c.value += 1; else acc.push({ label: r.category, value: 1 }); return acc; }, []),
                applicationTrend
            } });
        }
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

// Sprint 12 — combined feed for the /admin/analytics page.
const getAnalytics = async (req, res) => {
    try {
        // Reuse the two existing generators by faking the response sink.
        const kpiData = await new Promise((resolve) => {
            const res2 = { status: () => ({ json: (j) => resolve(j.data) }) };
            getKPIs(req, res2);
        });
        const chartData = await new Promise((resolve) => {
            const res2 = { status: () => ({ json: (j) => resolve(j.data) }) };
            getChartData(req, res2);
        });
        const charts = {
            propertiesByCity: chartData.propertiesByLocation || chartData.propertiesByCity || [],
            usersByRole: chartData.usersByRole || [],
            propertiesByPriceRange: chartData.propertiesByPrice || chartData.propertiesByPriceRange || [],
            verificationStats: chartData.verificationStats || [],
            fraudByType: chartData.fraudByCategory || chartData.fraudByType || [],
            applicationTrend: chartData.applicationTrends || chartData.applicationTrend || [],
        };
        res.status(200).json({ data: { kpis: kpiData, charts } });
    } catch (error) {
        console.error("Combined analytics error:", error);
        res.status(500).json({ message: "Server error generating analytics" });
    }
};

module.exports = {
    getKPIs,
    getChartData,
    getAnalytics
};
