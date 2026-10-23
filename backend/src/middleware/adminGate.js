// Sprint 14 — defense-in-depth for admin routes.
//
// roleMiddleware only trusts the JWT `role` claim. A leaked secret (or a
// stale token minted before a demotion) would grant full admin access.
// This gate re-checks the account in the store (mock mode) or database
// (Mongo mode): the user must exist, be active, and still be an admin.
const { isMockMode, mockStore } = require('../config/db');

module.exports = async function adminGate(req, res, next) {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. You do not have permission' });
    }
    if (isMockMode()) {
      const u = Array.from(mockStore.users.values()).find((x) => x._id === req.user.id);
      if (!u || u.role !== 'admin') {
        return res.status(403).json({ message: 'Access denied. You do not have permission' });
      }
      return next();
    }
    const User = require('../models/User');
    const u = await User.findById(req.user.id).select('role isActive');
    if (!u || u.isActive === false || u.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. You do not have permission' });
    }
    return next();
  } catch (e) {
    return res.status(500).json({ message: 'Server error' });
  }
};
