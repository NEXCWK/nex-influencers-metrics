'use strict';

require('dotenv').config();
const bcrypt = require('bcrypt');
const supabase = require('./supabase');

const SALT_ROUNDS = 12;
const DEFAULT_PASSWORD = 'nex2026';

const users = [
  { username: 'felipemoreira', role: 'admin',       display_name: 'Felipe Moreira' },
  { username: 'luizamarques',  role: 'admin',       display_name: 'Luiza Marques'  },
  { username: 'paulapicat',    role: 'influencer',  display_name: 'Paula Picat'    },
  { username: 'gabs',          role: 'influencer',  display_name: 'Gabs'           },
  { username: 'ari',           role: 'influencer',  display_name: 'Ari'            },
  { username: 'anabia',        role: 'influencer',  display_name: 'Ana Bia'        },
  { username: 'anarusick',     role: 'influencer',  display_name: 'Ana Rusick'     },
  { username: 'gabi',          role: 'influencer',  display_name: 'Gabi'           },
];

async function seed() {
  console.log('Starting seed...');

  let passwordHash;
  try {
    passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, SALT_ROUNDS);
    console.log('Password hashed successfully.');
  } catch (err) {
    console.error('Failed to hash password:', err.message);
    process.exit(1);
  }

  for (const user of users) {
    const { data: existing, error: fetchError } = await supabase
      .from('users')
      .select('id, username')
      .eq('username', user.username)
      .maybeSingle();

    if (fetchError) {
      console.error(`Error checking user ${user.username}:`, fetchError.message);
      continue;
    }

    if (existing) {
      console.log(`User "${user.username}" already exists — skipping.`);
      continue;
    }

    const { error: insertError } = await supabase.from('users').insert({
      username: user.username,
      display_name: user.display_name,
      password_hash: passwordHash,
      role: user.role,
      must_change_password: true,
      is_active: true,
    });

    if (insertError) {
      console.error(`Failed to insert user "${user.username}":`, insertError.message);
    } else {
      console.log(`Created user: ${user.username} (${user.role})`);
    }
  }

  console.log('Seed complete.');
  process.exit(0);
}

// Allow running directly (node src/db/seed.js) or imported as a function
if (require.main === module) {
  seed().catch((err) => {
    console.error('Unexpected seed error:', err);
    process.exit(1);
  });
}

module.exports = seed;
