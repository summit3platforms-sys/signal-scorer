import { getDB } from '../services/database.js';

export function requireRole(allowedRoles = []) {
  return (req, res, next) => {
    try {
      const userId = req.headers['x-user-id'];
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized: Missing x-user-id header' });
      }

      const db = getDB();
      const user = db.prepare('SELECT role, status FROM users WHERE uniqueId = ?').get(userId);

      if (!user) {
        return res.status(401).json({ error: 'Unauthorized: Invalid user credentials' });
      }

      if (user.status !== 'active') {
        return res.status(403).json({ error: 'Forbidden: Account is not active' });
      }

      if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
        return res.status(403).json({ error: 'Forbidden: Insufficient privileges' });
      }

      req.user = user;
      next();
    } catch (err) {
      console.error('[AuthMiddleware] Error checking credentials:', err.message);
      res.status(500).json({ error: 'Internal server error checking credentials' });
    }
  };
}

export const requireMaster = requireRole(['master']);
export const requireActiveUser = requireRole(['master', 'user']);
