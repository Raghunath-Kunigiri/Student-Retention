const express = require('express');
const csvParser = require('../utils/csvParser');
const Student = require('../models/Student');
const Advisor = require('../models/Advisor');
const Course = require('../models/Course');
const Enrollment = require('../models/Enrollment');
const FinancialRecord = require('../models/FinancialRecord');
const HousingRecord = require('../models/HousingRecord');

const router = express.Router();

// CSV-based statistics endpoints
router.get('/csv-stats', async (req, res) => {
  try {
    // Get data from CSV files
    const studentsData = csvParser.getStudentData();
    const academicData = csvParser.getAcademicData();
    
    // Total students from students.csv
    const totalStudents = studentsData.length;
    
    // At-risk students from academic_records.csv (GPA < 3.1)
    const atRiskStudents = academicData.filter(record => record.gpa < 3.1).length;
    
    // Average GPA from academic_records.csv
    const validGPAs = academicData.filter(record => record.gpa > 0);
    const averageGPA = validGPAs.length > 0 
      ? (validGPAs.reduce((sum, record) => sum + record.gpa, 0) / validGPAs.length).toFixed(2)
      : 0;
    
    // Active enrollments (unique students in academic_records.csv)
    const uniqueStudents = new Set(academicData.map(record => record.student_id));
    const activeEnrollments = uniqueStudents.size;
    
    const stats = {
      totalStudents,
      atRiskStudents,
      averageGPA: parseFloat(averageGPA),
      activeEnrollments
    };
    
    res.json(stats);
  } catch (error) {
    console.error('CSV stats error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all students from CSV with academic data
router.get('/csv-students', async (req, res) => {
  try {
    // Get raw CSV data directly
    const studentsData = csvParser.parseCSV('students.csv');
    const academicData = csvParser.parseCSV('academic_records.csv');
    
    // Create academic data map for quick lookup
    const academicMap = new Map();
    academicData.forEach(record => {
      academicMap.set(record.student_id, record);
    });
    
    // Combine student data with academic data, ensuring proper field mapping
    const studentsWithAcademic = studentsData.map(student => {
      const academic = academicMap.get(student.student_id);
      return {
        student_id: student.student_id,
        firstName: student.first_name,
        lastName: student.last_name,
        email: student.email,
        phone: student.phone,
        major: student.major,
        year: student.year,
        birthDate: student.birth_date,
        enrollmentStatus: student.enrollment_status,
        advisorId: student.advisor_id,
        academic: academic ? {
          gpa: parseFloat(academic.gpa),
          creditsEarned: parseInt(academic.credits_earned),
          attendanceAbsences: parseInt(academic.attendance_absences)
        } : null
      };
    });
    
    res.json(studentsWithAcademic);
  } catch (error) {
    console.error('CSV students error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get dashboard statistics
router.get('/stats', async (req, res) => {
  try {
    // Get statistics from MongoDB
    const totalStudents = await Student.countDocuments({ isActive: true });
    const totalAdvisors = await Advisor.countDocuments({ isActive: true });
    const enrolledStudents = await Student.countDocuments({ 
      isActive: true, 
      enrollmentStatus: 'Enrolled' 
    });
    const atRiskStudents = await Student.countDocuments({ 
      isActive: true,
      riskScore: { $gte: 50 }
    });
    
    // Get major distribution
    const majorStats = await Student.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$major', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    
    // Get year distribution
    const yearStats = await Student.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$year', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);

    const stats = {
      totalStudents,
      totalAdvisors,
      enrolledStudents,
      atRiskStudents,
      majorDistribution: majorStats,
      yearDistribution: yearStats,
      retentionRate: totalStudents > 0 ? ((totalStudents - atRiskStudents) / totalStudents * 100).toFixed(1) : 0
    };
    
    res.json(stats);
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all students with combined data
router.get('/students', async (req, res) => {
  try {
    const { page = 1, limit = 2000, search, year, major, status } = req.query;
    
    // Build query
    let query = { isActive: true };
    
    if (year) {
      query.year = year;
    }
    
    if (major) {
      query.major = major;
    }
    
    if (status) {
      query.enrollmentStatus = status;
    }
    
    // Build search query
    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { studentId: { $regex: search, $options: 'i' } }
      ];
    }

    // Get total count for pagination
    const totalStudents = await Student.countDocuments(query);
    
    // Get paginated results
    const students = await Student.find(query)
      .populate('assignedAdvisor', 'firstName lastName email department')
      .select('-password')
      .sort({ studentId: 1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    // Calculate risk scores for all students
    students.forEach(student => {
      student.calculateRiskScore();
    });

    res.json({
      students,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalStudents / limit),
        totalStudents,
        hasNext: (page * limit) < totalStudents,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Students error:', error);
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
router.get('/advisors', async (req, res) => {
  try {
    const { department, specialization } = req.query;
    
    let query = { isActive: true };
    
    if (department) {
      query.department = department;
    }
    
    if (specialization) {
      query.specialization = { $regex: specialization, $options: 'i' };
    }

    const advisors = await Advisor.find(query)
      .populate('assignedStudents', 'studentId firstName lastName email major year')
      .select('-password')
      .sort({ lastName: 1, firstName: 1 });

    // Update student counts
    advisors.forEach(advisor => {
      advisor.updateStudentCount();
    });

    res.json(advisors);
  } catch (error) {
    console.error('Advisors error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get specific advisor by ID
router.get('/advisors/:id', async (req, res) => {
  try {
    const advisorId = parseInt(req.params.id);
    const advisor = await Advisor.findOne({ advisorId })
      .populate('assignedStudents', 'studentId firstName lastName email major year')
      .select('-password');
    
    if (!advisor) {
      return res.status(404).json({ error: 'Advisor not found' });
    }
    
    res.json(advisor);
  } catch (error) {
    console.error('Advisor error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get advisors by department for students
router.get('/advisors/department/:department', async (req, res) => {
  try {
    const { department } = req.params;
    const advisors = await Advisor.find({ 
      department: new RegExp(department, 'i'),
      isActive: true 
    }).select('-password -assignedStudents');
    
    res.json(advisors);
  } catch (error) {
    console.error('Advisors by department error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get student's assigned advisor
router.get('/students/:id/advisor', async (req, res) => {
  try {
    const studentId = parseInt(req.params.id);
    const student = await Student.findOne({ studentId }).select('advisorId');
    
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }
    
    const advisor = await Advisor.findOne({ advisorId: student.advisorId })
      .select('-password -assignedStudents');
    
    if (!advisor) {
      return res.status(404).json({ error: 'Advisor not found' });
    }
    
    res.json(advisor);
  } catch (error) {
    console.error('Student advisor error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get students with sorting and filtering options
router.get('/students/filtered', async (req, res) => {
  try {
    const { 
      sortBy = 'firstName', 
      sortOrder = 'asc', 
      department, 
      year, 
      enrollmentStatus,
      search 
    } = req.query;
    
    let query = { isActive: true };
    
    // Apply filters
    if (department) {
      query.major = new RegExp(department, 'i');
    }
    if (year) {
      query.year = year;
    }
    if (enrollmentStatus) {
      query.enrollmentStatus = enrollmentStatus;
    }
    if (search) {
      query.$or = [
        { firstName: new RegExp(search, 'i') },
        { lastName: new RegExp(search, 'i') },
        { email: new RegExp(search, 'i') },
        { studentId: isNaN(search) ? null : parseInt(search) }
      ];
    }
    
    // Build sort object
    const sortObj = {};
    sortObj[sortBy] = sortOrder === 'desc' ? -1 : 1;
    
    const students = await Student.find(query)
      .sort(sortObj)
      .select('-password')
      .limit(1000); // Limit for performance
    
    res.json(students);
  } catch (error) {
    console.error('Filtered students error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get students with academic records for comprehensive display
router.get('/students/detailed', async (req, res) => {
  try {
    const { 
      sortBy = 'firstName', 
      sortOrder = 'asc', 
      department, 
      year, 
      enrollmentStatus,
      search,
      page = 1,
      limit = 2000
    } = req.query;
    
    let query = { isActive: true };
    
    // Apply filters
    if (department) {
      query.major = new RegExp(department, 'i');
    }
    if (year) {
      query.year = year;
    }
    if (enrollmentStatus) {
      query.enrollmentStatus = enrollmentStatus;
    }
    if (search) {
      query.$or = [
        { firstName: new RegExp(search, 'i') },
        { lastName: new RegExp(search, 'i') },
        { email: new RegExp(search, 'i') },
        { studentId: isNaN(search) ? null : parseInt(search) }
      ];
    }
    
    // Build sort object
    const sortObj = {};
    sortObj[sortBy] = sortOrder === 'desc' ? -1 : 1;
    
    // Get students with academic records
    const students = await Student.find(query)
      .populate('assignedAdvisor', 'firstName lastName email department')
      .sort(sortObj)
      .select('-password')
      .skip((page - 1) * limit)
      .limit(parseInt(limit));
    
    // Get academic records for these students
    const studentIds = students.map(s => s.studentId);
    const academicRecords = await FinancialRecord.find({ 
      studentId: { $in: studentIds } 
    }).select('studentId gpa credits_earned attendance_absences');
    
    // Combine student data with academic records
    const studentsWithAcademic = students.map(student => {
      const academic = academicRecords.find(record => record.studentId === student.studentId);
      return {
        ...student.toObject(),
        academic: academic ? {
          gpa: academic.gpa,
          creditsEarned: academic.credits_earned,
          attendanceAbsences: academic.attendance_absences
        } : null
      };
    });
    
    res.json(studentsWithAcademic);
  } catch (error) {
    console.error('Detailed students error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get student enrollment data with course details
router.get('/students/:id/enrollments', async (req, res) => {
  try {
    const studentId = parseInt(req.params.id);
    const enrollments = await Enrollment.find({ studentId })
      .populate('courseId', 'courseCode courseName credits department')
      .sort({ enrolledDate: -1 });
    
    res.json(enrollments);
  } catch (error) {
    console.error('Student enrollments error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get courses data
router.get('/courses', async (req, res) => {
  try {
    const { department, semester, year } = req.query;
    
    let query = { isActive: true };
    
    if (department) {
      query.department = department;
    }
    
    if (semester) {
      query.semester = semester;
    }
    
    if (year) {
      query.year = year;
    }
    
    const courses = await Course.find(query)
      .sort({ courseCode: 1 });
    
    res.json(courses);
  } catch (error) {
    console.error('Courses error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get enrollments data
router.get('/enrollments', async (req, res) => {
  try {
    const { studentId, courseId, status } = req.query;
    
    let query = {};
    
    if (studentId) {
      query.studentId = parseInt(studentId);
    }
    
    if (courseId) {
      query.courseId = parseInt(courseId);
    }
    
    if (status) {
      query.status = status;
    }
    
    const enrollments = await Enrollment.find(query)
      .populate('studentId', 'firstName lastName studentId email')
      .populate('courseId', 'courseName courseCode department')
      .sort({ enrollmentDate: -1 });
    
    res.json(enrollments);
  } catch (error) {
    console.error('Enrollments error:', error);
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
router.get('/risk-analysis', async (req, res) => {
  try {
    const { minRiskScore = 50 } = req.query;
    
    const atRiskStudents = await Student.find({
      isActive: true,
      riskScore: { $gte: parseInt(minRiskScore) }
    })
    .populate('assignedAdvisor', 'firstName lastName email department')
    .select('-password')
    .sort({ riskScore: -1 });

    // Calculate risk scores and factors for all students
    atRiskStudents.forEach(student => {
      student.calculateRiskScore();
    });

    const riskAnalysis = atRiskStudents.map(student => ({
      studentId: student.studentId,
      name: student.fullName,
      email: student.email,
      major: student.major,
      year: student.year,
      gpa: student.academic?.gpa || 0,
      absences: student.academic?.attendanceAbsences || 0,
      feeBalance: student.financial?.feeBalance || 0,
      riskScore: student.riskScore,
      riskFactors: student.riskFactors,
      assignedAdvisor: student.assignedAdvisor,
      lastLogin: student.lastLogin
    }));

    // Get risk distribution
    const riskDistribution = await Student.aggregate([
      { $match: { isActive: true } },
      {
        $bucket: {
          groupBy: '$riskScore',
          boundaries: [0, 25, 50, 75, 100],
          default: 'Unknown',
          output: {
            count: { $sum: 1 },
            students: { $push: { studentId: '$studentId', name: { $concat: ['$firstName', ' ', '$lastName'] } } }
          }
        }
      }
    ]);

    res.json({
      totalAtRisk: atRiskStudents.length,
      students: riskAnalysis,
      riskDistribution,
      summary: {
        lowRisk: riskDistribution.find(r => r._id === 0)?.count || 0,
        mediumRisk: riskDistribution.find(r => r._id === 25)?.count || 0,
        highRisk: riskDistribution.find(r => r._id === 50)?.count || 0,
        criticalRisk: riskDistribution.find(r => r._id === 75)?.count || 0
      }
    });
  } catch (error) {
    console.error('Risk analysis error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
