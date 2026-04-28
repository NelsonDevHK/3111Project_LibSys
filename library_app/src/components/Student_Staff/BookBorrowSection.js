import React, { useState } from 'react';
import AvailableBooks from './AvailableBooks';
import BorrowedBooksScreen from './BorrowedBooksScreen';
import ReadingHistoryScreen from './ReadingHistoryScreen';

function BookBorrowSection({ currentUser }) {
  const [borrowMessage, setBorrowMessage] = useState('');
  const [activeView, setActiveView] = useState('available');

  const handleBorrow = async (bookId, durationDays) => {
    setBorrowMessage('');
    try {
      const res = await fetch('http://localhost:4000/api/borrow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookId,
          username: currentUser?.username,
          durationDays,
        })
      });
      const data = await res.json();
      if (res.ok) {
        const dueText = data?.book?.dueDate ? ` Due date: ${data.book.dueDate}.` : '';
        setBorrowMessage(`Book borrowed successfully!${dueText}`);
        return true;
      } else {
        setBorrowMessage(data.error || 'Failed to borrow book.');
        return false;
      }
    } catch {
      setBorrowMessage('Server error.');
      return false;
    }
  };

  return (
    <>
      <div className="borrowed-toggle-row">
        <button
          type="button"
          className={activeView === 'available' ? 'active' : ''}
          onClick={() => setActiveView('available')}
        >
          Available Books
        </button>
        <button
          type="button"
          className={activeView === 'borrowed' ? 'active' : ''}
          onClick={() => setActiveView('borrowed')}
        >
          My Borrowed Books
        </button>
        <button
          type="button"
          className={activeView === 'history' ? 'active' : ''}
          onClick={() => setActiveView('history')}
        >
          Reading History
        </button>
      </div>

      {activeView === 'available' ? (
        <AvailableBooks onBorrow={handleBorrow} currentUser={currentUser} />
      ) : activeView === 'borrowed' ? (
        <BorrowedBooksScreen currentUser={currentUser} />
      ) : (
        <ReadingHistoryScreen currentUser={currentUser} />
      )}

      {borrowMessage && <div className="success">{borrowMessage}</div>}
    </>
  );
}

export default BookBorrowSection;
