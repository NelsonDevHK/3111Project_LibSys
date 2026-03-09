import React, { useEffect, useState } from 'react';

function AvailableBooks({ onBorrow }) {
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchBooks = () => {
    fetch('http://localhost:4000/api/books')
      .then(res => res.json())
      .then(data => {
        setBooks(data.books);
        setLoading(false);
      })
      .catch(() => {
        setError('Failed to load books.');
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchBooks();
  }, []);

  const handleBorrow = async (bookId) => {
    await onBorrow(bookId);
    fetchBooks(); // Refresh books after borrowing
  };

  if (loading) return <div>Loading books...</div>;
  if (error) return <div className="error">{error}</div>;

  return (
    <div className="books-list">
      <h2>Available Books</h2>
      <table>
        <thead>
          <tr>
            <th>Title</th>
            <th>Author</th>
            <th>Publish Date</th>
            <th>Status</th>
            <th>Summary</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {books.map(book => (
            <tr key={book.id}>
              <td>{book.title}</td>
              <td>{book.authorFullName}</td>
              <td>{book.publishDate}</td>
              <td>{book.status}</td>
              <td>{book.summary}</td>
              <td>
                {book.status === 'available' ? (
                  <button onClick={() => handleBorrow(book.id)}>Borrow</button>
                ) : (
                  <span>Borrowed</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default AvailableBooks;
