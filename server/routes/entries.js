const express = require('express');
const Entry = require('../models/Entry');

const router = express.Router();

// Create
router.post('/', async (req, res) => {
  try {
    const entry = await Entry.create(req.body);
    res.status(201).json(entry);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Read many with basic filtering by type
router.get('/', async (req, res) => {
  try {
    const { type, limit = 50, skip = 0, studentId, advisorId, email, createdBy } = req.query;
    const query = {};
    if (type) query.type = type;
    if (createdBy) query.createdBy = createdBy;
    if (studentId) query['data.studentId'] = studentId;
    if (advisorId) query['data.advisorId'] = advisorId;
    if (email) query['data.email'] = email;
    const items = await Entry.find(query)
      .sort({ createdAt: -1 })
      .skip(Number(skip))
      .limit(Math.min(Number(limit), 200));
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Read one
router.get('/:id', async (req, res) => {
  try {
    const item = await Entry.findById(req.params.id);
    if (!item) return res.status(404).json({ error: 'Not found' });
    res.json(item);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Update
router.put('/:id', async (req, res) => {
  try {
    const item = await Entry.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!item) return res.status(404).json({ error: 'Not found' });
    res.json(item);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Delete
router.delete('/:id', async (req, res) => {
  try {
    const item = await Entry.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;

// Danger: Purge all entries for a studentId (any type)
router.delete('/purge-student', async (req, res) => {
  try {
    const { studentId } = req.query;
    if (!studentId) return res.status(400).json({ error: 'studentId is required' });
    const result = await Entry.deleteMany({ 'data.studentId': studentId });
    res.json({ ok: true, deletedCount: result.deletedCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


