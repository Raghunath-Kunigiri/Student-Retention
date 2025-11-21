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
    const enrollmentsData = csvParser.parseCSV('enrollments.csv');
    
    // Total students from students.csv
    const totalStudents = studentsData.length;
    
    // At-risk students from academic_records.csv (GPA 0.0 - 2.99)
    const atRiskStudents = academicData.filter(record => record.gpa >= 0 && record.gpa <= 2.99).length;
    
    // Average GPA from academic_records.csv
    const validGPAs = academicData.filter(record => record.gpa > 0);
    const averageGPA = validGPAs.length > 0 
      ? (validGPAs.reduce((sum, record) => sum + record.gpa, 0) / validGPAs.length).toFixed(2)
      : 0;
    
    // Active enrollments (unique students in enrollments.csv in the last 180 days)
    const now = new Date();
    const last180 = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
    const activeSet = new Set();
    for (const e of enrollmentsData) {
      const ts = new Date(e.enrolled_date);
      if (!isNaN(ts.getTime()) && ts >= last180 && ts <= now) {
        activeSet.add(e.student_id);
      }
    }
    const activeEnrollments = activeSet.size;

    // Retention calculation using students.csv dropout_status_2024 field
    // This is more accurate than enrollment-based calculation as it uses actual dropout status
    let retentionRate = 0;
    if (studentsData && studentsData.length > 0) {
      // Count students with dropout_status_2024 = "Retained"
      const retainedStudents = studentsData.filter(s => {
        const status = (s.dropout_status_2024 || '').toString().trim();
        return status.toLowerCase() === 'retained';
      }).length;
      
      // Count students with dropout_status_2024 = "Dropped" 
      const droppedStudents = studentsData.filter(s => {
        const status = (s.dropout_status_2024 || '').toString().trim();
        return status.toLowerCase() === 'dropped';
      }).length;
      
      // Total students with a dropout status (Retained + Dropped)
      const totalWithStatus = retainedStudents + droppedStudents;
      
      if (totalWithStatus > 0) {
        retentionRate = Math.round((retainedStudents / totalWithStatus) * 100);
      } else {
        // Fallback to enrollment-based calculation if dropout_status_2024 is not available
        const yearToStudents = new Map();
        for (const e of enrollmentsData) {
          const ts = new Date(e.enrolled_date);
          if (isNaN(ts.getTime())) continue;
          const y = ts.getFullYear();
          if (!yearToStudents.has(y)) yearToStudents.set(y, new Set());
          yearToStudents.get(y).add(e.student_id);
        }
        const years = Array.from(yearToStudents.keys()).sort((a,b)=>a-b);
        if (years.length >= 2) {
          const fromYear = years[years.length - 2];
          const toYear = years[years.length - 1];
          const cohort = yearToStudents.get(fromYear);
          const next = yearToStudents.get(toYear);
          let retainedCount = 0;
          for (const id of cohort) if (next.has(id)) retainedCount++;
          retentionRate = cohort.size > 0 ? Math.round((retainedCount / cohort.size) * 100) : 0;
        }
      }
    }
    
    const stats = {
      totalStudents,
      atRiskStudents,
      averageGPA: parseFloat(averageGPA),
      activeEnrollments,
      retentionRate
    };
    
    res.json(stats);
  } catch (error) {
    console.error('CSV stats error:', error);
    res.status(500).json({ error: error.message });
  }
});

