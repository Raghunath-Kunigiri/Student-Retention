const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const studentSchema = new mongoose.Schema({
  studentId: {
    type: Number,
    required: true,
    unique: true,
    index: true
  },
  firstName: {
    type: String,
    required: true,
    trim: true
  },
  lastName: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  phone: {
    type: String,
    trim: true,
    default: 'Not provided'
  },
  major: {
    type: String,
    required: true,
    trim: true
  },
  year: {
    type: String,
    required: true,
    enum: ['First Year', 'Second Year', 'Third Year', 'Fourth Year', 'Graduate'],
    default: 'First Year'
  },
  birthDate: {
    type: Date,
    default: Date.now
  },
  enrollmentStatus: {
    type: String,
    required: true,
    enum: ['Enrolled', 'Graduated', 'Withdrawn', 'Suspended'],
    default: 'Enrolled'
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  // Academic Information
  academic: {
    gpa: {
      type: Number,
      min: 0,
      max: 4.0,
      default: 0
    },
    creditsCompleted: {
      type: Number,
      default: 0
    },
    attendanceAbsences: {
      type: Number,
      default: 0
    },
    lastSemesterGPA: {
      type: Number,
      min: 0,
      max: 4.0
    }
  },
  // Financial Information
  financial: {
    feeBalance: {
      type: Number,
      default: 0
    },
    scholarshipAmount: {
      type: Number,
      default: 0
    },
    paymentStatus: {
      type: String,
      enum: ['Current', 'Overdue', 'Delinquent'],
      default: 'Current'
    }
  },
  // Housing Information
  housing: {
    residenceHall: {
      type: String,
      trim: true
    },
    roomNumber: {
      type: String,
      trim: true
    },
    housingStatus: {
      type: String,
      enum: ['On-Campus', 'Off-Campus', 'Commuter'],
      default: 'Commuter'
    }
  },
  // Risk Assessment
  riskFactors: [{
    type: String,
    enum: ['Low GPA', 'High Absences', 'High Fee Balance', 'Academic Probation', 'Financial Aid Issues']
  }],
  riskScore: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  // Advisor Assignment
  assignedAdvisor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Advisor'
  },
  // Timestamps
  lastLogin: {
    type: Date
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Indexes are automatically created for unique fields
// Additional indexes for efficient queries
studentSchema.index({ major: 1 });
studentSchema.index({ year: 1 });
studentSchema.index({ enrollmentStatus: 1 });
studentSchema.index({ 'academic.gpa': 1 });
studentSchema.index({ 'financial.feeBalance': 1 });

// Hash password before saving
studentSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
studentSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Calculate risk score
studentSchema.methods.calculateRiskScore = function() {
  let score = 0;
  const factors = [];
  
  // GPA risk
  if (this.academic.gpa < 2.5) {
    score += 30;
    factors.push('Low GPA');
  } else if (this.academic.gpa < 3.0) {
    score += 15;
  }
  
  // Attendance risk
  if (this.academic.attendanceAbsences > 5) {
    score += 25;
    factors.push('High Absences');
  } else if (this.academic.attendanceAbsences > 3) {
    score += 10;
  }
  
  // Financial risk
  if (this.financial.feeBalance > 2000) {
    score += 20;
    factors.push('High Fee Balance');
  } else if (this.financial.feeBalance > 1000) {
    score += 10;
  }
  
  // Payment status risk
  if (this.financial.paymentStatus === 'Delinquent') {
    score += 15;
    factors.push('Financial Aid Issues');
  } else if (this.financial.paymentStatus === 'Overdue') {
    score += 8;
  }
  
  this.riskScore = Math.min(score, 100);
  this.riskFactors = factors;
  
  return this.riskScore;
};

// Virtual for full name
studentSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Ensure virtual fields are serialized
studentSchema.set('toJSON', {
  virtuals: true,
  transform: function(doc, ret) {
    delete ret.password;
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('Student', studentSchema);
