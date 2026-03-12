import React, { useEffect, useState } from 'react';

function AvailableBooks({ onBorrow }) {
  // All hooks and state must be inside the function!
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [author, setAuthor] = useState('');
  const [genre, setGenre] = useState('');
  const [availability, setAvailability] = useState('');
  const [publishDate, setPublishDate] = useState('');
  const [selected, setSelected] = useState([]);
  const [borrowMessage, setBorrowMessage] = useState('');
  const [duration, setDuration] = useState(10);
  // Summary modal
  const [showSummary, setShowSummary] = useState(false);
  const [summaryContent, setSummaryContent] = useState('');

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

  // Multi-borrow
  const handleBorrowSelected = async () => {
    setBorrowMessage('');
    if (selected.length === 0) {
      setBorrowMessage('Select at least one book to borrow.');
      return;
    }
    if (selected.length > 5) {
      setBorrowMessage('You can borrow at most 5 books at a time.');
      return;
    }
    if (duration < 10 || duration > 14) {
      setBorrowMessage('Borrow duration must be between 10 and 14 days.');
      return;
    }
    let successCount = 0;
    for (const bookId of selected) {
      await onBorrow(bookId);
      successCount++;
    }
    fetchBooks();
    setBorrowMessage(`Borrowed ${successCount} book(s) successfully for ${duration} days.`);
    setSelected([]);
  };

  // Single borrow (for legacy button)
  const handleBorrow = async (bookId) => {
    setBorrowMessage('');
    if (duration < 10 || duration > 14) {
      setBorrowMessage('Borrow duration must be between 10 and 14 days.');
      return;
    }
    await onBorrow(bookId);
    fetchBooks();
  };

  // Filtering
  const filteredBooks = books.filter(book => {
    if (search && !book.title.toLowerCase().includes(search.toLowerCase())) return false;
    if (author && !book.authorFullName.toLowerCase().includes(author.toLowerCase())) return false;
    if (genre && book.genre !== genre) return false;
    if (availability && book.status !== availability) return false;
    if (publishDate && book.publishDate !== publishDate) return false;
    return true;
  });

  // Unique genres and publish dates for filter dropdowns
  const genres = Array.from(new Set(books.map(b => b.genre)));
  const dates = Array.from(new Set(books.map(b => b.publishDate)));

  if (loading) return <div>Loading books...</div>;
  if (error) return <div className="error">{error}</div>;

  return (
    <div className="books-list">
      <h2>Available Books</h2>
      {/* Search and filter controls */}
      <div className="book-filters">
        <input
          type="text"
          placeholder="Search by title"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <input
          type="text"
          placeholder="Search by author"
          value={author}
          onChange={e => setAuthor(e.target.value)}
        />
        <select value={genre} onChange={e => setGenre(e.target.value)}>
          <option value="">All Genres</option>
          {genres.map(g => <option key={g} value={g}>{g}</option>)}
        </select>
        <select value={availability} onChange={e => setAvailability(e.target.value)}>
          <option value="">All Status</option>
          <option value="available">Available</option>
          <option value="borrowed">Borrowed</option>
        </select>
        <select value={publishDate} onChange={e => setPublishDate(e.target.value)}>
          <option value="">All Dates</option>
          {dates.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>

      {/* Borrow controls */}
      <div className="borrow-controls">
        <label>Borrow Duration (days):</label>
        <input
          type="number"
          min={10}
          max={14}
          value={duration}
          onChange={e => setDuration(Number(e.target.value))}
        />
        <button onClick={handleBorrowSelected}>Borrow Selected</button>
      </div>
      {borrowMessage && <div className="error">{borrowMessage}</div>}

      {/* Book table */}
      <table>
        <thead>
          <tr>
            <th></th>
            <th>Title</th>
            <th>Author</th>
            <th>Publish Date</th>
            <th>Status</th>
            <th>Summary</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {filteredBooks.map(book => (
            <tr key={book.id}>
              <td data-label="Select">
                {book.status === 'available' && (
                  <input
                    type="checkbox"
                    checked={selected.includes(book.id)}
                    onChange={e => {
                      if (e.target.checked) {
                        setSelected([...selected, book.id]);
                      } else {
                        setSelected(selected.filter(id => id !== book.id));
                      }
                    }}
                  />
                )}
              </td>
              <td data-label="Title">{book.title}</td>
              <td data-label="Author">{book.authorFullName}</td>
              <td data-label="Publish Date">{book.publishDate}</td>
              <td data-label="Status">{book.status}</td>
              <td data-label="Summary">
                {book.summary && book.summary.length > 60 ? (
                  <button onClick={() => { setShowSummary(true); setSummaryContent(book.summary); }}>Read Summary</button>
                ) : (
                  book.summary || 'No summary available'
                )}
              </td>
              <td data-label="Action">
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

      {/* Summary modal */}
      {showSummary && (
        <div className="summary-modal">
          <div className="summary-content">
            <h3>Book Summary</h3>
            <p>{summaryContent}</p>
            <button onClick={() => setShowSummary(false)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default AvailableBooks;
