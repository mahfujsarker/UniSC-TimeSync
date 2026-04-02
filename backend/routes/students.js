/**
 * Student Routes
 */
const express = require('express');
const router = express.Router();
const controller = require('../controllers/studentController');
const authenticateToken = require('../middleware/auth');

router.get('/timetable', authenticateToken, controller.viewTimetable);
router.post('/enroll', authenticateToken, controller.enroll);
router.get('/my-classes', authenticateToken, controller.myClasses);
router.delete('/unenroll/:id', authenticateToken, controller.unenroll);

module.exports = router;
