/**
 * Timetable Controller
 * Handles timetable entry CRUD with conflict detection.
 * Supports grid-based scheduling (classrooms x time slots).
 */
const pool = require('../config/db');

async function checkConflicts(classroom_id, tutor_id, class_id, day_of_week, start_time, end_time, excludeId = null) {
  const conflicts = [];
  const excludeClause = excludeId ? ' AND te.id != $6' : '';
  
  const roomParams = [classroom_id, day_of_week, start_time, end_time];
  if (excludeId) roomParams.push(excludeId);
  
  const roomConflict = await pool.query(
    `SELECT te.*, u.name as unit_name, u.code as unit_code, c.room_number
     FROM timetable_entries te
     JOIN units u ON te.unit_id = u.id
     JOIN classrooms c ON te.classroom_id = c.id
     WHERE te.classroom_id = $1 
       AND te.day_of_week = $2
       AND te.start_time < $4 
       AND te.end_time > $3
       ${excludeClause}`,
    roomParams
  );
  if (roomConflict.rows.length > 0) {
    const c = roomConflict.rows[0];
    conflicts.push({
      type: 'classroom',
      message: `Room ${c.room_number} is already booked for ${c.unit_name} (${c.unit_code}) from ${c.start_time} to ${c.end_time}`,
      existing: c
    });
  }

  const tutorParams = [tutor_id, day_of_week, start_time, end_time];
  if (excludeId) tutorParams.push(excludeId);
  
  const tutorConflict = await pool.query(
    `SELECT te.*, u.name as unit_name, u.code as unit_code, t.name as tutor_name
     FROM timetable_entries te
     JOIN units u ON te.unit_id = u.id
     JOIN tutors t ON te.tutor_id = t.id
     WHERE te.tutor_id = $1 
       AND te.day_of_week = $2
       AND te.start_time < $4 
       AND te.end_time > $3
       ${excludeClause}`,
    tutorParams
  );
  if (tutorConflict.rows.length > 0) {
    const c = tutorConflict.rows[0];
    conflicts.push({
      type: 'tutor',
      message: `Tutor ${c.tutor_name} is already assigned to ${c.unit_name} (${c.unit_code}) from ${c.start_time} to ${c.end_time}`,
      existing: c
    });
  }

  if (class_id) {
    const classConflict = await pool.query(
      `SELECT te.*, u.name as unit_name, u.code as unit_code, cl.group_name
       FROM timetable_entries te
       JOIN units u ON te.unit_id = u.id
       JOIN classes cl ON te.class_id = cl.id
       WHERE te.class_id = $1 
         AND te.day_of_week = $2
         AND te.start_time < $4 
         AND te.end_time > $3
         ${excludeClause}`,
      [class_id, day_of_week, start_time, end_time]
    );
    if (classConflict.rows.length > 0) {
      const c = classConflict.rows[0];
      conflicts.push({
        type: 'class',
        message: `${c.unit_name} ${c.group_name} is already scheduled from ${c.start_time} to ${c.end_time}`,
        existing: c
      });
    }
  }

  return conflicts;
}

async function validateRoomType(classroom_id, required_room_type) {
  const result = await pool.query('SELECT type FROM classrooms WHERE id = $1', [classroom_id]);
  if (result.rows.length === 0) {
    return { valid: false, message: 'Classroom not found' };
  }
  const roomType = result.rows[0].type;
  if (roomType !== required_room_type) {
    return { 
      valid: false, 
      message: `Room type mismatch: ${required_room_type} room required, but ${roomType} room provided` 
    };
  }
  return { valid: true };
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
  
  const startParts = start.split(':');
  const endParts = end.split(':');
  const startMinutes = parseInt(startParts[0]) * 60 + parseInt(startParts[1]);
  const endMinutes = parseInt(endParts[0]) * 60 + parseInt(endParts[1]);
  
  if (startMinutes % 30 !== 0) {
    errors.push('Start time must be on a 30-minute interval');
  }
  
  if (endMinutes % 30 !== 0) {
    errors.push('End time must be on a 30-minute interval');
  }
  
  return errors;
}

