const mongoose = require('mongoose');

const progressSchema = new mongoose.Schema({
  // Student this progress belongs to
  studentId: {
    type: Number,
    required: true,
    index: true
  },
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    index: true
  },
  // Semester/Term information
  term: {
    type: String,
    trim: true
  },
  termYear: {
    type: Number
  },
  // Academic metrics at this point in time
  gpa: {
    type: Number,
    required: true,
    min: 0,
    max: 4.0
  },
  creditsEarned: {
    type: Number,
    default: 0
  },
  creditsAttempted: {
    type: Number,
    default: 0
  },
  attendanceAbsences: {
    type: Number,
    default: 0
  },
  // Trend indicators
  gpaChange: {
    type: Number,
    default: 0 // Positive = improvement, Negative = decline
  },
  trend: {
    type: String,
    enum: ['improving', 'declining', 'stable'],
    default: 'stable'
  },
  // Risk indicators
  riskLevel: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'low'
  },
  // Additional metadata
  notes: {
    type: String,
    default: ''
  },
  // Timestamp for this progress snapshot
  recordedAt: {
    type: Date,
    required: true,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true
});

// Compound indexes for efficient queries
progressSchema.index({ studentId: 1, recordedAt: -1 });
progressSchema.index({ student: 1, recordedAt: -1 });
progressSchema.index({ riskLevel: 1, recordedAt: -1 });

// Static method to create or update progress snapshot
progressSchema.statics.createSnapshot = async function(studentId, progressData) {
  try {
    const Student = require('./Student');
    const student = await Student.findOne({ studentId });
    
    if (!student) {
      throw new Error('Student not found');
    }

    // Get the most recent progress for this student
    const lastProgress = await this.findOne({ studentId })
      .sort({ recordedAt: -1 });

    const gpaChange = lastProgress 
      ? progressData.gpa - lastProgress.gpa 
      : 0;

    // Determine trend
    let trend = 'stable';
    if (gpaChange > 0.1) trend = 'improving';
    else if (gpaChange < -0.1) trend = 'declining';

    // Determine risk level
    let riskLevel = 'low';
    if (progressData.gpa < 2.0) riskLevel = 'critical';
    else if (progressData.gpa < 2.5) riskLevel = 'high';
    else if (progressData.gpa < 3.0) riskLevel = 'medium';

    // If GPA is declining, increase risk
    if (trend === 'declining' && riskLevel === 'low') {
      riskLevel = 'medium';
    }

    const progress = new this({
      studentId,
      student: student._id,
      term: progressData.term,
      termYear: progressData.termYear,
      gpa: progressData.gpa,
      creditsEarned: progressData.creditsEarned || 0,
      creditsAttempted: progressData.creditsAttempted || 0,
      attendanceAbsences: progressData.attendanceAbsences || 0,
      gpaChange,
      trend,
      riskLevel,
      notes: progressData.notes || '',
      recordedAt: progressData.recordedAt || new Date()
    });

    await progress.save();
    return progress;
  } catch (error) {
    console.error('Error creating progress snapshot:', error);
    throw error;
  }
};

// Static method to get student progress history
progressSchema.statics.getStudentProgress = async function(studentId, options = {}) {
  const {
    limit = 50,
    skip = 0,
    startDate,
    endDate
  } = options;

  const query = { studentId };

  if (startDate || endDate) {
    query.recordedAt = {};
    if (startDate) query.recordedAt.$gte = new Date(startDate);
    if (endDate) query.recordedAt.$lte = new Date(endDate);
  }

  return this.find(query)
    .sort({ recordedAt: -1 })
    .limit(limit)
    .skip(skip)
    .populate('student', 'studentId firstName lastName email major');
};

// Static method to get students with declining GPA
progressSchema.statics.getDecliningStudents = async function(threshold = -0.2) {
  // Get all students with recent progress records
  const recentProgress = await this.find({
    recordedAt: { $gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) } // Last 90 days
  })
    .sort({ studentId: 1, recordedAt: -1 })
    .populate('student', 'studentId firstName lastName email major');

  // Group by student and find those with declining GPA
  const studentMap = new Map();
  const decliningStudents = [];

  recentProgress.forEach(progress => {
    if (!studentMap.has(progress.studentId)) {
      studentMap.set(progress.studentId, []);
    }
    studentMap.get(progress.studentId).push(progress);
  });

  studentMap.forEach((progresses, studentId) => {
    if (progresses.length >= 2) {
      // Sort by date (oldest first)
      progresses.sort((a, b) => a.recordedAt - b.recordedAt);
      
      const oldest = progresses[0];
      const newest = progresses[progresses.length - 1];
      const gpaChange = newest.gpa - oldest.gpa;

      if (gpaChange < threshold) {
        decliningStudents.push({
          student: progresses[0].student,
          currentGPA: newest.gpa,
          previousGPA: oldest.gpa,
          gpaChange,
          trend: 'declining',
          riskLevel: newest.riskLevel,
          lastUpdated: newest.recordedAt
        });
      }
    }
  });

  return decliningStudents.sort((a, b) => a.gpaChange - b.gpaChange); // Most declining first
};

module.exports = mongoose.model('Progress', progressSchema);
