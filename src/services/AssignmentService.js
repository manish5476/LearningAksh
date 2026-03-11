'use strict';
const AppError = require('../utils/appError');
const AssignmentRepository = require('../repositories/AssignmentRepository');
const AssignmentSubmissionRepository = require('../repositories/AssignmentSubmissionRepository');
const CourseRepository = require('../repositories/CourseRepository');
const LessonProgressRepository = require('../repositories/LessonProgressRepository');
const EventDispatcher = require('../events/EventDispatcher');

class AssignmentService {

  // ==========================
  // STUDENT ACTIONS
  // ==========================
  async submitAssignment(studentId, assignmentId, content, file) {
    const assignment = await AssignmentRepository.findById(assignmentId);
    if (!assignment) throw new AppError('Assignment not found', 404);

    // Prevent resubmitting graded work
    const existingSubmission = await AssignmentSubmissionRepository.findOne({ 
      assignment: assignmentId, 
      student: studentId 
    });

    if (existingSubmission && existingSubmission.status === 'graded') {
      throw new AppError('Cannot resubmit a graded assignment', 400);
    }

    // Check if late (assuming assignment has a dueDate)
    const isLate = assignment.dueDate ? Date.now() > new Date(assignment.dueDate).getTime() : false;

    const submissionData = {
      assignment: assignmentId,
      student: studentId,
      content: content,
      // Map the uploaded file to an array as per our schema
      attachments: file ? [`/uploads/assignments/${file.filename}`] : [],
      submittedAt: Date.now(),
      status: isLate ? 'late-submitted' : 'submitted',
      isLate
    };

    // Upsert the submission
    const submission = await AssignmentSubmissionRepository.model.findOneAndUpdate(
      { assignment: assignmentId, student: studentId },
      submissionData,
      { upsert: true, new: true, runValidators: true }
    );

    return submission;
  }

  // ==========================
  // INSTRUCTOR ACTIONS
  // ==========================
  async gradeSubmission(instructorId, submissionId, gradeData) {
    // 1. Fetch submission with its parent assignment
    const submission = await AssignmentSubmissionRepository.findById(submissionId, ['assignment']);
    if (!submission || !submission.assignment) {
      throw new AppError('Submission or parent assignment not found', 404);
    }

    // 2. SECURITY CHECK: Verify the instructor actually owns this course!
    const course = await CourseRepository.findById(submission.assignment.course);
    if (!course || course.instructor.toString() !== instructorId.toString()) {
      throw new AppError('You are not authorized to grade this submission', 403);
    }

    // 3. Calculate pass/fail based on points
    const points = gradeData.points || 0;
    const percentage = (points / submission.assignment.totalPoints) * 100;
    const isPassed = points >= submission.assignment.passingPoints;

    // 4. Update the submission
    const updatedSubmission = await AssignmentSubmissionRepository.updateById(submissionId, {
      status: 'graded',
      grade: {
        points,
        percentage,
        feedback: gradeData.feedback,
        gradedBy: instructorId,
        gradedAt: Date.now()
      }
    });

    // 5. Update Course Progress using our optimized flat schema
    if (isPassed && submission.assignment.lesson) {
      await LessonProgressRepository.model.findOneAndUpdate(
        { 
          student: submission.student, 
          course: submission.assignment.course, 
          lesson: submission.assignment.lesson 
        },
        { isCompleted: true },
        { upsert: true }
      );

      // Tell the rest of the app that progress happened (triggers certificate checks, etc.)
      EventDispatcher.emit('progress.updated', { 
        studentId: submission.student, 
        courseId: submission.assignment.course 
      });
    }

    return updatedSubmission;
  }
}

module.exports = new AssignmentService();