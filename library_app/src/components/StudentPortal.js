import React, { useState } from 'react';
import AvailableBooks from './AvailableBooks';

function StudentPortal() {
  const [borrowMessage, setBorrowMessage] = useState('');

  const handleBorrow = async (bookId) => {
    setBorrowMessage('');
    try {
      const res = await fetch('http://localhost:4000/api/borrow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookId })
      });
      const data = await res.json();
      if (res.ok) {
        setBorrowMessage('Book borrowed successfully!');
      } else {
        setBorrowMessage(data.error || 'Failed to borrow book.');
      }
    } catch {
      setBorrowMessage('Server error.');
    }
  };

  return (
    <div className="portal">
      <h2>Student Portal</h2>
      <p>Welcome, Student! This is your dashboard.</p>
      <AvailableBooks onBorrow={handleBorrow} />
      {borrowMessage && <div className="success">{borrowMessage}</div>}
    </div>
  );
}

export default StudentPortal;
