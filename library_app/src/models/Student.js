// src/models/Student.js
// Student class extends User for Task 1.1 registration
import User from './User';

class Student extends User {
  constructor(username, fullName, password) {
    super(username, fullName, password, 'student');
    // Add student-specific properties if needed
  }
}

export default Student;
