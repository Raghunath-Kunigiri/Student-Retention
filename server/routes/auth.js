const express = require('express');
const csvParser = require('../utils/csvParser');

const router = express.Router();

// Simple in-memory session store (in production, use Redis or database)
const sessions = new Map();

// Generate session token
function generateSessionToken() {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

// Student login endpoint
router.post('/student/login', async (req, res) => {
  try {
    const { studentId, password } = req.body;

    if (!studentId || !password) {
      return res.status(400).json({ 
        success: false, 
        error: 'Student ID and password are required' 
      });
    }

    // Get student data from CSV first
    const students = csvParser.parseCSV('students.csv');
    let student = students.find(s => s.student_id.toString() === studentId.toString());

    // If not found in CSV, check database for registered students
    if (!student) {
      try {
        const Entry = require('../models/Entry');
        const dbStudent = await Entry.findOne({ 
          type: 'student-profile', 
          'data.studentId': parseInt(studentId) 
        });
        
        if (dbStudent && dbStudent.data) {
          student = dbStudent.data;
        }
      } catch (dbError) {
        console.error('Database lookup error:', dbError);
      }
    }

    if (!student) {
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid student ID' 
      });
    }

    // For demo purposes, we'll accept any password that's at least 6 characters
    // In production, you'd hash passwords and store them securely
    if (password.length < 6) {
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid password' 
      });
    }

    // Create session
    const sessionToken = generateSessionToken();
    sessions.set(sessionToken, {
      type: 'student',
      studentId: student.student_id,
      userData: student,
      createdAt: new Date()
    });

    // Get combined student data
    const studentData = csvParser.getStudentData().find(s => s.student_id === student.student_id);

    res.json({
      success: true,
      sessionToken,
      user: {
        studentId: student.student_id,
        fullName: `${student.first_name} ${student.last_name}`,
        email: student.email,
        major: student.major,
        year: student.year,
        academic: studentData?.academic || {},
        financial: studentData?.financial || {},
        housing: studentData?.housing || {}
      }
    });

  } catch (error) {
    console.error('Student login error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// Advisor login endpoint
router.post('/advisor/login', async (req, res) => {
  try {
    const { email, password, department } = req.body;

    if (!email || !password || !department) {
      return res.status(400).json({ 
        success: false, 
        error: 'Email, password, and department are required' 
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid email format' 
      });
    }

    // Get advisor data from CSV first
    const advisors = csvParser.parseCSV('advisors.csv');
    let advisor = advisors.find(a => a.email.toLowerCase() === email.toLowerCase());
    
    console.log('CSV lookup result:', advisor ? 'Found in CSV' : 'Not found in CSV');

    // If not found in CSV, check database for registered advisors
    if (!advisor) {
      try {
        const Entry = require('../models/Entry');
        console.log('Searching database for email:', email.toLowerCase());
        
        // Try both exact match and case-insensitive match
        let dbAdvisor = await Entry.findOne({ 
          type: 'advisor-profile', 
          'data.email': email.toLowerCase() 
        });
        
        if (!dbAdvisor) {
          // Try case-insensitive search
          dbAdvisor = await Entry.findOne({ 
            type: 'advisor-profile',
            $expr: {
              $eq: [
                { $toLower: "$data.email" },
                email.toLowerCase()
              ]
            }
          });
        }
        
        console.log('Database lookup result:', dbAdvisor ? 'Found in DB' : 'Not found in DB');
        
        if (dbAdvisor) {
          console.log('Raw DB data:', JSON.stringify(dbAdvisor, null, 2));
          
          if (dbAdvisor.data) {
            advisor = dbAdvisor.data;
            console.log('Using DB advisor data:', advisor);
          }
        }
      } catch (dbError) {
        console.error('Database lookup error:', dbError);
      }
    }

    if (!advisor) {
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid email address' 
      });
    }

    // For demo purposes, we'll accept any password that's at least 6 characters
    if (password.length < 6) {
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid password' 
      });
    }

    // Create session
    const sessionToken = generateSessionToken();
    sessions.set(sessionToken, {
      type: 'advisor',
      advisorId: advisor.advisor_id,
      userData: advisor,
      createdAt: new Date()
    });

    res.json({
      success: true,
      sessionToken,
      user: {
        advisorId: advisor.advisor_id || advisor.advisorId,
        fullName: `${advisor.first_name || advisor.firstName} ${advisor.last_name || advisor.lastName}`,
        email: advisor.email,
        department: department,
        phone: advisor.phone || 'Not provided'
      }
    });

  } catch (error) {
    console.error('Advisor login error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// Student registration endpoint
router.post('/student/register', async (req, res) => {
  try {
    const { fullName, email, studentId, major, password, confirmPassword } = req.body;

    // Validation
    if (!fullName || !email || !studentId || !major || !password || !confirmPassword) {
      return res.status(400).json({ 
        success: false, 
        error: 'All fields are required' 
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ 
        success: false, 
        error: 'Passwords do not match' 
      });
    }

    if (password.length < 6) {
      return res.status(400).json({ 
        success: false, 
        error: 'Password must be at least 6 characters long' 
      });
    }

    // Check if student ID already exists
    const students = csvParser.parseCSV('students.csv');
    const existingStudent = students.find(s => s.student_id.toString() === studentId.toString());
    
    if (existingStudent) {
      return res.status(400).json({ 
        success: false, 
        error: 'Student ID already exists' 
      });
    }

    // Check if email already exists
    const existingEmail = students.find(s => s.email.toLowerCase() === email.toLowerCase());
    if (existingEmail) {
      return res.status(400).json({ 
        success: false, 
        error: 'Email already registered' 
      });
    }

    // Create new student profile (in production, you'd save to database)
    const [firstName, ...lastNameParts] = fullName.split(' ');
    const lastName = lastNameParts.join(' ');

    const newStudent = {
      student_id: parseInt(studentId),
      first_name: firstName,
      last_name: lastName,
      email: email,
      major: major,
      year: 'First Year',
      enrollment_status: 'Enrolled',
      birth_date: '2000-01-01', // Default
      phone: 'Not provided'
    };

    // Store in the entries collection
    try {
      const Entry = require('../models/Entry');
      await Entry.create({
        type: 'student-profile',
        data: newStudent
      });
    } catch (dbError) {
      console.error('Database save error:', dbError);
      // Continue anyway for demo purposes
    }

    res.json({
      success: true,
      message: 'Registration successful! You can now log in.',
      user: newStudent
    });

  } catch (error) {
    console.error('Student registration error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// Advisor registration endpoint
router.post('/advisor/register', async (req, res) => {
  try {
    const { fullName, email, advisorId, department, specialization, password, confirmPassword } = req.body;

    // Validation
    if (!fullName || !email || !advisorId || !department || !specialization || !password || !confirmPassword) {
      return res.status(400).json({ 
        success: false, 
        error: 'All fields are required' 
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ 
        success: false, 
        error: 'Passwords do not match' 
      });
    }

    if (password.length < 6) {
      return res.status(400).json({ 
        success: false, 
        error: 'Password must be at least 6 characters long' 
      });
    }

    // Check if advisor already exists
    const advisors = csvParser.parseCSV('advisors.csv');
    const existingAdvisor = advisors.find(a => a.email.toLowerCase() === email.toLowerCase());
    
    if (existingAdvisor) {
      return res.status(400).json({ 
        success: false, 
        error: 'Email already registered' 
      });
    }

    // Create new advisor profile
    const [firstName, ...lastNameParts] = fullName.split(' ');
    const lastName = lastNameParts.join(' ');

    const newAdvisor = {
      advisor_id: parseInt(advisorId),
      first_name: firstName,
      last_name: lastName,
      email: email,
      phone: 'Not provided',
      assigned_student_id: 'N/A'
    };

    // Store in the entries collection
    try {
      const Entry = require('../models/Entry');
      const advisorData = {
        ...newAdvisor,
        department,
        specialization
      };
      console.log('Saving advisor to database:', advisorData);
      
      const savedEntry = await Entry.create({
        type: 'advisor-profile',
        data: advisorData
      });
      
      console.log('Advisor saved successfully:', savedEntry._id);
    } catch (dbError) {
      console.error('Database save error:', dbError);
    }

    res.json({
      success: true,
      message: 'Registration successful! You can now log in.',
      user: newAdvisor
    });

  } catch (error) {
    console.error('Advisor registration error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// Verify session endpoint
router.get('/verify/:token', (req, res) => {
  const { token } = req.params;
  const session = sessions.get(token);

  if (!session) {
    return res.status(401).json({ 
      success: false, 
      error: 'Invalid or expired session' 
    });
  }

  res.json({
    success: true,
    user: session.userData,
    type: session.type
  });
});

// Logout endpoint
router.post('/logout/:token', (req, res) => {
  const { token } = req.params;
  sessions.delete(token);
  
  res.json({
    success: true,
    message: 'Logged out successfully'
  });
});

module.exports = router;
