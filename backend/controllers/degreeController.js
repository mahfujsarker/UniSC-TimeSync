/**
 * Degree Controller
 * CRUD operations for degrees.
 */
// Build by Mahfuj
const pool = require('../config/db');

async function getAll(req, res) {
  try {
    const result = await pool.query('SELECT * FROM degrees ORDER BY name ASC');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching degrees:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function getById(req, res) {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM degrees WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Degree not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching degree:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function create(req, res) {
  try {
    const { name, code } = req.body;
    if (!name || !code) {
      return res.status(400).json({ error: 'Name and code are required' });
    }
    const result = await pool.query(
      'INSERT INTO degrees (name, code) VALUES ($1, $2) RETURNING *',
      [name, code.toUpperCase()]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Degree code already exists' });
    }
    console.error('Error creating degree:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function update(req, res) {
  try {
    const { id } = req.params;
    const { name, code } = req.body;
    const result = await pool.query(
      'UPDATE degrees SET name = COALESCE($1, name), code = COALESCE($2, code), updated_at = NOW() WHERE id = $3 RETURNING *',
      [name, code ? code.toUpperCase() : null, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Degree not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Degree code already exists' });
    }
    console.error('Error updating degree:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function remove(req, res) {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM degrees WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Degree not found' });
    }
    res.json({ message: 'Degree deleted successfully' });
  } catch (err) {
    console.error('Error deleting degree:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = { getAll, getById, create, update, remove };
