const csvParser = require('./csvParser');
const Student = require('../models/Student');
const Advisor = require('../models/Advisor');

async function simpleMigration() {
  try {
    console.log('Starting simple data migration...');

    // Migrate Students
    console.log('Migrating students...');
    const students = csvParser.parseCSV('students.csv');
    let studentCount = 0;
    
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
            gpa: Math.random() * 2 + 2, // Random GPA between 2.0 and 4.0
            creditsCompleted: Math.floor(Math.random() * 60) + 30, // Random credits 30-90
            attendanceAbsences: Math.floor(Math.random() * 10) // Random absences 0-10
          },
          financial: {
            feeBalance: Math.random() * 5000, // Random balance 0-5000
            scholarshipAmount: Math.random() * 2000, // Random scholarship 0-2000
            paymentStatus: Math.random() > 0.7 ? 'Overdue' : 'Current'
          },
          housing: {
            housingStatus: Math.random() > 0.5 ? 'On-Campus' : 'Commuter'
          }
        });
        await student.save();
        studentCount++;
      }
    }
    console.log(`Migrated ${studentCount} students`);

    // Migrate Advisors
    console.log('Migrating advisors...');
    const advisors = csvParser.parseCSV('advisors.csv');
    let advisorCount = 0;
    
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
            totalMeetings: Math.floor(Math.random() * 100),
            studentsRetained: Math.floor(Math.random() * 50),
            averageStudentGPA: Math.random() * 2 + 2
          }
        });
        await advisor.save();
        advisorCount++;
      }
    }
    console.log(`Migrated ${advisorCount} advisors`);

    console.log('Simple data migration completed successfully!');
    
  } catch (error) {
    console.error('Migration error:', error);
    throw error;
  }
}

module.exports = { simpleMigration };
