'use strict';

/**
 * Restricts access to users with the 'admin' role only.
 */
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

/**
 * Restricts access to authenticated users with 'admin' or 'influencer' role.
 * (Effectively all active users once authenticated, but explicit for clarity.)
 */
function requireInfluencer(req, res, next) {
  if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'influencer')) {
    return res.status(403).json({ error: 'Access denied' });
  }
  next();
}

module.exports = { requireAdmin, requireInfluencer };
