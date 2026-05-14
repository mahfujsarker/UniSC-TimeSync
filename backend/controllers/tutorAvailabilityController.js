/**
 * Tutor Availability Controller
 * Manages tutor availability per published Teaching Period.
 */
const pool = require('../config/db');
const { ensureAcademicSchema } = require('../utils/academicSchema');

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

async function ensureTutorAvailabilitySchema() {
  await ensureAcademicSchema();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tutor_availability (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      tutor_id UUID NOT NULL REFERENCES tutors(id) ON DELETE CASCADE,
      trimester_id UUID NOT NULL REFERENCES trimesters(id) ON DELETE CASCADE,
      day_of_week VARCHAR(10) NOT NULL CHECK (day_of_week IN ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday')),
      start_time TIME,
      end_time TIME,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      UNIQUE(tutor_id, trimester_id, day_of_week)
    );

    ALTER TABLE tutor_availability ALTER COLUMN start_time DROP NOT NULL;
    ALTER TABLE tutor_availability ALTER COLUMN end_time DROP NOT NULL;

    DELETE FROM tutor_availability a
    USING tutor_availability b
    WHERE a.tutor_id = b.tutor_id
      AND a.trimester_id = b.trimester_id
      AND a.day_of_week = b.day_of_week
      AND a.created_at > b.created_at;

    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'tutor_availability_tutor_id_trimester_id_day_of_week_start_time_key'
      ) THEN
        ALTER TABLE tutor_availability
          DROP CONSTRAINT tutor_availability_tutor_id_trimester_id_day_of_week_start_time_key;
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'unique_tutor_availability_day'
      ) THEN
        ALTER TABLE tutor_availability
          ADD CONSTRAINT unique_tutor_availability_day
          UNIQUE (tutor_id, trimester_id, day_of_week);
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'valid_tutor_availability_times'
      ) THEN
        ALTER TABLE tutor_availability
          ADD CONSTRAINT valid_tutor_availability_times
          CHECK (
            (start_time IS NULL AND end_time IS NULL)
            OR (start_time IS NOT NULL AND end_time IS NOT NULL AND end_time > start_time)
          );
      END IF;
    END $$;
  `);
}

function normalizeTime(value) {
  return value ? String(value).slice(0, 5) : null;
}

function validateAvailabilityWindow(day_of_week, start_time, end_time) {
  const errors = [];
  if (!DAYS.includes(day_of_week)) {
    errors.push('Invalid day of week');
  }

  const start = normalizeTime(start_time);
  const end = normalizeTime(end_time);
  if ((start && !end) || (!start && end)) {
    errors.push('Set both start and end time, or leave both blank for full-day availability');
  }
  if (start && end) {
    if (start < '08:00' || end > '22:00') {
      errors.push('Availability time must be between 08:00 and 22:00');
    }
    if (end <= start) {
      errors.push('End time must be after start time');
    }
    const [startHour, startMinute] = start.split(':').map(Number);
    const [endHour, endMinute] = end.split(':').map(Number);
    if (((startHour * 60) + startMinute) % 30 !== 0 || ((endHour * 60) + endMinute) % 30 !== 0) {
      errors.push('Availability times must use 30-minute intervals');
    }
  }
  return errors;
}

async function getByTutor(req, res) {
  try {
    await ensureTutorAvailabilitySchema();
    const { tutorId } = req.params;
    const { trimester_id } = req.query;

    let query = `
      SELECT ta.*, t.name as tutor_name, tr.name as trimester_name, tr.type, tr.code, tr.period_number
      FROM tutor_availability ta
      JOIN tutors t ON ta.tutor_id = t.id
      JOIN trimesters tr ON ta.trimester_id = tr.id
      WHERE ta.tutor_id = $1
    `;
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
    await ensureTutorAvailabilitySchema();
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
    await ensureTutorAvailabilitySchema();
    const { tutor_id, trimester_id, day_of_week, start_time, end_time } = req.body;

    if (!tutor_id || !trimester_id || !day_of_week) {
      return res.status(400).json({ error: 'Tutor, Teaching Period, and day are required' });
    }

    const errors = validateAvailabilityWindow(day_of_week, start_time, end_time);
    if (errors.length > 0) {
      return res.status(400).json({ error: errors.join(', ') });
    }

    const result = await pool.query(
      `INSERT INTO tutor_availability (tutor_id, trimester_id, day_of_week, start_time, end_time)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (tutor_id, trimester_id, day_of_week)
       DO UPDATE SET start_time = EXCLUDED.start_time, end_time = EXCLUDED.end_time, updated_at = NOW()
       RETURNING *`,
      [tutor_id, trimester_id, day_of_week, normalizeTime(start_time), normalizeTime(end_time)]
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
    await ensureTutorAvailabilitySchema();
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
  await ensureTutorAvailabilitySchema();
  const result = await pool.query(
    `SELECT * FROM tutor_availability
     WHERE tutor_id = $1 AND trimester_id = $2 AND day_of_week = $3
       AND (
        (start_time IS NULL AND end_time IS NULL)
        OR (start_time <= $4 AND end_time >= $5)
       )`,
    [tutor_id, trimester_id, day_of_week, start_time, end_time]
  );
  return result.rows.length > 0;
}

async function replaceForTutor(req, res) {
  const client = await pool.connect();
  try {
    await ensureTutorAvailabilitySchema();
    const { tutorId } = req.params;
    const { availability = [] } = req.body;

    await client.query('BEGIN');

    const tutor = await client.query('SELECT id FROM tutors WHERE id = $1', [tutorId]);
    if (tutor.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Tutor not found' });
    }

    const rows = [];
    for (const period of availability) {
      if (!period?.trimester_id || !Array.isArray(period.days)) continue;
      const teachingPeriod = await client.query(
        `SELECT id FROM trimesters WHERE id = $1 AND status = 'published'`,
        [period.trimester_id]
      );
      if (teachingPeriod.rows.length === 0) continue;

      for (const day of period.days) {
        const dayName = day.day_of_week;
        const errors = validateAvailabilityWindow(dayName, day.start_time, day.end_time);
        if (errors.length > 0) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: `${dayName}: ${errors.join(', ')}` });
        }
        rows.push({
          trimester_id: period.trimester_id,
          day_of_week: dayName,
          start_time: normalizeTime(day.start_time),
          end_time: normalizeTime(day.end_time)
        });
      }
    }

    await client.query('DELETE FROM tutor_availability WHERE tutor_id = $1', [tutorId]);
    for (const row of rows) {
      await client.query(
        `INSERT INTO tutor_availability (tutor_id, trimester_id, day_of_week, start_time, end_time)
         VALUES ($1, $2, $3, $4, $5)`,
        [tutorId, row.trimester_id, row.day_of_week, row.start_time, row.end_time]
      );
    }
    await client.query('COMMIT');

    const result = await pool.query(
      `SELECT ta.*, tr.name as trimester_name, tr.type, tr.code
       FROM tutor_availability ta
       JOIN trimesters tr ON ta.trimester_id = tr.id
       WHERE ta.tutor_id = $1
       ORDER BY tr.name, ta.day_of_week`,
      [tutorId]
    );
    res.json(result.rows);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Error replacing tutor availability:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
}

module.exports = { getByTutor, getByTrimester, create, remove, replaceForTutor, checkAvailability, ensureTutorAvailabilitySchema };
