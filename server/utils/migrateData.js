const csvParser = require('./csvParser');
const Student = require('../models/Student');
const Advisor = require('../models/Advisor');
const Course = require('../models/Course');
const Enrollment = require('../models/Enrollment');
const FinancialRecord = require('../models/FinancialRecord');
const HousingRecord = require('../models/HousingRecord');

async function migrateData() {
  try {
    console.log('Starting data migration...');

    // Migrate Students
    console.log('Migrating students...');
    const students = csvParser.parseCSV('students.csv');
    for (const studentData of students) {
      const existingStudent = await Student.findOne({ studentId: studentData.student_id });
      if (!existingStudent) {
        const student = new Student({
          studentId: studentData.student_id,
          firstName: studentData.first_name,
          lastName: studentData.last_name,
          email: studentData.email,
          phone: studentData.phone || 'Not provided',
          major: studentData.major,
          year: studentData.year,
          birthDate: new Date(studentData.birth_date),
          enrollmentStatus: studentData.enrollment_status,
          password: 'defaultpassword123', // Default password for migrated students
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
        await student.save();
      }
    }
    console.log(`Migrated ${students.length} students`);

    // Migrate Advisors
    console.log('Migrating advisors...');
    const advisors = csvParser.parseCSV('advisors.csv');
    for (const advisorData of advisors) {
      const existingAdvisor = await Advisor.findOne({ advisorId: advisorData.advisor_id });
      if (!existingAdvisor) {
        const advisor = new Advisor({
          advisorId: advisorData.advisor_id,
          firstName: advisorData.first_name,
          lastName: advisorData.last_name,
          email: advisorData.email,
          phone: advisorData.phone || 'Not provided',
          department: 'General Academic Advising', // Default department
          specialization: 'General Academic Advising', // Default specialization
          password: 'defaultpassword123', // Default password for migrated advisors
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
        await advisor.save();
      }
    }
    console.log(`Migrated ${advisors.length} advisors`);

    // Migrate Courses
    console.log('Migrating courses...');
    const courses = csvParser.parseCSV('courses.csv');
    for (const courseData of courses) {
      const existingCourse = await Course.findOne({ courseId: courseData.course_id });
      if (!existingCourse) {
        const course = new Course({
          courseId: parseInt(courseData.course_id),
          courseCode: courseData.course_code,
          courseName: courseData.course_title,
          department: courseData.course_code.substring(0, 2) || 'CS', // Extract department from course code
          credits: parseInt(courseData.credits) || 3,
          description: courseData.description || '',
          prerequisites: courseData.prerequisites ? courseData.prerequisites.split(',') : [],
          instructor: courseData.instructor || 'TBA',
          semester: courseData.semester || 'Fall',
          year: parseInt(courseData.year) || new Date().getFullYear(),
          capacity: parseInt(courseData.capacity) || 30,
          enrolled: parseInt(courseData.enrolled) || 0,
          isActive: true
        });
        await course.save();
      }
    }
    console.log(`Migrated ${courses.length} courses`);

    // Migrate Enrollments
    console.log('Migrating enrollments...');
    const enrollments = csvParser.parseCSV('enrollments.csv');
    for (const enrollmentData of enrollments) {
      const student = await Student.findOne({ studentId: enrollmentData.student_id });
      const course = await Course.findOne({ courseId: enrollmentData.course_id });
      
      if (student && course) {
        const existingEnrollment = await Enrollment.findOne({ 
          student: student._id, 
          course: course._id 
        });
        
        if (!existingEnrollment) {
          const enrollment = new Enrollment({
            student: student._id,
            course: course._id,
            studentId: enrollmentData.student_id,
            courseId: enrollmentData.course_id,
            semester: enrollmentData.semester || 'Fall',
            year: parseInt(enrollmentData.year) || new Date().getFullYear(),
            enrollmentDate: new Date(enrollmentData.enrollment_date) || new Date(),
            status: enrollmentData.status || 'Enrolled',
            grade: enrollmentData.grade || null,
            credits: course.credits,
            attendance: {
              totalClasses: parseInt(enrollmentData.total_classes) || 0,
              attendedClasses: parseInt(enrollmentData.attended_classes) || 0,
              attendanceRate: parseFloat(enrollmentData.attendance_rate) || 100
            }
          });
          await enrollment.save();
        }
      }
    }
    console.log(`Migrated ${enrollments.length} enrollments`);

    // Migrate Financial Records
    console.log('Migrating financial records...');
    const financialData = csvParser.parseCSV('financial_data.csv');
    for (const financialRecordData of financialData) {
      const student = await Student.findOne({ studentId: financialRecordData.student_id });
      
      if (student) {
        const existingRecord = await FinancialRecord.findOne({ 
          student: student._id,
          semester: financialRecordData.semester,
          year: parseInt(financialRecordData.year)
        });
        
        if (!existingRecord) {
          const financialRecord = new FinancialRecord({
            student: student._id,
            studentId: financialRecordData.student_id,
            semester: financialRecordData.semester || 'Fall',
            year: parseInt(financialRecordData.year) || new Date().getFullYear(),
            tuition: parseFloat(financialRecordData.tuition) || 0,
            fees: parseFloat(financialRecordData.fees) || 0,
            scholarships: parseFloat(financialRecordData.scholarships) || 0,
            grants: parseFloat(financialRecordData.grants) || 0,
            loans: parseFloat(financialRecordData.loans) || 0,
            payments: parseFloat(financialRecordData.payments) || 0,
            dueDate: financialRecordData.due_date ? new Date(financialRecordData.due_date) : null,
            lastPaymentDate: financialRecordData.last_payment_date ? new Date(financialRecordData.last_payment_date) : null,
            financialAidStatus: financialRecordData.financial_aid_status || 'Not Applied',
            notes: financialRecordData.notes || ''
          });
          await financialRecord.save();
        }
      }
    }
    console.log(`Migrated ${financialData.length} financial records`);

    // Migrate Housing Records
    console.log('Migrating housing records...');
    const housingData = csvParser.parseCSV('housing.csv');
    for (const housingRecordData of housingData) {
      const student = await Student.findOne({ studentId: housingRecordData.student_id });
      
      if (student) {
        const existingRecord = await HousingRecord.findOne({ 
          student: student._id,
          semester: housingRecordData.semester,
          year: parseInt(housingRecordData.year)
        });
        
        if (!existingRecord) {
          const housingRecord = new HousingRecord({
            student: student._id,
            studentId: housingRecordData.student_id,
            semester: housingRecordData.semester || 'Fall',
            year: parseInt(housingRecordData.year) || new Date().getFullYear(),
            housingType: housingRecordData.housing_type || 'Commuter',
            residenceHall: housingRecordData.residence_hall || '',
            roomNumber: housingRecordData.room_number || '',
            roomType: housingRecordData.room_type || '',
            housingCost: parseFloat(housingRecordData.housing_cost) || 0,
            mealPlan: housingRecordData.meal_plan || 'None',
            mealPlanCost: parseFloat(housingRecordData.meal_plan_cost) || 0,
            housingStatus: housingRecordData.housing_status || 'Active',
            moveInDate: housingRecordData.move_in_date ? new Date(housingRecordData.move_in_date) : null,
            moveOutDate: housingRecordData.move_out_date ? new Date(housingRecordData.move_out_date) : null,
            notes: housingRecordData.notes || ''
          });
          await housingRecord.save();
        }
      }
    }
    console.log(`Migrated ${housingData.length} housing records`);

    console.log('Data migration completed successfully!');
    
    // Update student academic and financial data from related records
    console.log('Updating student data from related records...');
    await updateStudentDataFromRecords();
    
  } catch (error) {
    console.error('Migration error:', error);
    throw error;
  }
}

async function updateStudentDataFromRecords() {
  try {
    const students = await Student.find({ isActive: true });
    
    for (const student of students) {
      // Update academic data from enrollments
      const enrollments = await Enrollment.find({ student: student._id, status: 'Completed' });
      if (enrollments.length > 0) {
        const totalCredits = enrollments.reduce((sum, e) => sum + e.credits, 0);
        const totalGpaPoints = enrollments.reduce((sum, e) => sum + (e.gpaPoints || 0), 0);
        const gpa = totalCredits > 0 ? totalGpaPoints / totalCredits : 0;
        
        student.academic.gpa = Math.round(gpa * 100) / 100;
        student.academic.creditsCompleted = totalCredits;
      }
      
      // Update financial data from financial records
      const latestFinancialRecord = await FinancialRecord.findOne({ student: student._id })
        .sort({ year: -1, semester: -1 });
      
      if (latestFinancialRecord) {
        student.financial.feeBalance = latestFinancialRecord.balance;
        student.financial.scholarshipAmount = latestFinancialRecord.scholarships + latestFinancialRecord.grants;
        student.financial.paymentStatus = latestFinancialRecord.paymentStatus;
      }
      
      // Update housing data from housing records
      const latestHousingRecord = await HousingRecord.findOne({ student: student._id })
        .sort({ year: -1, semester: -1 });
      
      if (latestHousingRecord) {
        student.housing.housingStatus = latestHousingRecord.housingType;
        student.housing.residenceHall = latestHousingRecord.residenceHall;
        student.housing.roomNumber = latestHousingRecord.roomNumber;
      }
      
      // Calculate risk score
      student.calculateRiskScore();
      
      await student.save();
    }
    
    console.log(`Updated data for ${students.length} students`);
  } catch (error) {
    console.error('Error updating student data:', error);
  }
}

module.exports = { migrateData, updateStudentDataFromRecords };
