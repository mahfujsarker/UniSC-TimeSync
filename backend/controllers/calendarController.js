/**
 * Calendar Controller
 * CRUD operations for academic calendar events.
 */
const pool = require('../config/db');

async function getAll(req, res) {
  try {
    const { trimester_id } = req.query;
    let query = `
      SELECT ac.*, tr.name as trimester_name
      FROM academic_calendar ac
      LEFT JOIN trimesters tr ON ac.trimester_id = tr.id
    `;
    const params = [];
    if (trimester_id) {
      query += ' WHERE ac.trimester_id = $1';
      params.push(trimester_id);
    }
    query += ' ORDER BY ac.start_date ASC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching calendar:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function getById(req, res) {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT ac.*, tr.name as trimester_name
       FROM academic_calendar ac
       LEFT JOIN trimesters tr ON ac.trimester_id = tr.id
       WHERE ac.id = $1`, [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Calendar event not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching calendar event:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function create(req, res) {
  try {
    const { name, start_date, end_date, trimester_id } = req.body;
    if (!name || !start_date || !end_date) {
      return res.status(400).json({ error: 'Name, start_date, and end_date are required' });
    }
    const result = await pool.query(
      'INSERT INTO academic_calendar (name, start_date, end_date, trimester_id) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, start_date, end_date, trimester_id || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating calendar event:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function update(req, res) {
  try {
    const { id } = req.params;
    const { name, start_date, end_date, trimester_id } = req.body;
    const result = await pool.query(
      `UPDATE academic_calendar SET 
        name = COALESCE($1, name),
        start_date = COALESCE($2, start_date),
        end_date = COALESCE($3, end_date),
        trimester_id = COALESCE($4, trimester_id),
        updated_at = NOW()
       WHERE id = $5 RETURNING *`,
      [name, start_date, end_date, trimester_id, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Calendar event not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating calendar event:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function remove(req, res) {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM academic_calendar WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Calendar event not found' });
    }
    res.json({ message: 'Calendar event deleted successfully' });
  } catch (err) {
    console.error('Error deleting calendar event:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = { getAll, getById, create, update, remove };
