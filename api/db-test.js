const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://kunigiriraghunath9493:ZHIb5Fiq4kzo40UR@portfolio.kxnf8sl.mongodb.net/student_retention';

module.exports = async (req, res) => {
  try {
    console.log('Testing database connection...');
    
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(MONGODB_URI, { 
        serverSelectionTimeoutMS: 10000 
      });
      console.log('Connected to MongoDB');
    }
    
    res.json({ 
      status: 'success',
      message: 'Database connection successful',
      connectionState: mongoose.connection.readyState,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Database test error:', error);
    res.status(500).json({ 
      status: 'error',
      message: 'Database connection failed',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
};
