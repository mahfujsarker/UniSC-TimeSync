const fs = require('fs');

const newContent = `/**
 * Timetable Controller
 * Handles timetable entry CRUD with conflict detection.
 * The core logic of the UniSC TimeSync system.
 */
const pool = require('../config/db');

/**
 * Check for scheduling conflicts before creating/updating a timetable entry.
 * Returns an array of conflict descriptions; empty = no conflicts.
 */
async function checkConflicts(classroom_id, tutor_id, day_of_week, start_time, end_time, excludeId = null) {
  const conflicts = [];
  const excludeClause = excludeId ? ' AND id != $5' : '';
  const params = [classroom_id, day_of_week, start_time, end_time];
  if (excludeId) params.push(excludeId);

  const roomConflict = await pool.query(
    \`SELECT te.*, u.name as unit_name, u.code as unit_code
     FROM timetable_entries te
     JOIN units u ON te.unit_id = u.id
     WHERE te.classroom_id = $1 
       AND te.day_of_week = $2
       AND te.start_time < $4 
       AND te.end_time > $3
       \${excludeClause}\`,
    params
  );
  if (roomConflict.rows.length > 0) {
    const c = roomConflict.rows[0];
    conflicts.push({
      type: 'room',
      message: \`Room is already booked for \${c.unit_name} (\${c.unit_code}) from \${c.start_time} to \${c.end_time}\`,
      existing: c
    });
  }

  const tutorParams = [tutor_id, day_of_week, start_time, end_time];
  if (excludeId) tutorParams.push(excludeId);
  const tutorConflict = await pool.query(
    \`SELECT te.*, u.name as unit_name, u.code as unit_code
     FROM timetable_entries te
     JOIN units u ON te.unit_id = u.id
     WHERE te.tutor_id = $1 
       AND te.day_of_week = $2
       AND te.start_time < $4 
       AND te.end_time > $3
       \${excludeClause}\`,
    tutorParams
  );
  if (tutorConflict.rows.length > 0) {
    const c = tutorConflict.rows[0];
    conflicts.push({
      type: 'tutor',
      message: \`Tutor is already assigned to \${c.unit_name} (\${c.unit_code}) from \${c.start_time} to \${c.end_time}\`,
      existing: c
    });
  }

  return conflicts;
}

function validateTimeRange(start_time, end_time) {
  const errors = [];
  
  if (!start_time || !end_time) {
    errors.push('Start time and end time are required');
    return errors;
  }

  const start = start_time.trim();
  const end = end_time.trim();
  
  if (start < '08:00') {
    errors.push('Start time must be at or after 08:00');
  }
  
  if (end > '22:00') {
    errors.push('End time must be at or before 22:00');
  }
  
  if (end <= start) {
    errors.push('End time must be after start time');
  }
  
  return errors;
}

async function getAll(req, res) {
  try {
    const { trimester_id, degree_id } = req.query;
    let query = \`
      SELECT te.*,
        u.name as unit_name, u.code as unit_code,
        c.room_number, c.location as room_location, c.type as room_type,
        t.name as tutor_name, t.email as tutor_email,
        d.name as degree_name, d.code as degree_code,
        tr.name as trimester_name
      FROM timetable_entries te
      JOIN units u ON te.unit_id = u.id
      JOIN unit_degrees ud ON u.id = ud.unit_id
      JOIN classrooms c ON te.classroom_id = c.id
      JOIN tutors t ON te.tutor_id = t.id
      JOIN trimesters tr ON te.trimester_id = tr.id
      JOIN degrees d ON ud.degree_id = d.id
      WHERE 1=1
    `;
    const params = [];
    let paramIdx = 1;

    if (trimester_id) {
      query += ` AND te.trimester_id = $${paramIdx++}`;
      params.push(trimester_id);
    }
    if (degree_id) {
      query += ` AND ud.degree_id = $${paramIdx++}`;
      params.push(degree_id);
    }
    query += ' GROUP BY te.id, u.id, c.id, t.id, d.id, tr.id ORDER BY te.day_of_week, te.start_time';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching timetable:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function getKanban(req, res) {
  try {
    const { trimesterId } = req.params;
    const { degree_id } = req.query;

    let query = `SELECT te.*,
        u.name as unit_name, u.code as unit_code,
        c.room_number, c.location as room_location, c.max_capacity, c.type as room_type,
        t.name as tutor_name, t.email as tutor_email
      FROM timetable_entries te
      JOIN units u ON te.unit_id = u.id
      JOIN unit_degrees ud ON u.id = ud.unit_id
      JOIN classrooms c ON te.classroom_id = c.id
      JOIN tutors t ON te.tutor_id = t.id
      WHERE te.trimester_id = $1`;
    const params = [trimesterId];

    if (degree_id) {
      query += ` AND ud.degree_id = $2`;
      params.push(degree_id);
    }
    
    query += ` GROUP BY te.id, u.id, c.id, t.id ORDER BY te.start_time`;

    const result = await pool.query(query, params);

    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    const kanban = {};
    days.forEach(day => {
      kanban[day] = result.rows.filter(entry => entry.day_of_week === day);
    });

    res.json(kanban);
  } catch (err) {
    console.error('Error fetching Kanban data:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function validateEntry(req, res) {
  try {
    const { classroom_id, tutor_id, day_of_week, start_time, end_time, exclude_id } = req.body;
    
    const timeErrors = validateTimeRange(start_time, end_time);
    if (timeErrors.length > 0) {
      return res.status(400).json({ error: timeErrors.join(', ') });
    }
    
    const conflicts = await checkConflicts(classroom_id, tutor_id, day_of_week, start_time, end_time, exclude_id);
    res.json({ 
      hasConflicts: conflicts.length > 0, 
      conflicts 
    });
  } catch (err) {
    console.error('Error checking conflicts:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function create(req, res) {
  try {
    const { unit_id, classroom_id, tutor_id, trimester_id, day_of_week, start_time, end_time } = req.body;
    
    if (!unit_id || !classroom_id || !tutor_id || !trimester_id || !day_of_week || !start_time || !end_time) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const timeErrors = validateTimeRange(start_time, end_time);
    if (timeErrors.length > 0) {
      return res.status(400).json({ error: timeErrors.join(', ') });
    }

    const conflicts = await checkConflicts(classroom_id, tutor_id, day_of_week, start_time, end_time);
    if (conflicts.length > 0) {
      return res.status(409).json({ 
        error: 'Scheduling conflict detected',
        conflicts 
      });
    }

    const result = await pool.query(
      \`INSERT INTO timetable_entries (unit_id, classroom_id, tutor_id, trimester_id, day_of_week, start_time, end_time)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *\`,
      [unit_id, classroom_id, tutor_id, trimester_id, day_of_week, start_time, end_time]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating timetable entry:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function update(req, res) {
  try {
    const { id } = req.params;
    const { unit_id, classroom_id, tutor_id, trimester_id, day_of_week, start_time, end_time } = req.body;

    const current = await pool.query('SELECT * FROM timetable_entries WHERE id = $1', [id]);
    if (current.rows.length === 0) {
      return res.status(404).json({ error: 'Timetable entry not found' });
    }
    const entry = current.rows[0];

    const newClassroom = classroom_id || entry.classroom_id;
    const newTutor = tutor_id || entry.tutor_id;
    const newDay = day_of_week || entry.day_of_week;
    const newStart = start_time || entry.start_time;
    const newEnd = end_time || entry.end_time;

    const timeErrors = validateTimeRange(newStart, newEnd);
    if (timeErrors.length > 0) {
      return res.status(400).json({ error: timeErrors.join(', ') });
    }

    const conflicts = await checkConflicts(newClassroom, newTutor, newDay, newStart, newEnd, id);
    if (conflicts.length > 0) {
      return res.status(409).json({ 
        error: 'Scheduling conflict detected',
        conflicts 
      });
    }

    const result = await pool.quer
