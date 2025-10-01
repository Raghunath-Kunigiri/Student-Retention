const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const morgan = require('morgan');
require('dotenv').config();

const app = express();

// Config
const PORT = process.env.PORT || 4000;
const MONGODB_URI = process.env.MONGODB_URI || '';
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173').split(',');

// Middleware
app.use(morgan('dev'));
app.use(express.json());
app.use(cors({
  origin: function(origin, callback){
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.indexOf(origin) !== -1) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));

// Misc: root + favicon
app.get('/', (req, res) => {
  res.type('text/plain').send('Student Retention API');
});
app.get('/favicon.ico', (req, res) => res.status(204).end());

// Health
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Routes
app.use('/api/entries', require('./routes/entries'));

// Start server after DB connection
async function start(){
  if (!MONGODB_URI){
    console.error('Missing MONGODB_URI. Set it in .env');
    process.exit(1);
  }
  try {
    await mongoose.connect(MONGODB_URI, { 
      serverSelectionTimeoutMS: 10000 
    });
    console.log('Connected to MongoDB');
    app.listen(PORT, () => {
      console.log(`API running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('Failed to connect to MongoDB:', err.message);
    process.exit(1);
  }
}

start();


