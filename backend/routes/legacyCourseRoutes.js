/**
 * Legacy course route aliases. Prefer /api/courses for new code.
 */
const express = require('express');
const router = express.Router();
const controller = require('../controllers/courseController');
const authenticateToken = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');

router.get('/', authenticateToken, controller.getAll);
router.get('/by-degree', authenticateToken, controller.getByDegreeAndTrimester);
router.get('/by-degree/:degreeId', authenticateToken, controller.getByDegree);
router.get('/:id', authenticateToken, controller.getById);
router.post('/', authenticateToken, roleCheck('admin'), controller.create);
router.put('/:id', authenticateToken, roleCheck('admin'), controller.update);
router.put('/:id/enrolled-students', authenticateToken, roleCheck('admin'), controller.updateEnrolledStudents);
router.delete('/:id', authenticateToken, roleCheck('admin'), controller.remove);

module.exports = router;
