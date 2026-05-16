-- ============================================
-- Seed Data for TTMS
-- ============================================

-- Insert admin user (password: admin123)
INSERT INTO users (email, password_hash, full_name, role) VALUES
('admin@ttms.edu', '$2a$10$xVqYLGGw0E5WxMBM0dKQ.OV8JLRdKRC1LN7kGFPB.KA1z3EWF.4Oi', 'System Admin', 'admin');

-- Insert student user (password: student123)
INSERT INTO users (email, password_hash, full_name, role) VALUES
('student@ttms.edu', '$2a$10$xVqYLGGw0E5WxMBM0dKQ.OV8JLRdKRC1LN7kGFPB.KA1z3EWF.4Oi', 'Jane Student', 'student');

-- Insert degrees
INSERT INTO degrees (name, code) VALUES
('Bachelor of Computer Science', 'BCS'),
('Bachelor of Information Technology', 'BIT'),
('Master of Information Technology', 'ICT-MSC');

-- Insert academic year and teaching periods
INSERT INTO academic_years (year, source_type, status) VALUES
(2026, 'manual', 'published')
ON CONFLICT (year) DO NOTHING;

INSERT INTO trimesters (academic_year_id, type, code, period_number, name, start_date, end_date, classes_start_date, classes_end_date, status) VALUES
((SELECT id FROM academic_years WHERE year = 2026), 'TRIMESTER', 'T1', 1, 'Trimester 1, 2026', '2026-03-02', '2026-06-19', '2026-03-02', '2026-05-29', 'published'),
((SELECT id FROM academic_years WHERE year = 2026), 'TRIMESTER', 'T2', 2, 'Trimester 2, 2026', '2026-07-13', '2026-10-30', '2026-07-13', '2026-10-09', 'published');

-- Insert classrooms
INSERT INTO classrooms (room_number, location, max_capacity, type) VALUES
('L101', 'Building A', 25, 'lab'),
('L102', 'Building A', 25, 'lab'),
('R201', 'Building B', 30, 'normal'),
('R202', 'Building B', 30, 'normal'),
('R301', 'Building C', 50, 'normal');

-- Insert tutors
INSERT INTO tutors (name, email) VALUES
('Dr. Sarah Chen', 'sarah.chen@ttms.edu'),
('Prof. James Wilson', 'james.wilson@ttms.edu'),
('Dr. Emily Rodriguez', 'emily.rodriguez@ttms.edu'),
('Prof. Michael Brown', 'michael.brown@ttms.edu');

-- Insert courses with new fields (total_students, class_duration)
INSERT INto courses (name, code, classroom_type, total_students, class_duration) VALUES
('Introduction to Programming', 'ICT100', 'lab', 60, 2),
('Data Structures', 'ICT200', 'normal', 45, 2),
('Database Systems', 'ICT210', 'lab', 50, 2),
('Web Development', 'ICT220', 'lab', 70, 2),
('Advanced Algorithms', 'ICT300', 'normal', 30, 1),
('Machine Learning', 'ICT400', 'lab', 25, 3);

-- Assign courses to degrees
INSERT INTO unit_degrees (unit_id, degree_id) VALUES
((SELECT id FROM units WHERE code = 'ICT100'), (SELECT id FROM degrees WHERE code = 'BCS')),
((SELECT id FROM units WHERE code = 'ICT200'), (SELECT id FROM degrees WHERE code = 'BCS')),
((SELECT id FROM units WHERE code = 'ICT210'), (SELECT id FROM degrees WHERE code = 'BCS')),
((SELECT id FROM units WHERE code = 'ICT220'), (SELECT id FROM degrees WHERE code = 'BCS')),
((SELECT id FROM units WHERE code = 'ICT300'), (SELECT id FROM degrees WHERE code = 'BCS')),
((SELECT id FROM units WHERE code = 'ICT400'), (SELECT id FROM degrees WHERE code = 'ICT-MSC'));

-- Assign courses to generic offering patterns
INSERT INTO unit_offering_patterns (unit_id, period_type, period_number, code) VALUES
((SELECT id FROM units WHERE code = 'ICT100'), 'TRIMESTER', 1, 'T1'),
((SELECT id FROM units WHERE code = 'ICT200'), 'TRIMESTER', 1, 'T1'),
((SELECT id FROM units WHERE code = 'ICT210'), 'TRIMESTER', 1, 'T1'),
((SELECT id FROM units WHERE code = 'ICT220'), 'TRIMESTER', 1, 'T1'),
((SELECT id FROM units WHERE code = 'ICT300'), 'TRIMESTER', 1, 'T1'),
((SELECT id FROM units WHERE code = 'ICT400'), 'TRIMESTER', 1, 'T1');

