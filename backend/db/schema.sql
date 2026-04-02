-- ============================================
-- TTMS Database Schema
-- University Time Table Management System
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- Users table (Admin & Student roles)
-- ============================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'student' CHECK (role IN ('admin', 'student')),
    refresh_token TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- Degrees table
-- ============================================
CREATE TABLE IF NOT EXISTS degrees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- Trimesters / Sessions (associated with degrees)
-- ============================================
CREATE TABLE IF NOT EXISTS trimesters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT valid_dates CHECK (end_date > start_date)
);

-- ============================================
-- Classrooms
-- ============================================
CREATE TABLE IF NOT EXISTS classrooms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_number VARCHAR(50) NOT NULL,
    location VARCHAR(255),
    max_capacity INTEGER NOT NULL DEFAULT 30,
    type VARCHAR(20) NOT NULL DEFAULT 'normal' CHECK (type IN ('lab', 'normal')),
    is_available BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- Units / Courses
-- ============================================
CREATE TABLE IF NOT EXISTS units (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    degree_id UUID NOT NULL REFERENCES degrees(id) ON DELETE CASCADE,
    classroom_type VARCHAR(20) NOT NULL DEFAULT 'normal' CHECK (classroom_type IN ('lab', 'normal')),
    total_students INTEGER NOT NULL DEFAULT 0,
    class_duration INTEGER NOT NULL DEFAULT 1 CHECK (class_duration >= 1 AND class_duration <= 4),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- Unit-Trimester associations (many-to-many)
-- ============================================
CREATE TABLE IF NOT EXISTS unit_trimesters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    unit_id UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,
    trimester_id UUID NOT NULL REFERENCES trimesters(id) ON DELETE CASCADE,
    UNIQUE(unit_id, trimester_id)
);

-- ============================================
-- Tutors
-- ============================================
CREATE TABLE IF NOT EXISTS tutors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- Tutor-Unit assignments (many-to-many)
-- ============================================
CREATE TABLE IF NOT EXISTS tutor_units (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tutor_id UUID NOT NULL REFERENCES tutors(id) ON DELETE CASCADE,
    unit_id UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,
    UNIQUE(tutor_id, unit_id)
);

-- ============================================
-- Class Instances (auto-generated based on capacity)
-- ============================================
CREATE TABLE IF NOT EXISTS classes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    unit_id UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,
    trimester_id UUID NOT NULL REFERENCES trimesters(id) ON DELETE CASCADE,
    group_name VARCHAR(50) NOT NULL,
    required_room_type VARCHAR(20) NOT NULL CHECK (required_room_type IN ('lab', 'normal')),
    duration INTEGER NOT NULL DEFAULT 1,
    max_capacity INTEGER NOT NULL DEFAULT 25,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(unit_id, trimester_id, group_name)
);

-- ============================================
-- Timetable Entries
-- ============================================
CREATE TABLE IF NOT EXISTS timetable_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    unit_id UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,
    classroom_id UUID NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
    tutor_id UUID NOT NULL REFERENCES tutors(id) ON DELETE CASCADE,
    trimester_id UUID NOT NULL REFERENCES trimesters(id) ON DELETE CASCADE,
    day_of_week VARCHAR(10) NOT NULL CHECK (day_of_week IN ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday')),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    is_recurring BOOLEAN NOT NULL DEFAULT true,
    week_number INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT valid_times CHECK (end_time > start_time)
);

-- Indexes for timetable performance
CREATE INDEX IF NOT EXISTS idx_timetable_class ON timetable_entries(class_id);
CREATE INDEX IF NOT EXISTS idx_timetable_unit ON timetable_entries(unit_id);
CREATE INDEX IF NOT EXISTS idx_timetable_classroom ON timetable_entries(classroom_id);
CREATE INDEX IF NOT EXISTS idx_timetable_tutor ON timetable_entries(tutor_id);

-- ============================================
-- Student Selections / Enrollments
-- ============================================
CREATE TABLE IF NOT EXISTS student_selections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    timetable_entry_id UUID NOT NULL REFERENCES timetable_entries(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, timetable_entry_id)
);

-- ============================================
-- Academic Calendar
-- ============================================
CREATE TABLE IF NOT EXISTS academic_calendar (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    trimester_id UUID REFERENCES trimesters(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT valid_calendar_dates CHECK (end_date > start_date)
);

-- ============================================
-- Indexes for performance
-- ============================================
CREATE INDEX IF NOT EXISTS idx_units_degree ON units(degree_id);
CREATE INDEX IF NOT EXISTS idx_classes_unit ON classes(unit_id);
CREATE INDEX IF NOT EXISTS idx_classes_trimester ON classes(trimester_id);
CREATE INDEX IF NOT EXISTS idx_timetable_trimester ON timetable_entries(trimester_id);
CREATE INDEX IF NOT EXISTS idx_timetable_day ON timetable_entries(day_of_week);
CREATE INDEX IF NOT EXISTS idx_student_selections_user ON student_selections(user_id);
CREATE INDEX IF NOT EXISTS idx_student_selections_entry ON student_selections(timetable_entry_id);
