const mongoose = require('mongoose');

const activitySchema = new mongoose.Schema({
  // Student this activity belongs to
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
  // Activity type
  type: {
    type: String,
    required: true,
    enum: [
      'help_request',
      'help_request_response',
      'notification_sent',
      'notification_read',
      'advisor_contact',
      'risk_score_change',
      'academic_update',
      'financial_update',
      'housing_update',
      'login',
      'profile_update',
      'meeting_scheduled',
      'meeting_completed',
      'note_added'
    ],
    index: true
  },
  // Activity title
  title: {
    type: String,
    required: true
  },
  // Activity description/details
  description: {
    type: String,
    default: ''
  },
  // Who performed this activity (advisor, system, student)
  performedBy: {
    type: {
      type: String,
      enum: ['advisor', 'student', 'system'],
      required: true
    },
    advisorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Advisor'
    },
    advisorName: String,
    studentId: Number,
    studentName: String
  },
  // Related data (flexible object to store type-specific information)
  metadata: {
    type: Object,
    default: {}
  },
  // Priority/importance level
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal'
  },
  // Status
  status: {
    type: String,
    enum: ['active', 'completed', 'archived'],
    default: 'active'
  },
  // Timestamp (when the activity occurred)
  activityDate: {
    type: Date,
    required: true,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true
});

// Compound indexes for efficient queries
activitySchema.index({ studentId: 1, activityDate: -1 });
activitySchema.index({ student: 1, activityDate: -1 });
activitySchema.index({ type: 1, activityDate: -1 });
activitySchema.index({ 'performedBy.advisorId': 1, activityDate: -1 });

// Static method to create activity
activitySchema.statics.createActivity = async function(data) {
  try {
    const activity = new this(data);
    await activity.save();
    return activity;
  } catch (error) {
    console.error('Error creating activity:', error);
    throw error;
  }
};

// Method to get student timeline
activitySchema.statics.getStudentTimeline = async function(studentId, options = {}) {
  const {
    limit = 50,
    skip = 0,
    type,
    startDate,
    endDate
  } = options;

  const query = { studentId };

  if (type) {
    query.type = type;
  }

  if (startDate || endDate) {
    query.activityDate = {};
    if (startDate) query.activityDate.$gte = new Date(startDate);
    if (endDate) query.activityDate.$lte = new Date(endDate);
  }

  return this.find(query)
    .sort({ activityDate: -1 })
    .limit(limit)
    .skip(skip)
    .populate('student', 'studentId firstName lastName email')
    .populate('performedBy.advisorId', 'advisorId firstName lastName email');
};

module.exports = mongoose.model('Activity', activitySchema);

