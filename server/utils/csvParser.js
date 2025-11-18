const fs = require('fs');
const path = require('path');

class CSVParser {
  constructor() {
    this.datasetsPath = path.join(__dirname, '../../Datasets');
    this.cache = new Map();
  }

  // Parse CSV file and return array of objects
  parseCSV(filename) {
    if (this.cache.has(filename)) {
      return this.cache.get(filename);
    }

    try {
      const filePath = path.join(this.datasetsPath, filename);
      const csvContent = fs.readFileSync(filePath, 'utf8');
      const lines = csvContent.trim().split('\n');
      
      if (lines.length < 2) {
        return [];
      }

      const headers = lines[0].split(',').map(h => h.trim());
      const data = [];

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        const row = {};
        
        headers.forEach((header, index) => {
          let value = values[index] || '';
          
          // Convert numeric values (but skip phone, email, and other text fields)
          const numericFields = ['student_id', 'advisor_id', 'gpa', 'credits', 'fee_balance', 'scholarship_amount', 'days_overdue', 'financial_id', 'course_id', 'term_id', 'enrollment_id'];
          if (numericFields.includes(header) && !isNaN(value) && value !== '' && !value.includes('-') && !value.includes('@')) {
            // Special handling for days_overdue - it might have dashes in date context, but we want to parse it
            if (header === 'days_overdue') {
              value = parseInt(value) || 0;
            } else if (value.includes('.')) {
              value = parseFloat(value);
            } else {
              value = parseInt(value);
            }
          }
          
          row[header] = value;
        });
        
        data.push(row);
      }

      this.cache.set(filename, data);
      return data;
    } catch (error) {
      console.error(`Error parsing ${filename}:`, error.message);
      return [];
    }
  }

  // Get all available datasets
  getAvailableDatasets() {
    try {
      const files = fs.readdirSync(this.datasetsPath);
      return files.filter(file => file.endsWith('.csv'));
    } catch (error) {
      console.error('Error reading datasets directory:', error.message);
      return [];
    }
  }

  // Get academic records data
  getAcademicData() {
    return this.parseCSV('academic_records.csv');
  }

  // Get combined student data with all related information
  getStudentData() {
    const students = this.parseCSV('students.csv');
    const academicRecords = this.parseCSV('academic_records.csv');
    const financialData = this.parseCSV('financial_data.csv');
    const housing = this.parseCSV('housing.csv');
    const enrollments = this.parseCSV('enrollments.csv');
    const courses = this.parseCSV('courses.csv');

    // Create lookup maps
    const academicMap = new Map(academicRecords.map(record => [record.student_id, record]));
    const financialMap = new Map(financialData.map(record => [record.student_id, record]));
    const housingMap = new Map(housing.map(record => [record.student_id, record]));

    // Combine data
    return students.map(student => {
      const studentId = student.student_id;
      
      return {
        ...student,
        academic: academicMap.get(studentId) || {},
        financial: financialMap.get(studentId) || {},
        housing: housingMap.get(studentId) || {},
        enrollments: enrollments.filter(e => e.student_id === studentId),
        totalEnrollments: enrollments.filter(e => e.student_id === studentId).length,
        currentCourses: this.getCurrentCourses(studentId, enrollments, courses)
      };
    });
  }

  // Get advisor data with assigned students
  getAdvisorData() {
    const advisors = this.parseCSV('advisors.csv');
    const students = this.parseCSV('students.csv');

    return advisors.map(advisor => ({
      ...advisor,
      assignedStudents: students.filter(student => 
        advisor.assigned_student_id === 'N/A' ? false : 
        student.student_id.toString() === advisor.assigned_student_id
      ),
      studentCount: advisor.assigned_student_id === 'N/A' ? 0 : 1
    }));
  }

  // Get current courses for a student
  getCurrentCourses(studentId, enrollments, courses) {
    const studentEnrollments = enrollments.filter(e => e.student_id === studentId);
    const courseMap = new Map(courses.map(course => [course.course_id, course]));
    
    return studentEnrollments.map(enrollment => ({
      ...enrollment,
      course: courseMap.get(enrollment.course_id) || {}
    }));
  }

  // Get dashboard statistics
  getDashboardStats() {
    const students = this.parseCSV('students.csv');
    const academicRecords = this.parseCSV('academic_records.csv');
    const financialData = this.parseCSV('financial_data.csv');

    const totalStudents = students.length;
    const enrolledStudents = students.filter(s => s.enrollment_status === 'Enrolled').length;
    
    const avgGPA = academicRecords.reduce((sum, record) => sum + record.gpa, 0) / academicRecords.length;
    const lowGPAStudents = academicRecords.filter(record => record.gpa < 2.0).length;
    
    const studentsOnFinancialAid = financialData.filter(f => f.financial_aid_status === 'On Financial Aid').length;
    const studentsWithBalance = financialData.filter(f => f.fee_balance > 0).length;

    return {
      totalStudents,
      enrolledStudents,
      averageGPA: Math.round(avgGPA * 100) / 100,
      lowGPAStudents,
      studentsOnFinancialAid,
      studentsWithBalance,
      retentionRate: Math.round((enrolledStudents / totalStudents) * 100)
    };
  }

  // Clear cache (useful for development)
  clearCache() {
    this.cache.clear();
  }
}

module.exports = new CSVParser();
