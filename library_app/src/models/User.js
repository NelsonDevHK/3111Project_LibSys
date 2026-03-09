// src/models/User.js
// Base User class for all user types (Student, Staff, Author, Librarian)

class User {
  constructor(username, fullName, password, role) {
    this.username = username;
    this.fullName = fullName;
    this.password = password; // In production, hash this!
    this.role = role; // 'student', 'staff', 'author', 'librarian'
  }

  // Validate password strength (min 8 chars, at least 1 number, 1 letter)
  static validatePassword(password) {
    const minLength = 8;
    const hasLetter = /[a-zA-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    return password.length >= minLength && hasLetter && hasNumber;
  }

  // Validate username is not empty
  static validateUsername(username) {
    return typeof username === 'string' && username.trim().length > 0;
  }
}

export default User;
