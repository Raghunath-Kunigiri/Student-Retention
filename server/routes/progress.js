const express = require('express');
const Progress = require('../models/Progress');
const Student = require('../models/Student');
const Advisor = require('../models/Advisor');
const csvParser = require('../utils/csvParser');
const router = express.Router();

/**
 * Get progress history for a specific student
 * GET /api/progress/student/:studentId
 */
router.get('/student/:studentId', async (req, res) => {
  try {
    const { studentId } = req.params;
    const { 
      limit = 50, 
      skip = 0, 
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

    const progressHistory = await Progress.getStudentProgress(parseInt(studentId), {
      limit: parseInt(limit),
      skip: parseInt(skip),
      startDate,
      endDate
    });

    const total = await Progress.countDocuments({ studentId: parseInt(studentId) });

    // Calculate summary statistics
    const gpaHistory = progressHistory.map(p => p.gpa);
    const averageGPA = gpaHistory.length > 0
      ? (gpaHistory.reduce((sum, gpa) => sum + gpa, 0) / gpaHistory.length).toFixed(2)
      : 0;
    
    const latestProgress = progressHistory[0] || null;
    const oldestProgress = progressHistory[progressHistory.length - 1] || null;
    const overallChange = latestProgress && oldestProgress
      ? (latestProgress.gpa - oldestProgress.gpa).toFixed(2)
      : 0;

    res.json({
      success: true,
      student: {
        studentId: student.studentId,
        fullName: `${student.firstName} ${student.lastName}`,
        email: student.email,
        major: student.major
      },
      progressHistory,
      summary: {
        totalSnapshots: total,
        averageGPA: parseFloat(averageGPA),
        currentGPA: latestProgress ? latestProgress.gpa : 0,
        overallChange: parseFloat(overallChange),
        trend: latestProgress ? latestProgress.trend : 'stable',
        riskLevel: latestProgress ? latestProgress.riskLevel : 'low'
      },
      pagination: {
        total,
        limit: parseInt(limit),
        skip: parseInt(skip),
        hasMore: total > parseInt(skip) + parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Error fetching student progress:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * Create or update progress snapshot for a student
 * POST /api/progress
 */
router.post('/', async (req, res) => {
  try {
    const {
      studentId,
      term,
      termYear,
      gpa,
      creditsEarned,
      creditsAttempted,
      attendanceAbsences,
      notes
    } = req.body;

    if (!studentId || gpa === undefined) {
      return res.status(400).json({
        success: false,
        error: 'studentId and gpa are required'
      });
    }

    const progress = await Progress.createSnapshot(parseInt(studentId), {
      term,
      termYear,
      gpa: parseFloat(gpa),
      creditsEarned: creditsEarned ? parseInt(creditsEarned) : 0,
      creditsAttempted: creditsAttempted ? parseInt(creditsAttempted) : 0,
      attendanceAbsences: attendanceAbsences ? parseInt(attendanceAbsences) : 0,
      notes: notes || ''
    });

    res.status(201).json({
      success: true,
      progress: await Progress.findById(progress._id)
        .populate('student', 'studentId firstName lastName email major')
    });
  } catch (error) {
    console.error('Error creating progress snapshot:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Sync progress from CSV academic records
 * POST /api/progress/sync
 */
router.post('/sync', async (req, res) => {
  try {
    const { studentId } = req.body;
    const academicData = csvParser.getAcademicData();
    
    let synced = 0;
    let errors = [];

    if (studentId) {
      // Sync single student
      const record = academicData.find(r => r.student_id == studentId);
      if (record) {
        try {
          await Progress.createSnapshot(parseInt(studentId), {
            gpa: parseFloat(record.gpa) || 0,
            creditsEarned: parseInt(record.credits_earned) || 0,
            attendanceAbsences: parseInt(record.attendance_absences) || 0,
            recordedAt: record.last_updated ? new Date(record.last_updated) : new Date()
          });
          synced = 1;
        } catch (error) {
          errors.push({ studentId, error: error.message });
        }
      }
    } else {
      // Sync all students
      for (const record of academicData) {
        try {
          await Progress.createSnapshot(parseInt(record.student_id), {
            gpa: parseFloat(record.gpa) || 0,
            creditsEarned: parseInt(record.credits_earned) || 0,
            attendanceAbsences: parseInt(record.attendance_absences) || 0,
            recordedAt: record.last_updated ? new Date(record.last_updated) : new Date()
          });
          synced++;
        } catch (error) {
          errors.push({ studentId: record.student_id, error: error.message });
        }
      }
    }

    res.json({
      success: true,
      synced,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error('Error syncing progress:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get students with declining GPA
 * GET /api/progress/declining
 */
router.get('/declining', async (req, res) => {
  try {
    const { threshold = -0.2, advisorId } = req.query;
    
    let decliningStudents = await Progress.getDecliningStudents(parseFloat(threshold));

    // Filter by advisor if provided
    if (advisorId) {
      const advisor = await Advisor.findOne({ advisorId: parseInt(advisorId) });
      if (advisor && advisor.assignedStudents && advisor.assignedStudents.length > 0) {
        const assignedStudentIds = advisor.assignedStudents.map(s => 
          s.studentId || (typeof s === 'object' ? s.studentId : s)
        );
        decliningStudents = decliningStudents.filter(ds => 
          assignedStudentIds.includes(ds.student.studentId)
        );
      }
    }

    res.json({
      success: true,
      count: decliningStudents.length,
      students: decliningStudents
    });
  } catch (error) {
    console.error('Error fetching declining students:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get progress statistics for advisor's students
 * GET /api/progress/advisor/:advisorId
 */
router.get('/advisor/:advisorId', async (req, res) => {
  try {
    const { advisorId } = req.params;
    
    const advisor = await Advisor.findOne({ advisorId: parseInt(advisorId) })
      .populate('assignedStudents', 'studentId firstName lastName email major');
    
    if (!advisor) {
      return res.status(404).json({
        success: false,
        error: 'Advisor not found'
      });
    }

    const studentIds = advisor.assignedStudents.map(s => s.studentId);
    
    if (studentIds.length === 0) {
      return res.json({
        success: true,
        advisor: {
          advisorId: advisor.advisorId,
          fullName: `${advisor.firstName} ${advisor.lastName}`
        },
        statistics: {
          totalStudents: 0,
          studentsWithProgress: 0,
          averageGPA: 0,
          atRiskCount: 0,
          decliningCount: 0
        },
        students: []
      });
    }

    // Get latest progress for each student
    const latestProgress = await Progress.aggregate([
      { $match: { studentId: { $in: studentIds } } },
      { $sort: { studentId: 1, recordedAt: -1 } },
      {
        $group: {
          _id: '$studentId',
          latest: { $first: '$$ROOT' }
        }
      }
    ]);

    const studentsWithProgress = latestProgress.length;
    const gpaValues = latestProgress.map(p => p.latest.gpa).filter(g => g > 0);
    const averageGPA = gpaValues.length > 0
      ? (gpaValues.reduce((sum, gpa) => sum + gpa, 0) / gpaValues.length).toFixed(2)
      : 0;

    const atRiskCount = latestProgress.filter(p => 
      p.latest.riskLevel === 'high' || p.latest.riskLevel === 'critical'
    ).length;

    const decliningCount = latestProgress.filter(p => 
      p.latest.trend === 'declining'
    ).length;

    res.json({
      success: true,
      advisor: {
        advisorId: advisor.advisorId,
        fullName: `${advisor.firstName} ${advisor.lastName}`
      },
      statistics: {
        totalStudents: studentIds.length,
        studentsWithProgress,
        averageGPA: parseFloat(averageGPA),
        atRiskCount,
        decliningCount
      },
      students: latestProgress.map(p => ({
        studentId: p._id,
        currentGPA: p.latest.gpa,
        trend: p.latest.trend,
        riskLevel: p.latest.riskLevel,
        lastUpdated: p.latest.recordedAt
      }))
    });
  } catch (error) {
    console.error('Error fetching advisor progress:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
