const express = require('express');
const csvParser = require('../utils/csvParser');
const Student = require('../models/Student');
const Advisor = require('../models/Advisor');

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

    // First try to find student in MongoDB
    const parsedStudentId = parseInt(studentId);
    let student = await Student.findOne({ studentId: parsedStudentId });

    // If not found in MongoDB, check CSV for existing students
    if (!student) {
      const students = csvParser.parseCSV('students.csv');
      const csvStudent = students.find(s => s.student_id.toString() === studentId.toString());
      
      if (csvStudent) {
        // Create student in MongoDB from CSV data
        student = new Student({
          studentId: csvStudent.student_id,
          firstName: csvStudent.first_name,
          lastName: csvStudent.last_name,
          email: csvStudent.email,
          phone: csvStudent.phone || 'Not provided',
          major: csvStudent.major,
          year: csvStudent.year,
          birthDate: new Date(csvStudent.birth_date),
          enrollmentStatus: csvStudent.enrollment_status,
          password: 'defaultpassword123' // Default password for CSV students
        });
        
        await student.save();
      }
    }

    if (!student) {
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid student ID' 
      });
    }

    // Verify password
    const isPasswordValid = await student.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid password' 
      });
    }

    // Update last login
    student.lastLogin = new Date();
    await student.save();

    // Calculate risk score
    student.calculateRiskScore();

    // Create session
    const sessionToken = generateSessionToken();
    sessions.set(sessionToken, {
      type: 'student',
      studentId: student.studentId,
      userData: student,
      createdAt: new Date()
    });

    res.json({
      success: true,
      sessionToken,
      user: {
        studentId: student.studentId,
        fullName: student.fullName,
        email: student.email,
        major: student.major,
        year: student.year,
        academic: student.academic,
        financial: student.financial,
        housing: student.housing,
        riskScore: student.riskScore,
        riskFactors: student.riskFactors
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

    // First try to find advisor in MongoDB
    let advisor = await Advisor.findOne({ email: email.toLowerCase() });

    // If not found in MongoDB, check CSV for existing advisors
    if (!advisor) {
      const advisors = csvParser.parseCSV('advisors.csv');
      const csvAdvisor = advisors.find(a => a.email.toLowerCase() === email.toLowerCase());
      
      if (csvAdvisor) {
        // Create advisor in MongoDB from CSV data
        advisor = new Advisor({
          advisorId: csvAdvisor.advisor_id,
          firstName: csvAdvisor.first_name,
          lastName: csvAdvisor.last_name,
          email: csvAdvisor.email,
          phone: csvAdvisor.phone || 'Not provided',
          department: department, // Use provided department
          specialization: 'General Academic Advising', // Default specialization
          password: 'defaultpassword123' // Default password for CSV advisors
        });
        
        await advisor.save();
      }
    }

    if (!advisor) {
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid email address' 
      });
    }

    // Verify password
    const isPasswordValid = await advisor.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid password' 
      });
    }

    // Update last login
    advisor.lastLogin = new Date();
    await advisor.save();

    // Create session
    const sessionToken = generateSessionToken();
    sessions.set(sessionToken, {
      type: 'advisor',
      advisorId: advisor.advisorId,
      userData: advisor,
      createdAt: new Date()
    });

    res.json({
      success: true,
      sessionToken,
      user: {
        advisorId: advisor.advisorId,
        fullName: advisor.fullName,
        email: advisor.email,
        department: advisor.department,
        specialization: advisor.specialization,
        phone: advisor.phone,
        currentStudents: advisor.currentStudents,
        maxStudents: advisor.maxStudents
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

    // Check if student ID already exists in MongoDB
    const existingStudent = await Student.findOne({ studentId: parseInt(studentId) });
    if (existingStudent) {
      return res.status(400).json({ 
        success: false, 
        error: 'Student ID already exists' 
      });
    }

    // Check if email already exists in MongoDB
    const existingEmail = await Student.findOne({ email: email.toLowerCase() });
    if (existingEmail) {
      return res.status(400).json({ 
        success: false, 
        error: 'Email already registered' 
      });
    }

    // Parse full name
    const nameParts = fullName.trim().split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || 'Not provided';

    // Create new student in MongoDB
    const newStudent = new Student({
      studentId: parseInt(studentId),
      firstName: firstName,
      lastName: lastName,
      email: email.toLowerCase(),
      major: major,
      year: 'First Year',
      enrollmentStatus: 'Enrolled',
      password: password,
      academic: {
        gpa: 0,
        creditsCompleted: 0,
        attendanceAbsences: 0
      },
      financial: {
        feeBalance: 0,
        scholarshipAmount: 0,
        paymentStatus: 'Current'
      },
      housing: {
        housingStatus: 'Commuter'
      }
    });

    await newStudent.save();

    res.json({
      success: true,
      message: 'Registration successful! You can now log in.',
      user: {
        studentId: newStudent.studentId,
        fullName: newStudent.fullName,
        email: newStudent.email,
        major: newStudent.major,
        year: newStudent.year
      }
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

    // Check if advisor ID already exists in MongoDB
    const existingAdvisorId = await Advisor.findOne({ advisorId: parseInt(advisorId) });
    if (existingAdvisorId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Advisor ID already exists' 
      });
    }

    // Check if email already exists in MongoDB
    const existingEmail = await Advisor.findOne({ email: email.toLowerCase() });
    if (existingEmail) {
      return res.status(400).json({ 
        success: false, 
        error: 'Email already registered' 
      });
    }

    // Parse full name
    const nameParts = fullName.trim().split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || 'Not provided';

    // Create new advisor in MongoDB
    const newAdvisor = new Advisor({
      advisorId: parseInt(advisorId),
      firstName: firstName,
      lastName: lastName,
      email: email.toLowerCase(),
      department: department,
      specialization: specialization,
      password: password,
      phone: 'Not provided',
      title: 'Academic Advisor',
      maxStudents: 50,
      currentStudents: 0,
      assignedStudents: [],
      performance: {
        totalMeetings: 0,
        studentsRetained: 0,
        averageStudentGPA: 0
      }
    });

    await newAdvisor.save();

    res.json({
      success: true,
      message: 'Registration successful! You can now log in.',
      user: {
        advisorId: newAdvisor.advisorId,
        fullName: newAdvisor.fullName,
        email: newAdvisor.email,
        department: newAdvisor.department,
        specialization: newAdvisor.specialization
      }
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
