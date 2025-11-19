const express = require('express');
const StudentNotification = require('../models/StudentNotification');

const router = express.Router();

// Get all notifications for a student
router.get('/', async (req, res) => {
  try {
    const { studentId, isRead, limit = 50, skip = 0 } = req.query;
    
    if (!studentId) {
      return res.status(400).json({ error: 'studentId is required' });
    }

    const studentIdNum = parseInt(studentId);
    if (isNaN(studentIdNum)) {
      return res.status(400).json({ error: 'Invalid studentId' });
    }

    console.log(`🔔 Fetching notifications for studentId: ${studentIdNum}`);

    const query = { studentId: studentIdNum };
    if (isRead !== undefined) {
      query.isRead = isRead === 'true';
    }

    const notifications = await StudentNotification.find(query)
      .sort({ createdAt: -1 })
      .skip(Number(skip))
      .limit(Math.min(Number(limit), 200))
      .populate('entryId', 'type data createdAt');

    const unreadCount = await StudentNotification.countDocuments({
      studentId: studentIdNum,
      isRead: false
    });

    res.json({
      notifications,
      unreadCount,
      total: notifications.length
    });
  } catch (error) {
    console.error('Error fetching student notifications:', error);
    res.status(500).json({ error: error.message });
  }
});

// Mark notification as read
router.patch('/:id/read', async (req, res) => {
  try {
    const notification = await StudentNotification.findByIdAndUpdate(
      req.params.id,
      { isRead: true },
      { new: true }
    );
    
    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    
    res.json({ success: true, notification });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ error: error.message });
  }
});

// Mark all notifications as read
router.patch('/mark-all-read', async (req, res) => {
  try {
    const { studentId } = req.body;
    
    if (!studentId) {
      return res.status(400).json({ error: 'studentId is required' });
    }

    const studentIdNum = parseInt(studentId);
    if (isNaN(studentIdNum)) {
      return res.status(400).json({ error: 'Invalid studentId' });
    }

    const result = await StudentNotification.updateMany(
      { studentId: studentIdNum, isRead: false },
      { isRead: true }
    );

    res.json({ success: true, updated: result.modifiedCount });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

