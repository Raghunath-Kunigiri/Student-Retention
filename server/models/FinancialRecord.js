const mongoose = require('mongoose');

const financialRecordSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true
  },
  studentId: {
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
  // Tuition and fees
  tuition: {
    type: Number,
    required: true,
    default: 0
  },
  fees: {
    type: Number,
    required: true,
    default: 0
  },
  totalCharges: {
    type: Number,
    required: true,
    default: 0
  },
  // Financial aid
  scholarships: {
    type: Number,
    default: 0
  },
  grants: {
    type: Number,
    default: 0
  },
  loans: {
    type: Number,
    default: 0
  },
  totalAid: {
    type: Number,
    default: 0
  },
  // Payments
  payments: {
    type: Number,
    default: 0
  },
  // Balance
  balance: {
    type: Number,
    required: true,
    default: 0
  },
  // Payment status
  paymentStatus: {
    type: String,
    required: true,
    enum: ['Current', 'Overdue', 'Delinquent', 'Paid'],
    default: 'Current'
  },
  // Due dates
  dueDate: {
    type: Date
  },
  lastPaymentDate: {
    type: Date
  },
  // Financial aid status
  financialAidStatus: {
    type: String,
    enum: ['Approved', 'Pending', 'Denied', 'Not Applied'],
    default: 'Not Applied'
  },
  // Additional information
  notes: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Index for efficient queries
financialRecordSchema.index({ student: 1 });
financialRecordSchema.index({ studentId: 1 });
financialRecordSchema.index({ semester: 1, year: 1 });
financialRecordSchema.index({ paymentStatus: 1 });
financialRecordSchema.index({ balance: 1 });

// Calculate total charges
financialRecordSchema.methods.calculateTotalCharges = function() {
  this.totalCharges = this.tuition + this.fees;
  return this.totalCharges;
};

// Calculate total aid
financialRecordSchema.methods.calculateTotalAid = function() {
  this.totalAid = this.scholarships + this.grants + this.loans;
  return this.totalAid;
};

// Calculate balance
financialRecordSchema.methods.calculateBalance = function() {
  this.balance = this.totalCharges - this.totalAid - this.payments;
  return this.balance;
};

// Update payment status based on balance
financialRecordSchema.methods.updatePaymentStatus = function() {
  if (this.balance <= 0) {
    this.paymentStatus = 'Paid';
  } else if (this.balance > 2000) {
    this.paymentStatus = 'Delinquent';
  } else if (this.balance > 1000) {
    this.paymentStatus = 'Overdue';
  } else {
    this.paymentStatus = 'Current';
  }
  return this.paymentStatus;
};

// Pre-save middleware to calculate derived fields
financialRecordSchema.pre('save', function(next) {
  this.calculateTotalCharges();
  this.calculateTotalAid();
  this.calculateBalance();
  this.updatePaymentStatus();
  next();
});

module.exports = mongoose.model('FinancialRecord', financialRecordSchema);
