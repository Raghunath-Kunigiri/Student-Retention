const express = require('express');
const Notification = require('../models/Notification');
const Advisor = require('../models/Advisor');
const Reply = require('../models/Reply');

const router = express.Router();

// Test endpoint to verify route is working
router.get('/test', (req, res) => {
  res.json({ message: 'Notifications route is working!', timestamp: new Date().toISOString() });
});

// Debug endpoint to check all notifications (for troubleshooting) - MUST be before /:id routes
router.get('/debug/all', async (req, res) => {
  try {
    console.log('🔍 Debug endpoint called - fetching all notifications');
    const allNotifications = await Notification.find({})
      .sort({ createdAt: -1 })
      .limit(50)
      .populate('advisorId', 'advisorId firstName lastName email')
      .lean();
    
    res.json({
      total: allNotifications.length,
      notifications: allNotifications.map(n => ({
        _id: n._id,
        advisorId: n.advisorId?._id || n.advisorId,
        advisorIdNumber: n.advisorId?.advisorId,
        advisorName: n.advisorId?.firstName + ' ' + n.advisorId?.lastName,
        studentId: n.studentId,
        studentName: n.studentName,
        title: n.title,
        isRead: n.isRead,
        createdAt: n.createdAt
      }))
    });
  } catch (err) {
    console.error('Error in debug endpoint:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get all notifications for an advisor
router.get('/', async (req, res) => {
  try {
    const { advisorId, isRead, limit = 50, skip = 0 } = req.query;
    
    if (!advisorId) {
      return res.status(400).json({ error: 'advisorId is required' });
    }

    console.log(`🔔 Fetching notifications for advisorId: ${advisorId} (type: ${typeof advisorId})`);

    // Find advisor by advisorId (number) or _id
    let advisor;
    if (/^\d+$/.test(advisorId)) {
      const advisorIdNum = parseInt(advisorId);
      advisor = await Advisor.findOne({ advisorId: advisorIdNum });
      console.log(`   Tried numeric lookup (${advisorIdNum}): ${advisor ? 'Found' : 'Not found'}`);
    } else {
      try {
        advisor = await Advisor.findById(advisorId);
        console.log(`   Tried ObjectId lookup: ${advisor ? 'Found' : 'Not found'}`);
      } catch (err) {
        console.log(`   ObjectId lookup failed: ${err.message}`);
      }
    }

    if (!advisor) {
      console.error(`❌ Advisor not found for advisorId: ${advisorId}`);
      console.error(`   Listing all advisors in database:`);
      const allAdvisors = await Advisor.find({ isActive: true }).select('advisorId firstName lastName').limit(10);
      allAdvisors.forEach(a => {
        console.error(`     - ${a.firstName} ${a.lastName} (ID: ${a.advisorId})`);
      });
      return res.status(404).json({ error: `Advisor not found for ID: ${advisorId}` });
    }

    console.log(`✅ Found advisor: ${advisor.fullName} (ID: ${advisor.advisorId}, ObjectId: ${advisor._id})`);

    const query = { advisorId: advisor._id };
    if (isRead !== undefined) {
      query.isRead = isRead === 'true';
    }

    console.log(`🔍 Querying notifications with:`, query);

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .skip(Number(skip))
      .limit(Math.min(Number(limit), 200))
      .populate('entryId', 'type data createdAt');

    const unreadCount = await Notification.countDocuments({
      advisorId: advisor._id,
      isRead: false
    });

    console.log(`📬 Found ${notifications.length} notifications (${unreadCount} unread) for advisor ${advisor.fullName}`);

    res.json({
      notifications,
      unreadCount,
      total: notifications.length
    });
  } catch (err) {
    console.error('❌ Error fetching notifications:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get unread count for an advisor
router.get('/unread-count', async (req, res) => {
  try {
    const { advisorId } = req.query;
    
    if (!advisorId) {
      return res.status(400).json({ error: 'advisorId is required' });
    }

    // Find advisor by advisorId (number) or _id
    let advisor;
    if (/^\d+$/.test(advisorId)) {
      advisor = await Advisor.findOne({ advisorId: parseInt(advisorId) });
    } else {
      advisor = await Advisor.findById(advisorId);
    }

    if (!advisor) {
      return res.status(404).json({ error: 'Advisor not found' });
    }

    const count = await Notification.countDocuments({
      advisorId: advisor._id,
      isRead: false
    });

    res.json({ unreadCount: count });
  } catch (err) {
    console.error('Error fetching unread count:', err);
    res.status(500).json({ error: err.message });
  }
});

// Update notification (for adding entryId, etc.)
router.patch('/:id', async (req, res) => {
  try {
    const notification = await Notification.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    res.json(notification);
  } catch (err) {
    console.error('Error updating notification:', err);
    res.status(500).json({ error: err.message });
  }
});

// Mark notification as read
router.patch('/:id/read', async (req, res) => {
  try {
    const notification = await Notification.findByIdAndUpdate(
      req.params.id,
      { isRead: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    res.json(notification);
  } catch (err) {
    console.error('Error marking notification as read:', err);
    res.status(500).json({ error: err.message });
  }
});

// Mark all notifications as read for an advisor
router.patch('/mark-all-read', async (req, res) => {
  try {
    const { advisorId } = req.body;
    
    if (!advisorId) {
      return res.status(400).json({ error: 'advisorId is required' });
    }

    // Find advisor by advisorId (number) or _id
    let advisor;
    if (/^\d+$/.test(advisorId)) {
      advisor = await Advisor.findOne({ advisorId: parseInt(advisorId) });
    } else {
      advisor = await Advisor.findById(advisorId);
    }

    if (!advisor) {
      return res.status(404).json({ error: 'Advisor not found' });
    }

    const result = await Notification.updateMany(
      { advisorId: advisor._id, isRead: false },
      { isRead: true }
    );

    res.json({ 
      success: true, 
      updatedCount: result.modifiedCount 
    });
  } catch (err) {
    console.error('Error marking all notifications as read:', err);
    res.status(500).json({ error: err.message });
  }
});

// Reply to a notification (MUST be before /:id routes to avoid conflicts)
router.post('/:id/reply', async (req, res) => {
  try {
    console.log(`📝 Reply request received for notification ${req.params.id}`);
    console.log(`   Request body:`, req.body);
    
    const { contactMethod, timing, message } = req.body;
    
    if (!contactMethod || !timing) {
      console.error('❌ Missing required fields:', { contactMethod: !!contactMethod, timing: !!timing });
      return res.status(400).json({ error: 'Contact method and timing are required' });
    }

    const notification = await Notification.findById(req.params.id);
    
    if (!notification) {
      console.error(`❌ Notification not found: ${req.params.id}`);
      return res.status(404).json({ error: 'Notification not found' });
    }

    // Update notification with reply
    notification.reply = {
      contactMethod,
      timing,
      message: message || '',
      repliedAt: new Date()
    };
    
    // Mark as read when replied
    notification.isRead = true;
    
    await notification.save();

    // Also save reply to Reply collection for better tracking
    try {
      const reply = await Reply.create({
        entryId: notification.entryId,
        notificationId: notification._id,
        advisorId: notification.advisorId,
        studentId: notification.studentId,
        contactMethod,
        timing,
        message: message || '',
        repliedAt: new Date()
      });
      
      console.log(`✅ Reply saved to database with ID: ${reply._id}`);
    } catch (replyError) {
      console.error('⚠️ Error saving reply to Reply collection:', replyError);
      // Don't fail the request if Reply save fails, notification already has the reply
    }

    console.log(`✅ Advisor replied to notification ${notification._id} for student ${notification.studentName}`);

    res.json({
      success: true,
      notification: notification,
      message: 'Reply sent successfully'
    });
  } catch (err) {
    console.error('❌ Error replying to notification:', err);
    console.error('   Error stack:', err.stack);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// Delete notification
router.delete('/:id', async (req, res) => {
  try {
    const notification = await Notification.findByIdAndDelete(req.params.id);
    
    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting notification:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