-- Assign tutors to courses
INSERT INTO tutor_units (tutor_id, unit_id) VALUES
((SELECT id FROM tutors WHERE email = 'sarah.chen@ttms.edu'), (SELECT id FROM units WHERE code = 'ICT100')),
((SELECT id FROM tutors WHERE email = 'james.wilson@ttms.edu'), (SELECT id FROM units WHERE code = 'ICT200')),
((SELECT id FROM tutors WHERE email = 'emily.rodriguez@ttms.edu'), (SELECT id FROM units WHERE code = 'ICT210')),
((SELECT id FROM tutors WHERE email = 'michael.brown@ttms.edu'), (SELECT id FROM units WHERE code = 'ICT220')),
((SELECT id FROM tutors WHERE email = 'sarah.chen@ttms.edu'), (SELECT id FROM units WHERE code = 'ICT300')),
((SELECT id FROM tutors WHERE email = 'james.wilson@ttms.edu'), (SELECT id FROM units WHERE code = 'ICT400'));

-- Create class instances (auto-generated based on capacity)
-- ICT100: 60 students / 25 (lab cap) = 3 classes
INSERT INTO classes (unit_id, trimester_id, group_name, required_room_type, duration, max_capacity) VALUES
((SELECT id FROM units WHERE code = 'ICT100'), (SELECT id FROM trimesters WHERE name = 'Trimester 1, 2026' LIMIT 1), 'Group A', 'lab', 2, 25),
((SELECT id FROM units WHERE code = 'ICT100'), (SELECT id FROM trimesters WHERE name = 'Trimester 1, 2026' LIMIT 1), 'Group B', 'lab', 2, 25),
((SELECT id FROM units WHERE code = 'ICT100'), (SELECT id FROM trimesters WHERE name = 'Trimester 1, 2026' LIMIT 1), 'Group C', 'lab', 2, 25);

-- ICT200: 45 students / 30 (normal cap) = 2 classes
INSERT INTO classes (unit_id, trimester_id, group_name, required_room_type, duration, max_capacity) VALUES
((SELECT id FROM units WHERE code = 'ICT200'), (SELECT id FROM trimesters WHERE name = 'Trimester 1, 2026' LIMIT 1), 'Group A', 'normal', 2, 30),
((SELECT id FROM units WHERE code = 'ICT200'), (SELECT id FROM trimesters WHERE name = 'Trimester 1, 2026' LIMIT 1), 'Group B', 'normal', 2, 30);

-- ICT210: 50 students / 25 (lab cap) = 2 classes
INSERT INTO classes (unit_id, trimester_id, group_name, required_room_type, duration, max_capacity) VALUES
((SELECT id FROM units WHERE code = 'ICT210'), (SELECT id FROM trimesters WHERE name = 'Trimester 1, 2026' LIMIT 1), 'Group A', 'lab', 2, 25),
((SELECT id FROM units WHERE code = 'ICT210'), (SELECT id FROM trimesters WHERE name = 'Trimester 1, 2026' LIMIT 1), 'Group B', 'lab', 2, 25);

-- ICT220: 70 students / 25 (lab cap) = 3 classes
INSERT INTO classes (unit_id, trimester_id, group_name, required_room_type, duration, max_capacity) VALUES
((SELECT id FROM units WHERE code = 'ICT220'), (SELECT id FROM trimesters WHERE name = 'Trimester 1, 2026' LIMIT 1), 'Group A', 'lab', 2, 25),
((SELECT id FROM units WHERE code = 'ICT220'), (SELECT id FROM trimesters WHERE name = 'Trimester 1, 2026' LIMIT 1), 'Group B', 'lab', 2, 25),
((SELECT id FROM units WHERE code = 'ICT220'), (SELECT id FROM trimesters WHERE name = 'Trimester 1, 2026' LIMIT 1), 'Group C', 'lab', 2, 25);

