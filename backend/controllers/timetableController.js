/**
 * Timetable Controller
 * Handles timetable entry CRUD with conflict detection.
 * Supports grid-based scheduling (classrooms x time slots).
 */
const pool = require('../config/db');
const { ensureAcademicSchema } = require('../utils/academicSchema');
const {
  checkAvailability: checkTutorAvailability,
  ensureTutorAvailabilitySchema
} = require('./tutorAvailabilityController');

async function checkConflicts(classroom_id, tutor_id, class_id, trimester_id, day_of_week, start_time, end_time, excludeId = null) {
  // A valid timetable entry must not overlap the same room, tutor, or class
  // group in the same teaching period. Time overlap uses half-open intervals:
  // existing.start < new.end AND existing.end > new.start.
  const conflicts = [];
  
  if (!classroom_id || !day_of_week || !start_time || !end_time) {
    return conflicts;
  }
  
  const roomParams = [classroom_id, day_of_week, start_time, end_time];
  let roomTrimesterClause = '';
  let roomExcludeClause = '';
  if (trimester_id) {
    roomTrimesterClause = ` AND te.trimester_id = $${roomParams.length + 1}`;
    roomParams.push(trimester_id);
  }
  if (excludeId) {
    roomExcludeClause = ` AND te.id != $${roomParams.length + 1}`;
    roomParams.push(excludeId);
  }
  
  const roomConflict = await pool.query(
    `SELECT te.*, u.name as unit_name, u.code as unit_code, c.room_number
     FROM timetable_entries te
     JOIN units u ON te.unit_id = u.id
     JOIN classrooms c ON te.classroom_id = c.id
     WHERE te.classroom_id = $1 
       AND te.day_of_week = $2
       AND te.start_time < $4 
       AND te.end_time > $3
       ${roomTrimesterClause}
       ${roomExcludeClause}`,
    roomParams
  );
  if (roomConflict.rows.length > 0) {
    const c = roomConflict.rows[0];
    conflicts.push({
      type: 'classroom',
      message: `CLASSROOM CONFLICT: Room ${c.room_number} is already booked for ${c.unit_name} (${c.unit_code}) on ${c.day_of_week} from ${c.start_time} to ${c.end_time}`,
      existing: c
    });
  }

  const tutorParams = [tutor_id, day_of_week, start_time, end_time];
  let tutorTrimesterClause = '';
  let tutorExcludeClause = '';
  if (trimester_id) {
    tutorTrimesterClause = ` AND te.trimester_id = $${tutorParams.length + 1}`;
    tutorParams.push(trimester_id);
  }
  if (excludeId) {
    tutorExcludeClause = ` AND te.id != $${tutorParams.length + 1}`;
    tutorParams.push(excludeId);
  }
  
  const tutorConflict = await pool.query(
    `SELECT te.*, u.name as unit_name, u.code as unit_code, t.name as tutor_name
     FROM timetable_entries te
     JOIN units u ON te.unit_id = u.id
     JOIN tutors t ON te.tutor_id = t.id
     WHERE te.tutor_id = $1 
       AND te.day_of_week = $2
       AND te.start_time < $4 
       AND te.end_time > $3
       ${tutorTrimesterClause}
       ${tutorExcludeClause}`,
    tutorParams
  );
  if (tutorConflict.rows.length > 0) {
    const c = tutorConflict.rows[0];
    conflicts.push({
      type: 'tutor',
      message: `TUTOR CONFLICT: Tutor ${c.tutor_name} is already assigned to ${c.unit_name} (${c.unit_code}) on ${c.day_of_week} from ${c.start_time} to ${c.end_time}`,
      existing: c
    });
  }

  if (class_id) {
    const classParams = [class_id, day_of_week, start_time, end_time];
    let classTrimesterClause = '';
    let classExcludeClause = '';
    if (trimester_id) {
      classTrimesterClause = ` AND te.trimester_id = $${classParams.length + 1}`;
      classParams.push(trimester_id);
    }
    if (excludeId) {
      classExcludeClause = ` AND te.id != $${classParams.length + 1}`;
      classParams.push(excludeId);
    }
    
    const classConflict = await pool.query(
      `SELECT te.*, u.name as unit_name, u.code as unit_code, cl.group_name
       FROM timetable_entries te
       JOIN units u ON te.unit_id = u.id
       JOIN classes cl ON te.class_id = cl.id
       WHERE te.class_id = $1 
         AND te.day_of_week = $2
         AND te.start_time < $4 
         AND te.end_time > $3
         ${classTrimesterClause}
         ${classExcludeClause}`,
      classParams
    );
    if (classConflict.rows.length > 0) {
      const c = classConflict.rows[0];
      conflicts.push({
        type: 'class',
        message: `COURSE CONFLICT: ${c.unit_name} ${c.group_name} is already scheduled on ${c.day_of_week} from ${c.start_time} to ${c.end_time}`,
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

async function validateRoomSuitability(classroom_id, cls) {
  const result = await pool.query(
    'SELECT type, max_capacity, is_available FROM classrooms WHERE id = $1',
    [classroom_id]
  );
  if (result.rows.length === 0) {
    return { valid: false, message: 'Classroom not found' };
  }

  const room = result.rows[0];
  if (!room.is_available) {
    return { valid: false, message: 'Classroom is not available' };
  }
  if (room.type !== cls.required_room_type) {
    return {
      valid: false,
      message: `Room type mismatch: ${cls.required_room_type} room required, but ${room.type} room provided`
    };
  }
  if (Number(room.max_capacity) < Number(cls.max_capacity || 0)) {
    return {
      valid: false,
      message: `Room capacity too small: capacity ${room.max_capacity}, class requires ${cls.max_capacity}`
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
    await ensureTutorAvailabilitySchema();
    await ensureAcademicSchema();
    const { trimester_id, degree_id, classroom_id, day_of_week } = req.query;
    let query = `
      SELECT te.*,
        u.name as unit_name, u.code as unit_code,
        c.room_number, c.location as room_location, c.type as room_type, c.max_capacity,
        t.name as tutor_name, t.email as tutor_email,
        d.name as degree_name, d.code as degree_code,
        tr.name as trimester_name,
        cl.group_name, cl.required_room_type, cl.duration as class_duration,
        CASE
          -- Surface warnings for entries that remain scheduled after tutor
          -- availability changes. The UI uses this flag to highlight cards.
          WHEN EXISTS (
            SELECT 1 FROM tutor_availability ta
            WHERE ta.tutor_id = te.tutor_id
              AND ta.trimester_id = te.trimester_id
              AND ta.availability_scope = 'DAY'
          ) THEN NOT EXISTS (
            SELECT 1 FROM tutor_availability ta
            WHERE ta.tutor_id = te.tutor_id
              AND ta.trimester_id = te.trimester_id
              AND ta.availability_scope = 'DAY'
              AND ta.day_of_week = te.day_of_week
              AND (
                (ta.start_time IS NULL AND ta.end_time IS NULL)
                OR (ta.start_time <= te.start_time AND ta.end_time >= te.end_time)
              )
          )
          WHEN EXISTS (
            SELECT 1 FROM tutor_availability ta
            WHERE ta.tutor_id = te.tutor_id
              AND ta.trimester_id = te.trimester_id
              AND ta.availability_scope = 'PERIOD'
          ) THEN false
          WHEN EXISTS (
            SELECT 1 FROM tutor_availability ta
            WHERE ta.tutor_id = te.tutor_id
              AND ta.academic_year_id = tr.academic_year_id
              AND ta.availability_scope = 'YEAR'
          ) THEN false
          ELSE true
        END as tutor_availability_conflict
      FROM timetable_entries te
      JOIN units u ON te.unit_id = u.id
      JOIN classes cl ON te.class_id = cl.id
      JOIN classrooms c ON te.classroom_id = c.id
      JOIN tutors t ON te.tutor_id = t.id
      JOIN trimesters tr ON te.trimester_id = tr.id
      JOIN unit_degrees ud ON u.id = ud.unit_id
      JOIN degrees d ON ud.degree_id = d.id
      WHERE u.status = 'published' AND d.status = 'published' AND tr.status = 'published'
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
    await ensureAcademicSchema();
    const { trimesterId } = req.params;
    const { degree_id, classroom_id, day_of_week } = req.query;

    let query = `SELECT te.*,
        u.name as unit_name, u.code as unit_code,
        c.room_number, c.location as room_location, c.max_capacity, c.type as room_type,
        t.name as tutor_name, t.email as tutor_email,
        cl.group_name, cl.required_room_type, cl.duration as class_duration
      FROM timetable_entries te
      JOIN units u ON te.unit_id = u.id
      JOIN unit_degrees ud ON u.id = ud.unit_id
      JOIN classes cl ON te.class_id = cl.id
      JOIN classrooms c ON te.classroom_id = c.id
      JOIN tutors t ON te.tutor_id = t.id
      JOIN trimesters tr ON te.trimester_id = tr.id
      JOIN degrees d ON ud.degree_id = d.id
      WHERE te.trimester_id = $1
        AND u.status = 'published'
        AND d.status = 'published'
        AND tr.status = 'published'`;
    const params = [trimesterId];
    let paramIdx = 2;

    if (degree_id) {
      query += ` AND ud.degree_id = $${paramIdx++}`;
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
    await ensureAcademicSchema();
    const { trimesterId } = req.params;
    const { classroom_id, day_of_week } = req.query;
    
    const trimResult = await pool.query("SELECT * FROM trimesters WHERE id = $1 AND status = 'published'", [trimesterId]);
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
      JOIN trimesters tr ON te.trimester_id = tr.id
      WHERE te.trimester_id = $1
        AND u.status = 'published'
        AND tr.status = 'published'
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
    const { class_id, classroom_id, tutor_id, trimester_id, day_of_week, start_time, end_time, exclude_id } = req.body;
    
    const timeErrors = validateTimeRange(start_time, end_time);
    if (timeErrors.length > 0) {
      return res.status(400).json({ valid: false, errors: timeErrors });
    }

    if (trimester_id) {
      const periodResult = await pool.query(
        "SELECT id FROM trimesters WHERE id = $1 AND status = 'published'",
        [trimester_id]
      );
      if (periodResult.rows.length === 0) {
        return res.status(404).json({ valid: false, errors: ['Teaching period not found'] });
      }
    }

    if (class_id) {
      const classResult = await pool.query(
        `SELECT cl.*
         FROM classes cl
         JOIN trimesters tr ON cl.trimester_id = tr.id
         WHERE cl.id = $1
           AND tr.status = 'published'
           AND ($2::uuid IS NULL OR cl.trimester_id = $2)`,
        [class_id, trimester_id || null]
      );
      if (classResult.rows.length === 0) {
        return res.status(404).json({ valid: false, errors: ['Class not found'] });
      }

      const cls = classResult.rows[0];
      const roomValidation = await validateRoomSuitability(classroom_id, cls);
      if (!roomValidation.valid) {
        return res.status(400).json({ valid: false, errors: [roomValidation.message] });
      }
    }

    // Check tutor availability
    if (tutor_id && trimester_id && day_of_week && start_time && end_time) {
      const tutorAvailable = await checkTutorAvailability(tutor_id, trimester_id, day_of_week, start_time, end_time);
      if (!tutorAvailable) {
        return res.status(400).json({
          valid: false,
          errors: ['Tutor is not available for this trimester, day, or time.']
        });
      }
    }

    const conflicts = await checkConflicts(classroom_id, tutor_id, class_id, trimester_id, day_of_week, start_time, end_time, exclude_id);
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

    const classResult = await client.query(
      `SELECT cl.*
       FROM classes cl
       JOIN units u ON cl.unit_id = u.id
       JOIN trimesters tr ON cl.trimester_id = tr.id
       WHERE cl.id = $1
         AND cl.trimester_id = $2
         AND u.status = 'published'
         AND tr.status = 'published'`,
      [class_id, trimester_id]
    );
    if (classResult.rows.length === 0) {
      return res.status(404).json({ error: 'Class not found' });
    }
    const cls = classResult.rows[0];

    const roomValidation = await validateRoomSuitability(classroom_id, cls);
    if (!roomValidation.valid) {
      return res.status(400).json({ error: roomValidation.message });
    }

    // Check tutor availability
    const tutorAvailable = await checkTutorAvailability(tutor_id, trimester_id, day_of_week, start_time, end_time);
    if (!tutorAvailable) {
      return res.status(409).json({
        error: 'Tutor is not available for this trimester, day, or time.'
      });
    }

    const conflicts = await checkConflicts(classroom_id, tutor_id, class_id, trimester_id, day_of_week, start_time, end_time);
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

    const current = await pool.query('SELECT te.*, cl.required_room_type, cl.max_capacity FROM timetable_entries te JOIN classes cl ON te.class_id = cl.id WHERE te.id = $1', [id]);
    if (current.rows.length === 0) {
      return res.status(404).json({ error: 'Timetable entry not found' });
    }
    const entry = current.rows[0];

    const newClassroom = classroom_id || entry.classroom_id;
    const newTutor = tutor_id || entry.tutor_id;
    const newClass = class_id || entry.class_id;
    const newTrimester = trimester_id || entry.trimester_id;
    const newDay = day_of_week || entry.day_of_week;
    const newStart = start_time || entry.start_time;
    const newEnd = end_time || entry.end_time;

    const timeErrors = validateTimeRange(newStart, newEnd);
    if (timeErrors.length > 0) {
      return res.status(400).json({ error: timeErrors.join(', ') });
    }

    let classForValidation = entry;
    if (newTrimester) {
      const periodResult = await pool.query(
        "SELECT id FROM trimesters WHERE id = $1 AND status = 'published'",
        [newTrimester]
      );
      if (periodResult.rows.length === 0) {
        return res.status(404).json({ error: 'Teaching period not found' });
      }
    }

    const classPeriodResult = await pool.query(
      'SELECT id FROM classes WHERE id = $1 AND trimester_id = $2',
      [newClass, newTrimester]
    );
    if (classPeriodResult.rows.length === 0) {
      return res.status(400).json({ error: 'Class does not belong to the selected teaching period' });
    }

    if (class_id && class_id !== entry.class_id) {
      const classResult = await pool.query(
        'SELECT * FROM classes WHERE id = $1 AND trimester_id = $2',
        [class_id, newTrimester]
      );
      if (classResult.rows.length === 0) {
        return res.status(404).json({ error: 'Class not found' });
      }
      classForValidation = classResult.rows[0];
    }

    const roomValidation = await validateRoomSuitability(newClassroom, classForValidation);
    if (!roomValidation.valid) {
      return res.status(400).json({ error: roomValidation.message });
    }

    // Check tutor availability
    const tutorAvailable = await checkTutorAvailability(newTutor, newTrimester, newDay, newStart, newEnd);
    if (!tutorAvailable) {
      return res.status(409).json({
        error: 'Tutor is not available for this trimester, day, or time.'
      });
    }

    const conflicts = await checkConflicts(newClassroom, newTutor, newClass, newTrimester, newDay, newStart, newEnd, id);
    if (conflicts.length > 0) {
      return res.status(409).json({
        error: 'Scheduling conflict detected',
        conflicts
      });
    }

    const updates = [];
    const params = [];
    let paramCount = 1;

    if (class_id !== undefined) { params.push(class_id); updates.push(`class_id = $${paramCount++}`); }
    if (unit_id !== undefined) { params.push(unit_id); updates.push(`unit_id = $${paramCount++}`); }
    if (classroom_id !== undefined) { params.push(classroom_id); updates.push(`classroom_id = $${paramCount++}`); }
    if (tutor_id !== undefined) { params.push(tutor_id); updates.push(`tutor_id = $${paramCount++}`); }
    if (trimester_id !== undefined) { params.push(trimester_id); updates.push(`trimester_id = $${paramCount++}`); }
    if (day_of_week !== undefined) { params.push(day_of_week); updates.push(`day_of_week = $${paramCount++}`); }
    if (start_time !== undefined) { params.push(start_time); updates.push(`start_time = $${paramCount++}`); }
    if (end_time !== undefined) { params.push(end_time); updates.push(`end_time = $${paramCount++}`); }
    if (is_recurring !== undefined) { params.push(is_recurring); updates.push(`is_recurring = $${paramCount++}`); }
    if (week_number !== undefined) { params.push(week_number); updates.push(`week_number = $${paramCount++}`); }

    params.push(id);

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    const result = await pool.query(
      `UPDATE timetable_entries SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${paramCount} RETURNING *`,
      params
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

    const classResult = await client.query(
      `SELECT cl.*
       FROM classes cl
       JOIN units u ON cl.unit_id = u.id
       JOIN trimesters tr ON cl.trimester_id = tr.id
       WHERE cl.id = $1
         AND cl.trimester_id = $2
         AND u.status = 'published'
         AND tr.status = 'published'`,
      [class_id, trimester_id]
    );
    if (classResult.rows.length === 0) {
      return res.status(404).json({ error: 'Class not found' });
    }
    const cls = classResult.rows[0];

    const roomValidation = await validateRoomSuitability(classroom_id, cls);
    if (!roomValidation.valid) {
      return res.status(400).json({ error: roomValidation.message });
    }

    // Check tutor availability
    const tutorAvailable = await checkTutorAvailability(tutor_id, trimester_id, day_of_week, start_time, end_time);
    if (!tutorAvailable) {
      return res.status(409).json({
        error: 'Tutor is not available for this trimester, day, or time.'
      });
    }

    await client.query('BEGIN');

    const entries = [];
    if (create_recurring) {
      // Recurring schedules represent the normal weekly class. Replacing the
      // previous recurring row keeps one canonical entry per generated class.
      const existingRecurring = await client.query(
        'SELECT id FROM timetable_entries WHERE class_id = $1 AND is_recurring = true',
        [class_id]
      );
      const excludeId = existingRecurring.rows[0]?.id || null;
      const conflicts = await checkConflicts(classroom_id, tutor_id, class_id, trimester_id, day_of_week, start_time, end_time, excludeId);
      if (conflicts.length > 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'Scheduling conflict detected', conflicts });
      }

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
      const conflicts = await checkConflicts(classroom_id, tutor_id, class_id, trimester_id, day_of_week, start_time, end_time);
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
