const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  advisorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Advisor',
    required: true,
    index: true
  },
  studentId: {
    type: Number,
    required: true
  },
  studentName: {
    type: String,
    required: true
  },
  studentEmail: {
    type: String,
    required: true
  },
  type: {
    type: String,
    required: true,
    enum: ['help-request', 'appointment', 'other'],
    default: 'help-request'
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  entryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Entry'
  },
  data: {
    type: Object,
    default: {}
  },
  isRead: {
    type: Boolean,
    default: false,
    index: true
  },
  emailSent: {
    type: Boolean,
    default: false
  },
  emailSentAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Index for efficient queries
notificationSchema.index({ advisorId: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);

