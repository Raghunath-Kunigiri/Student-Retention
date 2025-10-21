const mongoose = require('mongoose');

const enrollmentSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true
  },
  course: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: true
  },
  studentId: {
    type: Number,
    required: true,
    index: true
  },
  courseId: {
    type: Number,
    required: true,
    index: true
  },
  semester: {
    type: String,
    required: true,
    enum: ['Fall', 'Spring', 'Summer']
  },
  year: {
    type: Number,
    required: true
  },
  enrollmentDate: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    required: true,
    enum: ['Enrolled', 'Dropped', 'Completed', 'Failed', 'Withdrawn'],
    default: 'Enrolled'
  },
  grade: {
    type: String,
    enum: ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'D-', 'F', 'P', 'NP', 'I', 'W'],
    default: null
  },
  credits: {
    type: Number,
    required: true
  },
  gpaPoints: {
    type: Number,
    default: 0
  },
  attendance: {
    totalClasses: {
      type: Number,
      default: 0
    },
    attendedClasses: {
      type: Number,
      default: 0
    },
    attendanceRate: {
      type: Number,
      min: 0,
      max: 100,
      default: 100
    }
  }
}, {
  timestamps: true
});

// Index for efficient queries
enrollmentSchema.index({ student: 1, course: 1 });
enrollmentSchema.index({ studentId: 1, courseId: 1 });
enrollmentSchema.index({ semester: 1, year: 1 });
enrollmentSchema.index({ status: 1 });

// Calculate GPA points based on grade
enrollmentSchema.methods.calculateGPAPoints = function() {
  const gradePoints = {
    'A+': 4.0, 'A': 4.0, 'A-': 3.7,
    'B+': 3.3, 'B': 3.0, 'B-': 2.7,
    'C+': 2.3, 'C': 2.0, 'C-': 1.7,
    'D+': 1.3, 'D': 1.0, 'D-': 0.7,
    'F': 0.0, 'P': 4.0, 'NP': 0.0,
    'I': null, 'W': null
  };
  
  if (this.grade && gradePoints[this.grade] !== null) {
    this.gpaPoints = gradePoints[this.grade] * this.credits;
  }
  
  return this.gpaPoints;
};

// Calculate attendance rate
enrollmentSchema.methods.calculateAttendanceRate = function() {
  if (this.attendance.totalClasses > 0) {
    this.attendance.attendanceRate = (this.attendance.attendedClasses / this.attendance.totalClasses) * 100;
  }
  return this.attendance.attendanceRate;
};

// Pre-save middleware to calculate derived fields
enrollmentSchema.pre('save', function(next) {
  this.calculateGPAPoints();
  this.calculateAttendanceRate();
  next();
});

module.exports = mongoose.model('Enrollment', enrollmentSchema);
