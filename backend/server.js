/**
 * TTMS Backend Server
 * University Time Table Management System
 * 
 * Express.js server with PostgreSQL, JWT auth, and RESTful APIs.
 */
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// ============================================
// Middleware
// ============================================
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging in development
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
    next();
  });
}

// ============================================
// Routes
// ============================================
app.use('/api/auth', require('./routes/auth'));
app.use('/api/degrees', require('./routes/degrees'));
app.use('/api/trimesters', require('./routes/trimesters'));
app.use('/api/units', require('./routes/units'));
app.use('/api/classrooms', require('./routes/classrooms'));
app.use('/api/tutors', require('./routes/tutors'));
app.use('/api/timetable', require('./routes/timetable'));
app.use('/api/classes', require('./routes/classes'));
app.use('/api/student', require('./routes/students'));
app.use('/api/calendar', require('./routes/calendar'));

// ============================================
// Health check
// ============================================
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'TTMS Backend'
  });
});

// ============================================
// Error handling
// ============================================
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ============================================
// Start server
// ============================================
app.listen(PORT, () => {
  console.log(`\n🚀 TTMS Backend running on http://localhost:${PORT}`);
  console.log(`📋 API endpoints available at http://localhost:${PORT}/api`);
  console.log(`🔒 Environment: ${process.env.NODE_ENV || 'development'}\n`);
});

module.exports = app;
