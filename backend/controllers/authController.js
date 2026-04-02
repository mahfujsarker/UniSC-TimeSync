/**
 * Auth Controller
 * Handles user registration, login, and token refresh.
 */
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
require('dotenv').config();

/**
 * Generate access and refresh tokens for a user.
 */
function generateTokens(user) {
  const accessToken = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
  );

  const refreshToken = jwt.sign(
    { id: user.id },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
  );

  return { accessToken, refreshToken };
}

/**
 * POST /api/auth/register
 * Register a new user (default role: student).
 */
async function register(req, res) {
  try {
    const { email, password, full_name, role } = req.body;

    // Validate input
    if (!email || !password || !full_name) {
      return res.status(400).json({ error: 'Email, password, and full name are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Check if user exists
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    // Only allow admin role if request comes from an admin user
    const userRole = (role === 'admin' && req.user && req.user.role === 'admin') ? 'admin' : 'student';

    // Create user
    const result = await pool.query(
      'INSERT INTO users (email, password_hash, full_name, role) VALUES ($1, $2, $3, $4) RETURNING id, email, full_name, role, created_at',
      [email, password_hash, full_name, userRole]
    );

    const user = result.rows[0];
    const tokens = generateTokens(user);

    // Save refresh token
    await pool.query('UPDATE users SET refresh_token = $1 WHERE id = $2', [tokens.refreshToken, user.id]);

    res.status(201).json({
      message: 'Registration successful',
      user: { id: user.id, email: user.email, full_name: user.full_name, role: user.role },
      ...tokens
    });

  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * POST /api/auth/login
 */
async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];

    // Verify password
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate tokens
    const tokens = generateTokens(user);

    // Save refresh token
    await pool.query('UPDATE users SET refresh_token = $1 WHERE id = $2', [tokens.refreshToken, user.id]);

    res.json({
      message: 'Login successful',
      user: { id: user.id, email: user.email, full_name: user.full_name, role: user.role },
      ...tokens
    });

  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * POST /api/auth/refresh
 * Refresh access token using refresh token.
 */
async function refresh(req, res) {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token required' });
    }

    // Verify refresh token
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

    // Check if token matches stored token
    const result = await pool.query('SELECT * FROM users WHERE id = $1 AND refresh_token = $2', [decoded.id, refreshToken]);
    if (result.rows.length === 0) {
      return res.status(403).json({ error: 'Invalid refresh token' });
    }

    const user = result.rows[0];
    const tokens = generateTokens(user);

    // Update refresh token
    await pool.query('UPDATE users SET refresh_token = $1 WHERE id = $2', [tokens.refreshToken, user.id]);

    res.json(tokens);

  } catch (err) {
    console.error('Token refresh error:', err);
    res.status(403).json({ error: 'Invalid refresh token' });
  }
}

/**
 * POST /api/auth/logout
 */
async function logout(req, res) {
  try {
    await pool.query('UPDATE users SET refresh_token = NULL WHERE id = $1', [req.user.id]);
    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    console.error('Logout error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = { register, login, refresh, logout };
