/**
 * Timetable Routes (Admin only)
 */
const express = require('express');
const router = express.Router();
const controller = require('../controllers/timetableController');
const authenticateToken = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');

router.get('/', authenticateToken, controller.getAll);
router.get('/kanban/:trimesterId', authenticateToken, controller.getKanban);
router.get('/grid/:trimesterId', authenticateToken, controller.getGrid);

router.post('/check-conflicts', authenticateToken, roleCheck('admin'), controller.validateEntry);
router.post('/schedule', authenticateToken, roleCheck('admin'), controller.scheduleClass);
router.post('/', authenticateToken, roleCheck('admin'), controller.create);
router.put('/:id', authenticateToken, roleCheck('admin'), controller.update);
router.delete('/:id', authenticateToken, roleCheck('admin'), controller.remove);

module.exports = router;
