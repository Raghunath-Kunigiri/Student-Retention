const express = require('express');
const Activity = require('../models/Activity');
const Student = require('../models/Student');
const Advisor = require('../models/Advisor');
const router = express.Router();

/**
 * Get activity timeline for a specific student
 * GET /api/activities/student/:studentId
 */
router.get('/student/:studentId', async (req, res) => {
  try {
    const { studentId } = req.params;
    const { 
      limit = 50, 
      skip = 0, 
      type, 
      startDate, 
      endDate 
    } = req.query;

    const student = await Student.findOne({ studentId: parseInt(studentId) });
    
    if (!student) {
      return res.status(404).json({ 
        success: false, 
        error: 'Student not found' 
      });
    }

    const activities = await Activity.getStudentTimeline(parseInt(studentId), {
      limit: parseInt(limit),
      skip: parseInt(skip),
      type,
      startDate,
      endDate
    });

    const total = await Activity.countDocuments({ studentId: parseInt(studentId) });

    res.json({
      success: true,
      student: {
        studentId: student.studentId,
        fullName: `${student.firstName} ${student.lastName}`,
        email: student.email
      },
      activities,
      pagination: {
        total,
        limit: parseInt(limit),
        skip: parseInt(skip),
        hasMore: total > parseInt(skip) + parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Error fetching student timeline:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * Get all activities for advisor's students
 * GET /api/activities/advisor/:advisorId
 */
router.get('/advisor/:advisorId', async (req, res) => {
  try {
    const { advisorId } = req.params;
    const { 
      limit = 50, 
      skip = 0, 
      type, 
      startDate, 
      endDate,
      studentId 
    } = req.query;

    const advisor = await Advisor.findOne({ advisorId: parseInt(advisorId) });
    
    if (!advisor) {
      return res.status(404).json({ 
        success: false, 
        error: 'Advisor not found' 
      });
    }

    // Build query
    const query = { 'performedBy.advisorId': advisor._id };
    
    if (studentId) {
      query.studentId = parseInt(studentId);
    }
    
    if (type) {
      query.type = type;
    }
    
    if (startDate || endDate) {
      query.activityDate = {};
      if (startDate) query.activityDate.$gte = new Date(startDate);
      if (endDate) query.activityDate.$lte = new Date(endDate);
    }

    const activities = await Activity.find(query)
      .sort({ activityDate: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip))
      .populate('student', 'studentId firstName lastName email')
      .populate('performedBy.advisorId', 'advisorId firstName lastName email');

    const total = await Activity.countDocuments(query);

    res.json({
      success: true,
      advisor: {
        advisorId: advisor.advisorId,
        fullName: `${advisor.firstName} ${advisor.lastName}`
      },
      activities,
      pagination: {
        total,
        limit: parseInt(limit),
        skip: parseInt(skip),
        hasMore: total > parseInt(skip) + parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Error fetching advisor activities:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * Create a new activity
 * POST /api/activities
 */
router.post('/', async (req, res) => {
  try {
    const {
      studentId,
      type,
      title,
      description,
      performedBy,
      metadata,
      priority,
      activityDate
    } = req.body;

    if (!studentId || !type || !title) {
      return res.status(400).json({
        success: false,
        error: 'studentId, type, and title are required'
      });
    }

    // Find student
    const student = await Student.findOne({ studentId: parseInt(studentId) });
    if (!student) {
      return res.status(404).json({
        success: false,
        error: 'Student not found'
      });
    }

    // Prepare activity data
    const activityData = {
      studentId: parseInt(studentId),
      student: student._id,
      type,
      title,
      description: description || '',
      performedBy: performedBy || { type: 'system' },
      metadata: metadata || {},
      priority: priority || 'normal',
      activityDate: activityDate ? new Date(activityDate) : new Date()
    };

    // If advisor is performing the action, populate advisor info
    if (performedBy && performedBy.type === 'advisor' && performedBy.advisorId) {
      const advisor = await Advisor.findById(performedBy.advisorId);
      if (advisor) {
        activityData.performedBy.advisorId = advisor._id;
        activityData.performedBy.advisorName = `${advisor.firstName} ${advisor.lastName}`;
      }
    }

    const activity = await Activity.createActivity(activityData);

    res.status(201).json({
      success: true,
      activity: await Activity.findById(activity._id)
        .populate('student', 'studentId firstName lastName email')
        .populate('performedBy.advisorId', 'advisorId firstName lastName email')
    });
  } catch (error) {
    console.error('Error creating activity:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get activity statistics for a student
 * GET /api/activities/student/:studentId/stats
 */
router.get('/student/:studentId/stats', async (req, res) => {
  try {
    const { studentId } = req.params;

    const student = await Student.findOne({ studentId: parseInt(studentId) });
    if (!student) {
      return res.status(404).json({
        success: false,
        error: 'Student not found'
      });
    }

    const stats = await Activity.aggregate([
      { $match: { studentId: parseInt(studentId) } },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
          latest: { $max: '$activityDate' }
        }
      }
    ]);

    const totalActivities = await Activity.countDocuments({ studentId: parseInt(studentId) });
    const recentActivities = await Activity.countDocuments({
      studentId: parseInt(studentId),
      activityDate: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } // Last 30 days
    });

    res.json({
      success: true,
      stats: {
        total: totalActivities,
        last30Days: recentActivities,
        byType: stats.reduce((acc, item) => {
          acc[item._id] = {
            count: item.count,
            latest: item.latest
          };
          return acc;
        }, {})
      }
    });
  } catch (error) {
    console.error('Error fetching activity stats:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;

