/**
 * Class Routes
 * API endpoints for class instances management.
 */
const express = require('express');
const router = express.Router();
const classController = require('../controllers/classController');
const authenticateToken = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');

router.get('/', authenticateToken, classController.getAll);
router.get('/unscheduled', authenticateToken, classController.getUnscheduled);
router.get('/by-course', authenticateToken, classController.getByCourseAndTrimester);
router.get('/by-unit', authenticateToken, classController.getByCourseAndTrimester);
router.get('/:id', authenticateToken, classController.getById);
router.post('/', authenticateToken, roleCheck('admin'), classController.createForCourse);
router.post('/batch', authenticateToken, roleCheck('admin'), classController.createBatchForTrimester);
router.put('/:id', authenticateToken, roleCheck('admin'), classController.update);
router.delete('/by-course', authenticateToken, roleCheck('admin'), classController.removeByCourse);
router.delete('/by-unit', authenticateToken, roleCheck('admin'), classController.removeByCourse);
router.delete('/:id', authenticateToken, roleCheck('admin'), classController.remove);

module.exports = router;
