import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import ReviewsDisplay from './ReviewsDisplay';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

function BorrowedBooksScreen({ currentUser }) {
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeBookId, setActiveBookId] = useState(null);
  const [bookmarkPageInput, setBookmarkPageInput] = useState('1');
  const [currentPage, setCurrentPage] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [highlightColor, setHighlightColor] = useState('#fff59d');
  const [highlights, setHighlights] = useState([]);
  const [selectedText, setSelectedText] = useState('');
  const [selectedRects, setSelectedRects] = useState([]);
  const [feedback, setFeedback] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showReviewsBook, setShowReviewsBook] = useState(null);
  const pageLayerRef = useRef(null);

  const fetchBorrowedBooks = useCallback(async () => {
    if (!currentUser?.username) {
      setBooks([]);
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`http://localhost:4000/api/borrowed/${encodeURIComponent(currentUser.username)}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch borrowed books.');
      }

      const nextBooks = Array.isArray(data.books) ? data.books : [];
      setBooks(nextBooks);
      setError('');

      if (activeBookId && !nextBooks.some((book) => String(book.id) === String(activeBookId))) {
        setActiveBookId(null);
        setHighlights([]);
        setFeedback('Reading screen closed because borrowing period expired or the book was returned.');
      }
    } catch (fetchError) {
      setError(fetchError.message || 'Failed to fetch borrowed books.');
    } finally {
      setLoading(false);
    }
  }, [activeBookId, currentUser?.username]);

  useEffect(() => {
    fetchBorrowedBooks();
    const poll = setInterval(fetchBorrowedBooks, 15000);
    return () => clearInterval(poll);
  }, [fetchBorrowedBooks]);

  const activeBook = useMemo(
    () => books.find((book) => String(book.id) === String(activeBookId)) || null,
    [books, activeBookId]
  );

  const loadReadingProgress = useCallback(
    async (bookId) => {
      if (!currentUser?.username || !bookId) return;

      try {
        const res = await fetch(
          `http://localhost:4000/api/reading-progress/${encodeURIComponent(currentUser.username)}/${encodeURIComponent(bookId)}`
        );
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Failed to fetch reading progress.');
        }

        const progress = data.readingProgress || {};
        const page = progress.bookmarkPage || 1;
        setBookmarkPageInput(String(page));
        setCurrentPage(page);
        setHighlights(Array.isArray(progress.highlights) ? progress.highlights : []);
      } catch (progressError) {
        setFeedback(progressError.message || 'Failed to load reading progress.');
      }
    },
    [currentUser?.username]
  );

  useEffect(() => {
    if (!activeBook?.dueAt) return undefined;

    const msUntilDue = new Date(activeBook.dueAt).getTime() - Date.now();
    if (!Number.isFinite(msUntilDue)) return undefined;

    if (msUntilDue <= 0) {
      setActiveBookId(null);
      setFeedback('Borrowing period expired. Closing reader now.');
      fetchBorrowedBooks();
      return undefined;
    }

    const timer = setTimeout(() => {
      setActiveBookId(null);
      setFeedback('Borrowing period expired. Closing reader now.');
      fetchBorrowedBooks();
    }, msUntilDue + 500);

    return () => clearTimeout(timer);
  }, [activeBook?.dueAt, fetchBorrowedBooks]);

  const openReader = async (bookId) => {
    setActiveBookId(bookId);
    setFeedback('');
    setSelectedText('');
    setSelectedRects([]);
    await loadReadingProgress(bookId);
  };

  const saveBookmark = async () => {
    if (!activeBook || !currentUser?.username) return;

    const page = Number(bookmarkPageInput);
    if (!Number.isFinite(page) || page < 1) {
      setFeedback('Bookmark page must be a positive number.');
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch('http://localhost:4000/api/reading-progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: currentUser.username,
          bookId: activeBook.id,
          bookmarkPage: page,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save bookmark.');
      }

      setCurrentPage(page);
      setFeedback('Bookmark saved.');
    } catch (saveError) {
      setFeedback(saveError.message || 'Failed to save bookmark.');
    } finally {
      setIsSaving(false);
    }
  };

  const addHighlight = async () => {
    if (!activeBook || !currentUser?.username) return;

    if (!selectedText.trim() || selectedRects.length === 0) {
      setFeedback('Please select text in the PDF first.');
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch('http://localhost:4000/api/highlights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: currentUser.username,
          bookId: activeBook.id,
          text: selectedText.trim(),
          page: currentPage,
          color: highlightColor,
          rects: selectedRects,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save highlight.');
      }

      setSelectedText('');
      setSelectedRects([]);
      window.getSelection()?.removeAllRanges();
      setHighlights((prev) => [data.highlight, ...prev]);
      setFeedback('Highlight saved.');
    } catch (highlightError) {
      setFeedback(highlightError.message || 'Failed to save highlight.');
    } finally {
      setIsSaving(false);
    }
  };

  const removeHighlight = async (highlightId) => {
    if (!activeBook || !currentUser?.username || !highlightId) return;

    try {
      const res = await fetch(
        `http://localhost:4000/api/highlights/${encodeURIComponent(currentUser.username)}/${encodeURIComponent(activeBook.id)}/${encodeURIComponent(highlightId)}`,
        { method: 'DELETE' }
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete highlight.');
      }

      setHighlights((prev) => prev.filter((item) => item.id !== highlightId));
      setFeedback('Highlight deleted.');
    } catch (deleteError) {
      setFeedback(deleteError.message || 'Failed to delete highlight.');
    }
  };

  const returnBook = async (bookId) => {
    if (!currentUser?.username) return;

    try {
      const res = await fetch('http://localhost:4000/api/return', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookId, username: currentUser.username }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to return book.');
      }

      if (String(activeBookId) === String(bookId)) {
        setActiveBookId(null);
        setHighlights([]);
        setSelectedText('');
        setSelectedRects([]);
      }

      setFeedback('Book returned successfully.');
      fetchBorrowedBooks();
    } catch (returnError) {
      setFeedback(returnError.message || 'Failed to return book.');
    }
  };

  if (loading) return <div>Loading borrowed books...</div>;

  const pageHighlights = highlights.filter((item) => Number(item.page) === Number(currentPage));

  const handleMouseUpSelection = () => {
    if (!activeBook || !pageLayerRef.current) return;

    const selection = window.getSelection();
    const text = selection?.toString?.().trim() || '';
    if (!selection || !text) {
      setSelectedText('');
      setSelectedRects([]);
      return;
    }

    const range = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
    if (!range) return;

    const common = range.commonAncestorContainer;
    const pageNode = pageLayerRef.current;
    if (!pageNode.contains(common.nodeType === 1 ? common : common.parentNode)) {
      setSelectedText('');
      setSelectedRects([]);
      return;
    }

    const layerRect = pageNode.getBoundingClientRect();
    const rawRects = Array.from(range.getClientRects());
    const normalizedRects = rawRects
      .map((rect) => ({
        leftPct: ((rect.left - layerRect.left) / layerRect.width) * 100,
        topPct: ((rect.top - layerRect.top) / layerRect.height) * 100,
        widthPct: (rect.width / layerRect.width) * 100,
        heightPct: (rect.height / layerRect.height) * 100,
      }))
      .filter((rect) => rect.widthPct > 0 && rect.heightPct > 0);

    if (normalizedRects.length === 0) {
      setSelectedText('');
      setSelectedRects([]);
      return;
    }

    setSelectedText(text);
    setSelectedRects(normalizedRects);
  };

  return (
    <div className="borrowed-books-screen">
      <h2>My Borrowed Books</h2>

      {error && <p className="error">{error}</p>}
      {feedback && <p className="info">{feedback}</p>}

      {books.length === 0 ? (
        <p>No borrowed books right now.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Title</th>
              <th>Author</th>
              <th>Borrowed At</th>
              <th>Due Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {books.map((book) => (
              <tr key={book.id}>
                <td>{book.title}</td>
                <td>{book.authorFullName}</td>
                <td>{book.borrowedAt ? new Date(book.borrowedAt).toLocaleString() : '-'}</td>
                <td>{book.dueDate || '-'}</td>
                <td>
                  <button type="button" onClick={() => openReader(book.id)}>
                    Read PDF
                  </button>
                  <button type="button" onClick={() => returnBook(book.id)}>
                    Return
                  </button>
                    <button type="button" onClick={() => setShowReviewsBook(book)}>
                      Review
                    </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {activeBook && (
        <div className="reader-panel">
          <h3>
            Reading: {activeBook.title}
            {activeBook.dueAt && (
              <span className="reader-due-at"> (Due: {new Date(activeBook.dueAt).toLocaleString()})</span>
            )}
          </h3>

          <div className="reader-controls">
            <button
              type="button"
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={currentPage <= 1}
            >
              Prev Page
            </button>
            <span>
              Page {currentPage} / {numPages || '-'}
            </span>
            <button
              type="button"
              onClick={() => setCurrentPage((prev) => Math.min(numPages || prev + 1, prev + 1))}
              disabled={numPages > 0 ? currentPage >= numPages : false}
            >
              Next Page
            </button>
            <input
              type="number"
              min={1}
              value={bookmarkPageInput}
              onChange={(event) => setBookmarkPageInput(event.target.value)}
              placeholder="Page number"
            />
            <button type="button" onClick={saveBookmark} disabled={isSaving}>
              Save Bookmark
            </button>
            <button type="button" onClick={() => setActiveBookId(null)}>
              Close Reader
            </button>
          </div>

          <div className="pdf-reader" onMouseUp={handleMouseUpSelection}>
            <Document
              file={`http://localhost:4000/${activeBook.filePath}`}
              onLoadSuccess={({ numPages: totalPages }) => setNumPages(totalPages)}
              onLoadError={() => setFeedback('Failed to load PDF document.')}
              loading="Loading PDF..."
            >
              <div className="pdf-page-layer" ref={pageLayerRef}>
                <Page pageNumber={currentPage} width={760} renderTextLayer renderAnnotationLayer />

                {pageHighlights.map((item) =>
                  Array.isArray(item.rects)
                    ? item.rects.map((rect, index) => (
                        <span
                          key={`${item.id}-${index}`}
                          className="pdf-highlight-overlay"
                          style={{
                            left: `${rect.leftPct}%`,
                            top: `${rect.topPct}%`,
                            width: `${rect.widthPct}%`,
                            height: `${rect.heightPct}%`,
                            backgroundColor: item.color || '#fff59d',
                          }}
                        />
                      ))
                    : null
                )}

                {selectedRects.map((rect, index) => (
                  <span
                    key={`selection-${index}`}
                    className="pdf-highlight-overlay selection-preview"
                    style={{
                      left: `${rect.leftPct}%`,
                      top: `${rect.topPct}%`,
                      width: `${rect.widthPct}%`,
                      height: `${rect.heightPct}%`,
                      backgroundColor: highlightColor,
                    }}
                  />
                ))}
              </div>
            </Document>
          </div>

          <div className="highlight-form">
            <h4>Text Highlights</h4>
            <p>Select text with your cursor in the PDF, choose color, then save.</p>
            <div className="highlight-controls">
              <input
                type="color"
                value={highlightColor}
                onChange={(event) => setHighlightColor(event.target.value)}
              />
              <button type="button" onClick={addHighlight} disabled={isSaving}>
                Save Highlight
              </button>
            </div>
            <p className="selected-text-preview">Selected text: {selectedText || 'None'}</p>

            <div className="highlights-list">
              {highlights.length === 0 ? (
                <p>No highlights saved yet.</p>
              ) : (
                highlights.map((item) => (
                  <div key={item.id} className="highlight-item" style={{ borderLeftColor: item.color || '#fff59d' }}>
                    <p>{item.text}</p>
                    <small>
                      Page: {item.page || '-'} | {item.timestamp ? new Date(item.timestamp).toLocaleString() : ''}
                    </small>
                    <button type="button" onClick={() => removeHighlight(item.id)}>
                      Delete
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {showReviewsBook && (
        <div className="summary-modal">
          <div className="summary-content reviews-modal-content">
            <button
              type="button"
              className="modal-close-button"
              onClick={() => setShowReviewsBook(null)}
            >
              Close
            </button>
            <ReviewsDisplay
              book={showReviewsBook}
              username={currentUser.username}
              userRole={currentUser.role}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default BorrowedBooksScreen;
