import React from 'react';
import BookBorrowSection from './BookBorrowSection';

function StaffPortal({ currentUser }) {
  return (
    <div className="portal">
      <h2>Staff Portal</h2>
      <p>Welcome, {currentUser ? currentUser.username : 'Staff'}! This is your dashboard.</p>
      <BookBorrowSection currentUser={currentUser} />
    </div>
  );
}

export default StaffPortal;