async function getAll(req, res) {
  try {
    const { trimester_id, degree_id, classroom_id, day_of_week } = req.query;
    let query = `
      SELECT te.*,
        u.name as unit_name, u.code as unit_code,
        c.room_number, c.location as room_location, c.type as room_type, c.max_capacity,
        t.name as tutor_name, t.email as tutor_email,
        d.name as degree_name, d.code as degree_code,
        tr.name as trimester_name,
        cl.group_name, cl.required_room_type, cl.duration as class_duration
      FROM timetable_entries te
      JOIN units u ON te.unit_id = u.id
      JOIN classes cl ON te.class_id = cl.id
      JOIN classrooms c ON te.classroom_id = c.id
      JOIN tutors t ON te.tutor_id = t.id
      JOIN trimesters tr ON te.trimester_id = tr.id
      JOIN degrees d ON u.degree_id = d.id
      WHERE 1=1
    `;
    const params = [];
    let paramIdx = 1;

    if (trimester_id) {
      query += ` AND te.trimester_id = $${paramIdx++}`;
      params.push(trimester_id);
    }
    if (degree_id) {
      query += ` AND u.degree_id = $${paramIdx++}`;
      params.push(degree_id);
    }
    if (classroom_id) {
      query += ` AND te.classroom_id = $${paramIdx++}`;
      params.push(classroom_id);
    }
    if (day_of_week) {
      query += ` AND te.day_of_week = $${paramIdx++}`;
      params.push(day_of_week);
    }
    query += ' ORDER BY te.day_of_week, te.start_time';

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
    const { degree_id, classroom_id, day_of_week } = req.query;

    let query = `SELECT te.*,
        u.name as unit_name, u.code as unit_code,
        c.room_number, c.location as room_location, c.max_capacity, c.type as room_type,
        t.name as tutor_name, t.email as tutor_email,
        cl.group_name, cl.required_room_type, cl.duration as class_duration
      FROM timetable_entries te
      JOIN units u ON te.unit_id = u.id
      JOIN classes cl ON te.class_id = cl.id
      JOIN classrooms c ON te.classroom_id = c.id
      JOIN tutors t ON te.tutor_id = t.id
      WHERE te.trimester_id = $1`;
    const params = [trimesterId];
    let paramIdx = 2;

    if (degree_id) {
      query += ` AND u.degree_id = $${paramIdx++}`;
      params.push(degree_id);
    }
    if (classroom_id) {
      query += ` AND te.classroom_id = $${paramIdx++}`;
      params.push(classroom_id);
    }
    if (day_of_week) {
      query += ` AND te.day_of_week = $${paramIdx++}`;
      params.push(day_of_week);
    }
    
    query += ` ORDER BY c.room_number, te.start_time`;

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

async function getGrid(req, res) {
  try {
    const { trimesterId, classroom_id, day_of_week } = req.query;
    
    const trimResult = await pool.query('SELECT * FROM trimesters WHERE id = $1', [trimesterId]);
    if (trimResult.rows.length === 0) {
      return res.status(404).json({ error: 'Trimester not found' });
    }
    const trimester = trimResult.rows[0];

    let classroomQuery = 'SELECT * FROM classrooms WHERE is_available = true';
    const classroomParams = [];
    if (classroom_id) {
      classroomQuery += ' AND id = $1';
      classroomParams.push(classroom_id);
    }
    classroomQuery += ' ORDER BY room_number';
    const classroomResult = await pool.query(classroomQuery, classroomParams);
    const classrooms = classroomResult.rows;

    let entryQuery = `
      SELECT te.*,
        u.name as unit_name, u.code as unit_code,
        t.name as tutor_name,
        cl.group_name, cl.required_room_type, cl.duration as class_duration
      FROM timetable_entries te
      JOIN units u ON te.unit_id = u.id
      JOIN classes cl ON te.class_id = cl.id
      JOIN tutors t ON te.tutor_id = t.id
      WHERE te.trimester_id = $1
    `;
    const entryParams = [trimesterId];

    if (classroom_id) {
      entryQuery += ' AND te.classroom_id = $2';
      entryParams.push(classroom_id);
    }
    if (day_of_week) {
      entryQuery += ` AND te.day_of_week = $${entryParams.length + 1}`;
      entryParams.push(day_of_week);
    }

    const entryResult = await pool.query(entryQuery, entryParams);
    const entries = entryResult.rows;

    res.json({
      trimester,
      classrooms,
      entries,
      timeSlots: generateTimeSlots()
    });
  } catch (err) {
    console.error('Error fetching grid data:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

function generateTimeSlots() {
  const slots = [];
  for (let hour = 8; hour < 22; hour++) {
    slots.push(`${hour.toString().padStart(2, '0')}:00`);
    slots.push(`${hour.toString().padStart(2, '0')}:30`);
  }
  return slots;
}

async function validateEntry(req, res) {
  try {
    const { class_id, classroom_id, tutor_id, day_of_week, start_time, end_time, exclude_id } = req.body;
    
    const timeErrors = validateTimeRange(start_time, end_time);
    if (timeErrors.length > 0) {
      return res.status(400).json({ valid: false, errors: timeErrors });
    }

    if (class_id) {
      const classResult = await pool.query(
        'SELECT * FROM classes WHERE id = $1',
        [class_id]
      );
      if (classResult.rows.length > 0) {
        const cls = classResult.rows[0];
        const roomValidation = await validateRoomType(classroom_id, cls.required_room_type);
        if (!roomValidation.valid) {
          return res.status(400).json({ valid: false, errors: [roomValidation.message] });
        }
      }
    }

    const conflicts = await checkConflicts(classroom_id, tutor_id, class_id, day_of_week, start_time, end_time, exclude_id);
    res.json({ 
      valid: conflicts.length === 0,
      conflicts
    });
  } catch (err) {
    console.error('Error checking conflicts:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function create(req, res) {
  const client = await pool.connect();
  try {
    const { class_id, unit_id, classroom_id, tutor_id, trimester_id, day_of_week, start_time, end_time, is_recurring = true, week_number = null } = req.body;
    
    if (!class_id || !unit_id || !classroom_id || !tutor_id || !trimester_id || !day_of_week || !start_time || !end_time) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const timeErrors = validateTimeRange(start_time, end_time);
    if (timeErrors.length > 0) {
      return res.status(400).json({ error: timeErrors.join(', ') });
    }

    const classResult = await client.query('SELECT * FROM classes WHERE id = $1', [class_id]);
    if (classResult.rows.length === 0) {
      return res.status(404).json({ error: 'Class not found' });
    }
    const cls = classResult.rows[0];

    const roomValidation = await validateRoomType(classroom_id, cls.required_room_type);
    if (!roomValidation.valid) {
      return res.status(400).json({ error: roomValidation.message });
    }

    const conflicts = await checkConflicts(classroom_id, tutor_id, class_id, day_of_week, start_time, end_time);
    if (conflicts.length > 0) {
      return res.status(409).json({ 
        error: 'Scheduling conflict detected',
        conflicts 
      });
    }

    const result = await client.query(
      `INSERT INTO timetable_entries (class_id, unit_id, classroom_id, tutor_id, trimester_id, day_of_week, start_time, end_time, is_recurring, week_number)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [class_id, unit_id, classroom_id, tutor_id, trimester_id, day_of_week, start_time, end_time, is_recurring, week_number]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating timetable entry:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
}

async function update(req, res) {
  try {
    const { id } = req.params;
    const { class_id, unit_id, classroom_id, tutor_id, trimester_id, day_of_week, start_time, end_time, is_recurring, week_number } = req.body;

    const current = await pool.query('SELECT te.*, cl.required_room_type FROM timetable_entries te JOIN classes cl ON te.class_id = cl.id WHERE te.id = $1', [id]);
    if (current.rows.length === 0) {
      return res.status(404).json({ error: 'Timetable entry not found' });
    }
    const entry = current.rows[0];

    const newClassroom = classroom_id || entry.classroom_id;
    const newTutor = tutor_id || entry.tutor_id;
    const newClass = class_id || entry.class_id;
    const newDay = day_of_week || entry.day_of_week;
    const newStart = start_time || entry.start_time;
    const newEnd = end_time || entry.end_time;

    const timeErrors = validateTimeRange(newStart, newEnd);
    if (timeErrors.length > 0) {
      return res.status(400).json({ error: timeErrors.join(', ') });
    }

    if (class_id) {
      const classResult = await pool.query('SELECT * FROM classes WHERE id = $1', [class_id]);
      if (classResult.rows.length > 0) {
        const cls = classResult.rows[0];
        const roomValidation = await validateRoomType(newClassroom, cls.required_room_type);
        if (!roomValidation.valid) {
          return res.status(400).json({ error: roomValidation.message });
        }
      }
    }

    const conflicts = await checkConflicts(newClassroom, newTutor, newClass, newDay, newStart, newEnd, id);
    if (conflicts.length > 0) {
      return res.status(409).json({ 
        error: 'Scheduling conflict detected',
        conflicts 
      });
    }

    const result = await pool.query(
      `UPDATE timetable_entries SET 
        class_id = COALESCE($1, class_id),
        unit_id = COALESCE($2, unit_id),
        classroom_id = COALESCE($3, classroom_id),
        tutor_id = COALESCE($4, tutor_id),
        trimester_id = COALESCE($5, trimester_id),
        day_of_week = COALESCE($6, day_of_week),
        start_time = COALESCE($7, start_time),
        end_time = COALESCE($8, end_time),
        is_recurring = COALESCE($9, is_recurring),
        week_number = $10,
        updated_at = NOW()
       WHERE id = $11 RETURNING *`,
      [class_id, unit_id, classroom_id, tutor_id, trimester_id, day_of_week, start_time, end_time, is_recurring, week_number, id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating timetable entry:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function remove(req, res) {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM timetable_entries WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Timetable entry not found' });
    }
    res.json({ message: 'Timetable entry deleted successfully' });
  } catch (err) {
    console.error('Error deleting timetable entry:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function scheduleClass(req, res) {
  const client = await pool.connect();
  try {
    const { class_id, unit_id, classroom_id, tutor_id, trimester_id, day_of_week, start_time, end_time, create_recurring = true } = req.body;
    
    if (!class_id || !unit_id || !classroom_id || !tutor_id || !trimester_id || !day_of_week || !start_time || !end_time) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const timeErrors = validateTimeRange(start_time, end_time);
    if (timeErrors.length > 0) {
      return res.status(400).json({ error: timeErrors.join(', ') });
    }

    const classResult = await client.query('SELECT * FROM classes WHERE id = $1', [class_id]);
    if (classResult.rows.length === 0) {
      return res.status(404).json({ error: 'Class not found' });
    }
    const cls = classResult.rows[0];

    const roomValidation = await validateRoomType(classroom_id, cls.required_room_type);
    if (!roomValidation.valid) {
      return res.status(400).json({ error: roomValidation.message });
    }

    await client.query('BEGIN');

    const entries = [];
    if (create_recurring) {
      const existingRecurring = await client.query(
        'SELECT id FROM timetable_entries WHERE class_id = $1 AND is_recurring = true',
        [class_id]
      );
      if (existingRecurring.rows.length > 0) {
        await client.query('DELETE FROM timetable_entries WHERE class_id = $1 AND is_recurring = true', [class_id]);
      }
      
      const result = await client.query(
        `INSERT INTO timetable_entries (class_id, unit_id, classroom_id, tutor_id, trimester_id, day_of_week, start_time, end_time, is_recurring)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true) RETURNING *`,
        [class_id, unit_id, classroom_id, tutor_id, trimester_id, day_of_week, start_time, end_time]
      );
      entries.push(result.rows[0]);
    } else {
      const conflicts = await checkConflicts(classroom_id, tutor_id, class_id, day_of_week, start_time, end_time);
      if (conflicts.length > 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'Scheduling conflict detected', conflicts });
      }
      const result = await client.query(
        `INSERT INTO timetable_entries (class_id, unit_id, classroom_id, tutor_id, trimester_id, day_of_week, start_time, end_time, is_recurring)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, false) RETURNING *`,
        [class_id, unit_id, classroom_id, tutor_id, trimester_id, day_of_week, start_time, end_time]
      );
      entries.push(result.rows[0]);
    }

    await client.query('COMMIT');
    res.status(201).json({
      message: create_recurring ? 'Class scheduled as recurring' : 'Class scheduled for single occurrence',
      entries
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error scheduling class:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
}

module.exports = { 
  getAll, 
  getKanban, 
  getGrid,
  validateEntry, 
  create, 
  update, 
  remove,
  scheduleClass,
  checkConflicts,
  validateRoomType,
  validateTimeRange
};
