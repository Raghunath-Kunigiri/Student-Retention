const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
require('dotenv').config();

const app = express();

// Config
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://kunigiriraghunath9493:ZHIb5Fiq4kzo40UR@portfolio.kxnf8sl.mongodb.net/student_retention';

// Middleware
app.use(morgan('dev'));
app.use(express.json());
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Health endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// MongoDB connection function
async function connectDB() {
  if (!MONGODB_URI) {
    console.error('Missing MONGODB_URI. Set it in environment variables');
    return false;
  }
  
  try {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(MONGODB_URI, { 
        serverSelectionTimeoutMS: 10000 
      });
      console.log('Connected to MongoDB');
    }
    return true;
  } catch (err) {
    console.error('Failed to connect to MongoDB:', err.message);
    return false;
  }
}

// Connect to DB on first request
app.use(async (req, res, next) => {
  try {
    if (mongoose.connection.readyState === 0) {
      console.log('Connecting to MongoDB...');
      await connectDB();
    }
    next();
  } catch (error) {
    console.error('Database connection error:', error);
    res.status(500).json({ error: 'Database connection failed', details: error.message });
  }
});

// Routes
try {
  app.use('/api/entries', require('../server/routes/entries'));
  app.use('/api/data', require('../server/routes/data'));
  app.use('/api/auth', require('../server/routes/auth'));
  app.use('/api/migration', require('../server/routes/migration'));
  console.log('Routes loaded successfully');
} catch (error) {
  console.error('Error loading routes:', error);
  app.use('/api/*', (req, res) => {
    res.status(500).json({ error: 'Route loading failed', details: error.message });
  });
}

// Export for Vercel
module.exports = app;