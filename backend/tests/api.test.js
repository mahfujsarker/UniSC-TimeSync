const test = require('node:test');
const assert = require('node:assert/strict');

const {
  calculateNumberOfClasses,
  ROOM_CAPACITIES
} = require('../controllers/classController');
const { validateTimeRange } = require('../controllers/timetableController');

test('calculateNumberOfClasses creates at least one class', () => {
  assert.equal(calculateNumberOfClasses(0, 'normal'), 1);
  assert.equal(calculateNumberOfClasses(0, 'lab'), 1);
});

test('calculateNumberOfClasses rounds enrolments up by room type capacity', () => {
  assert.equal(ROOM_CAPACITIES.normal, 30);
  assert.equal(ROOM_CAPACITIES.lab, 25);
  assert.equal(calculateNumberOfClasses(31, 'normal'), 2);
  assert.equal(calculateNumberOfClasses(51, 'lab'), 3);
});

test('validateTimeRange accepts valid half-hour timetable slots', () => {
  assert.deepEqual(validateTimeRange('08:00', '09:30'), []);
  assert.deepEqual(validateTimeRange('13:30', '15:00'), []);
});

test('validateTimeRange rejects invalid timetable slots', () => {
  assert.match(validateTimeRange('07:30', '08:30').join(' '), /08:00/);
  assert.match(validateTimeRange('09:00', '09:00').join(' '), /after start/);
  assert.match(validateTimeRange('09:15', '10:00').join(' '), /30-minute/);
  assert.match(validateTimeRange('21:30', '22:30').join(' '), /22:00/);
});
