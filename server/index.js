const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
require('dotenv').config();

const app = express();

// Config
const PORT = process.env.PORT || 4000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://kunigiriraghunath9493:ZHIb5Fiq4kzo40UR@portfolio.kxnf8sl.mongodb.net/student_retention';
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:4000').split(',');

// Middleware
app.use(morgan('dev'));
app.use(express.json());
app.use(cors({
  origin: function(origin, callback){
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Allow localhost on any port
    if (origin.startsWith('http://localhost:') || origin.startsWith('https://localhost:')) {
      return callback(null, true);
    }
    
    // Allow allowed origins
    if (ALLOWED_ORIGINS.indexOf(origin) !== -1) {
      return callback(null, true);
    }
    
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Serve static files from public directory
app.use(express.static(path.join(__dirname, '../public')));
app.use('/src', express.static(path.join(__dirname, '../src')));
app.use('/Images', express.static(path.join(__dirname, '../Images')));

// Root route - redirect to main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});
app.get('/favicon.ico', (req, res) => res.status(204).end());

// Health
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Routes
app.use('/api/entries', require('./routes/entries'));
app.use('/api/data', require('./routes/data'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/migration', require('./routes/migration'));

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

// Start server after DB connection (only for local development)
async function start() {
  const connected = await connectDB();
  if (connected) {
    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
      console.log(`📱 Frontend: http://localhost:${PORT}`);
      console.log(`🔧 API: http://localhost:${PORT}/api`);
    });
  } else {
    process.exit(1);
  }
}

// For Vercel deployment
if (process.env.NODE_ENV === 'production') {
  // Connect to DB on first request
  app.use(async (req, res, next) => {
    if (mongoose.connection.readyState === 0) {
      await connectDB();
    }
    next();
  });
} else {
  // For local development
  start();
}

// Export for Vercel
module.exports = app;


