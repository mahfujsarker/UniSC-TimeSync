const express = require('express');
const router = express.Router();
const { getByTutor, getByTrimester, create, remove } = require('../controllers/tutorAvailabilityController');
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');

router.use(auth, roleCheck('admin'));

router.get('/tutor/:tutorId', getByTutor);
router.get('/trimester/:trimesterId', getByTrimester);
router.post('/', create);
router.delete('/:id', remove);

module.exports = router;
