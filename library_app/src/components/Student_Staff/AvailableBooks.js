import React, { useEffect, useMemo, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

function AvailableBooks({ onBorrow, currentUser }) {
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
  const [showSummary, setShowSummary] = useState(false);
  const [summaryContent, setSummaryContent] = useState('');
  const [previewBook, setPreviewBook] = useState(null);
  const [previewPages, setPreviewPages] = useState(0);
  const [confirmBorrowPayload, setConfirmBorrowPayload] = useState(null);
  const [isSubmittingBorrow, setIsSubmittingBorrow] = useState(false);

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

  const handleBorrowSelected = () => {
    setBorrowMessage('');
    if (selected.length === 0) {
      setBorrowMessage('Select at least one book to borrow.');
      return;
    }
    openBorrowConfirmation(selected);
  };

  const openBorrowConfirmation = (bookIds) => {
    setBorrowMessage('');
    const ids = Array.isArray(bookIds) ? bookIds : [];
    if (ids.length === 0) {
      setBorrowMessage('No book selected for borrowing.');
      return;
    }

    if (ids.length > 5) {
      setBorrowMessage('You can borrow at most 5 books at a time.');
      return;
    }

    if (duration < 10 || duration > 14) {
      setBorrowMessage('Borrow duration must be between 10 and 14 days.');
      return;
    }

    const selectedBooks = books.filter((book) => ids.includes(book.id));
    const unavailable = selectedBooks.filter((book) => book.status !== 'available');
    if (unavailable.length > 0) {
      setBorrowMessage('Some selected books are unavailable. Remove them before borrowing.');
      return;
    }

    const due = new Date();
    due.setDate(due.getDate() + duration);

    setConfirmBorrowPayload({
      bookIds: ids,
      books: selectedBooks,
      duration,
      dueDate: due.toISOString().split('T')[0],
      warnings: ids.length >= 4 ? ['You are borrowing many books at once.'] : [],
    });
  };

  const confirmBorrow = async () => {
    if (!confirmBorrowPayload) return;

    setIsSubmittingBorrow(true);
    setBorrowMessage('');
    let successCount = 0;

    for (const bookId of confirmBorrowPayload.bookIds) {
      // eslint-disable-next-line no-await-in-loop
      const success = await onBorrow(bookId, confirmBorrowPayload.duration);
      if (success) successCount += 1;
    }

    const failureCount = confirmBorrowPayload.bookIds.length - successCount;
    if (failureCount === 0) {
      setBorrowMessage(
        `Borrowed ${successCount} book(s) successfully for ${confirmBorrowPayload.duration} days. Due date: ${confirmBorrowPayload.dueDate}.`
      );
    } else {
      setBorrowMessage(`Borrowed ${successCount} book(s). ${failureCount} failed (possibly unavailable now).`);
    }

    setConfirmBorrowPayload(null);
    setSelected([]);
    fetchBooks();
    setIsSubmittingBorrow(false);
  };

  const handleBorrowSingle = (bookId) => {
    openBorrowConfirmation([bookId]);
  };

  const filteredBooks = books.filter((book) => {
    if (search && !book.title.toLowerCase().includes(search.toLowerCase())) return false;
    if (author && !book.authorFullName.toLowerCase().includes(author.toLowerCase())) return false;
    if (genre && book.genre !== genre) return false;
    if (availability && book.status !== availability) return false;
    if (publishDate && book.publishDate !== publishDate) return false;
    return true;
  });

  const genres = Array.from(new Set(books.map((b) => b.genre)));
  const dates = Array.from(new Set(books.map((b) => b.publishDate)));

  const recommendedBooks = useMemo(() => {
    if (!Array.isArray(books) || books.length === 0) return [];

    const userHistoryGenreCounts = {};
    books.forEach((book) => {
      const history = Array.isArray(book.borrowHistory) ? book.borrowHistory : [];
      const userBorrowedThis = history.some((entry) => entry?.username === currentUser?.username);
      if (userBorrowedThis && book.genre) {
        userHistoryGenreCounts[book.genre] = (userHistoryGenreCounts[book.genre] || 0) + 1;
      }
    });

    return books
      .filter((book) => book.status === 'available')
      .map((book) => {
        const popularity = Number(book.borrowCount) || 0;
        const genreAffinity = userHistoryGenreCounts[book.genre] || 0;
        return {
          ...book,
          recommendationScore: popularity * 2 + genreAffinity * 3,
        };
      })
      .sort((a, b) => b.recommendationScore - a.recommendationScore)
      .slice(0, 5);
  }, [books, currentUser?.username]);

  if (loading) return <div>Loading books...</div>;
  if (error) return <div className="error">{error}</div>;

  return (
    <div className="books-list">
      <h2>Available Books</h2>

      {recommendedBooks.length > 0 && (
        <div className="recommendations-box">
          <h3>Recommended For You</h3>
          <ul>
            {recommendedBooks.map((book) => (
              <li key={book.id}>
                <strong>{book.title}</strong> by {book.authorFullName}
                <span> (Popularity: {book.borrowCount || 0})</span>
              </li>
            ))}
          </ul>
        </div>
      )}

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
            <th>Quick Review</th>
            <th>Summary</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {filteredBooks.map((book) => (
            <tr key={book.id}>
              <td data-label="Select">
                {book.status === 'available' && (
                  <input
                    type="checkbox"
                    checked={selected.includes(book.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelected([...selected, book.id]);
                      } else {
                        setSelected(selected.filter(id => id !== book.id));
                      }
                    }}
                  />
                )}
              </td>
              <td data-label="Title">
                <span className={book.status === 'available' ? 'book-title-available' : 'book-title-unavailable'}>
                  {book.title}
                </span>
              </td>
              <td data-label="Author">{book.authorFullName}</td>
              <td data-label="Publish Date">{book.publishDate}</td>
              <td data-label="Status">{book.status}</td>
              <td data-label="Quick Review">
                <button type="button" onClick={() => setPreviewBook(book)}>
                  Preview
                </button>
              </td>
              <td data-label="Summary">
                {book.summary && book.summary.length > 60 ? (
                  <button
                    type="button"
                    onClick={() => {
                      setShowSummary(true);
                      setSummaryContent(book.summary);
                    }}
                  >
                    Read Summary
                  </button>
                ) : (
                  book.summary || 'No summary available'
                )}
              </td>
              <td data-label="Action">
                {book.status === 'available' ? (
                  <button type="button" onClick={() => handleBorrowSingle(book.id)}>
                    Borrow
                  </button>
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
            <button type="button" onClick={() => setShowSummary(false)}>
              Close
            </button>
          </div>
        </div>
      )}

      {previewBook && (
        <div className="summary-modal">
          <div className="summary-content quick-preview-modal">
            <h3>Quick Review: {previewBook.title}</h3>
            <p>Previewing first {Math.min(previewPages || 3, 3)} page(s).</p>
            <div className="quick-preview-pages">
              <Document
                file={`http://localhost:4000/${previewBook.filePath}`}
                onLoadSuccess={({ numPages }) => setPreviewPages(numPages)}
                onLoadError={() => setBorrowMessage('Failed to load preview PDF.')}
                loading="Loading preview..."
              >
                {Array.from({ length: Math.min(previewPages || 3, 3) }).map((_, index) => (
                  <Page key={`preview-${index + 1}`} pageNumber={index + 1} width={620} />
                ))}
              </Document>
            </div>
            <button type="button" onClick={() => setPreviewBook(null)}>
              Close Preview
            </button>
          </div>
        </div>
      )}

      {confirmBorrowPayload && (
        <div className="summary-modal">
          <div className="summary-content borrow-confirm-modal">
            <h3>Confirm Borrow</h3>
            <p>Selected book(s):</p>
            <ul>
              {confirmBorrowPayload.books.map((book) => (
                <li key={`confirm-${book.id}`}>
                  {book.title} by {book.authorFullName}
                </li>
              ))}
            </ul>
            <p>Borrow duration: {confirmBorrowPayload.duration} day(s)</p>
            <p>Due date: {confirmBorrowPayload.dueDate}</p>
            {confirmBorrowPayload.warnings.length > 0 && (
              <div className="warning-box">
                {confirmBorrowPayload.warnings.map((warning) => (
                  <p key={warning}>{warning}</p>
                ))}
              </div>
            )}

            <div className="dialog-buttons">
              <button type="button" onClick={() => setConfirmBorrowPayload(null)} disabled={isSubmittingBorrow}>
                Cancel
              </button>
              <button type="button" onClick={confirmBorrow} disabled={isSubmittingBorrow}>
                {isSubmittingBorrow ? 'Borrowing...' : 'Confirm Borrow'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AvailableBooks;
