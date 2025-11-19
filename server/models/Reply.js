const mongoose = require('mongoose');

const replySchema = new mongoose.Schema({
  entryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Entry',
    required: true,
    index: true
  },
  notificationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Notification',
    required: true,
    index: true
  },
  advisorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Advisor',
    required: true,
    index: true
  },
  studentId: {
    type: Number,
    required: true,
    index: true
  },
  contactMethod: {
    type: String,
    enum: ['Email', 'Phone', 'In-Person', 'Video Call', 'Other'],
    required: true
  },
  timing: {
    type: String,
    required: true
  },
  message: {
    type: String,
    default: ''
  },
  repliedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
replySchema.index({ entryId: 1, createdAt: -1 });
replySchema.index({ studentId: 1, createdAt: -1 });
replySchema.index({ advisorId: 1, createdAt: -1 });
replySchema.index({ notificationId: 1 });

module.exports = mongoose.model('Reply', replySchema);

