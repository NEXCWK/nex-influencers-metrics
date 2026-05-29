'use strict';

const express = require('express');
const multer = require('multer');
const bcrypt = require('bcrypt');

const supabase = require('../db/supabase');
const authenticate = require('../middleware/auth');
const storage = require('../services/storage');

const router = express.Router();
const SALT_ROUNDS = 12;

router.use(authenticate);

// ---------------------------------------------------------------------------
// Multer: in-memory, 5 MB, images only (avatars)
// ---------------------------------------------------------------------------
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only JPEG, PNG and WebP images are allowed'), false);
  },
});

function extFromMime(mimeType) {
  return { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[mimeType] || 'jpg';
}

// ---------------------------------------------------------------------------
// GET /profile — the authenticated user's profile (with signed avatar URL)
// ---------------------------------------------------------------------------
router.get('/', async (req, res, next) => {
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
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// PUT /profile — update display_name and bio
// ---------------------------------------------------------------------------
router.put('/', async (req, res, next) => {
  try {
    const { display_name, bio } = req.body;

    const updates = {};
    if (display_name !== undefined) {
      if (!String(display_name).trim()) {
        return res.status(400).json({ error: 'O nome não pode ficar em branco' });
      }
      updates.display_name = String(display_name).trim();
    }
    if (bio !== undefined) {
      if (String(bio).length > 280) {
        return res.status(400).json({ error: 'A bio deve ter no máximo 280 caracteres' });
      }
      updates.bio = String(bio).trim();
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'Nada para atualizar' });
    }

    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', req.user.id)
      .select('id, username, display_name, role, bio, avatar_url')
      .single();

    if (error) {
      console.error('Profile update error:', error.message);
      return res.status(500).json({ error: 'Failed to update profile' });
    }

    return res.json({
      id: data.id,
      username: data.username,
      display_name: data.display_name,
      role: data.role,
      bio: data.bio || '',
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /profile/avatar — upload / replace profile photo
// ---------------------------------------------------------------------------
router.post('/avatar', upload.single('avatar'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Image file is required (field name: avatar)' });
    }

    const newPath = await storage.uploadAvatar(
      req.file.buffer,
      req.file.mimetype,
      req.user.id,
      extFromMime(req.file.mimetype)
    );

    // Remove the previous avatar (best effort) before saving the new path
    if (req.user.avatar_url && req.user.avatar_url !== newPath) {
      try { await storage.removeFile(req.user.avatar_url); } catch { /* best effort */ }
    }

    const { error } = await supabase
      .from('users')
      .update({ avatar_url: newPath })
      .eq('id', req.user.id);

    if (error) {
      console.error('Avatar save error:', error.message);
      return res.status(500).json({ error: 'Failed to save avatar' });
    }

    const signedUrl = await storage.getSignedUrl(newPath);
    return res.json({ avatar_url: signedUrl });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /profile/password — change password (requires current password)
// ---------------------------------------------------------------------------
router.post('/password', async (req, res, next) => {
  try {
    const { current_password, new_password } = req.body;

    if (!current_password || !new_password) {
      return res.status(400).json({ error: 'Informe a senha atual e a nova senha' });
    }
    if (new_password.length < 8) {
      return res.status(400).json({ error: 'A nova senha deve ter pelo menos 8 caracteres' });
    }

    // Fetch the stored hash
    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('password_hash')
      .eq('id', req.user.id)
      .single();

    if (fetchError || !user) {
      return res.status(500).json({ error: 'Failed to verify password' });
    }

    const valid = await bcrypt.compare(current_password, user.password_hash);
    if (!valid) {
      return res.status(400).json({ error: 'Senha atual incorreta' });
    }

    const passwordHash = await bcrypt.hash(new_password, SALT_ROUNDS);
    const { error: updateError } = await supabase
      .from('users')
      .update({ password_hash: passwordHash, must_change_password: false })
      .eq('id', req.user.id);

    if (updateError) {
      console.error('Password change error:', updateError.message);
      return res.status(500).json({ error: 'Failed to change password' });
    }

    return res.json({ message: 'Senha alterada com sucesso' });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// Multer error handler
// ---------------------------------------------------------------------------
// eslint-disable-next-line no-unused-vars
router.use((err, _req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'Imagem muito grande. Máximo de 5 MB.' });
    }
    return res.status(400).json({ error: err.message });
  }
  if (err && err.message && err.message.includes('Only JPEG')) {
    return res.status(400).json({ error: err.message });
  }
  next(err);
});

module.exports = router;
