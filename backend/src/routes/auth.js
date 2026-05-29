'use strict';

const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const supabase = require('../db/supabase');
const storage = require('../services/storage');
const authenticate = require('../middleware/auth');

const router = express.Router();
const SALT_ROUNDS = 12;
const DEFAULT_PASSWORD = 'nex2026';
const TOKEN_EXPIRY = '7d';

// ---------------------------------------------------------------------------
// POST /auth/login
// ---------------------------------------------------------------------------
router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    // Fetch user by username
    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('id, username, display_name, role, bio, avatar_url, password_hash, must_change_password, is_active')
      .eq('username', username.trim().toLowerCase())
      .maybeSingle();

    if (fetchError) {
      console.error('Login DB error:', fetchError.message);
      return res.status(500).json({ error: 'Internal server error' });
    }

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (!user.is_active) {
      return res.status(403).json({ error: 'Account is deactivated' });
    }

    // Verify password
    const passwordValid = await bcrypt.compare(password, user.password_hash);
    if (!passwordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Update last_login
    await supabase
      .from('users')
      .update({ last_login: new Date().toISOString() })
      .eq('id', user.id);

    // Sign JWT
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: TOKEN_EXPIRY }
    );

    const avatarSignedUrl = user.avatar_url
      ? await storage.getSignedUrl(user.avatar_url)
      : null;

    return res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        display_name: user.display_name,
        role: user.role,
        bio: user.bio || '',
        avatar_url: avatarSignedUrl,
        must_change_password: user.must_change_password,
      },
      must_change_password: user.must_change_password,
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /auth/change-password  (requires auth)
// ---------------------------------------------------------------------------
router.post('/change-password', authenticate, async (req, res, next) => {
  try {
    const { new_password } = req.body;

    if (!new_password) {
      return res.status(400).json({ error: 'new_password is required' });
    }

    if (new_password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long' });
    }

    if (new_password === DEFAULT_PASSWORD) {
      return res.status(400).json({ error: 'New password must be different from the default password' });
    }

    const passwordHash = await bcrypt.hash(new_password, SALT_ROUNDS);

    const { error } = await supabase
      .from('users')
      .update({ password_hash: passwordHash, must_change_password: false })
      .eq('id', req.user.id);

    if (error) {
      console.error('Change password DB error:', error.message);
      return res.status(500).json({ error: 'Failed to update password' });
    }

    return res.json({ message: 'Password updated successfully' });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /auth/me  (requires auth)
// ---------------------------------------------------------------------------
router.get('/me', authenticate, async (req, res, next) => {
  try {
    const avatarSignedUrl = req.user.avatar_url
      ? await storage.getSignedUrl(req.user.avatar_url)
      : null;

    return res.json({
      id: req.user.id,
      username: req.user.username,
      display_name: req.user.display_name,
      role: req.user.role,
      bio: req.user.bio || '',
      avatar_url: avatarSignedUrl,
      must_change_password: req.user.must_change_password,
      last_login: req.user.last_login,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
