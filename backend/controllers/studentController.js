/**
 * Student Controller
 * Handles student-specific operations: view timetable, enroll, unenroll.
 */
const pool = require('../config/db');
const { ensureAcademicSchema } = require('../utils/academicSchema');

/**
 * GET /api/student/timetable
 * View published timetable for a degree/trimester.
 */
async function viewTimetable(req, res) {
  try {
    await ensureAcademicSchema();
    const { degree_id, trimester_id } = req.query;
    
    let query = `
      SELECT te.*,
        u.name as unit_name, u.code as unit_code,
        c.room_number, c.location as room_location, c.max_capacity, c.type as room_type,
        t.name as tutor_name,
        d.name as degree_name, d.code as degree_code,
        tr.name as trimester_name,
        (SELECT COUNT(*) FROM student_selections ss WHERE ss.timetable_entry_id = te.id) as enrolled_count
      FROM timetable_entries te
      JOIN units u ON te.unit_id = u.id
      JOIN unit_degrees ud ON u.id = ud.unit_id
      JOIN degrees d ON ud.degree_id = d.id
      JOIN classrooms c ON te.classroom_id = c.id
      JOIN tutors t ON te.tutor_id = t.id
      JOIN trimesters tr ON te.trimester_id = tr.id
      WHERE u.status = 'published' AND d.status = 'published'
    `;
    const params = [];
    let paramIdx = 1;

    if (degree_id) {
      query += ` AND ud.degree_id = $${paramIdx++}`;
      params.push(degree_id);
    }
    if (trimester_id) {
      query += ` AND te.trimester_id = $${paramIdx++}`;
      params.push(trimester_id);
    }
    query += ' GROUP BY te.id, u.id, c.id, t.id, d.id, tr.id ORDER BY te.day_of_week, te.start_time';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching student timetable:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * POST /api/student/enroll
 * Enroll in a timetable entry/class.
 */
async function enroll(req, res) {
  try {
    await ensureAcademicSchema();
    const { timetable_entry_id } = req.body;
    const userId = req.user.id;

    if (!timetable_entry_id) {
      return res.status(400).json({ error: 'timetable_entry_id is required' });
    }

    // Check if entry exists
    const entry = await pool.query(
      `SELECT te.*, c.max_capacity,
        (SELECT COUNT(*) FROM student_selections ss WHERE ss.timetable_entry_id = te.id) as enrolled_count
       FROM timetable_entries te
       JOIN classrooms c ON te.classroom_id = c.id
       WHERE te.id = $1`,
      [timetable_entry_id]
    );
    if (entry.rows.length === 0) {
      return res.status(404).json({ error: 'Timetable entry not found' });
    }

    // Check capacity
    const slot = entry.rows[0];
    if (slot.enrolled_count >= slot.max_capacity) {
      return res.status(409).json({ error: 'Class is full — no spots available' });
    }

    // Check for student time conflict
    const conflict = await pool.query(
      `SELECT te.*, u.name as unit_name
       FROM student_selections ss
       JOIN timetable_entries te ON ss.timetable_entry_id = te.id
       JOIN units u ON te.unit_id = u.id
       WHERE ss.user_id = $1
         AND te.day_of_week = $2
         AND te.start_time < $4
         AND te.end_time > $3`,
      [userId, slot.day_of_week, slot.start_time, slot.end_time]
    );
    if (conflict.rows.length > 0) {
      return res.status(409).json({ 
        error: `Time conflict with ${conflict.rows[0].unit_name}`,
        conflicting_class: conflict.rows[0]
      });
    }

    // Enroll
    const result = await pool.query(
      'INSERT INTO student_selections (user_id, timetable_entry_id) VALUES ($1, $2) RETURNING *',
      [userId, timetable_entry_id]
    );
    res.status(201).json({ message: 'Enrolled successfully', selection: result.rows[0] });

  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Already enrolled in this class' });
    }
    console.error('Error enrolling:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * GET /api/student/my-classes
 * View currently enrolled classes.
 */
async function myClasses(req, res) {
  try {
    await ensureAcademicSchema();
    const userId = req.user.id;
    const result = await pool.query(
      `SELECT ss.id as selection_id, ss.created_at as enrolled_at,
        te.*, u.name as unit_name, u.code as unit_code,
        c.room_number, c.location as room_location,
        t.name as tutor_name,
        d.name as degree_name, tr.name as trimester_name
       FROM student_selections ss
       JOIN timetable_entries te ON ss.timetable_entry_id = te.id
       JOIN units u ON te.unit_id = u.id
       JOIN unit_degrees ud ON u.id = ud.unit_id
       JOIN degrees d ON ud.degree_id = d.id
       JOIN classrooms c ON te.classroom_id = c.id
       JOIN tutors t ON te.tutor_id = t.id
       JOIN trimesters tr ON te.trimester_id = tr.id
       WHERE ss.user_id = $1
         AND u.status = 'published'
         AND d.status = 'published'
       GROUP BY ss.id, te.id, u.id, c.id, t.id, d.id, tr.id
       ORDER BY te.day_of_week, te.start_time`,
      [userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching my classes:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * DELETE /api/student/unenroll/:id
 * Drop a class enrollment.
 */
async function unenroll(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const result = await pool.query(
      'DELETE FROM student_selections WHERE id = $1 AND user_id = $2 RETURNING *',
      [id, userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Enrollment not found' });
    }
    res.json({ message: 'Unenrolled successfully' });
  } catch (err) {
    console.error('Error unenrolling:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = { viewTimetable, enroll, myClasses, unenroll };
