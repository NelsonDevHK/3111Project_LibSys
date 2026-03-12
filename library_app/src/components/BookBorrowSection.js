import React, { useState } from 'react';
import AvailableBooks from './AvailableBooks';

function BookBorrowSection({ currentUser }) {
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
    <>
      <AvailableBooks onBorrow={handleBorrow} />
      {borrowMessage && <div className="success">{borrowMessage}</div>}
    </>
  );
}

export default BookBorrowSection;
