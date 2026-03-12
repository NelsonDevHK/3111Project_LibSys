import React from 'react';
import BookBorrowSection from './BookBorrowSection';

function StudentPortal({ currentUser }) {
  return (
    <div className="portal">
      <h2>Student Portal</h2>
      <p>Welcome, {currentUser ? currentUser.username : 'Student'}! This is your dashboard.</p>
      <BookBorrowSection currentUser={currentUser} />
    </div>
  );
}

export default StudentPortal;
