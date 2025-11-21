const express = require('express');
const mongoose = require('mongoose');
const HelpRequestResponse = require('../models/HelpRequestResponse');
const Advisor = require('../models/Advisor');
const router = express.Router();

/**
 * Get all responses for a specific help request (by timestamp and email)
 */
router.get('/request/:timestamp/:email', async (req, res) => {
  try {
    const { timestamp, email } = req.params;
    
    const responses = await HelpRequestResponse.find({
      googleFormTimestamp: timestamp,
      studentEmail: email.toLowerCase()
    })
    .sort({ createdAt: -1 })
    .populate('advisorId', 'firstName lastName email');

    res.json({ success: true, responses });
  } catch (error) {
    console.error('Error fetching help request responses:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get all responses by an advisor
 */
router.get('/advisor/:advisorId', async (req, res) => {
  try {
    const { advisorId } = req.params;
    
    const responses = await HelpRequestResponse.find({ advisorId })
      .sort({ createdAt: -1 })
      .populate('advisorId', 'firstName lastName email');

    res.json({ success: true, responses });
  } catch (error) {
    console.error('Error fetching advisor responses:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Create a new response
 */
router.post('/', async (req, res) => {
  try {
    const {
      googleFormTimestamp,
      studentEmail,
      studentName,
      studentPhone,
      advisorId,
      contactMethod,
      contactDate,
      responseNotes,
      status,
      googleFormData
    } = req.body;

    if (!googleFormTimestamp || !studentEmail || !studentName || !advisorId || !contactMethod) {
      return res.status(400).json({ 
        error: 'Missing required fields: googleFormTimestamp, studentEmail, studentName, advisorId, contactMethod' 
      });
    }

    // Get advisor - advisorId might be numeric ID (from localStorage) or ObjectId string
    // localStorage stores the numeric advisorId field, but we need MongoDB ObjectId for the reference
    let advisor = null;
    let advisorObjectId = null;
    
    // Try to find by numeric advisorId first (most common case - from localStorage)
    if (!isNaN(advisorId)) {
      const numericId = parseInt(advisorId);
      advisor = await Advisor.findOne({ advisorId: numericId });
      if (advisor) {
        console.log(`✅ Found advisor by numeric ID: ${numericId} -> MongoDB _id: ${advisor._id}`);
      }
    }
    
    // If not found, try as ObjectId (in case it's already an ObjectId string)
    if (!advisor && mongoose.Types.ObjectId.isValid(advisorId)) {
      advisor = await Advisor.findById(advisorId);
      if (advisor) {
        console.log(`✅ Found advisor by ObjectId: ${advisorId}`);
      }
    }
    
    // If still not found and advisorId is numeric, try loading from CSV and creating in MongoDB
    if (!advisor && !isNaN(advisorId)) {
      const numericId = parseInt(advisorId);
      const csvParser = require('../utils/csvParser');
      const advisors = csvParser.parseCSV('advisors.csv');
      const csvAdvisor = advisors.find(a => {
        const aId = a.advisor_id || a.advisorId;
        return parseInt(aId) === numericId;
      });
      
      if (csvAdvisor) {
        console.log(`📝 Creating advisor in MongoDB from CSV (ID: ${numericId})...`);
        try {
          advisor = new Advisor({
            advisorId: numericId,
            firstName: csvAdvisor.first_name || '',
            lastName: csvAdvisor.last_name || '',
            email: csvAdvisor.email || '',
            phone: csvAdvisor.phone || 'Not provided',
            department: csvAdvisor.department || 'Computer Science',
            specialization: 'General Academic Advising',
            password: 'defaultpassword123', // Default password
            isActive: true
          });
          await advisor.save();
          console.log(`✅ Advisor created in MongoDB: ${advisor.fullName} (ObjectId: ${advisor._id})`);
        } catch (createError) {
          console.error(`❌ Error creating advisor: ${createError.message}`);
          // If creation failed (maybe it was created by another request), try finding again
          advisor = await Advisor.findOne({ advisorId: numericId });
        }
      }
    }
    
    if (!advisor) {
      console.error(`❌ Advisor not found for advisorId: ${advisorId} (type: ${typeof advisorId})`);
      // Log all advisors for debugging
      const allAdvisors = await Advisor.find({}).select('advisorId firstName lastName email').limit(10);
      console.error(`   Available advisors in database:`, allAdvisors.map(a => ({ id: a.advisorId, name: `${a.firstName} ${a.lastName}` })));
      return res.status(404).json({ error: `Advisor not found with ID: ${advisorId}. Please ensure you are logged in.` });
    }
    
    // Use the MongoDB _id (ObjectId) for the reference in HelpRequestResponse
    // Ensure it's properly converted to ObjectId
    const advisorName = `${advisor.firstName} ${advisor.lastName}`;
    
    // Convert advisor._id to ObjectId if it's not already one
    if (advisor._id instanceof mongoose.Types.ObjectId) {
      advisorObjectId = advisor._id;
    } else if (typeof advisor._id === 'string' && mongoose.Types.ObjectId.isValid(advisor._id)) {
      advisorObjectId = new mongoose.Types.ObjectId(advisor._id);
    } else {
      console.error(`❌ Invalid advisor._id format: ${advisor._id} (type: ${typeof advisor._id})`);
      return res.status(400).json({ error: 'Invalid advisor ID format' });
    }
    
    console.log(`📝 Using advisor: ${advisorName} (numeric ID: ${advisor.advisorId}, MongoDB _id: ${advisorObjectId.toString()})`);
    
    console.log(`📝 Creating help request response with advisor ObjectId: ${advisorObjectId.toString()}`);
    
    const response = await HelpRequestResponse.create({
      googleFormTimestamp,
      studentEmail: studentEmail.toLowerCase(),
      studentName,
      studentPhone: studentPhone || '',
      advisorId: advisorObjectId, // Use MongoDB ObjectId
      advisorName,
      contactMethod,
      contactDate: contactDate ? new Date(contactDate) : new Date(),
      responseNotes: responseNotes || '',
      status: status || 'Pending',
      googleFormData: googleFormData || {}
    });

    // Populate advisor - only if we successfully created the response
    let populatedResponse;
    try {
      populatedResponse = await HelpRequestResponse.findById(response._id)
        .populate('advisorId', 'firstName lastName email');
      console.log(`✅ Help request response created: ${response._id}`);
    } catch (populateError) {
      console.error(`⚠️ Error populating advisor (response still saved): ${populateError.message}`);
      // Return the response without population if populate fails (response is still saved)
      populatedResponse = response;
    }

    res.status(201).json({ success: true, response: populatedResponse });
  } catch (error) {
    console.error('Error creating help request response:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Update an existing response
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      contactMethod,
      contactDate,
      responseNotes,
      status
    } = req.body;

    const response = await HelpRequestResponse.findById(id);
    if (!response) {
      return res.status(404).json({ error: 'Response not found' });
    }

    // Update fields
    if (contactMethod) response.contactMethod = contactMethod;
    if (contactDate) response.contactDate = new Date(contactDate);
    if (responseNotes !== undefined) response.responseNotes = responseNotes;
    if (status) response.status = status;

    await response.save();

    const populatedResponse = await HelpRequestResponse.findById(response._id)
      .populate('advisorId', 'firstName lastName email');

    console.log(`✅ Help request response updated: ${response._id}`);
    res.json({ success: true, response: populatedResponse });
  } catch (error) {
    console.error('Error updating help request response:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Delete a response
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const response = await HelpRequestResponse.findByIdAndDelete(id);
    if (!response) {
      return res.status(404).json({ error: 'Response not found' });
    }

    console.log(`✅ Help request response deleted: ${id}`);
    res.json({ success: true, message: 'Response deleted successfully' });
  } catch (error) {
    console.error('Error deleting help request response:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Search students for help request responses - uses CSV data for real-time search
 */
router.get('/search/students', async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q || q.trim().length < 1) {
      return res.json({ success: true, students: [] });
    }

    // Use CSV parser to get students from CSV file
    const csvParser = require('../utils/csvParser');
    const studentsData = csvParser.parseCSV('students.csv');
    
    const searchTerm = q.trim().toLowerCase();
    const searchId = !isNaN(searchTerm) ? parseInt(searchTerm) : null;
    
    // Search by name, email, or studentId in CSV data
    const filteredStudents = studentsData
      .filter(student => {
        const firstName = (student.first_name || '').toLowerCase();
        const lastName = (student.last_name || '').toLowerCase();
        const fullName = `${firstName} ${lastName}`;
        const email = (student.email || '').toLowerCase();
        const studentId = student.student_id;
        
        // Search by name (first, last, or full)
        const nameMatch = firstName.includes(searchTerm) || 
                         lastName.includes(searchTerm) || 
                         fullName.includes(searchTerm);
        
        // Search by email
        const emailMatch = email.includes(searchTerm);
        
        // Search by student ID
        const idMatch = searchId !== null && parseInt(studentId) === searchId;
        
        return nameMatch || emailMatch || idMatch;
      })
      .map(student => ({
        studentId: parseInt(student.student_id),
        firstName: student.first_name,
        lastName: student.last_name,
        email: student.email,
        phone: student.phone || 'Not provided'
      }))
      .slice(0, 20); // Limit to 20 results

    console.log(`🔍 Student search: "${q}" found ${filteredStudents.length} results`);
    res.json({ success: true, students: filteredStudents });
  } catch (error) {
    console.error('Error searching students from CSV:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get full student details by email or ID - for displaying in modal
 */
router.get('/student-details', async (req, res) => {
  try {
    const { email, studentId } = req.query;
    
    if (!email && !studentId) {
      return res.status(400).json({ error: 'Email or studentId is required' });
    }

    // Use CSV parser to get students from CSV file
    const csvParser = require('../utils/csvParser');
    const studentsData = csvParser.parseCSV('students.csv');
    const academicData = csvParser.parseCSV('academic_records.csv');
    const financialData = csvParser.parseCSV('financial_data.csv');
    
    // Find student by email or ID
    let student = null;
    if (email) {
      student = studentsData.find(s => s.email && s.email.toLowerCase() === email.toLowerCase());
    } else if (studentId) {
      student = studentsData.find(s => parseInt(s.student_id) === parseInt(studentId));
    }
    
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }
    
    // Get academic record
    const academic = academicData.find(a => parseInt(a.student_id) === parseInt(student.student_id));
    
    // Get financial record
    const financial = financialData.find(f => parseInt(f.student_id) === parseInt(student.student_id));
    
    // Combine all data
    const studentDetails = {
      studentId: parseInt(student.student_id),
      firstName: student.first_name,
      lastName: student.last_name,
      email: student.email,
      phone: student.phone || 'Not provided',
      major: student.major,
      year: student.year,
      birthDate: student.birth_date,
      enrollmentStatus: student.enrollment_status,
      dropoutStatus: student.dropout_status_2024 || 'N/A',
      advisorId: student.advisor_id ? parseInt(student.advisor_id) : null,
      academic: academic ? {
        gpa: parseFloat(academic.gpa) || 0,
        creditsEarned: parseInt(academic.credits_earned) || 0,
        attendanceAbsences: parseInt(academic.attendance_absences) || 0
      } : null,
      financial: financial ? {
        feeBalance: parseFloat(financial.fee_balance) || 0,
        scholarshipAmount: parseFloat(financial.scholarship_amount) || 0,
        paymentStatus: financial.payment_status || 'Current'
      } : null
    };
    
    console.log(`✅ Student details fetched for: ${studentDetails.email}`);
    res.json({ success: true, student: studentDetails });
  } catch (error) {
    console.error('Error fetching student details:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

