require('dotenv').config();
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { Pool } = require('pg');
const path = require('path');

const app = express();

// ─── Database Setup (PostgreSQL) ──────────────────────────────────
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS votes (
      id SERIAL PRIMARY KEY,
      google_id TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      party TEXT NOT NULL,
      voted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log('✅ Database ready');
}
initDB();

// ─── Middleware ───────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: process.env.SESSION_SECRET || 'vote-secret-key',
  resave: false,
  saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());

// ─── Passport Google OAuth ────────────────────────────────────────
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: process.env.CALLBACK_URL || '/auth/google/callback'
}, (accessToken, refreshToken, profile, done) => {
  const user = {
    googleId: profile.id,
    email: profile.emails[0].value,
    name: profile.displayName
  };
  return done(null, user);
}));

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

// ─── Auth Middleware ──────────────────────────────────────────────
function isLoggedIn(req, res, next) {
  if (req.isAuthenticated()) return next();
  res.redirect('/');
}

function isAdmin(req, res, next) {
  const adminPass = req.headers['x-admin-key'] || req.query.key;
  if (adminPass === process.env.ADMIN_KEY) return next();
  res.status(401).json({ error: 'Unauthorized' });
}

// ─── Auth Routes ──────────────────────────────────────────────────
app.get('/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/' }),
  (req, res) => res.redirect('/vote')
);

app.get('/auth/logout', (req, res) => {
  req.logout(() => res.redirect('/'));
});

// ─── API: Get current user status ─────────────────────────────────
app.get('/api/me', isLoggedIn, async (req, res) => {
  const user = req.user;
  const result = await pool.query(
    'SELECT party, voted_at FROM votes WHERE google_id = $1', [user.googleId]
  );
  const voted = result.rows[0] || null;
  res.json({ name: user.name, email: user.email, voted: !!voted, vote: voted });
});

// ─── API: Submit Vote ─────────────────────────────────────────────
app.post('/api/vote', isLoggedIn, async (req, res) => {
  const { party } = req.body;
  const validParties = ['DMK', 'ADMK', 'TVK', 'NTK'];

  if (!validParties.includes(party)) {
    return res.status(400).json({ error: 'Invalid party selection.' });
  }

  const user = req.user;

  const existing = await pool.query(
    'SELECT id FROM votes WHERE google_id = $1', [user.googleId]
  );
  if (existing.rows.length > 0) {
    return res.status(409).json({ error: 'You have already voted.' });
  }

  try {
    await pool.query(
      'INSERT INTO votes (google_id, email, name, party) VALUES ($1, $2, $3, $4)',
      [user.googleId, user.email, user.name, party]
    );
    res.json({ success: true, message: 'Vote submitted successfully!' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to record vote.' });
  }
});

// ─── API: Admin Results ───────────────────────────────────────────
app.get('/api/results', isAdmin, async (req, res) => {
  const totals = await pool.query(
    'SELECT party, COUNT(*) as count FROM votes GROUP BY party ORDER BY count DESC'
  );
  const total = await pool.query('SELECT COUNT(*) as total FROM votes');
  const recent = await pool.query(
    'SELECT name, email, party, voted_at FROM votes ORDER BY voted_at DESC LIMIT 20'
  );
  res.json({
    totals: totals.rows,
    total: parseInt(total.rows[0].total),
    recent: recent.rows
  });
});

// ─── Pages ────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  if (req.isAuthenticated()) return res.redirect('/vote');
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/vote', isLoggedIn, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'vote.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// ─── Start ────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server running at http://localhost:${PORT}`));