// CSV-based retention rate for a date range using enrollments.csv
router.get('/csv-retention', async (req, res) => {
  try {
    const { start, end, windowDays } = req.query;
    if (!start || !end) {
      return res.status(400).json({ error: 'Missing start or end query params (YYYY-MM-DD)' });
    }

    const startDate = new Date(start);
    const endDate = new Date(end);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
    }

    // Normalize end date to end of day
    endDate.setHours(23, 59, 59, 999);
    const subsequentWindowDays = Number.isFinite(parseInt(windowDays)) ? parseInt(windowDays) : 365;
    const subsequentEndDate = new Date(endDate.getTime() + subsequentWindowDays * 24 * 60 * 60 * 1000);

    const students = csvParser.parseCSV('students.csv');
    const enrollments = csvParser.parseCSV('enrollments.csv');

    // Cohort: unique students with at least one enrollment within the initial period
    const cohortIds = new Set();
    for (const e of enrollments) {
      const ts = new Date(e.enrolled_date);
      if (!isNaN(ts.getTime()) && ts >= startDate && ts <= endDate) {
        cohortIds.add(e.student_id);
      }
    }

    // Retained: cohort students who have an enrollment in the subsequent period (after endDate up to window)
    const retainedIds = new Set();
    if (cohortIds.size > 0) {
      for (const e of enrollments) {
        if (!cohortIds.has(e.student_id)) continue;
        const ts = new Date(e.enrolled_date);
        if (!isNaN(ts.getTime()) && ts > endDate && ts <= subsequentEndDate) {
          retainedIds.add(e.student_id);
        }
      }
    }

    const cohortSize = cohortIds.size;
    const retainedCount = retainedIds.size;
    const retentionRate = cohortSize > 0
      ? Math.round((retainedCount / cohortSize) * 100)
      : 0;

    return res.json({
      start,
      end,
      windowDays: subsequentWindowDays,
      cohortSize,
      retainedCount,
      retentionRate
    });
  } catch (error) {
    console.error('CSV retention error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all students from CSV with academic data
router.get('/csv-students', async (req, res) => {
  try {
    const { limit, search, advisor_id } = req.query;
    
    // Get raw CSV data directly
    const studentsData = csvParser.parseCSV('students.csv');
    const academicData = csvParser.parseCSV('academic_records.csv');
    
    // Create academic data map for quick lookup
    const academicMap = new Map();
    academicData.forEach(record => {
      academicMap.set(record.student_id, record);
    });
    
    // Combine student data with academic data, ensuring proper field mapping
    let studentsWithAcademic = studentsData.map(student => {
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
          creditsEarned: Math.min(parseInt(academic.credits_earned) || 0, 33), // Cap at 33
          attendanceAbsences: parseInt(academic.attendance_absences)
        } : null
      };
    });
    
    // Apply advisor_id filter if provided
    if (advisor_id) {
      const advisorIdNum = parseInt(advisor_id);
      studentsWithAcademic = studentsWithAcademic.filter(student => {
        return parseInt(student.advisorId) === advisorIdNum;
      });
    }
    
    // Apply search filter if provided
    if (search) {
      const searchLower = search.toLowerCase();
      studentsWithAcademic = studentsWithAcademic.filter(student => {
        const name = `${student.firstName} ${student.lastName}`.toLowerCase();
        const id = String(student.student_id).toLowerCase();
        return name.includes(searchLower) || id.includes(searchLower);
      });
    }
    
    // Apply limit if provided
    if (limit) {
      const limitNum = parseInt(limit);
      studentsWithAcademic = studentsWithAcademic.slice(0, limitNum);
    }
    
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
router.get('/students/:id', async (req, res) => {
  try {
    const studentId = parseInt(req.params.id);
    
    // Get CSV data first (source of truth)
    const students = csvParser.getStudentData();
    const csvStudent = students.find(s => {
      const sId = s.student_id || s.studentId;
      return sId == studentId || sId === studentId || String(sId) === String(studentId);
    });
    
    // Try to get from MongoDB (for registered students)
    const mongoStudent = await Student.findOne({ studentId }).select('-password');
    
    if (mongoStudent && csvStudent) {
      // Merge CSV data with MongoDB data, prioritizing CSV for name, email, major, year, phone
      const mergedStudent = {
        ...mongoStudent.toObject(),
        // Override with CSV data (source of truth) - CSV always takes priority
        firstName: csvStudent.first_name || mongoStudent.firstName,
        lastName: csvStudent.last_name || mongoStudent.lastName,
        email: csvStudent.email || mongoStudent.email,
        phone: csvStudent.phone || mongoStudent.phone || 'Not provided',
        major: csvStudent.major || mongoStudent.major,
        year: csvStudent.year || mongoStudent.year,
        enrollmentStatus: csvStudent.enrollment_status || mongoStudent.enrollmentStatus,
        birthDate: csvStudent.birth_date ? new Date(csvStudent.birth_date) : mongoStudent.birthDate,
        advisor_id: csvStudent.advisor_id, // Include advisor_id from CSV
        // Prioritize CSV data for academic, financial, housing
        academic: csvStudent.academic ? {
          ...csvStudent.academic,
          // Normalize field names for frontend
          attendanceAbsences: csvStudent.academic.attendance_absences || csvStudent.academic.attendanceAbsences || 0,
          attendance_absences: csvStudent.academic.attendance_absences || csvStudent.academic.attendanceAbsences || 0
        } : (mongoStudent.academic || {}),
        financial: csvStudent.financial ? {
          ...csvStudent.financial,
          fee_balance: parseFloat(csvStudent.financial.fee_balance) || 0,
          days_overdue: parseInt(csvStudent.financial.days_overdue) || 0
        } : (mongoStudent.financial || {}),
        housing: csvStudent.housing || mongoStudent.housing || {}
      };
      console.log('Merged student data:', {
        studentId: mergedStudent.studentId,
        phone: mergedStudent.phone,
        major: mergedStudent.major,
        year: mergedStudent.year,
        csvPhone: csvStudent.phone,
        csvMajor: csvStudent.major,
        csvYear: csvStudent.year,
        financial: mergedStudent.financial
      });
      return res.json(mergedStudent);
    }
    
    if (mongoStudent) {
      // MongoDB student exists but not in CSV (shouldn't happen after our validation)
      return res.json(mongoStudent);
    }
    
    if (csvStudent) {
      // Return CSV student data formatted for the dashboard
      const csvData = {
        studentId: csvStudent.student_id,
        firstName: csvStudent.first_name || '',
        lastName: csvStudent.last_name || '',
        email: csvStudent.email || '',
        phone: csvStudent.phone || 'Not provided',
        major: csvStudent.major || '',
        year: csvStudent.year || '',
        enrollmentStatus: csvStudent.enrollment_status || 'Enrolled',
        birthDate: csvStudent.birth_date ? new Date(csvStudent.birth_date) : null,
        advisor_id: csvStudent.advisor_id, // Include advisor_id from CSV
        academic: csvStudent.academic ? {
          ...csvStudent.academic,
          // Normalize field names for frontend
          attendanceAbsences: csvStudent.academic.attendance_absences || csvStudent.academic.attendanceAbsences || 0,
          attendance_absences: csvStudent.academic.attendance_absences || csvStudent.academic.attendanceAbsences || 0
        } : {},
        financial: csvStudent.financial ? {
          ...csvStudent.financial,
          fee_balance: parseFloat(csvStudent.financial.fee_balance) || 0,
          days_overdue: parseInt(csvStudent.financial.days_overdue) || 0
        } : {
          fee_balance: 0,
          financial_aid_status: 'No Financial Aid',
          days_overdue: 0,
          last_payment_date: null
        },
        housing: csvStudent.housing || {}
      };
      console.log('CSV student data returned:', {
        studentId: csvData.studentId,
        phone: csvData.phone,
        major: csvData.major,
        year: csvData.year,
        advisor_id: csvData.advisor_id,
        financial: csvData.financial
      });
      return res.json(csvData);
    }

    return res.status(404).json({ error: 'Student not found' });
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

// Get student's assigned advisor (auto-assign if not assigned)
router.get('/students/:id/advisor', async (req, res) => {
  try {
    const studentId = parseInt(req.params.id);
    
    // First, try to get advisor from CSV data (source of truth)
    const students = csvParser.getStudentData();
    const csvStudent = students.find(s => {
      const sId = s.student_id || s.studentId;
      return sId == studentId || sId === studentId || String(sId) === String(studentId);
    });
    
    if (csvStudent && csvStudent.advisor_id) {
      console.log('Student has advisor_id from CSV:', csvStudent.advisor_id);
      
      // Try to find advisor in MongoDB first
      let advisor = await Advisor.findOne({ advisorId: parseInt(csvStudent.advisor_id) });
      
      // If not in MongoDB, get from CSV
      if (!advisor) {
        console.log('Advisor not found in MongoDB, checking CSV...');
        const advisors = csvParser.parseCSV('advisors.csv');
        const csvAdvisor = advisors.find(a => {
          const aId = a.advisor_id || a.advisorId;
          const searchId = parseInt(csvStudent.advisor_id);
          return aId == searchId || aId === searchId || String(aId) === String(searchId) || parseInt(aId) === parseInt(searchId);
        });
        
        console.log('CSV advisor lookup:', {
          searchingFor: csvStudent.advisor_id,
          found: csvAdvisor ? 'Yes' : 'No',
          advisor: csvAdvisor ? { id: csvAdvisor.advisor_id, name: `${csvAdvisor.first_name} ${csvAdvisor.last_name}` } : null
        });
        
        if (csvAdvisor) {
          // Return CSV advisor data formatted for the dashboard
          const advisorData = {
            advisorId: parseInt(csvAdvisor.advisor_id) || csvAdvisor.advisor_id,
            firstName: csvAdvisor.first_name || '',
            lastName: csvAdvisor.last_name || '',
            email: csvAdvisor.email || '',
            phone: csvAdvisor.phone || 'Not provided',
            department: csvAdvisor.department || 'Unknown'
          };
          console.log('Returning CSV advisor data:', advisorData);
          return res.json(advisorData);
        } else {
          console.error('Advisor not found in CSV for advisor_id:', csvStudent.advisor_id);
        }
      } else {
        console.log('Advisor found in MongoDB:', advisor.advisorId);
        // Return MongoDB advisor without sensitive data
        const advisorData = advisor.toObject();
        delete advisorData.password;
        delete advisorData.assignedStudents;
        return res.json(advisorData);
      }
    } else {
      console.log('Student has no advisor_id in CSV:', {
        hasCsvStudent: !!csvStudent,
        advisor_id: csvStudent?.advisor_id
      });
    }
    
    // Fallback to name-based assignment if CSV advisor_id not found
    const { getStudentAdvisor } = require('../utils/advisorAssignment');
    const advisor = await getStudentAdvisor(studentId);
    
    if (!advisor) {
      return res.status(404).json({ error: 'Could not find or assign advisor' });
    }
    
    // Return advisor without sensitive data
    const advisorData = advisor.toObject();
    delete advisorData.password;
    delete advisorData.assignedStudents;
    
    res.json(advisorData);
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

// Get student enrollment data with course details from CSV, grouped by term
router.get('/students/:id/enrollments', async (req, res) => {
  try {
    const studentId = parseInt(req.params.id);
    
    // Get enrollments from CSV
    const enrollments = csvParser.parseCSV('enrollments.csv');
    const courses = csvParser.parseCSV('courses.csv');
    const terms = csvParser.parseCSV('terms.csv');
    
    // Filter enrollments for this student
    const studentEnrollments = enrollments.filter(e => {
      const eId = e.student_id || e.studentId;
      return eId == studentId || eId === studentId || String(eId) === String(studentId);
    });
    
    // Create course lookup map
    const courseMap = new Map(courses.map(c => [c.course_id || c.courseId, c]));
    
    // Create term lookup map
    const termMap = new Map(terms.map(t => [t.term_id || t.termId, t]));
    
    // Enrich enrollments with course and term details
    const enrichedEnrollments = studentEnrollments.map(enrollment => {
      const courseId = enrollment.course_id || enrollment.courseId;
      const termId = enrollment.term_id || enrollment.termId;
      const course = courseMap.get(parseInt(courseId));
      const term = termMap.get(parseInt(termId));
      
      return {
        enrollment_id: enrollment.enrollment_id || enrollment.enrollmentId,
        student_id: enrollment.student_id || enrollment.studentId,
        course_id: courseId,
        term_id: termId,
        grade: enrollment.grade || 'N/A',
        status: enrollment.status || 'Unknown',
        enrolled_date: enrollment.enrolled_date || enrollment.enrolledDate,
        course: course ? {
          course_id: course.course_id || course.courseId,
          course_code: course.course_code || course.courseCode,
          course_title: course.course_title || course.courseTitle,
          credits: course.credits || 0,
          department: course.department || 'Unknown'
        } : null,
        term: term ? {
          term_id: term.term_id || term.termId,
          term_name: term.term_name || term.termName,
          start_date: term.start_date || term.startDate,
          end_date: term.end_date || term.endDate,
          academic_year: term.academic_year || term.academicYear
        } : null
      };
    });
    
    // Group by term_id
    const groupedByTerm = {};
    enrichedEnrollments.forEach(enrollment => {
      const termId = enrollment.term_id;
      if (!groupedByTerm[termId]) {
        groupedByTerm[termId] = {
          term: enrollment.term,
          enrollments: []
        };
      }
      groupedByTerm[termId].enrollments.push(enrollment);
    });
    
    // Sort terms by term_id (newest first)
    const sortedTerms = Object.keys(groupedByTerm)
      .sort((a, b) => parseInt(b) - parseInt(a))
      .map(termId => groupedByTerm[termId]);
    
    // Sort enrollments within each term by enrolled_date (newest first)
    sortedTerms.forEach(termGroup => {
      termGroup.enrollments.sort((a, b) => {
        const dateA = new Date(a.enrolled_date);
        const dateB = new Date(b.enrolled_date);
        return dateB - dateA;
      });
    });
    
    res.json({
      studentId: studentId,
      totalEnrollments: enrichedEnrollments.length,
      terms: sortedTerms
    });
  } catch (error) {
    console.error('Student enrollments error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Test CSV parsing endpoint
router.get('/courses/test', async (req, res) => {
  try {
    console.log('Testing CSV parsing...');
    console.log('Current working directory:', process.cwd());
    console.log('CSV parser datasets path:', csvParser.datasetsPath);
    
    const coursesData = csvParser.parseCSV('courses.csv');
    console.log('CSV parsing result:', coursesData.length, 'courses');
    console.log('First course:', coursesData[0]);
    
    res.json({
      success: true,
      count: coursesData.length,
      sample: coursesData[0],
      allCourses: coursesData,
      workingDir: process.cwd(),
      datasetsPath: csvParser.datasetsPath
    });
  } catch (error) {
    console.error('CSV test error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      stack: error.stack
    });
  }
});

// Get courses data
router.get('/courses', async (req, res) => {
  try {
    const { department, semester, year } = req.query;
    
    // Get courses from CSV file
    const coursesData = csvParser.parseCSV('courses.csv');
    console.log('Raw courses data from CSV:', coursesData.length, 'courses');
    console.log('First course sample:', coursesData[0]);
    
    let filteredCourses = coursesData;
    
    if (department) {
      filteredCourses = filteredCourses.filter(course => 
        course.department.toLowerCase() === department.toLowerCase()
      );
    }
    
    // Sort by course code
    filteredCourses.sort((a, b) => a.course_code.localeCompare(b.course_code));
    
    res.json(filteredCourses);
  } catch (error) {
    console.error('Courses error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Add a new course to CSV
router.post('/courses', async (req, res) => {
  try {
    const { course_code, course_title, credits, department, description } = req.body;
    
    if (!course_code || !course_title || !credits || !department) {
      return res.status(400).json({ error: 'Missing required fields: course_code, course_title, credits, department' });
    }
    
    // Get existing courses
    const existingCourses = csvParser.parseCSV('courses.csv');
    
    // Find the highest course_id
    const maxId = existingCourses.reduce((max, course) => {
      const id = parseInt(course.course_id) || 0;
      return id > max ? id : max;
    }, 0);
    
    // Create new course
    const newCourse = {
      course_id: maxId + 1,
      course_code: course_code.trim(),
      course_title: course_title.trim(),
      credits: parseInt(credits) || 0,
      department: department.trim(),
      description: description ? description.trim() : ''
    };
    
    // Add to existing courses
    existingCourses.push(newCourse);
    
    // Write back to CSV
    const headers = ['course_id', 'course_code', 'course_title', 'credits', 'department', 'description'];
    csvParser.writeCSV('courses.csv', existingCourses, headers);
    
    console.log('✅ Course added to CSV:', newCourse);
    
    res.status(201).json({
      success: true,
      course: newCourse,
      message: 'Course added successfully'
    });
  } catch (error) {
    console.error('Error adding course:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete a course from CSV
router.delete('/courses/:id', async (req, res) => {
  try {
    const courseId = parseInt(req.params.id);
    
    if (isNaN(courseId)) {
      return res.status(400).json({ error: 'Invalid course ID' });
    }
    
    // Get existing courses
    const existingCourses = csvParser.parseCSV('courses.csv');
    
    // Check if course exists
    const courseIndex = existingCourses.findIndex(c => parseInt(c.course_id) === courseId);
    
    if (courseIndex === -1) {
      return res.status(404).json({ error: 'Course not found' });
    }
    
    // Remove course
    const deletedCourse = existingCourses.splice(courseIndex, 1)[0];
    
    // Write back to CSV
    const headers = ['course_id', 'course_code', 'course_title', 'credits', 'department', 'description'];
    csvParser.writeCSV('courses.csv', existingCourses, headers);
    
    console.log('✅ Course deleted from CSV:', deletedCourse);
    
    res.json({
      success: true,
      course: deletedCourse,
      message: 'Course deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting course:', error);
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

// Sync student data with CSV (update MongoDB records to match CSV)
router.post('/sync-student/:id', async (req, res) => {
  try {
    const studentId = parseInt(req.params.id);
    
    // Get CSV data
    const students = csvParser.getStudentData();
    const csvStudent = students.find(s => {
      const sId = s.student_id || s.studentId;
      return sId == studentId || sId === studentId || String(sId) === String(studentId);
    });
    
    if (!csvStudent) {
      return res.status(404).json({ error: 'Student not found in CSV' });
    }
    
    // Find student in MongoDB
    const mongoStudent = await Student.findOne({ studentId });
    
    if (!mongoStudent) {
      return res.status(404).json({ error: 'Student not found in database' });
    }
    
    // Update student with CSV data
    mongoStudent.firstName = csvStudent.first_name || mongoStudent.firstName;
    mongoStudent.lastName = csvStudent.last_name || mongoStudent.lastName;
    mongoStudent.email = csvStudent.email || mongoStudent.email;
    mongoStudent.phone = (csvStudent.phone && csvStudent.phone.trim() !== '') ? csvStudent.phone : mongoStudent.phone;
    mongoStudent.major = csvStudent.major || mongoStudent.major;
    mongoStudent.year = csvStudent.year || mongoStudent.year;
    mongoStudent.enrollmentStatus = csvStudent.enrollment_status || mongoStudent.enrollmentStatus;
    if (csvStudent.birth_date) {
      mongoStudent.birthDate = new Date(csvStudent.birth_date);
    }
    
    // Assign advisor from CSV if available
    if (csvStudent.advisor_id) {
      const advisor = await Advisor.findOne({ advisorId: parseInt(csvStudent.advisor_id) });
      if (advisor) {
        mongoStudent.assignedAdvisor = advisor._id;
        if (!advisor.assignedStudents.includes(mongoStudent._id)) {
          advisor.assignedStudents.push(mongoStudent._id);
          advisor.currentStudents = advisor.assignedStudents.length;
          await advisor.save();
        }
      }
    }
    
    await mongoStudent.save();
    
    res.json({
      success: true,
      message: 'Student data synced with CSV',
      student: {
        studentId: mongoStudent.studentId,
        firstName: mongoStudent.firstName,
        lastName: mongoStudent.lastName,
        email: mongoStudent.email,
        phone: mongoStudent.phone,
        major: mongoStudent.major,
        year: mongoStudent.year
      }
    });
  } catch (error) {
    console.error('Error syncing student:', error);
    res.status(500).json({ error: error.message });
  }
});

// Clear all user data (students and advisors) - USE WITH CAUTION
router.delete('/clear-all-users', async (req, res) => {
  try {
    const { confirm } = req.query;
    
    // Require explicit confirmation
    if (confirm !== 'true') {
      return res.status(400).json({ 
        error: 'This action will delete ALL students and advisors. Add ?confirm=true to confirm.' 
      });
    }

    console.log('⚠️  Clearing all user data...');
    
    // Delete all students
    const studentResult = await Student.deleteMany({});
    console.log(`Deleted ${studentResult.deletedCount} student(s)`);

    // Delete all advisors
    const advisorResult = await Advisor.deleteMany({});
    console.log(`Deleted ${advisorResult.deletedCount} advisor(s)`);

    res.json({
      success: true,
      message: 'All user data cleared successfully',
      deleted: {
        students: studentResult.deletedCount,
        advisors: advisorResult.deletedCount
      }
    });
  } catch (error) {
    console.error('Error clearing database:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update risk level for a single student
router.put('/students/:id/risk-level', async (req, res) => {
  try {
    const studentId = parseInt(req.params.id);
    const { riskLevel } = req.body; // 'high', 'medium', or 'low'
    
    console.log(`[Risk Level Update] Request received for student ${studentId} with risk level: ${riskLevel}`);
    
    if (!studentId || isNaN(studentId)) {
      console.error('[Risk Level Update] Invalid student ID:', req.params.id);
      return res.status(400).json({ error: 'Invalid student ID' });
    }
    
    if (!riskLevel || !['high', 'medium', 'low'].includes(riskLevel)) {
      console.error('[Risk Level Update] Invalid risk level:', riskLevel);
      return res.status(400).json({ error: 'Invalid risk level. Must be "high", "medium", or "low"' });
    }
    
    // Map risk level to risk score ranges
    let riskScoreMin, riskScoreMax, riskFactors;
    switch (riskLevel) {
      case 'high':
        riskScoreMin = 50;
        riskScoreMax = 100;
        riskFactors = ['High Risk'];
        break;
      case 'medium':
        riskScoreMin = 25;
        riskScoreMax = 49;
        riskFactors = ['Medium Risk'];
        break;
      case 'low':
        riskScoreMin = 0;
        riskScoreMax = 24;
        riskFactors = [];
        break;
    }
    
    // Calculate average risk score for the level
    const averageRiskScore = Math.round((riskScoreMin + riskScoreMax) / 2);
    
    console.log(`[Risk Level Update] Looking for student with ID: ${studentId}`);
    
    // Find and update the student
    let student = await Student.findOne({ studentId: studentId });
    
    if (!student) {
      console.log(`[Risk Level Update] Student ${studentId} not found in MongoDB, checking CSV...`);
      
      // If student not in MongoDB, try to get from CSV and create in MongoDB
      const students = csvParser.getStudentData();
      const csvStudent = students.find(s => {
        const sId = s.student_id || s.studentId;
        return sId == studentId || sId === studentId || String(sId) === String(studentId);
      });
      
      if (csvStudent) {
        console.log(`[Risk Level Update] Found student ${studentId} in CSV, creating MongoDB record...`);
        // Create student in MongoDB with basic info
        student = new Student({
          studentId: studentId,
          firstName: csvStudent.first_name || '',
          lastName: csvStudent.last_name || '',
          email: csvStudent.email || '',
          major: csvStudent.major || '',
          year: csvStudent.year || '',
          academic: {
            gpa: csvStudent.academic?.gpa || 0,
            creditsEarned: csvStudent.academic?.credits_earned || 0,
            attendanceAbsences: csvStudent.academic?.attendance_absences || 0
          },
          riskScore: averageRiskScore,
          riskFactors: riskFactors,
          isActive: true
        });
        await student.save();
        console.log(`[Risk Level Update] Created new student record in MongoDB for ${studentId}`);
      } else {
        console.error(`[Risk Level Update] Student ${studentId} not found in CSV or MongoDB`);
        return res.status(404).json({ error: `Student ${studentId} not found` });
      }
    } else {
      // Update existing student's risk level
      student.riskScore = averageRiskScore;
      student.riskFactors = riskFactors;
      await student.save();
      console.log(`[Risk Level Update] Updated existing student ${studentId} risk level to "${riskLevel}"`);
    }
    
    res.json({
      success: true,
      message: `Risk level updated to "${riskLevel}" for student ${studentId}`,
      studentId: studentId,
      riskLevel: riskLevel,
      riskScore: averageRiskScore
    });
  } catch (error) {
    console.error('[Risk Level Update] Error:', error);
    console.error('[Risk Level Update] Error stack:', error.stack);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

module.exports = router;
