/**
 * Tutor Availability Controller
 * Manages tutor availability per trimester/session.
 */
const pool = require('../config/db');

async function getByTutor(req, res) {
  try {
    const { tutorId } = req.params;
    const { trimester_id } = req.query;

    let query = 'SELECT ta.*, t.name as tutor_name, tr.name as trimester_name FROM tutor_availability ta JOIN tutors t ON ta.tutor_id = t.id JOIN trimesters tr ON ta.trimester_id = tr.id WHERE ta.tutor_id = $1';
    const params = [tutorId];

    if (trimester_id) {
      query += ' AND ta.trimester_id = $2';
      params.push(trimester_id);
    }

    query += ' ORDER BY ta.trimester_id, ta.day_of_week, ta.start_time';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching tutor availability:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function getByTrimester(req, res) {
  try {
    const { trimesterId } = req.params;

    const result = await pool.query(
      `SELECT ta.*, t.name as tutor_name FROM tutor_availability ta
       JOIN tutors t ON ta.tutor_id = t.id
       WHERE ta.trimester_id = $1
       ORDER BY t.name, ta.day_of_week, ta.start_time`,
      [trimesterId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching availability by trimester:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function create(req, res) {
  try {
    const { tutor_id, trimester_id, day_of_week, start_time, end_time } = req.body;

    if (!tutor_id || !trimester_id || !day_of_week || !start_time || !end_time) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    if (!['Monday','Tuesday','Wednesday','Thursday','Friday'].includes(day_of_week)) {
      return res.status(400).json({ error: 'Invalid day of week' });
    }

    if (end_time <= start_time) {
      return res.status(400).json({ error: 'End time must be after start time' });
    }

    const result = await pool.query(
      `INSERT INTO tutor_availability (tutor_id, trimester_id, day_of_week, start_time, end_time)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [tutor_id, trimester_id, day_of_week, start_time, end_time]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Availability already exists for this tutor, trimester, day, and start time' });
    }
    console.error('Error creating tutor availability:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function remove(req, res) {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM tutor_availability WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Availability entry not found' });
    }
    res.json({ message: 'Availability deleted successfully' });
  } catch (err) {
    console.error('Error deleting tutor availability:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function checkAvailability(tutor_id, trimester_id, day_of_week, start_time, end_time) {
  const result = await pool.query(
    `SELECT * FROM tutor_availability
     WHERE tutor_id = $1 AND trimester_id = $2 AND day_of_week = $3
       AND start_time <= $4 AND end_time >= $5`,
    [tutor_id, trimester_id, day_of_week, start_time, end_time]
  );
  return result.rows.length > 0;
}

module.exports = { getByTutor, getByTrimester, create, remove, checkAvailability };
