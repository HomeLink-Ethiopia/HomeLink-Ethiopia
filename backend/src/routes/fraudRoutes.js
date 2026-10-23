const express = require('express');
const router = express.Router();

const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');
const documentUpload = require('../middleware/documentUpload'); 

const {
    reportFraud,
    getAdminReports
} = require('../controller/fraudController');
// Admin list alias the frontend calls (GET /api/v1/fraud-reports).
router.get('/', authMiddleware, roleMiddleware('admin'), async (req, res) => {
  try {
    const { isMockMode, mockStore } = require('../config/db');
    if (isMockMode()) {
      const propTitle = (id) => ((mockStore.properties || []).find((pr) => pr._id === id) || {}).title;
      const reports = [...(mockStore.fraudReports || [])]
        .sort((a, b) => (b.aiRiskScore || 0) - (a.aiRiskScore || 0))
        .map((r) => ({
          ...r,
          // Shape for the admin page: reportType/riskScore/riskLevel/reporterId/propertyId
          reportType: r.category,
          riskScore: Math.round((r.aiRiskScore || 0) * 100),
          riskLevel: r.aiRiskLevel || ((r.aiRiskScore || 0) >= 0.6 ? 'HIGH' : (r.aiRiskScore || 0) >= 0.3 ? 'MEDIUM' : 'LOW'),
          reporterId: r.reportedBy,
          propertyId: r.reportedPropertyId
            ? typeof r.reportedPropertyId === 'object'
              ? r.reportedPropertyId
              : { _id: r.reportedPropertyId, title: propTitle(r.reportedPropertyId) || 'Property' }
            : null,
        }));
      return res.status(200).json({ data: reports });
    }
    const FraudReport = require('../models/FraudReport');
    const reports = await FraudReport.find({ status: { $in: ['open', 'under_review'] } })
      .populate('reportedBy', 'firstName lastName')
      .populate('reportedPropertyId', 'title')
      .populate('reportedUserId', 'firstName lastName')
      .sort({ aiRiskScore: -1 });
    return res.status(200).json({ data: reports });
  } catch (error) {
    console.error('fraud list error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Admin review action the frontend calls (PUT /api/v1/fraud-reports/:id/review).
router.put('/:id/review', authMiddleware, roleMiddleware('admin'), async (req, res) => {
  try {
    const { status, adminNotes } = req.body || {};
    const { isMockMode, mockStore } = require('../config/db');
    if (isMockMode()) {
      const report = (mockStore.fraudReports || []).find((r) => r._id === req.params.id);
      if (!report) return res.status(404).json({ message: 'Report not found' });
      if (status) report.status = status;
      if (adminNotes !== undefined) report.adminNotes = adminNotes;
      report.reviewedBy = req.user.id;
      report.resolvedAt = status === 'resolved' || status === 'dismissed' ? new Date().toISOString() : report.resolvedAt;
      report.history = (report.history || []).concat([{ status: report.status, note: adminNotes || 'Reviewed by admin', at: new Date().toISOString() }]);
      return res.status(200).json({ message: 'Report updated', data: report });
    }
    const FraudReport = require('../models/FraudReport');
    const report = await FraudReport.findByIdAndUpdate(
      req.params.id,
      { status, adminNotes, reviewedBy: req.user.id, $push: { history: { status, note: adminNotes || 'Reviewed by admin' } } },
      { new: true }
    );
    if (!report) return res.status(404).json({ message: 'Report not found' });
    return res.status(200).json({ message: 'Report updated', data: report });
  } catch (error) {
    console.error('fraud review error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// AI risk score for a property — derived from filed reports + listing signals.
// Read-only: risk informs admins, it never auto-bans anyone.
router.get('/risk-score/:id', authMiddleware, async (req, res) => {
  try {
    const { isMockMode, mockStore } = require('../config/db');
    if (isMockMode()) {
      const prop = (mockStore.properties || []).find((pr) => pr._id === req.params.id);
      const reports = (mockStore.fraudReports || []).filter((r) => r.reportedPropertyId === req.params.id && r.status !== 'dismissed');
      const signals = [];
      let score = prop && prop.fraudRiskScore ? Math.min(0.5, prop.fraudRiskScore / 200) : 0;
      if (prop && prop.fraudRiskScore > 50) signals.push('high_ai_risk_score_from_listing_scan');
      if (reports.length > 0) { score += 0.3 * Math.min(2, reports.length); signals.push('multiple_reports (' + reports.length + ')'); }
      if (prop) {
        const dupTitles = (mockStore.properties || []).filter((pr) => pr.title === prop.title).length;
        if (dupTitles > 1) { score += 0.2; signals.push('duplicate_property_information_found'); }
      }
      score = Math.min(Math.max(score, 0), 1);
      const level = score >= 0.6 ? 'HIGH' : score >= 0.3 ? 'MEDIUM' : 'LOW';
      return res.status(200).json({ data: { score: Math.round(score * 100), level, signals } });
    }
    const FraudReport = require('../models/FraudReport');
    const Property = require('../models/Property');
    const prop = await Property.findById(req.params.id).catch(() => null);
    const reports = await FraudReport.find({ reportedPropertyId: req.params.id, status: { $ne: 'dismissed' } });
    const signals = [];
    let score = prop && prop.fraudRiskScore ? Math.min(0.5, prop.fraudRiskScore / 200) : 0;
    if (reports.length > 0) { score += 0.3 * Math.min(2, reports.length); signals.push('multiple_reports (' + reports.length + ')'); }
    if (prop && prop.title) {
      const dup = await Property.find({ title: prop.title, _id: { $ne: prop._id } }).limit(3);
      if (dup.length > 0) { score += 0.2; signals.push('duplicate_property_information_found'); }
    }
    score = Math.min(Math.max(score, 0), 1);
    const level = score >= 0.6 ? 'HIGH' : score >= 0.3 ? 'MEDIUM' : 'LOW';
    return res.status(200).json({ data: { score: Math.round(score * 100), level, signals } });
  } catch (error) {
    console.error('fraud risk-score error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Submit a fraud report (can include evidence images/docs)
router.post('/', authMiddleware, documentUpload.array('evidence', 5), reportFraud);

// Admin dashboard endpoint to fetch reports sorted by risk
router.get('/admin', authMiddleware, roleMiddleware('admin'), getAdminReports);

module.exports = router;
