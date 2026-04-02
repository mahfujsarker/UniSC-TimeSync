/**
 * Role-Based Access Control Middleware
 * Restricts routes to specific user roles.
 * 
 * Usage: router.get('/admin-only', authenticateToken, roleCheck('admin'), handler)
 */
function roleCheck(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ 
        error: 'Insufficient permissions',
        message: `This action requires one of: ${allowedRoles.join(', ')}`
      });
    }

    next();
  };
}

module.exports = roleCheck;
