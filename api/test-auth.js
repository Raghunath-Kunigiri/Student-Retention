const express = require('express');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();

// Config
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://kunigiriraghunath9493:ZHIb5Fiq4kzo40UR@portfolio.kxnf8sl.mongodb.net/student_retention';

// Middleware
app.use(express.json());

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
      await connectDB();
    }
    next();
  } catch (error) {
    console.error('Database connection error:', error);
    res.status(500).json({ error: 'Database connection failed' });
  }
});

// Test endpoint
app.get('/api/test-auth', (req, res) => {
  res.json({ 
    message: 'Auth test endpoint working!',
    timestamp: new Date().toISOString(),
    method: req.method,
    url: req.url
  });
});

// Test advisor login endpoint
app.post('/api/test-advisor-login', async (req, res) => {
  try {
    console.log('Test advisor login request:', req.body);
    const { email, password, department } = req.body;
    
    if (!email || !password || !department) {
      return res.status(400).json({ 
        success: false, 
        error: 'Email, password, and department are required' 
      });
    }
    
    // Import models
    const Advisor = require('../server/models/Advisor');
    
    // Find advisor
    const advisor = await Advisor.findOne({ email: email.toLowerCase() });
    
    if (!advisor) {
      return res.status(401).json({ 
        success: false, 
        error: 'Advisor not found' 
      });
    }
    
    // Test password comparison
    const isPasswordValid = await advisor.comparePassword(password);
    
    res.json({
      success: true,
      message: 'Test login successful',
      advisorFound: !!advisor,
      passwordValid: isPasswordValid,
      advisorEmail: advisor.email
    });
    
  } catch (error) {
    console.error('Test advisor login error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Test login failed',
      details: error.message
    });
  }
});

module.exports = app;
