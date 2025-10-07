const express = require('express');
const csvParser = require('../utils/csvParser');

const router = express.Router();

// Get dashboard statistics
router.get('/stats', (req, res) => {
  try {
    const stats = csvParser.getDashboardStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all students with combined data
router.get('/students', (req, res) => {
  try {
    const { page = 1, limit = 50, search, year, major, status } = req.query;
    let students = csvParser.getStudentData();

    // Apply filters
    if (search) {
      const searchLower = search.toLowerCase();
      students = students.filter(student => 
        student.first_name.toLowerCase().includes(searchLower) ||
        student.last_name.toLowerCase().includes(searchLower) ||
        student.email.toLowerCase().includes(searchLower) ||
        student.student_id.toString().includes(searchLower)
      );
    }

    if (year) {
      students = students.filter(student => student.year === year);
    }

    if (major) {
      students = students.filter(student => student.major === major);
    }

    if (status) {
      students = students.filter(student => student.enrollment_status === status);
    }

    // Pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    const paginatedStudents = students.slice(startIndex, endIndex);

    res.json({
      students: paginatedStudents,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(students.length / limit),
        totalStudents: students.length,
        hasNext: endIndex < students.length,
        hasPrev: startIndex > 0
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get specific student data
router.get('/students/:id', (req, res) => {
  try {
    const studentId = parseInt(req.params.id);
    const students = csvParser.getStudentData();
    const student = students.find(s => s.student_id === studentId);

    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    res.json(student);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get advisors data
router.get('/advisors', (req, res) => {
  try {
    const advisors = csvParser.getAdvisorData();
    res.json(advisors);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get courses data
router.get('/courses', (req, res) => {
  try {
    const courses = csvParser.parseCSV('courses.csv');
    res.json(courses);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get enrollments data
router.get('/enrollments', (req, res) => {
  try {
    const { studentId, courseId } = req.query;
    let enrollments = csvParser.parseCSV('enrollments.csv');

    if (studentId) {
      enrollments = enrollments.filter(e => e.student_id === parseInt(studentId));
    }

    if (courseId) {
      enrollments = enrollments.filter(e => e.course_id === parseInt(courseId));
    }

    res.json(enrollments);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get financial data
router.get('/financial', (req, res) => {
  try {
    const financialData = csvParser.parseCSV('financial_data.csv');
    res.json(financialData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get housing data
router.get('/housing', (req, res) => {
  try {
    const housingData = csvParser.parseCSV('housing.csv');
    res.json(housingData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get available datasets
router.get('/datasets', (req, res) => {
  try {
    const datasets = csvParser.getAvailableDatasets();
    res.json({ datasets });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get risk analysis (students at risk)
router.get('/risk-analysis', (req, res) => {
  try {
    const students = csvParser.getStudentData();
    
    const atRiskStudents = students.filter(student => {
      const gpa = student.academic?.gpa || 0;
      const absences = student.academic?.attendance_absences || 0;
      const feeBalance = student.financial?.fee_balance || 0;
      
      return gpa < 2.5 || absences > 5 || feeBalance > 2000;
    }).map(student => ({
      student_id: student.student_id,
      name: `${student.first_name} ${student.last_name}`,
      email: student.email,
      major: student.major,
      year: student.year,
      gpa: student.academic?.gpa || 0,
      absences: student.academic?.attendance_absences || 0,
      fee_balance: student.financial?.fee_balance || 0,
      risk_factors: [
        ...(student.academic?.gpa < 2.5 ? ['Low GPA'] : []),
        ...(student.academic?.attendance_absences > 5 ? ['High Absences'] : []),
        ...(student.financial?.fee_balance > 2000 ? ['High Fee Balance'] : [])
      ]
    }));

    res.json({
      totalAtRisk: atRiskStudents.length,
      students: atRiskStudents
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
