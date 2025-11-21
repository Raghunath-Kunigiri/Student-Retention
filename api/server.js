// Vercel serverless function entry point
// This file exports a handler function for Vercel deployment

let app;

try {
  app = require('../server/index.js');
} catch (error) {
  console.error('Error loading server:', error);
  throw error;
}

// Vercel serverless function handler
module.exports = async (req, res) => {
  try {
    // Handle the request with Express app
    return app(req, res);
  } catch (error) {
    console.error('Serverless function error:', error);
    if (!res.headersSent) {
      res.status(500).json({ 
        error: 'Internal server error',
        message: error.message 
      });
    }
  }
};

