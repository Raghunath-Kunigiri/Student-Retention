const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const advisorSchema = new mongoose.Schema({
  advisorId: {
    type: Number,
    required: true,
    unique: true
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
  department: {
    type: String,
    required: true,
    trim: true
  },
  specialization: {
    type: String,
    required: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  // Advisor specific information
  title: {
    type: String,
    trim: true,
    default: 'Academic Advisor'
  },
  officeLocation: {
    type: String,
    trim: true
  },
  officeHours: {
    type: String,
    trim: true
  },
  maxStudents: {
    type: Number,
    default: 50
  },
  currentStudents: {
    type: Number,
    default: 0
  },
  // Assigned students
  assignedStudents: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student'
  }],
  // Performance metrics
  performance: {
    totalMeetings: {
      type: Number,
      default: 0
    },
    studentsRetained: {
      type: Number,
      default: 0
    },
    averageStudentGPA: {
      type: Number,
      min: 0,
      max: 4.0
    }
  },
  // Availability
  isAvailable: {
    type: Boolean,
    default: true
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
advisorSchema.index({ department: 1 });
advisorSchema.index({ specialization: 1 });
advisorSchema.index({ isAvailable: 1 });

// Hash password before saving
advisorSchema.pre('save', async function(next) {
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
advisorSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Update student count
advisorSchema.methods.updateStudentCount = function() {
  this.currentStudents = this.assignedStudents.length;
  return this.currentStudents;
};

// Check if advisor can take more students
advisorSchema.methods.canTakeMoreStudents = function() {
  return this.currentStudents < this.maxStudents;
};

// Virtual for full name
advisorSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Ensure virtual fields are serialized
advisorSchema.set('toJSON', {
  virtuals: true,
  transform: function(doc, ret) {
    delete ret.password;
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('Advisor', advisorSchema);
