const mongoose = require('mongoose');

const courseSchema = new mongoose.Schema({
  courseId: {
    type: Number,
    required: true,
    unique: true,
    index: true
  },
  courseCode: {
    type: String,
    required: true,
    trim: true,
    uppercase: true
  },
  courseName: {
    type: String,
    required: true,
    trim: true
  },
  department: {
    type: String,
    required: true,
    trim: true
  },
  credits: {
    type: Number,
    required: true,
    min: 1,
    max: 6
  },
  description: {
    type: String,
    trim: true
  },
  prerequisites: [{
    type: String,
    trim: true
  }],
  instructor: {
    type: String,
    trim: true
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
  capacity: {
    type: Number,
    default: 30
  },
  enrolled: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Index for efficient queries
courseSchema.index({ courseCode: 1 });
courseSchema.index({ department: 1 });
courseSchema.index({ semester: 1, year: 1 });
courseSchema.index({ isActive: 1 });

// Virtual for availability
courseSchema.virtual('isAvailable').get(function() {
  return this.enrolled < this.capacity;
});

// Ensure virtual fields are serialized
courseSchema.set('toJSON', {
  virtuals: true
});

module.exports = mongoose.model('Course', courseSchema);
