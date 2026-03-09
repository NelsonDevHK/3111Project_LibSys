// src/models/Staff.js
// Staff class extends User for Task 1.1 registration
import User from './User';

class Staff extends User {
  constructor(username, fullName, password) {
    super(username, fullName, password, 'staff');
    // Add staff-specific properties if needed
  }
}

export default Staff;
