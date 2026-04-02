/**
 * Classroom Routes (Admin only for write ops)
 */
const express = require('express');
const router = express.Router();
const controller = require('../controllers/classroomController');
const authenticateToken = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');

router.get('/', authenticateToken, controller.getAll);
router.get('/:id', authenticateToken, controller.getById);
router.post('/', authenticateToken, roleCheck('admin'), controller.create);
router.put('/:id', authenticateToken, roleCheck('admin'), controller.update);
router.delete('/:id', authenticateToken, roleCheck('admin'), controller.remove);

module.exports = router;
