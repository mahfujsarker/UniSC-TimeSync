/**
 * Public read-only routes for view-only timetable access.
 */
const express = require('express');
const router = express.Router();
const degreeController = require('../controllers/degreeController');
const trimesterController = require('../controllers/trimesterController');
const timetableController = require('../controllers/timetableController');

router.get('/degrees', degreeController.getAll);
router.get('/trimesters', (req, res, next) => {
  req.query.status = 'published';
  trimesterController.getAll(req, res, next);
});
router.get('/timetable', timetableController.getAll);

module.exports = router;
