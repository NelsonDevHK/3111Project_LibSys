// src/models/Librarian.js
// Librarian class extends User, includes employeeId
import User from './User';

class Librarian extends User {
  constructor(username, fullName, password, employeeId) {
    super(username, fullName, password, 'librarian'); // Call parent User constructor with role 'librarian'
    this.employeeId = employeeId;
  }
}

export default Librarian;
