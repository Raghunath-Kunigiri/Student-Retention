const express = require('express');
const Entry = require('../models/Entry');
const Notification = require('../models/Notification');
const StudentNotification = require('../models/StudentNotification');
const Reply = require('../models/Reply');
const Message = require('../models/Message');
const Student = require('../models/Student');
const Advisor = require('../models/Advisor');
const { sendHelpRequestNotification } = require('../utils/emailService');
const { getStudentAdvisor, assignAdvisorToStudent } = require('../utils/advisorAssignment');
const csvParser = require('../utils/csvParser');

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
            console.warn(`⚠️ Selected advisor ${entry.data.advisorId} not found in MongoDB, checking CSV...`);
            
            // Try to find advisor in CSV
            const advisors = csvParser.parseCSV('advisors.csv');
            const advisorIdNum = parseInt(entry.data.advisorId);
            const csvAdvisor = advisors.find(a => {
              const aId = parseInt(a.advisor_id) || a.advisor_id;
              return aId === advisorIdNum || aId == advisorIdNum;
            });
            
            if (csvAdvisor) {
              console.log(`✅ Found advisor in CSV: ${csvAdvisor.first_name} ${csvAdvisor.last_name} (ID: ${csvAdvisor.advisor_id})`);
              
              // Create or get advisor in MongoDB from CSV data
              advisor = await Advisor.findOne({ advisorId: advisorIdNum });
              
              if (!advisor) {
                console.log(`📝 Creating advisor in MongoDB from CSV data...`);
                advisor = new Advisor({
                  advisorId: parseInt(csvAdvisor.advisor_id) || csvAdvisor.advisor_id,
                  firstName: csvAdvisor.first_name || '',
                  lastName: csvAdvisor.last_name || '',
                  email: csvAdvisor.email || '',
                  phone: csvAdvisor.phone || 'Not provided',
                  department: csvAdvisor.department || 'Unknown',
                  specialization: 'General Academic Advising',
                  password: 'defaultpassword123', // Default password
                  isActive: true
                });
                await advisor.save();
                console.log(`✅ Advisor created in MongoDB: ${advisor.fullName} (ObjectId: ${advisor._id})`);
              } else {
                console.log(`✅ Advisor already exists in MongoDB: ${advisor.fullName}`);
              }
            } else {
              console.warn(`⚠️ Advisor ${entry.data.advisorId} not found in CSV either`);
              console.warn(`   Available advisors in database:`);
              const allAdvisors = await Advisor.find({ isActive: true }).select('advisorId firstName lastName').limit(10);
              allAdvisors.forEach(a => {
                console.warn(`     - ${a.firstName} ${a.lastName} (ID: ${a.advisorId})`);
              });
            }
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
    } else if (entry.type === 'advisor-contact' && entry.data && entry.data.studentId && entry.data.advisorId) {
      // Handle advisor-to-student contact
      try {
        console.log(`📝 Processing advisor contact to student ${entry.data.studentId}`);
        
        // Find the student
        const student = await Student.findOne({ studentId: entry.data.studentId });
        
        if (!student) {
          console.warn(`⚠️ Student ${entry.data.studentId} not found in database`);
          return res.status(201).json({
            ...entry.toObject(),
            notificationCreated: false,
            warning: 'Student not found in database'
          });
        }

        console.log(`✅ Found student: ${student.firstName} ${student.lastName}`);

        // Find the advisor
        let advisor = null;
        const advisorId = entry.data.advisorId;
        
        // Try to find advisor by advisorId (number) or _id (ObjectId)
        if (typeof advisorId === 'string' && advisorId.match(/^[0-9a-fA-F]{24}$/)) {
          // It's an ObjectId
          advisor = await Advisor.findById(advisorId);
        } else {
          // Try to find by advisorId number or check CSV
          const advisorIdNum = parseInt(advisorId);
          if (!isNaN(advisorIdNum)) {
            advisor = await Advisor.findOne({ advisorId: advisorIdNum });
          }
        }
        
        // If not found in MongoDB, check CSV
        if (!advisor) {
          console.log(`⚠️ Advisor not found in MongoDB, checking CSV...`);
          const advisors = csvParser.parseCSV('advisors.csv');
          const csvAdvisor = advisors.find(a => {
            const aId = a.advisor_id || a.advisorId;
            return aId == advisorId || aId === advisorId || String(aId) === String(advisorId);
          });
          
          if (csvAdvisor) {
            console.log(`✅ Found advisor in CSV, creating MongoDB record...`);
            advisor = new Advisor({
              advisorId: csvAdvisor.advisor_id || csvAdvisor.advisorId,
              firstName: csvAdvisor.first_name || csvAdvisor.firstName || '',
              lastName: csvAdvisor.last_name || csvAdvisor.lastName || '',
              email: csvAdvisor.email || '',
              department: csvAdvisor.department || '',
              isActive: true
            });
            await advisor.save();
            console.log(`✅ Created advisor in MongoDB: ${advisor.fullName}`);
          }
        }

        if (!advisor) {
          console.error(`❌ Advisor not found for ID: ${advisorId}`);
          return res.status(201).json({
            ...entry.toObject(),
            notificationCreated: false,
            warning: 'Advisor not found in database'
          });
        }

        console.log(`✅ Found advisor: ${advisor.firstName} ${advisor.lastName}`);

        // Create student notification
        const studentNotification = await StudentNotification.create({
          studentId: entry.data.studentId,
          advisorId: advisor._id,
          advisorName: `${advisor.firstName} ${advisor.lastName}`,
          advisorEmail: advisor.email || '',
          type: 'advisor-contact',
          title: `Message from Your Advisor: ${entry.data.subject || 'No Subject'}`,
          message: entry.data.message || '',
          entryId: entry._id,
          data: {
            subject: entry.data.subject,
            category: entry.data.category,
            urgency: entry.data.urgency,
            message: entry.data.message
          },
          isRead: false
        });

        notificationCreated = true;
        notificationData = studentNotification;
        
        console.log(`✅ Student notification created with ID: ${studentNotification._id}`);
        console.log(`   Student: ${student.firstName} ${student.lastName} (${student.email})`);
        console.log(`   Advisor: ${advisor.firstName} ${advisor.lastName}`);
      } catch (notifError) {
        console.error('❌ Error creating student notification:', notifError);
        console.error('   Error stack:', notifError.stack);
        // Don't fail the entry creation, just log the error
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
        ? (entry.type === 'help-request' 
            ? `Request saved and notification sent to advisor` 
            : `Message sent and notification created for student`)
        : `Request saved${entry.type === 'help-request' ? ' but notification could not be created' : entry.type === 'advisor-contact' ? ' but notification could not be created' : ''}`
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
    const { type, limit = 50, skip = 0, studentId, advisorId, email, createdBy, includeReplies } = req.query;
    const query = {};
    if (type) query.type = type;
    if (createdBy) query.createdBy = createdBy;
    if (studentId) {
      // Convert studentId to number if possible, but also match as string
      const studentIdNum = parseInt(studentId);
      if (!isNaN(studentIdNum)) {
        // Use $in to match both number and string formats
        query['data.studentId'] = { $in: [studentIdNum, studentIdNum.toString(), studentId] };
      } else {
        query['data.studentId'] = studentId;
      }
    }
    if (advisorId) query['data.advisorId'] = advisorId;
    if (email) query['data.email'] = email;
    
    console.log('📋 Fetching entries with query:', query);
    
    const items = await Entry.find(query)
      .sort({ createdAt: -1 })
      .skip(Number(skip))
      .limit(Math.min(Number(limit), 200));
    
    console.log(`✅ Found ${items.length} entries`);
    
    // If includeReplies is true, fetch replies from notifications
    if (includeReplies === 'true' && items.length > 0) {
      try {
        const entryIds = items.map(item => item._id);
        console.log(`🔍 Looking for replies for ${entryIds.length} entries`);
        console.log(`   Entry IDs:`, entryIds.map(id => id.toString()));
        
        // First try to get replies from Reply collection (primary source)
        const replies = await Reply.find({ 
          entryId: { $in: entryIds }
        }).sort({ createdAt: -1 });
        
        console.log(`✅ Found ${replies.length} replies in Reply collection`);
        
        // Create a map of entryId to reply
        const replyMap = new Map();
        replies.forEach(reply => {
          if (reply.entryId) {
            const entryIdStr = reply.entryId.toString();
            replyMap.set(entryIdStr, {
              contactMethod: reply.contactMethod,
              timing: reply.timing,
              message: reply.message || '',
              repliedAt: reply.repliedAt || reply.createdAt
            });
          }
        });
        
        // Fallback: Also check notifications for replies (for backward compatibility)
        const notifications = await Notification.find({ 
          entryId: { $in: entryIds },
          'reply.contactMethod': { $exists: true, $ne: null }
        }).select('entryId reply createdAt');
        
        console.log(`✅ Found ${notifications.length} notifications with replies (fallback)`);
        
        // Add any replies from notifications that aren't in Reply collection
        notifications.forEach(notif => {
          if (notif.entryId && notif.reply && notif.reply.contactMethod) {
            const entryIdStr = notif.entryId.toString();
            // Only add if not already in map (Reply collection takes precedence)
            if (!replyMap.has(entryIdStr)) {
              const replyData = notif.reply.toObject ? notif.reply.toObject() : notif.reply;
              replyMap.set(entryIdStr, {
                contactMethod: replyData.contactMethod,
                timing: replyData.timing,
                message: replyData.message || '',
                repliedAt: replyData.repliedAt || notif.createdAt
              });
            }
          }
        });
        
        // Add replies to items
        const itemsWithReplies = items.map(item => {
          const itemObj = item.toObject();
          const itemIdStr = item._id.toString();
          const reply = replyMap.get(itemIdStr);
          
          if (reply) {
            console.log(`   ✓ Found reply for entry ${itemIdStr}`);
            itemObj.reply = reply;
          } else {
            console.log(`   ✗ No reply for entry ${itemIdStr}`);
          }
          
          return itemObj;
        });
        
        console.log(`📤 Returning ${itemsWithReplies.length} items, ${itemsWithReplies.filter(i => i.reply).length} with replies`);
        
        return res.json(itemsWithReplies);
      } catch (replyError) {
        console.error('❌ Error fetching replies:', replyError);
        console.error('   Error stack:', replyError.stack);
        // Still return items even if reply fetching fails
        return res.json(items.map(item => item.toObject()));
      }
    }
    
    res.json(items.map(item => item.toObject()));
  } catch (err) {
    console.error('❌ Error fetching entries:', err);
    console.error('Error stack:', err.stack);
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

// Get messages for a conversation (entry)
router.get('/:id/messages', async (req, res) => {
  try {
    const entryId = req.params.id;
    const messages = await Message.find({ conversationId: entryId })
      .sort({ createdAt: 1 })
      .limit(200);
    
    res.json({ messages });
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: error.message });
  }
});

