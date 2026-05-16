/**
 * Tutor Controller
 * CRUD operations for tutors and tutor-unit assignments.
 */
const pool = require('../config/db');
const { ensureTutorAvailabilitySchema } = require('./tutorAvailabilityController');

async function getAll(req, res) {
  try {
    await ensureTutorAvailabilitySchema();
    const result = await pool.query(`
      SELECT t.*,
        COALESCE(
          (
            SELECT jsonb_agg(
              jsonb_build_object(
                'id', ta.id,
                'academic_year_id', ta.academic_year_id,
                'academic_year', ay.year,
                'trimester_id', ta.trimester_id,
                'availability_scope', ta.availability_scope,
                'day_of_week', ta.day_of_week,
                'start_time', ta.start_time,
                'end_time', ta.end_time,
                'trimester_name', tr.name,
                'type', tr.type,
                'code', tr.code
              )
              ORDER BY tr.name, ta.day_of_week
            )
            FROM tutor_availability ta
            LEFT JOIN academic_years ay ON ta.academic_year_id = ay.id
            LEFT JOIN trimesters tr ON ta.trimester_id = tr.id
            WHERE ta.tutor_id = t.id
          ),
          '[]'::jsonb
        ) as availability
      FROM tutors t
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
    await ensureTutorAvailabilitySchema();
    const { id } = req.params;
    const result = await pool.query(`
      SELECT t.*,
        COALESCE(
          (
            SELECT jsonb_agg(
              jsonb_build_object(
                'id', ta.id,
                'academic_year_id', ta.academic_year_id,
                'academic_year', ay.year,
                'trimester_id', ta.trimester_id,
                'availability_scope', ta.availability_scope,
                'day_of_week', ta.day_of_week,
                'start_time', ta.start_time,
                'end_time', ta.end_time,
                'trimester_name', tr.name,
                'type', tr.type,
                'code', tr.code
              )
              ORDER BY tr.name, ta.day_of_week
            )
            FROM tutor_availability ta
            LEFT JOIN academic_years ay ON ta.academic_year_id = ay.id
            LEFT JOIN trimesters tr ON ta.trimester_id = tr.id
            WHERE ta.tutor_id = t.id
          ),
          '[]'::jsonb
        ) as availability
      FROM tutors t
      WHERE t.id = $1
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
    await ensureTutorAvailabilitySchema();
    const { name, email } = req.body;
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
    await ensureTutorAvailabilitySchema();
    const { id } = req.params;
    const { name, email } = req.body;

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
    await ensureTutorAvailabilitySchema();
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
