-- ============================================
-- TTMS Database Migration
-- Adds tutor_availability table and enrolled_students column
-- ============================================

-- Add enrolled_students column to classes table
ALTER TABLE classes ADD COLUMN IF NOT EXISTS enrolled_students INTEGER DEFAULT 0;

-- ============================================
-- Tutor Availability table
-- ============================================
CREATE TABLE IF NOT EXISTS tutor_availability (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tutor_id UUID NOT NULL REFERENCES tutors(id) ON DELETE CASCADE,
    trimester_id UUID NOT NULL REFERENCES trimesters(id) ON DELETE CASCADE,
    day_of_week VARCHAR(10) NOT NULL CHECK (day_of_week IN ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday')),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT valid_availability_times CHECK (end_time > start_time),
    UNIQUE(tutor_id, trimester_id, day_of_week, start_time)
);

-- Indexes for tutor_availability performance
CREATE INDEX IF NOT EXISTS idx_tutor_availability_tutor ON tutor_availability(tutor_id);
CREATE INDEX IF NOT EXISTS idx_tutor_availability_trimester ON tutor_availability(trimester_id);
CREATE INDEX IF NOT EXISTS idx_tutor_availability_day ON tutor_availability(day_of_week);
