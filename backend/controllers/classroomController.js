/**
 * Classroom Controller
 * CRUD operations for classrooms.
 */
const pool = require('../config/db');

async function getAll(req, res) {
  try {
    const { type, available } = req.query;
    let query = 'SELECT * FROM classrooms WHERE 1=1';
    const params = [];
    let paramIdx = 1;

    if (type) {
      query += ` AND type = $${paramIdx++}`;
      params.push(type);
    }
    if (available !== undefined) {
      query += ` AND is_available = $${paramIdx++}`;
      params.push(available === 'true');
    }
    query += ' ORDER BY room_number ASC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching classrooms:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function getById(req, res) {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM classrooms WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Classroom not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching classroom:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function create(req, res) {
  try {
    const { room_number, location, max_capacity, type, is_available } = req.body;
    if (!room_number) {
      return res.status(400).json({ error: 'Room number is required' });
    }
    const result = await pool.query(
      'INSERT INTO classrooms (room_number, location, max_capacity, type, is_available) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [room_number, location || '', max_capacity || 30, type || 'normal', is_available !== false]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating classroom:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function update(req, res) {
  try {
    const { id } = req.params;
    const { room_number, location, max_capacity, type, is_available } = req.body;
    const result = await pool.query(
      `UPDATE classrooms SET 
        room_number = COALESCE($1, room_number),
        location = COALESCE($2, location),
        max_capacity = COALESCE($3, max_capacity),
        type = COALESCE($4, type),
        is_available = COALESCE($5, is_available),
        updated_at = NOW()
       WHERE id = $6 RETURNING *`,
      [room_number, location, max_capacity, type, is_available, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Classroom not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating classroom:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function remove(req, res) {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM classrooms WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Classroom not found' });
    }
    res.json({ message: 'Classroom deleted successfully' });
  } catch (err) {
    console.error('Error deleting classroom:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = { getAll, getById, create, update, remove };
