const express = require('express');
const { migrateData, updateStudentDataFromRecords } = require('../utils/migrateData');
const { simpleMigration } = require('../utils/simpleMigration');

const router = express.Router();

// Simple migration endpoint (for development/admin use)
router.post('/migrate', async (req, res) => {
  try {
    console.log('Starting simple data migration...');
    await simpleMigration();
    
    res.json({
      success: true,
      message: 'Simple data migration completed successfully!'
    });
  } catch (error) {
    console.error('Migration failed:', error);
    res.status(500).json({
      success: false,
      error: 'Migration failed',
      details: error.message
    });
  }
});

// Full migration endpoint (for development/admin use)
router.post('/migrate-full', async (req, res) => {
  try {
    console.log('Starting full data migration...');
    await migrateData();
    
    res.json({
      success: true,
      message: 'Full data migration completed successfully!'
    });
  } catch (error) {
    console.error('Migration failed:', error);
    res.status(500).json({
      success: false,
      error: 'Migration failed',
      details: error.message
    });
  }
});

// Update student data from related records
router.post('/update-student-data', async (req, res) => {
  try {
    console.log('Updating student data from related records...');
    await updateStudentDataFromRecords();
    
    res.json({
      success: true,
      message: 'Student data updated successfully!'
    });
  } catch (error) {
    console.error('Update failed:', error);
    res.status(500).json({
      success: false,
      error: 'Update failed',
      details: error.message
    });
  }
});

module.exports = router;
