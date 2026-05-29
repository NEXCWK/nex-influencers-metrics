'use strict';

const express = require('express');

const supabase = require('../db/supabase');
const authenticate = require('../middleware/auth');
const storage = require('../services/storage');

const router = express.Router();

router.use(authenticate);

// ---------------------------------------------------------------------------
// GET /members — directory of active influencers (view-only, for all users)
// Returns name, bio and a signed avatar URL. No contact/interaction data.
// ---------------------------------------------------------------------------
router.get('/', async (_req, res, next) => {
  try {
    const { data: users, error } = await supabase
      .from('users')
      .select('id, username, display_name, bio, avatar_url')
      .eq('role', 'influencer')
      .eq('is_active', true)
      .order('display_name', { ascending: true });

    if (error) {
      console.error('Members directory error:', error.message);
      return res.status(500).json({ error: 'Failed to fetch members' });
    }

    const members = await Promise.all(
      (users || []).map(async (u) => ({
        id: u.id,
        username: u.username,
        display_name: u.display_name,
        bio: u.bio || '',
        avatar_url: u.avatar_url ? await storage.getSignedUrl(u.avatar_url) : null,
      }))
    );

    return res.json({ members });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
