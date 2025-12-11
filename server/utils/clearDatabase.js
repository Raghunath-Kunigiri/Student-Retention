const mongoose = require('mongoose');
const Student = require('../models/Student');
const Advisor = require('../models/Advisor');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('❌ Error: MONGODB_URI environment variable is required');
  console.error('   Please set it in your .env file');
  process.exit(1);
}

async function clearDatabase() {
  try {
    console.log('Connecting to MongoDB...');
    
    // Connect to MongoDB
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(MONGODB_URI, { 
        serverSelectionTimeoutMS: 10000 
      });
      console.log('✅ Connected to MongoDB');
    }

    console.log('\n🗑️  Starting database cleanup...\n');

    // Delete all students
    console.log('Deleting all students...');
    const studentResult = await Student.deleteMany({});
    console.log(`✅ Deleted ${studentResult.deletedCount} student(s)`);

    // Delete all advisors
    console.log('Deleting all advisors...');
    const advisorResult = await Advisor.deleteMany({});
    console.log(`✅ Deleted ${advisorResult.deletedCount} advisor(s)`);

    console.log('\n✨ Database cleanup completed successfully!');
    console.log('   You can now register students fresh with CSV data.\n');

    // Close connection
    await mongoose.connection.close();
    console.log('Database connection closed.');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error clearing database:', error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  clearDatabase();
}

module.exports = clearDatabase;

