const mongoose = require('mongoose');

const helpRequestResponseSchema = new mongoose.Schema({
  // Link to Google Form response using timestamp and student email as unique identifier
  googleFormTimestamp: {
    type: String,
    required: true,
    index: true
  },
  studentEmail: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    index: true
  },
  studentName: {
    type: String,
    required: true,
    trim: true
  },
  studentPhone: {
    type: String,
    trim: true,
    default: ''
  },
  // Advisor who responded
  advisorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Advisor',
    required: true,
    index: true
  },
  advisorName: {
    type: String,
    required: true,
    trim: true
  },
  // Contact details
  contactMethod: {
    type: String,
    enum: ['Email', 'Phone', 'In-Person', 'Video Call', 'Other'],
    required: true
  },
  contactDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  // Response details
  responseNotes: {
    type: String,
    default: ''
  },
  // Status
  status: {
    type: String,
    enum: ['Pending', 'In Progress', 'Resolved', 'Follow-up Required'],
    default: 'Pending'
  },
  // Additional metadata
  googleFormData: {
    type: Object,
    default: {}
  }
}, {
  timestamps: true
});

// Composite index for finding responses for a specific help request
helpRequestResponseSchema.index({ googleFormTimestamp: 1, studentEmail: 1 });
helpRequestResponseSchema.index({ advisorId: 1, createdAt: -1 });
helpRequestResponseSchema.index({ studentEmail: 1, createdAt: -1 });

module.exports = mongoose.model('HelpRequestResponse', helpRequestResponseSchema);

