/**
 * Tutor Controller
 * CRUD operations for tutors and tutor-unit assignments.
 */
const pool = require('../config/db');

async function getAll(req, res) {
  try {
    const result = await pool.query(`
      SELECT t.*, 
        COALESCE(json_agg(
          json_build_object('unit_id', u.id, 'unit_name', u.name, 'unit_code', u.code)
        ) FILTER (WHERE u.id IS NOT NULL), '[]') as assigned_units
      FROM tutors t
      LEFT JOIN tutor_units tu ON t.id = tu.tutor_id
      LEFT JOIN units u ON tu.unit_id = u.id
      GROUP BY t.id
      ORDER BY t.name ASC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching tutors:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function getById(req, res) {
  try {
    const { id } = req.params;
    const result = await pool.query(`
      SELECT t.*, 
        COALESCE(json_agg(
          json_build_object('unit_id', u.id, 'unit_name', u.name, 'unit_code', u.code)
        ) FILTER (WHERE u.id IS NOT NULL), '[]') as assigned_units
      FROM tutors t
      LEFT JOIN tutor_units tu ON t.id = tu.tutor_id
      LEFT JOIN units u ON tu.unit_id = u.id
      WHERE t.id = $1
      GROUP BY t.id
    `, [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Tutor not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching tutor:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function create(req, res) {
  try {
    const { name, email, unit_ids } = req.body;
    if (!name || !email) {
      return res.status(400).json({ error: 'Name and email are required' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      const result = await client.query(
        'INSERT INTO tutors (name, email) VALUES ($1, $2) RETURNING *',
        [name, email]
      );
      const tutor = result.rows[0];

      // Assign units if provided
      if (unit_ids && unit_ids.length > 0) {
        for (const unitId of unit_ids) {
          await client.query(
            'INSERT INTO tutor_units (tutor_id, unit_id) VALUES ($1, $2)',
            [tutor.id, unitId]
          );
        }
      }

      await client.query('COMMIT');
      res.status(201).json(tutor);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Tutor email already exists' });
    }
    console.error('Error creating tutor:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function update(req, res) {
  try {
    const { id } = req.params;
    const { name, email, unit_ids } = req.body;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const result = await client.query(
        `UPDATE tutors SET 
          name = COALESCE($1, name),
          email = COALESCE($2, email),
          updated_at = NOW()
         WHERE id = $3 RETURNING *`,
        [name, email, id]
      );
      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Tutor not found' });
      }

      // Update unit assignments if provided
      if (unit_ids !== undefined) {
        await client.query('DELETE FROM tutor_units WHERE tutor_id = $1', [id]);
        for (const unitId of unit_ids) {
          await client.query(
            'INSERT INTO tutor_units (tutor_id, unit_id) VALUES ($1, $2)',
            [id, unitId]
          );
        }
      }

      await client.query('COMMIT');
      res.json(result.rows[0]);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Error updating tutor:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function remove(req, res) {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM tutors WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Tutor not found' });
    }
    res.json({ message: 'Tutor deleted successfully' });
  } catch (err) {
    console.error('Error deleting tutor:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = { getAll, getById, create, update, remove };
