/**
 * Calendar Controller
 * CRUD operations for academic calendar events.
 */
const pool = require('../config/db');
const { ensureAcademicSchema } = require('../utils/academicSchema');

async function getPublishedAcademicCalendar(req, res) {
  try {
    await ensureAcademicSchema();

    const yearsResult = await pool.query(`
      SELECT ay.*
      FROM academic_years ay
      WHERE ay.status = 'published'
      ORDER BY ay.year DESC
    `);

    if (yearsResult.rows.length === 0) {
      return res.json([]);
    }

    const yearIds = yearsResult.rows.map(year => year.id);
    const periodsResult = await pool.query(
      `SELECT tp.*
       FROM trimesters tp
       WHERE tp.academic_year_id = ANY($1::uuid[])
         AND tp.status = 'published'
       ORDER BY tp.type, tp.period_number, tp.start_date NULLS LAST, tp.name`,
      [yearIds]
    );

    const periodIds = periodsResult.rows.map(period => period.id);
    let events = [];
    if (periodIds.length > 0) {
      const eventsResult = await pool.query(
        `SELECT teaching_period_id, event_type, title, start_date, end_date, notes, 'teaching_period_events' as source
         FROM teaching_period_events
         WHERE teaching_period_id = ANY($1::uuid[])
         UNION ALL
         SELECT trimester_id as teaching_period_id, 'Academic Calendar' as event_type, name as title, start_date, end_date, NULL as notes, 'academic_calendar' as source
         FROM academic_calendar
         WHERE trimester_id = ANY($1::uuid[])
         ORDER BY start_date NULLS LAST, title`,
        [periodIds]
      );
      events = eventsResult.rows;
    }

    const eventsByPeriod = events.reduce((grouped, event) => {
      const key = String(event.teaching_period_id);
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(event);
      return grouped;
    }, new Map());

    const periodsByYear = periodsResult.rows.reduce((grouped, period) => {
      const key = String(period.academic_year_id);
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push({
        ...period,
        events: eventsByPeriod.get(String(period.id)) || []
      });
      return grouped;
    }, new Map());

    res.json(yearsResult.rows.map(year => ({
      ...year,
      teaching_periods: periodsByYear.get(String(year.id)) || []
    })));
  } catch (err) {
    console.error('Error fetching published academic calendar:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function getAll(req, res) {
  try {
    await ensureAcademicSchema();
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
    await ensureAcademicSchema();
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
    await ensureAcademicSchema();
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
    await ensureAcademicSchema();
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
    await ensureAcademicSchema();
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

module.exports = { getPublishedAcademicCalendar, getAll, getById, create, update, remove };
