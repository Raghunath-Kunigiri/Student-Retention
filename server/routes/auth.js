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
        // For CSV students, we need to check if they have registered with a custom password
        // If not, we'll create them with a default password that they need to change
        console.log('Found CSV student, checking if they have a custom password...');
        
        // Try to find if this student has already been created with a custom password
        const existingStudent = await Student.findOne({ 
          studentId: csvStudent.student_id,
          password: { $ne: 'defaultpassword123' }
        });
        
        if (existingStudent) {
          student = existingStudent;
        } else {
          // Create student in MongoDB from CSV data with default password
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
    }

    if (!student) {
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid student ID' 
      });
    }

    // Verify password
    console.log('Comparing password for student:', student.studentId);
    console.log('Provided password length:', password.length);
    console.log('Student password hash exists:', !!student.password);
    
    const isPasswordValid = await student.comparePassword(password);
    console.log('Password comparison result:', isPasswordValid);
    
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
    console.log('Advisor login request:', req.body);
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
    console.log('Comparing password for advisor:', advisor.email);
    console.log('Provided password length:', password.length);
    console.log('Advisor password hash exists:', !!advisor.password);
    
    const isPasswordValid = await advisor.comparePassword(password);
    console.log('Password comparison result:', isPasswordValid);
    
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

    // Validate against CSV file - student must exist in students.csv
    const students = csvParser.parseCSV('students.csv');
    const parsedStudentId = parseInt(studentId);
    
    // Find student in CSV by student_id
    const csvStudent = students.find(s => {
      const sId = s.student_id || s.studentId;
      return sId == parsedStudentId || sId === parsedStudentId || String(sId) === String(parsedStudentId);
    });

    if (!csvStudent) {
      return res.status(400).json({ 
        success: false, 
        error: 'Student ID not found in our records. Please use a valid student ID from the system.' 
      });
    }

    // Validate name matches CSV (case-insensitive comparison)
    const csvFullName = `${csvStudent.first_name} ${csvStudent.last_name}`.trim().toLowerCase();
    const providedFullName = fullName.trim().toLowerCase();
    
    if (csvFullName !== providedFullName) {
      return res.status(400).json({ 
        success: false, 
        error: `Name does not match our records. Please use: ${csvStudent.first_name} ${csvStudent.last_name}` 
      });
    }

    // Validate email matches CSV (case-insensitive comparison)
    const csvEmail = (csvStudent.email || '').trim().toLowerCase();
    const providedEmail = email.trim().toLowerCase();
    
    if (csvEmail !== providedEmail) {
      return res.status(400).json({ 
        success: false, 
        error: `Email does not match our records. Please use: ${csvStudent.email}` 
      });
    }

    // Check if student ID already exists in MongoDB (already registered)
    const existingStudent = await Student.findOne({ studentId: parsedStudentId });
    if (existingStudent) {
      return res.status(400).json({ 
        success: false, 
        error: 'This student ID is already registered. Please log in instead.' 
      });
    }

    // Check if email already exists in MongoDB
    const existingEmail = await Student.findOne({ email: csvEmail });
    if (existingEmail) {
      return res.status(400).json({ 
        success: false, 
        error: 'This email is already registered. Please log in instead.' 
      });
    }

    // Use data from CSV instead of user input
    const firstName = csvStudent.first_name || '';
    const lastName = csvStudent.last_name || 'Not provided';
    const csvMajor = csvStudent.major || major; // Use CSV major, fallback to provided
    const csvYear = csvStudent.year || 'First Year';
    const csvPhone = csvStudent.phone || 'Not provided';
    const csvEnrollmentStatus = csvStudent.enrollment_status || 'Enrolled';
    const csvBirthDate = csvStudent.birth_date ? new Date(csvStudent.birth_date) : null;

    // Create new student in MongoDB using CSV data
    const newStudent = new Student({
      studentId: parsedStudentId,
      firstName: firstName,
      lastName: lastName,
      email: csvEmail,
      phone: csvPhone,
      major: csvMajor,
      year: csvYear,
      birthDate: csvBirthDate,
      enrollmentStatus: csvEnrollmentStatus,
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

    // Assign advisor from CSV advisor_id if available
    if (csvStudent.advisor_id) {
      try {
        const advisor = await Advisor.findOne({ advisorId: parseInt(csvStudent.advisor_id) });
        if (advisor) {
          newStudent.assignedAdvisor = advisor._id;
          await newStudent.save();
          
          // Update advisor's assigned students list
          if (!advisor.assignedStudents.includes(newStudent._id)) {
            advisor.assignedStudents.push(newStudent._id);
            advisor.currentStudents = advisor.assignedStudents.length;
            await advisor.save();
          }
        }
      } catch (error) {
        console.error('Error assigning advisor during registration:', error);
        // Continue even if advisor assignment fails
      }
    }

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
    console.log('Advisor registration request:', req.body);
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

// Update student profile (excluding email and name)
router.put('/student/profile/:studentId', async (req, res) => {
  try {
    const { studentId } = req.params;
    const parsedStudentId = parseInt(studentId);
    
    if (!parsedStudentId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid student ID' 
      });
    }

    const student = await Student.findOne({ studentId: parsedStudentId });
    
    if (!student) {
      return res.status(404).json({ 
        success: false, 
        error: 'Student not found' 
      });
    }

    // Extract allowed fields (exclude email, firstName, lastName, studentId, password)
    const allowedFields = ['phone', 'major', 'year', 'birthDate', 'enrollmentStatus', 
                          'address', 'housing', 'academic', 'financial'];
    
    const updateData = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    }

    // Handle nested address fields
    if (req.body.address) {
      updateData.address = {
        street: req.body.address.street || student.address?.street || '',
        city: req.body.address.city || student.address?.city || '',
        state: req.body.address.state || student.address?.state || '',
        zipCode: req.body.address.zipCode || student.address?.zipCode || '',
        country: req.body.address.country || student.address?.country || 'USA'
      };
    }

    // Update student
    Object.assign(student, updateData);
    await student.save();

    res.json({
      success: true,
      message: 'Profile updated successfully',
      student: {
        studentId: student.studentId,
        firstName: student.firstName,
        lastName: student.lastName,
        email: student.email,
        phone: student.phone,
        address: student.address,
        major: student.major,
        year: student.year,
        enrollmentStatus: student.enrollmentStatus,
        housing: student.housing
      }
    });
  } catch (error) {
    console.error('Error updating student profile:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Update advisor profile (excluding email and name)
router.put('/advisor/profile/:advisorId', async (req, res) => {
  try {
    const { advisorId } = req.params;
    const parsedAdvisorId = parseInt(advisorId);
    
    if (!parsedAdvisorId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid advisor ID' 
      });
    }

    const advisor = await Advisor.findOne({ advisorId: parsedAdvisorId });
    
    if (!advisor) {
      return res.status(404).json({ 
        success: false, 
        error: 'Advisor not found' 
      });
    }

    // Extract allowed fields (exclude email, firstName, lastName, advisorId, password)
    const allowedFields = ['phone', 'department', 'specialization', 'title', 
                          'officeLocation', 'officeHours', 'address', 'isAvailable'];
    
    const updateData = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    }

    // Handle nested address fields
    if (req.body.address) {
      updateData.address = {
        street: req.body.address.street || advisor.address?.street || '',
        city: req.body.address.city || advisor.address?.city || '',
        state: req.body.address.state || advisor.address?.state || '',
        zipCode: req.body.address.zipCode || advisor.address?.zipCode || '',
        country: req.body.address.country || advisor.address?.country || 'USA'
      };
    }

    // Update advisor
    Object.assign(advisor, updateData);
    await advisor.save();

    res.json({
      success: true,
      message: 'Profile updated successfully',
      advisor: {
        advisorId: advisor.advisorId,
        firstName: advisor.firstName,
        lastName: advisor.lastName,
        email: advisor.email,
        phone: advisor.phone,
        address: advisor.address,
        department: advisor.department,
        specialization: advisor.specialization,
        title: advisor.title,
        officeLocation: advisor.officeLocation,
        officeHours: advisor.officeHours,
        isAvailable: advisor.isAvailable
      }
    });
  } catch (error) {
    console.error('Error updating advisor profile:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
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