// Send a message in a conversation
router.post('/:id/messages', async (req, res) => {
  try {
    const entryId = req.params.id;
    const { senderType, senderId, senderName, message } = req.body;
    
    if (!senderType || !senderId || !senderName || !message) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    if (!['student', 'advisor'].includes(senderType)) {
      return res.status(400).json({ error: 'Invalid senderType. Must be "student" or "advisor"' });
    }
    
    // Verify entry exists
    const entry = await Entry.findById(entryId);
    if (!entry) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    
    // Create message
    const newMessage = await Message.create({
      conversationId: entryId,
      senderType,
      senderId,
      senderName,
      message,
      isRead: false
    });
    
    // Mark other messages in conversation as read for the recipient
    // (if advisor sends, mark unread student messages as read, and vice versa)
    const recipientType = senderType === 'student' ? 'advisor' : 'student';
    await Message.updateMany(
      { 
        conversationId: entryId, 
        senderType: recipientType,
        isRead: false 
      },
      { 
        isRead: true,
        readAt: new Date()
      }
    );
    
    // Create notification for the recipient
    if (senderType === 'student') {
      // Student sent message, notify advisor
      const entryData = entry.data || {};
      const advisorId = entryData.advisorId;
      
      if (advisorId) {
        let advisor = await Advisor.findById(advisorId) || 
                     await Advisor.findOne({ advisorId: parseInt(advisorId) });
        
        if (advisor) {
          await Notification.create({
            advisorId: advisor._id,
            studentId: entryData.studentId,
            studentName: entryData.fullName || senderName,
            studentEmail: entryData.email || '',
            type: 'help-request',
            title: `New Message: ${entryData.subject || 'Conversation'}`,
            message: message.substring(0, 100) + (message.length > 100 ? '...' : ''),
            entryId: entryId,
            data: {
              ...entryData,
              hasNewMessage: true
            },
            isRead: false
          });
        }
      }
    } else {
      // Advisor sent message, notify student
      const entryData = entry.data || {};
      const studentId = entryData.studentId;
      
      if (studentId) {
        const student = await Student.findOne({ studentId: parseInt(studentId) });
        
        if (student) {
          let advisor = await Advisor.findById(senderId);
          if (!advisor) {
            advisor = await Advisor.findOne({ advisorId: parseInt(senderId) });
          }
          
          if (advisor) {
            await StudentNotification.create({
              studentId: parseInt(studentId),
              advisorId: advisor._id,
              advisorName: advisor.fullName || senderName,
              advisorEmail: advisor.email || '',
              type: 'advisor-contact',
              title: `New Message: ${entryData.subject || 'Conversation'}`,
              message: message.substring(0, 100) + (message.length > 100 ? '...' : ''),
              entryId: entryId,
              data: {
                ...entryData,
                hasNewMessage: true
              },
              isRead: false
            });
          }
        }
      }
    }
    
    res.status(201).json({ 
      success: true, 
      message: newMessage 
    });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: error.message });
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


