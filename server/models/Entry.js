const mongoose = require('mongoose');

const EntrySchema = new mongoose.Schema({
  type: { type: String, required: true }, // e.g., 'student', 'advisor', 'note', etc.
  data: { type: Object, default: {} },    // arbitrary JSON payload
  createdBy: { type: String },            // optional identifier
}, { timestamps: true });

module.exports = mongoose.model('Entry', EntrySchema);


