/**
 * Trimester Controller
 * CRUD operations for trimesters/sessions.
 */
const pool = require('../config/db');

async function getAll(req, res) {
  try {
    const query = `
      SELECT *
      FROM trimesters
      ORDER BY start_date DESC
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching trimesters:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function getById(req, res) {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT * FROM trimesters WHERE id = $1`,
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Trimester not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching trimester:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function create(req, res) {
  try {
    const { name, start_date, end_date } = req.body;
    if (!name || !start_date || !end_date) {
      return res.status(400).json({ error: 'All fields are required: name, start_date, end_date' });
    }
    const result = await pool.query(
      'INSERT INTO trimesters (name, start_date, end_date) VALUES ($1, $2, $3) RETURNING *',
      [name, start_date, end_date]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating trimester:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function update(req, res) {
  try {
    const { id } = req.params;
    const { name, start_date, end_date } = req.body;
    const result = await pool.query(
      `UPDATE trimesters SET 
        name = COALESCE($1, name),
        start_date = COALESCE($2, start_date),
        end_date = COALESCE($3, end_date),
        updated_at = NOW()
       WHERE id = $4 RETURNING *`,
      [name, start_date, end_date, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Trimester not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating trimester:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function remove(req, res) {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM trimesters WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Trimester not found' });
    }
    res.json({ message: 'Trimester deleted successfully' });
  } catch (err) {
    console.error('Error deleting trimester:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = { getAll, getById, create, update, remove };
