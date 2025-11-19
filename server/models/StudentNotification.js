const mongoose = require('mongoose');

const studentNotificationSchema = new mongoose.Schema({
  studentId: {
    type: Number,
    required: true,
    index: true
  },
  advisorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Advisor',
    required: true,
    index: true
  },
  advisorName: {
    type: String,
    required: true
  },
  advisorEmail: {
    type: String,
    required: true
  },
  type: {
    type: String,
    required: true,
    enum: ['advisor-contact', 'appointment', 'other'],
    default: 'advisor-contact'
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
studentNotificationSchema.index({ studentId: 1, isRead: 1, createdAt: -1 });
studentNotificationSchema.index({ createdAt: -1 });

module.exports = mongoose.model('StudentNotification', studentNotificationSchema);

