import React, { useState, useEffect, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const LibrarianManagePublishedBooksScreen = ({ currentUser }) => {
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingBook, setEditingBook] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [previewBook, setPreviewBook] = useState(null);
  const [numPages, setNumPages] = useState(null);

  const [selectedBooks, setSelectedBooks] = useState(new Set());
  const [selectAll, setSelectAll] = useState(false);
  const [bulkEditModalOpen, setBulkEditModalOpen] = useState(false);
  const [bulkEditFields, setBulkEditFields] = useState({ title: '', genre: '', description: '' });
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [historyEntries, setHistoryEntries] = useState([]);
  const [genreFilter, setGenreFilter] = useState('');
  const [authorFilter, setAuthorFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [formData, setFormData] = useState({
    title: '',
    author: '',
    genre: '',
    description: '',
    file: null,
    cover: null,
  });

  const [editFormData, setEditFormData] = useState({
    title: '',
    genre: '',
    description: '',
  });

  const GENRES = ['Fiction', 'Non-Fiction', 'Science', 'History', 'Mystery', 'Romance', 'Biography'];

  // Fetch all published books
  const fetchBooks = useCallback(async () => {
    try {
      const response = await fetch('http://localhost:4000/api/librarian/published-books');
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch books.');
      }
      setBooks(data.books || []);
      setError('');
    } catch (fetchError) {
      setError(fetchError.message || 'Failed to fetch books.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBooks();
    const pollTimer = setInterval(fetchBooks, 15000);
    return () => clearInterval(pollTimer);
  }, [fetchBooks]);

  // Filter books based on search
  const authors = Array.from(new Set(books.map((b) => b.author).filter(Boolean)));

  const filteredBooks = books.filter((book) => {
    const matchesSearch =
      book.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      book.author.toLowerCase().includes(searchTerm.toLowerCase()) ||
      book.genre.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesGenre = genreFilter ? String(book.genre || '') === String(genreFilter) : true;
    const matchesAuthor = authorFilter ? String(book.author || '') === String(authorFilter) : true;
    const matchesStatus = statusFilter ? String(book.status || '') === String(statusFilter) : true;

    return matchesSearch && matchesGenre && matchesAuthor && matchesStatus;
  });

  // Handle add book form submission
  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title || !formData.author || !formData.genre || !formData.file) {
      setMessage('Title, Author, Genre, and Book PDF are required.');
      setMessageType('error');
      return;
    }

    const data = new FormData();
    data.append('title', formData.title);
    data.append('author', formData.author);
    data.append('genre', formData.genre);
    data.append('description', formData.description);
    data.append('file', formData.file);
    if (formData.cover) data.append('cover', formData.cover);

    try {
      const response = await fetch('http://localhost:4000/api/librarian/add-book', {
        method: 'POST',
        body: data,
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Failed to add book.');
      }

      setMessage('Book added successfully!');
      setMessageType('success');
      setFormData({ title: '', author: '', genre: '', description: '', file: null, cover: null });
      setShowAddForm(false);
      fetchBooks();
    } catch (fetchError) {
      setMessage(fetchError.message || 'Failed to add book.');
      setMessageType('error');
    }
  };

  // Handle edit book
  const handleEditClick = (book) => {
    setEditingBook(book);
    setEditFormData({
      title: book.title,
      genre: book.genre,
      description: book.description,
    });
    setMessage('');
    setMessageType('');
  };

  // Handle edit form submission
  const handleEditSubmit = async () => {
    if (!editFormData.title.trim() || !editFormData.genre.trim()) {
      setMessage('Title and Genre are required.');
      setMessageType('error');
      return;
    }

    try {
      const response = await fetch(`http://localhost:4000/api/librarian/published-books/${editingBook.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editFormData.title.trim(),
          genre: editFormData.genre.trim(),
          description: editFormData.description.trim(),
          actor: currentUser?.username || 'librarian',
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Failed to update book.');
      }

      // Use returned JSON to update local state and show formatted message
      const updated = result.book;
      setBooks((prev) => prev.map((b) => (String(b.id) === String(updated.id) ? updated : b)));
      setMessage(result.message || `Updated "${updated.title}" successfully.`);
      setMessageType('success');
      setEditingBook(null);
    } catch (fetchError) {
      setMessage(fetchError.message || 'Failed to update book.');
      setMessageType('error');
    }
  };

  // Handle delete book
  const handleDeleteClick = (book) => {
    setDeleteConfirm(book);
  };

  const handleDeleteConfirm = async () => {
    try {
      const response = await fetch(`http://localhost:4000/api/librarian/published-books/${deleteConfirm.id}`, {
        method: 'DELETE',
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Failed to delete book.');
      }

      setMessage('Book deleted successfully!');
      setMessageType('success');
      setDeleteConfirm(null);
      fetchBooks();
    } catch (fetchError) {
      setMessage(fetchError.message || 'Failed to delete book.');
      setMessageType('error');
    }
  };

  const toggleSelectBook = (bookId) => {
    const next = new Set(selectedBooks);
    if (next.has(String(bookId))) next.delete(String(bookId));
    else next.add(String(bookId));
    setSelectedBooks(next);
    setSelectAll(false);
  };

  const toggleSelectAll = () => {
    if (selectAll) {
      setSelectedBooks(new Set());
      setSelectAll(false);
      return;
    }
    const allIds = filteredBooks.map((b) => String(b.id));
    setSelectedBooks(new Set(allIds));
    setSelectAll(true);
  };

  const handleBulkEditApply = async () => {
    if (selectedBooks.size === 0) return;
    const ids = Array.from(selectedBooks);
    const updates = ids.map((id) => ({ bookId: id, ...bulkEditFields }));
    try {
      const resp = await fetch('http://localhost:4000/api/librarian/published-books/bulk-edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates }),
      });
      const result = await resp.json();
      if (!resp.ok) throw new Error(result.error || 'Bulk edit failed');
      setBulkEditModalOpen(false);
      setSelectedBooks(new Set());
      setSelectAll(false);
      fetchBooks();
      setMessage(result.message || 'Bulk edit applied');
      setMessageType('success');
    } catch (err) {
      setMessage(err.message || 'Bulk edit failed');
      setMessageType('error');
    }
  };

  const fetchBookHistory = async (bookId) => {
    try {
      const resp = await fetch(`http://localhost:4000/api/book-history/${bookId}`);
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Failed to fetch history');
      setHistoryEntries(data.history || []);
      setHistoryModalOpen(true);
    } catch (err) {
      setMessage(err.message || 'Failed to fetch history');
      setMessageType('error');
    }
  };

  if (loading) {
    return <div className="librarian-manage-books">Loading books...</div>;
  }

  return (
    <div className="librarian-manage-books">
      <h3 style={{ color: '#ffb86c', marginBottom: '16px' }}>Manage All Published Books</h3>

      {/* Search Bar */}
      <div style={{ marginBottom: '16px' }}>
        <input
          type="text"
          placeholder="Search by title, author, or genre..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            width: '100%',
            padding: '8px',
            marginBottom: '8px',
            backgroundColor: '#23232e',
            color: '#f8f8f2',
            border: '1px solid #6272a4',
            borderRadius: '4px',
          }}
        />
        <div style={{ display: 'inline-block', marginLeft: '8px' }}>
          <select
            value={genreFilter}
            onChange={(e) => setGenreFilter(e.target.value)}
            style={{ marginRight: '8px', padding: '6px', backgroundColor: '#282a36', color: '#f8f8f2', borderRadius: '4px', border: '1px solid #6272a4' }}
          >
            <option value="">All Genres</option>
            {GENRES.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>

          <select
            value={authorFilter}
            onChange={(e) => setAuthorFilter(e.target.value)}
            style={{ marginRight: '8px', padding: '6px', backgroundColor: '#282a36', color: '#f8f8f2', borderRadius: '4px', border: '1px solid #6272a4' }}
          >
            <option value="">All Authors</option>
            {authors.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ marginRight: '8px', padding: '6px', backgroundColor: '#282a36', color: '#f8f8f2', borderRadius: '4px', border: '1px solid #6272a4' }}
          >
            <option value="">All Statuses</option>
            <option value="available">available</option>
            <option value="borrowed">borrowed</option>
            <option value="pending">pending</option>
            <option value="approved">approved</option>
          </select>

          <button
            onClick={() => setBulkEditModalOpen(true)}
            disabled={selectedBooks.size === 0}
            style={{
              backgroundColor: selectedBooks.size === 0 ? '#444' : '#4fd6b0',
              color: '#23232e',
              padding: '8px 12px',
              borderRadius: '4px',
              cursor: selectedBooks.size === 0 ? 'not-allowed' : 'pointer',
              fontWeight: 'bold',
              marginRight: '8px',
            }}
          >
            Bulk Edit
          </button>

          <button
            onClick={async () => {
              if (selectedBooks.size === 0) return;
              if (!window.confirm(`Delete ${selectedBooks.size} selected books?`)) return;
              try {
                const ids = Array.from(selectedBooks);
                const resp = await fetch('http://localhost:4000/api/librarian/published-books/bulk-delete', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ bookIds: ids }),
                });
                const result = await resp.json();
                if (!resp.ok) throw new Error(result.error || 'Bulk delete failed');
                setSelectedBooks(new Set());
                setSelectAll(false);
                fetchBooks();
                setMessage(result.message || 'Bulk delete completed');
                setMessageType('success');
              } catch (err) {
                setMessage(err.message || 'Bulk delete failed');
                setMessageType('error');
              }
            }}
            style={{
              backgroundColor: '#ff6188',
              color: '#f8f8f2',
              padding: '8px 12px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 'bold',
            }}
          >
            Bulk Delete
          </button>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          style={{
            backgroundColor: '#4fd6b0',
            color: '#23232e',
            padding: '8px 12px',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: 'bold',
          }}
        >
          {showAddForm ? 'Cancel' : '+ Add New Book'}
        </button>
      </div>

      {/* Messages */}
      {message && (
        <div
          style={{
            padding: '8px 12px',
            marginBottom: '16px',
            borderRadius: '4px',
            backgroundColor: messageType === 'error' ? '#ff6188' : '#4fd6b0',
            color: messageType === 'error' ? '#f8f8f2' : '#23232e',
          }}
        >
          {message}
        </div>
      )}

      {/* Add Book Form */}
      {showAddForm && (
        <div
          style={{
            backgroundColor: '#23232e',
            padding: '16px',
            borderRadius: '4px',
            marginBottom: '16px',
            border: '1px solid #6272a4',
          }}
        >
          <h4 style={{ color: '#ffb86c' }}>Add New Book</h4>
          <form onSubmit={handleAddSubmit}>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', marginBottom: '4px', color: '#8f93a2' }}>
                Book Title *
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                style={{
                  width: '100%',
                  padding: '6px',
                  backgroundColor: '#282a36',
                  color: '#f8f8f2',
                  border: '1px solid #6272a4',
                  borderRadius: '4px',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', marginBottom: '4px', color: '#8f93a2' }}>
                Author Name *
              </label>
              <input
                type="text"
                value={formData.author}
                onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                style={{
                  width: '100%',
                  padding: '6px',
                  backgroundColor: '#282a36',
                  color: '#f8f8f2',
                  border: '1px solid #6272a4',
                  borderRadius: '4px',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', marginBottom: '4px', color: '#8f93a2' }}>
                Genre *
              </label>
              <select
                value={formData.genre}
                onChange={(e) => setFormData({ ...formData, genre: e.target.value })}
                style={{
                  width: '100%',
                  padding: '6px',
                  backgroundColor: '#282a36',
                  color: '#f8f8f2',
                  border: '1px solid #6272a4',
                  borderRadius: '4px',
                  boxSizing: 'border-box',
                }}
              >
                <option value="">Select a genre</option>
                {GENRES.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', marginBottom: '4px', color: '#8f93a2' }}>
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                style={{
                  width: '100%',
                  padding: '6px',
                  backgroundColor: '#282a36',
                  color: '#f8f8f2',
                  border: '1px solid #6272a4',
                  borderRadius: '4px',
                  boxSizing: 'border-box',
                  minHeight: '80px',
                  fontFamily: 'monospace',
                }}
              />
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', marginBottom: '4px', color: '#8f93a2' }}>
                Book PDF File *
              </label>
              <input
                type="file"
                accept=".pdf"
                onChange={(e) => setFormData({ ...formData, file: e.target.files?.[0] || null })}
                style={{
                  display: 'block',
                  marginBottom: '8px',
                  color: '#8f93a2',
                }}
              />
              {formData.file && (
                <small style={{ color: '#4fd6b0' }}>{formData.file.name}</small>
              )}
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', marginBottom: '4px', color: '#8f93a2' }}>
                Book Cover Image (Optional)
              </label>
              <input
                type="file"
                accept="image/jpeg,image/png"
                onChange={(e) => setFormData({ ...formData, cover: e.target.files?.[0] || null })}
                style={{
                  display: 'block',
                  color: '#8f93a2',
                }}
              />
              {formData.cover && (
                <small style={{ color: '#4fd6b0' }}>{formData.cover.name}</small>
              )}
            </div>

            <div>
              <button
                type="submit"
                style={{
                  backgroundColor: '#4fd6b0',
                  color: '#23232e',
                  padding: '8px 16px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  marginRight: '8px',
                }}
              >
                Add Book
              </button>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                style={{
                  backgroundColor: '#6272a4',
                  color: '#f8f8f2',
                  padding: '8px 16px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Edit Modal */}
      {editingBook && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000,
          }}
          onClick={() => setEditingBook(null)}
        >
          <div
            style={{
              backgroundColor: '#23232e',
              padding: '20px',
              borderRadius: '4px',
              border: '1px solid #6272a4',
              maxWidth: '500px',
              width: '90%',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h4 style={{ color: '#ffb86c', marginTop: 0 }}>Edit Book</h4>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', marginBottom: '4px', color: '#8f93a2' }}>
                Title
              </label>
              <input
                type="text"
                value={editFormData.title}
                onChange={(e) => setEditFormData({ ...editFormData, title: e.target.value })}
                style={{
                  width: '100%',
                  padding: '6px',
                  backgroundColor: '#282a36',
                  color: '#f8f8f2',
                  border: '1px solid #6272a4',
                  borderRadius: '4px',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', marginBottom: '4px', color: '#8f93a2' }}>
                Genre
              </label>
              <select
                value={editFormData.genre}
                onChange={(e) => setEditFormData({ ...editFormData, genre: e.target.value })}
                style={{
                  width: '100%',
                  padding: '6px',
                  backgroundColor: '#282a36',
                  color: '#f8f8f2',
                  border: '1px solid #6272a4',
                  borderRadius: '4px',
                  boxSizing: 'border-box',
                }}
              >
                <option value="">Select a genre</option>
                {GENRES.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', marginBottom: '4px', color: '#8f93a2' }}>
                Description
              </label>
              <textarea
                value={editFormData.description}
                onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                style={{
                  width: '100%',
                  padding: '6px',
                  backgroundColor: '#282a36',
                  color: '#f8f8f2',
                  border: '1px solid #6272a4',
                  borderRadius: '4px',
                  boxSizing: 'border-box',
                  minHeight: '80px',
                  fontFamily: 'monospace',
                }}
              />
            </div>

            <div>
              <button
                onClick={handleEditSubmit}
                style={{
                  backgroundColor: '#4fd6b0',
                  color: '#23232e',
                  padding: '8px 16px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  marginRight: '8px',
                }}
              >
                Save Changes
              </button>
              <button
                onClick={() => setEditingBook(null)}
                style={{
                  backgroundColor: '#6272a4',
                  color: '#f8f8f2',
                  padding: '8px 16px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000,
          }}
          onClick={() => setDeleteConfirm(null)}
        >
          <div
            style={{
              backgroundColor: '#23232e',
              padding: '20px',
              borderRadius: '4px',
              border: '1px solid #6272a4',
              maxWidth: '400px',
              width: '90%',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h4 style={{ color: '#ff6188', marginTop: 0 }}>Delete Book</h4>
            <p style={{ color: '#f8f8f2' }}>
              Are you sure you want to delete <strong>{deleteConfirm.title}</strong>? This action cannot be undone.
            </p>
            <div>
              <button
                onClick={handleDeleteConfirm}
                style={{
                  backgroundColor: '#ff6188',
                  color: '#f8f8f2',
                  padding: '8px 16px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  marginRight: '8px',
                }}
              >
                Delete
              </button>
              <button
                onClick={() => setDeleteConfirm(null)}
                style={{
                  backgroundColor: '#6272a4',
                  color: '#f8f8f2',
                  padding: '8px 16px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PDF Preview Modal */}
      {previewBook && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1001,
            overflow: 'auto',
            padding: '20px',
          }}
          onClick={() => setPreviewBook(null)}
        >
          <div
            style={{
              backgroundColor: '#23232e',
              padding: '20px',
              borderRadius: '4px',
              border: '1px solid #6272a4',
              maxWidth: '900px',
              width: '90%',
              maxHeight: '90vh',
              overflow: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h4 style={{ color: '#ffb86c', marginTop: 0 }}>{previewBook.title}</h4>
            <p style={{ color: '#8f93a2', margin: '4px 0' }}>
              <strong>Author:</strong> {previewBook.author}
            </p>
            <p style={{ color: '#8f93a2', margin: '4px 0' }}>
              <strong>Genre:</strong> {previewBook.genre}
            </p>
            
            <div style={{ marginTop: '16px', marginBottom: '16px', textAlign: 'center' }}>
              <Document
                file={`http://localhost:4000/${previewBook.filePath}`}
                onLoadSuccess={({ numPages: pages }) => setNumPages(pages)}
                onLoadError={() => setMessage('Failed to load PDF preview.')}
              >
                <Page
                  pageNumber={1}
                  width={Math.min(800, window.innerWidth - 60)}
                  renderTextLayer={false}
                />
              </Document>
              {numPages && (
                <p style={{ color: '#8f93a2', marginTop: '8px', fontSize: '0.9rem' }}>
                  Page 1 of {numPages}
                </p>
              )}
            </div>
            
            <div style={{ textAlign: 'center' }}>
              <a
                href={`http://localhost:4000/${previewBook.filePath}`}
                download
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  backgroundColor: '#4fd6b0',
                  color: '#23232e',
                  padding: '8px 16px',
                  borderRadius: '4px',
                  textDecoration: 'none',
                  fontWeight: 'bold',
                  display: 'inline-block',
                  marginRight: '8px',
                }}
              >
                Download PDF
              </a>
              <button
                onClick={() => setPreviewBook(null)}
                style={{
                  backgroundColor: '#6272a4',
                  color: '#f8f8f2',
                  padding: '8px 16px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Edit Modal */}
      {bulkEditModalOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.7)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1002,
          }}
          onClick={() => setBulkEditModalOpen(false)}
        >
          <div
            style={{ backgroundColor: '#23232e', padding: '20px', borderRadius: '4px', border: '1px solid #6272a4', width: '480px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h4 style={{ color: '#ffb86c', marginTop: 0 }}>Bulk Edit ({selectedBooks.size} books)</h4>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ color: '#8f93a2' }}>Title (applied to all selected if set)</label>
              <input value={bulkEditFields.title} onChange={(e) => setBulkEditFields({ ...bulkEditFields, title: e.target.value })} style={{ width: '100%', padding: '8px', marginTop: '6px', backgroundColor: '#282a36', color: '#f8f8f2', border: '1px solid #6272a4', borderRadius: '4px' }} />
            </div>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ color: '#8f93a2' }}>Genre</label>
              <select value={bulkEditFields.genre} onChange={(e) => setBulkEditFields({ ...bulkEditFields, genre: e.target.value })} style={{ width: '100%', padding: '8px', marginTop: '6px', backgroundColor: '#282a36', color: '#f8f8f2', border: '1px solid #6272a4', borderRadius: '4px' }}>
                <option value="">(leave unchanged)</option>
                {GENRES.map((g) => (<option key={g} value={g}>{g}</option>))}
              </select>
            </div>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ color: '#8f93a2' }}>Description</label>
              <textarea value={bulkEditFields.description} onChange={(e) => setBulkEditFields({ ...bulkEditFields, description: e.target.value })} style={{ width: '100%', padding: '8px', minHeight: '80px', marginTop: '6px', backgroundColor: '#282a36', color: '#f8f8f2', border: '1px solid #6272a4', borderRadius: '4px' }} />
            </div>
            <div style={{ textAlign: 'right' }}>
              <button onClick={handleBulkEditApply} style={{ backgroundColor: '#4fd6b0', color: '#23232e', padding: '8px 12px', borderRadius: '4px', marginRight: '8px' }}>Apply</button>
              <button onClick={() => setBulkEditModalOpen(false)} style={{ backgroundColor: '#6272a4', color: '#f8f8f2', padding: '8px 12px', borderRadius: '4px' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* History Modal */}
      {historyModalOpen && (
        <div
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1003 }}
          onClick={() => setHistoryModalOpen(false)}
        >
          <div style={{ backgroundColor: '#23232e', padding: '20px', borderRadius: '4px', border: '1px solid #6272a4', maxWidth: '800px', width: '90%', maxHeight: '80vh', overflow: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <h4 style={{ color: '#ffb86c', marginTop: 0 }}>Version History</h4>
            {historyEntries.length === 0 ? (
              <p style={{ color: '#8f93a2' }}>No history entries for this book.</p>
            ) : (
              <ul style={{ color: '#f8f8f2', paddingLeft: '16px' }}>
                {historyEntries.map((h) => (
                  <li key={h.id} style={{ marginBottom: '12px' }}>
                    <div style={{ color: '#8f93a2', fontSize: '0.9rem' }}>{new Date(h.timestamp).toLocaleString()} — {h.action} by {h.actor || 'librarian'}</div>

                    <div style={{ background: '#1e1f26', padding: '8px', borderRadius: '4px', overflow: 'auto', color: '#f8f8f2' }}>
                      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                        <div style={{ minWidth: '220px' }}>
                          <strong style={{ color: '#ffb86c' }}>Before</strong>
                          <div style={{ marginTop: '6px' }}>
                            <div><strong>Title:</strong> {h.before?.title || '—'}</div>
                            <div><strong>Author:</strong> {h.before?.authorFullName || h.before?.author || h.before?.authorUsername || '—'}</div>
                            <div style={{ marginTop: '6px' }}><strong>Description:</strong>
                              <div style={{ marginTop: '4px', color: '#b8b9c2' }}>{h.before?.description || '—'}</div>
                            </div>
                          </div>
                        </div>

                        <div style={{ minWidth: '220px' }}>
                          <strong style={{ color: '#50fa7b' }}>After</strong>
                          <div style={{ marginTop: '6px' }}>
                            <div><strong>Title:</strong> {h.after?.title || '—'}</div>
                            <div><strong>Author:</strong> {h.after?.authorFullName || h.after?.author || h.after?.authorUsername || '—'}</div>
                            <div style={{ marginTop: '6px' }}><strong>Description:</strong>
                              <div style={{ marginTop: '4px', color: '#b8b9c2' }}>{h.after?.description || '—'}</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <div style={{ textAlign: 'right' }}>
              <button onClick={() => setHistoryModalOpen(false)} style={{ backgroundColor: '#6272a4', color: '#f8f8f2', padding: '8px 12px', borderRadius: '4px' }}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Books Table */}
      {filteredBooks.length === 0 ? (
        <p style={{ color: '#8f93a2' }}>No books found.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #6272a4' }}>
              <th style={{ padding: '8px', textAlign: 'left', color: '#ffb86c' }}>
                <input type="checkbox" checked={selectAll} onChange={toggleSelectAll} />
              </th>
              <th style={{ padding: '8px', textAlign: 'left', color: '#ffb86c' }}>Title</th>
              <th style={{ padding: '8px', textAlign: 'left', color: '#ffb86c' }}>Author</th>
              <th style={{ padding: '8px', textAlign: 'left', color: '#ffb86c' }}>Genre</th>
              <th style={{ padding: '8px', textAlign: 'center', color: '#ffb86c' }}>Status</th>
              <th style={{ padding: '8px', textAlign: 'center', color: '#ffb86c' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredBooks.map((book) => (
              <tr key={book.id} style={{ borderBottom: '1px solid #6272a4' }}>
                <td style={{ padding: '8px' }}>
                  <input
                    type="checkbox"
                    checked={selectedBooks.has(String(book.id))}
                    onChange={() => toggleSelectBook(book.id)}
                  />
                </td>
                <td style={{ padding: '8px', color: '#f8f8f2' }}>{book.title}</td>
                <td style={{ padding: '8px', color: '#f8f8f2' }}>{book.author}</td>
                <td style={{ padding: '8px', color: '#f8f8f2' }}>{book.genre}</td>
                <td
                  style={{
                    padding: '8px',
                    textAlign: 'center',
                    color: book.status === 'approved' ? '#4fd6b0' : '#ffb86c',
                  }}
                >
                  {book.status}
                </td>
                <td style={{ padding: '8px', textAlign: 'center' }}>
                  <button
                    onClick={() => setPreviewBook(book)}
                    style={{
                      backgroundColor: '#8f93a2',
                      color: '#23232e',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      marginRight: '4px',
                      fontSize: '0.85rem',
                      fontWeight: 'bold',
                    }}
                  >
                    Preview
                  </button>
                  <button
                    onClick={() => handleEditClick(book)}
                    style={{
                      backgroundColor: '#6272a4',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      marginRight: '4px',
                      fontSize: '0.85rem',
                    }}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteClick(book)}
                    style={{
                      backgroundColor: '#ff6188',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      marginRight: '4px',
                      fontSize: '0.85rem',
                    }}
                  >
                    Delete
                  </button>
                  <button
                    onClick={() => fetchBookHistory(book.id)}
                    style={{
                      backgroundColor: '#8fb3ff',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '0.85rem',
                    }}
                  >
                    History
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default LibrarianManagePublishedBooksScreen;
