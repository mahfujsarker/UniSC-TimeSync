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
    description TEXT,
    degree_type VARCHAR(100),
    campus VARCHAR(255),
    study_mode VARCHAR(100),
    duration VARCHAR(100),
    source_url TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'reviewed', 'published', 'archived')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- Academic Years
-- ============================================
CREATE TABLE IF NOT EXISTS academic_years (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    year INTEGER UNIQUE NOT NULL,
    source_url TEXT,
    source_type VARCHAR(20) NOT NULL DEFAULT 'manual' CHECK (source_type IN ('manual', 'import', 'scraped', 'pdf')),
    last_synced_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'reviewed', 'published')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- Teaching Periods (compatibility table name: trimesters)
-- ============================================
CREATE TABLE IF NOT EXISTS trimesters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    academic_year_id UUID REFERENCES academic_years(id) ON DELETE SET NULL,
    type VARCHAR(20) NOT NULL DEFAULT 'TRIMESTER' CHECK (type IN ('TRIMESTER', 'SESSION', 'SEMESTER', 'OTHER')),
    code VARCHAR(20),
    period_number INTEGER,
    name VARCHAR(255) NOT NULL,
    start_date DATE,
    end_date DATE,
    classes_start_date DATE,
    classes_end_date DATE,
    timetable_release_date DATE,
    class_selection_open_date DATE,
    census_date DATE,
    exam_start_date DATE,
    exam_end_date DATE,
    grades_release_date DATE,
    source_url TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'reviewed', 'published', 'archived')),
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
-- Courses
-- ============================================
CREATE TABLE IF NOT EXISTS units (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    classroom_type VARCHAR(20) NOT NULL DEFAULT 'normal' CHECK (classroom_type IN ('lab', 'normal')),
    total_students INTEGER NOT NULL DEFAULT 0,
    class_duration INTEGER NOT NULL DEFAULT 1 CHECK (class_duration >= 1 AND class_duration <= 4),
    description TEXT,
    prerequisites TEXT,
    credit_points VARCHAR(50),
    source_url TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'reviewed', 'published', 'archived')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- Degree & Course URL Import Drafts
-- ============================================
CREATE TABLE IF NOT EXISTS degree_course_imports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_url TEXT NOT NULL,
    payload JSONB NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'reviewed', 'published', 'archived')),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    published_at TIMESTAMP WITH TIME ZONE
);

-- ============================================
-- Course-Degree associations (many-to-many)
-- ============================================
CREATE TABLE IF NOT EXISTS unit_degrees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    unit_id UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,
    degree_id UUID NOT NULL REFERENCES degrees(id) ON DELETE CASCADE,
    UNIQUE(unit_id, degree_id)
);

-- ============================================
-- Course-Teaching Period associations (many-to-many)
-- Legacy compatibility. Generic offering rules use unit_offering_patterns.
-- ============================================
CREATE TABLE IF NOT EXISTS unit_trimesters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    unit_id UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,
    trimester_id UUID NOT NULL REFERENCES trimesters(id) ON DELETE CASCADE,
    UNIQUE(unit_id, trimester_id)
);

-- ============================================
-- Generic Course Offering Patterns (compatibility table name: unit_offering_patterns)
-- ============================================
CREATE TABLE IF NOT EXISTS unit_offering_patterns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    unit_id UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,
    period_type VARCHAR(20) NOT NULL CHECK (period_type IN ('TRIMESTER', 'SESSION', 'SEMESTER')),
    period_number INTEGER NOT NULL CHECK (
        (period_type = 'TRIMESTER' AND period_number BETWEEN 1 AND 3)
        OR (period_type = 'SEMESTER' AND period_number BETWEEN 1 AND 2)
        OR (period_type = 'SESSION' AND period_number BETWEEN 1 AND 8)
    ),
    code VARCHAR(20) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(unit_id, period_type, period_number)
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
-- Tutor-Course assignments (many-to-many)
-- ============================================
CREATE TABLE IF NOT EXISTS tutor_units (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tutor_id UUID NOT NULL REFERENCES tutors(id) ON DELETE CASCADE,
    unit_id UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,
    UNIQUE(tutor_id, unit_id)
);

-- ============================================
-- Tutor Availability by Teaching Period
-- ============================================
CREATE TABLE IF NOT EXISTS tutor_availability (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tutor_id UUID NOT NULL REFERENCES tutors(id) ON DELETE CASCADE,
    academic_year_id UUID REFERENCES academic_years(id) ON DELETE CASCADE,
    trimester_id UUID REFERENCES trimesters(id) ON DELETE CASCADE,
    availability_scope VARCHAR(20) NOT NULL DEFAULT 'DAY' CHECK (availability_scope IN ('YEAR', 'PERIOD', 'DAY')),
    day_of_week VARCHAR(10) CHECK (day_of_week IN ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday')),
    start_time TIME,
    end_time TIME,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(tutor_id, academic_year_id, trimester_id, availability_scope, day_of_week),
    CONSTRAINT valid_tutor_availability_scope CHECK (
        (availability_scope = 'YEAR' AND academic_year_id IS NOT NULL AND trimester_id IS NULL AND day_of_week IS NULL AND start_time IS NULL AND end_time IS NULL)
        OR (availability_scope = 'PERIOD' AND trimester_id IS NOT NULL AND day_of_week IS NULL AND start_time IS NULL AND end_time IS NULL)
        OR (availability_scope = 'DAY' AND trimester_id IS NOT NULL AND day_of_week IS NOT NULL)
    ),
    CONSTRAINT valid_tutor_availability_times CHECK (
        (start_time IS NULL AND end_time IS NULL)
        OR (start_time IS NOT NULL AND end_time IS NOT NULL AND end_time > start_time)
    )
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
-- Teaching Period Events
-- ============================================
CREATE TABLE IF NOT EXISTS teaching_period_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    teaching_period_id UUID NOT NULL REFERENCES trimesters(id) ON DELETE CASCADE,
    event_type VARCHAR(100) NOT NULL,
    title VARCHAR(255) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- Indexes for performance
-- ============================================
CREATE INDEX IF NOT EXISTS idx_unit_degrees_unit ON unit_degrees(unit_id);
CREATE INDEX IF NOT EXISTS idx_unit_degrees_degree ON unit_degrees(degree_id);
CREATE INDEX IF NOT EXISTS idx_classes_unit ON classes(unit_id);
CREATE INDEX IF NOT EXISTS idx_classes_trimester ON classes(trimester_id);
CREATE INDEX IF NOT EXISTS idx_timetable_trimester ON timetable_entries(trimester_id);
CREATE INDEX IF NOT EXISTS idx_trimesters_academic_year ON trimesters(academic_year_id);
CREATE INDEX IF NOT EXISTS idx_unit_offering_patterns_unit ON unit_offering_patterns(unit_id);
CREATE INDEX IF NOT EXISTS idx_tutor_availability_tutor ON tutor_availability(tutor_id);
CREATE INDEX IF NOT EXISTS idx_tutor_availability_trimester ON tutor_availability(trimester_id);
CREATE INDEX IF NOT EXISTS idx_timetable_day ON timetable_entries(day_of_week);
CREATE INDEX IF NOT EXISTS idx_student_selections_user ON student_selections(user_id);
CREATE INDEX IF NOT EXISTS idx_student_selections_entry ON student_selections(timetable_entry_id);

