import React, { useEffect, useState } from 'react';

function RejectedBooksSection({ currentUser }) {
  const [rejectedBooks, setRejectedBooks] = useState([]);
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [messageType, setMessageType] = useState('');

  const fetchRejectedBooks = async () => {
    if (!currentUser?.username) return;

    try {
      const res = await fetch(`http://localhost:4000/api/rejectionReason/${encodeURIComponent(currentUser.username)}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch rejected books.');
      }

      setRejectedBooks(data.rejectionReasons || []);
      setFeedbackMessage('');
      setMessageType('');
    } catch (error) {
      setRejectedBooks([]);
      setFeedbackMessage(error.message || 'Failed to fetch rejected books.');
      setMessageType('error');
    }
  };

  useEffect(() => {
    fetchRejectedBooks();
  }, [currentUser?.username]);

  const handleConfirmRemoval = async (reasonId) => {
    const confirmed = window.confirm('Remove this rejected book notice?');
    if (!confirmed) return;

    try {
      const res = await fetch(
        `http://localhost:4000/api/rejectionReason/${encodeURIComponent(currentUser.username)}/${encodeURIComponent(reasonId)}`,
        { method: 'DELETE' }
      );
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to remove rejection reason.');
      }

      setRejectedBooks((currentBooks) => currentBooks.filter((book) => book.id !== reasonId));
      setFeedbackMessage('Rejected book notice removed.');
      setMessageType('success');
    } catch (error) {
      setFeedbackMessage(error.message || 'Failed to remove rejection reason.');
      setMessageType('error');
    }
  };

  if (rejectedBooks.length === 0 && !feedbackMessage) {
    return null;
  }

  return (
    <section className="rejected-books-section">
      <h3>Rejected Books</h3>
      {rejectedBooks.length === 0 ? (
        <p>No rejected books to review.</p>
      ) : (
        <div className="rejected-books-list">
          {rejectedBooks.map((book) => (
            <div key={book.id} className="rejected-book-card">
              <div className="rejected-book-copy">
                <p className="rejected-book-title">{book.bookTitle || 'Untitled Book'}</p>
                <p className="rejected-book-reason">Reason: {book.rejectionReason}</p>
              </div>
              <button
                type="button"
                className="change-file-button"
                onClick={() => handleConfirmRemoval(book.id)}
              >
                Confirm and Remove
              </button>
            </div>
          ))}
        </div>
      )}
      {feedbackMessage && <p className={messageType === 'success' ? 'success' : 'error'}>{feedbackMessage}</p>}
    </section>
  );
}

export default RejectedBooksSection;