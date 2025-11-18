const express = require('express');
const Entry = require('../models/Entry');
const Notification = require('../models/Notification');
const Student = require('../models/Student');
const Advisor = require('../models/Advisor');
const { sendHelpRequestNotification } = require('../utils/emailService');
const { getStudentAdvisor, assignAdvisorToStudent } = require('../utils/advisorAssignment');

const router = express.Router();

// Create
router.post('/', async (req, res) => {
  try {
    console.log('📥 Received entry creation request:', {
      type: req.body.type,
      hasData: !!req.body.data,
      studentId: req.body.data?.studentId,
      advisorId: req.body.data?.advisorId
    });
    
    // Create and save the entry
    const entry = await Entry.create(req.body);
    console.log(`✅ Entry created successfully with ID: ${entry._id}`);
    
    let notificationCreated = false;
    let notificationData = null;
    
    // If this is a help request, create notification for advisor
    if (entry.type === 'help-request' && entry.data && entry.data.studentId) {
      try {
        console.log(`📝 Processing help request from student ${entry.data.studentId}`);
        
        // Find the student
        const student = await Student.findOne({ studentId: entry.data.studentId });
        
        if (!student) {
          console.warn(`⚠️ Student ${entry.data.studentId} not found in database`);
          // Still return success for the entry, but log the warning
          return res.status(201).json({
            ...entry.toObject(),
            notificationCreated: false,
            warning: 'Student not found in database'
          });
        }

        console.log(`✅ Found student: ${student.firstName} ${student.lastName}`);

        let advisor = null;

        // If advisorId is provided in the request, use that advisor
        if (entry.data.advisorId) {
          console.log(`🔍 Looking for advisor with ID: ${entry.data.advisorId} (type: ${typeof entry.data.advisorId})`);
          
          // Try to find by advisorId (number) first
          const advisorIdNum = parseInt(entry.data.advisorId);
          if (!isNaN(advisorIdNum)) {
            advisor = await Advisor.findOne({ advisorId: advisorIdNum });
            console.log(`   Tried numeric lookup (${advisorIdNum}): ${advisor ? 'Found' : 'Not found'}`);
          }
          
          // If not found, try by _id (MongoDB ObjectId)
          if (!advisor) {
            try {
              advisor = await Advisor.findById(entry.data.advisorId);
              console.log(`   Tried ObjectId lookup: ${advisor ? 'Found' : 'Not found'}`);
            } catch (err) {
              console.log(`   ObjectId lookup failed (invalid format): ${err.message}`);
            }
          }
          
          if (advisor) {
            console.log(`✅ Found selected advisor: ${advisor.fullName} (ID: ${advisor.advisorId}, ObjectId: ${advisor._id})`);
          } else {
            console.warn(`⚠️ Selected advisor ${entry.data.advisorId} not found in database`);
            console.warn(`   Available advisors in database:`);
            const allAdvisors = await Advisor.find({ isActive: true }).select('advisorId firstName lastName').limit(10);
            allAdvisors.forEach(a => {
              console.warn(`     - ${a.firstName} ${a.lastName} (ID: ${a.advisorId})`);
            });
          }
        }

        // If no advisor selected or not found, get/assign advisor based on student's first name
        if (!advisor) {
          console.log(`🔄 Auto-assigning advisor based on student's first name initial`);
          advisor = await getStudentAdvisor(entry.data.studentId);
          if (advisor) {
            console.log(`✅ Auto-assigned advisor: ${advisor.fullName} (ID: ${advisor.advisorId})`);
          }
        }

        if (advisor) {
          // Create notification
          console.log(`📝 Creating notification for advisor ${advisor.fullName} (ID: ${advisor.advisorId}, ObjectId: ${advisor._id})`);
          
          const notification = await Notification.create({
            advisorId: advisor._id,
            studentId: entry.data.studentId,
            studentName: entry.data.fullName || `${student.firstName} ${student.lastName}`,
            studentEmail: entry.data.email || student.email,
            type: 'help-request',
            title: `New Help Request: ${entry.data.subject || 'No Subject'}`,
            message: `Student ${entry.data.fullName || student.firstName + ' ' + student.lastName} (ID: ${entry.data.studentId}) has submitted a ${entry.data.category || 'help'} request with ${entry.data.urgency || 'Normal'} urgency.`,
            entryId: entry._id,
            data: {
              category: entry.data.category,
              subject: entry.data.subject,
              details: entry.data.details,
              urgency: entry.data.urgency
            }
          });

          console.log(`✅ Notification created successfully:`);
          console.log(`   - Notification ID: ${notification._id}`);
          console.log(`   - Advisor ID (ObjectId): ${advisor._id}`);
          console.log(`   - Advisor ID (Number): ${advisor.advisorId}`);
          console.log(`   - Advisor Name: ${advisor.fullName}`);
          console.log(`   - Student ID: ${notification.studentId}`);
          console.log(`   - Student Name: ${notification.studentName}`);
          
          // Verify notification was saved
          const savedNotification = await Notification.findById(notification._id);
          if (savedNotification) {
            console.log(`✅ Verified notification saved to database`);
            notificationCreated = true;
            notificationData = {
              notificationId: notification._id,
              advisorId: advisor.advisorId,
              advisorName: advisor.fullName,
              studentId: notification.studentId,
              studentName: notification.studentName
            };
          } else {
            console.error(`❌ ERROR: Notification was not saved to database!`);
          }

          // Send email notification (async, don't wait for it)
          sendHelpRequestNotification(
            advisor.email,
            advisor.fullName,
            notification.studentName,
            notification.studentId,
            notification.data
          ).then(emailSent => {
            if (emailSent) {
              notification.emailSent = true;
              notification.emailSentAt = new Date();
              notification.save();
            }
          }).catch(err => {
            console.error('Error updating email status:', err);
          });

          console.log(`📬 Notification pushed to advisor ${advisor.fullName} (ID: ${advisor.advisorId}) dashboard`);
        } else {
          console.warn(`❌ Could not find or assign advisor for student ${entry.data.studentId}`);
        }
      } catch (notifError) {
        // Don't fail the entry creation if notification fails
        console.error('❌ Error creating notification:', notifError);
        console.error('Error stack:', notifError.stack);
      }
    } else {
      console.log(`ℹ️ Entry type is "${entry.type}", skipping notification creation`);
    }
    
    // Return entry with notification status
    res.status(201).json({
      ...entry.toObject(),
      notificationCreated,
      notification: notificationData,
      message: notificationCreated 
        ? `Request saved and notification sent to advisor` 
        : `Request saved${entry.type === 'help-request' ? ' but notification could not be created' : ''}`
    });
  } catch (err) {
    console.error('❌ Error creating entry:', err);
    console.error('Error stack:', err.stack);
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


