const Advisor = require('../models/Advisor');
const Student = require('../models/Student');

/**
 * Auto-assign advisor to student based on first name initial
 * Divides 26 letters evenly among available advisors
 * Example with 4 advisors: A-G, H-M, N-S, T-Z
 */
async function assignAdvisorToStudent(studentId) {
  try {
    const student = await Student.findOne({ studentId: parseInt(studentId) });
    if (!student) {
      throw new Error('Student not found');
    }

    // If student already has an assigned advisor, return it
    if (student.assignedAdvisor) {
      const advisor = await Advisor.findById(student.assignedAdvisor);
      if (advisor) {
        return advisor;
      }
    }

    // Get all active advisors
    const advisors = await Advisor.find({ isActive: true }).sort({ advisorId: 1 });
    
    if (advisors.length === 0) {
      throw new Error('No active advisors available');
    }

    // Get student's first name initial
    const firstName = (student.firstName || '').trim().toUpperCase();
    if (!firstName || firstName.length === 0) {
      throw new Error('Student first name is required for auto-assignment');
    }

    const firstLetter = firstName[0];
    const letterIndex = firstLetter.charCodeAt(0) - 65; // A=0, B=1, ..., Z=25

    if (letterIndex < 0 || letterIndex > 25) {
      // If not A-Z, assign to first advisor
      const advisor = advisors[0];
      await updateStudentAdvisorAssignment(student, advisor);
      return advisor;
    }

    // Calculate which advisor should handle this letter
    // Divide 26 letters evenly among advisors
    const lettersPerAdvisor = 26 / advisors.length;
    const advisorIndex = Math.floor(letterIndex / lettersPerAdvisor);
    const selectedAdvisor = advisors[Math.min(advisorIndex, advisors.length - 1)];

    // Update student's assigned advisor
    await updateStudentAdvisorAssignment(student, selectedAdvisor);

    return selectedAdvisor;
  } catch (error) {
    console.error('Error assigning advisor:', error);
    throw error;
  }
}

/**
 * Update student's advisor assignment and advisor's assigned students list
 */
async function updateStudentAdvisorAssignment(student, advisor) {
  // Update student
  student.assignedAdvisor = advisor._id;
  await student.save();

  // Update advisor's assigned students list if not already included
  if (!advisor.assignedStudents.includes(student._id)) {
    advisor.assignedStudents.push(student._id);
    advisor.currentStudents = advisor.assignedStudents.length;
    await advisor.save();
  }
}

/**
 * Get advisor for a student (assign if not already assigned)
 */
async function getStudentAdvisor(studentId) {
  try {
    const student = await Student.findOne({ studentId: parseInt(studentId) });
    if (!student) {
      return null;
    }

    // Check if student has assigned advisor
    if (student.assignedAdvisor) {
      const advisor = await Advisor.findById(student.assignedAdvisor);
      if (advisor && advisor.isActive) {
        return advisor;
      }
      // If advisor is inactive or not found, clear assignment and reassign
      student.assignedAdvisor = undefined;
      await student.save();
    }

    // Auto-assign if not assigned
    return await assignAdvisorToStudent(studentId);
  } catch (error) {
    console.error('Error getting student advisor:', error);
    return null;
  }
}

/**
 * Get letter range for each advisor (for display purposes)
 */
function getAdvisorLetterRanges(advisorCount) {
  if (advisorCount === 0) return [];
  
  const lettersPerAdvisor = 26 / advisorCount;
  const ranges = [];
  
  for (let i = 0; i < advisorCount; i++) {
    const startIndex = Math.floor(i * lettersPerAdvisor);
    const endIndex = Math.floor((i + 1) * lettersPerAdvisor) - 1;
    const startLetter = String.fromCharCode(65 + startIndex); // A=65
    const endLetter = String.fromCharCode(65 + Math.min(endIndex, 25)); // Z=90
    ranges.push(`${startLetter}-${endLetter}`);
  }
  
  return ranges;
}

module.exports = {
  assignAdvisorToStudent,
  getStudentAdvisor,
  getAdvisorLetterRanges,
  updateStudentAdvisorAssignment
};