-- ICT300: 30 students / 30 (normal cap) = 1 class
INSERT INTO classes (unit_id, trimester_id, group_name, required_room_type, duration, max_capacity) VALUES
((SELECT id FROM units WHERE code = 'ICT300'), (SELECT id FROM trimesters WHERE name = 'Trimester 1, 2026' LIMIT 1), 'Group A', 'normal', 1, 30);

-- ICT400: 25 students / 25 (lab cap) = 1 class
INSERT INTO classes (unit_id, trimester_id, group_name, required_room_type, duration, max_capacity) VALUES
((SELECT id FROM units WHERE code = 'ICT400'), (SELECT id FROM trimesters WHERE name = 'Trimester 1, 2026' LIMIT 1), 'Group A', 'lab', 3, 25);

-- Insert timetable entries with class_id references
INSERT INTO timetable_entries (class_id, unit_id, classroom_id, tutor_id, trimester_id, day_of_week, start_time, end_time, is_recurring) VALUES
((SELECT id FROM classes WHERE unit_id = (SELECT id FROM units WHERE code = 'ICT100') AND group_name = 'Group A'), (SELECT id FROM units WHERE code = 'ICT100'), (SELECT id FROM classrooms WHERE room_number = 'L101'), (SELECT id FROM tutors WHERE email = 'sarah.chen@ttms.edu'), (SELECT id FROM trimesters WHERE name = 'Trimester 1, 2026' LIMIT 1), 'Monday', '09:00', '11:00', true),
((SELECT id FROM classes WHERE unit_id = (SELECT id FROM units WHERE code = 'ICT100') AND group_name = 'Group B'), (SELECT id FROM units WHERE code = 'ICT100'), (SELECT id FROM classrooms WHERE room_number = 'L102'), (SELECT id FROM tutors WHERE email = 'sarah.chen@ttms.edu'), (SELECT id FROM trimesters WHERE name = 'Trimester 1, 2026' LIMIT 1), 'Monday', '11:00', '13:00', true),
((SELECT id FROM classes WHERE unit_id = (SELECT id FROM units WHERE code = 'ICT200') AND group_name = 'Group A'), (SELECT id FROM units WHERE code = 'ICT200'), (SELECT id FROM classrooms WHERE room_number = 'R201'), (SELECT id FROM tutors WHERE email = 'james.wilson@ttms.edu'), (SELECT id FROM trimesters WHERE name = 'Trimester 1, 2026' LIMIT 1), 'Monday', '14:00', '16:00', true),
((SELECT id FROM classes WHERE unit_id = (SELECT id FROM units WHERE code = 'ICT210') AND group_name = 'Group A'), (SELECT id FROM units WHERE code = 'ICT210'), (SELECT id FROM classrooms WHERE room_number = 'L101'), (SELECT id FROM tutors WHERE email = 'emily.rodriguez@ttms.edu'), (SELECT id FROM trimesters WHERE name = 'Trimester 1, 2026' LIMIT 1), 'Tuesday', '10:00', '12:00', true),
((SELECT id FROM classes WHERE unit_id = (SELECT id FROM units WHERE code = 'ICT220') AND group_name = 'Group A'), (SELECT id FROM units WHERE code = 'ICT220'), (SELECT id FROM classrooms WHERE room_number = 'L102'), (SELECT id FROM tutors WHERE email = 'michael.brown@ttms.edu'), (SELECT id FROM trimesters WHERE name = 'Trimester 1, 2026' LIMIT 1), 'Wednesday', '09:00', '11:00', true),
((SELECT id FROM classes WHERE unit_id = (SELECT id FROM units WHERE code = 'ICT400') AND group_name = 'Group A'), (SELECT id FROM units WHERE code = 'ICT400'), (SELECT id FROM classrooms WHERE room_number = 'L101'), (SELECT id FROM tutors WHERE email = 'james.wilson@ttms.edu'), (SELECT id FROM trimesters WHERE name = 'Trimester 1, 2026' LIMIT 1), 'Thursday', '13:00', '16:00', true);

-- Insert academic calendar events
INSERT INTO academic_calendar (name, start_date, end_date, trimester_id) VALUES
('Trimester 1, 2026 - Teaching Period', '2026-03-02', '2026-05-29', (SELECT id FROM trimesters WHERE name = 'Trimester 1, 2026' LIMIT 1)),
('Trimester 1, 2026 - Exam Period', '2026-06-01', '2026-06-19', (SELECT id FROM trimesters WHERE name = 'Trimester 1, 2026' LIMIT 1));

