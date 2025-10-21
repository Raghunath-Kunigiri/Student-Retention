const mongoose = require('mongoose');

const housingRecordSchema = new mongoose.Schema({
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
  // Housing type
  housingType: {
    type: String,
    required: true,
    enum: ['On-Campus', 'Off-Campus', 'Commuter'],
    default: 'Commuter'
  },
  // On-campus housing details
  residenceHall: {
    type: String,
    trim: true
  },
  roomNumber: {
    type: String,
    trim: true
  },
  roomType: {
    type: String,
    enum: ['Single', 'Double', 'Triple', 'Quad', 'Suite', 'Apartment'],
    trim: true
  },
  // Off-campus housing details
  offCampusAddress: {
    street: {
      type: String,
      trim: true
    },
    city: {
      type: String,
      trim: true
    },
    state: {
      type: String,
      trim: true
    },
    zipCode: {
      type: String,
      trim: true
    }
  },
  // Housing costs
  housingCost: {
    type: Number,
    default: 0
  },
  mealPlan: {
    type: String,
    enum: ['None', 'Basic', 'Standard', 'Premium', 'Unlimited'],
    default: 'None'
  },
  mealPlanCost: {
    type: Number,
    default: 0
  },
  // Housing status
  housingStatus: {
    type: String,
    required: true,
    enum: ['Active', 'Inactive', 'Pending', 'Cancelled'],
    default: 'Active'
  },
  // Dates
  moveInDate: {
    type: Date
  },
  moveOutDate: {
    type: Date
  },
  // Roommate information
  roommates: [{
    studentId: {
      type: Number
    },
    name: {
      type: String,
      trim: true
    }
  }],
  // Special accommodations
  specialAccommodations: {
    type: String,
    trim: true
  },
  // Housing violations
  violations: [{
    date: {
      type: Date
    },
    type: {
      type: String,
      trim: true
    },
    description: {
      type: String,
      trim: true
    },
    resolved: {
      type: Boolean,
      default: false
    }
  }],
  // Notes
  notes: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Index for efficient queries
housingRecordSchema.index({ student: 1 });
housingRecordSchema.index({ studentId: 1 });
housingRecordSchema.index({ semester: 1, year: 1 });
housingRecordSchema.index({ housingType: 1 });
housingRecordSchema.index({ residenceHall: 1, roomNumber: 1 });

// Virtual for full address (off-campus)
housingRecordSchema.virtual('fullAddress').get(function() {
  if (this.housingType === 'Off-Campus' && this.offCampusAddress) {
    const addr = this.offCampusAddress;
    return `${addr.street}, ${addr.city}, ${addr.state} ${addr.zipCode}`;
  }
  return null;
});

// Virtual for total housing cost
housingRecordSchema.virtual('totalHousingCost').get(function() {
  return this.housingCost + this.mealPlanCost;
});

// Ensure virtual fields are serialized
housingRecordSchema.set('toJSON', {
  virtuals: true
});

module.exports = mongoose.model('HousingRecord', housingRecordSchema);
