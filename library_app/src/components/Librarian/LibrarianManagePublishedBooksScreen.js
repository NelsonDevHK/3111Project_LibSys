import React, { useState, useEffect, useCallback } from 'react';

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
  const filteredBooks = books.filter(book =>
    book.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    book.author.toLowerCase().includes(searchTerm.toLowerCase()) ||
    book.genre.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Failed to update book.');
      }

      setMessage('Book updated successfully!');
      setMessageType('success');
      setEditingBook(null);
      fetchBooks();
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

      {/* Books Table */}
      {filteredBooks.length === 0 ? (
        <p style={{ color: '#8f93a2' }}>No books found.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #6272a4' }}>
              <th style={{ padding: '8px', textAlign: 'left', color: '#8f93a2' }}>Title</th>
              <th style={{ padding: '8px', textAlign: 'left', color: '#8f93a2' }}>Author</th>
              <th style={{ padding: '8px', textAlign: 'left', color: '#8f93a2' }}>Genre</th>
              <th style={{ padding: '8px', textAlign: 'center', color: '#8f93a2' }}>Status</th>
              <th style={{ padding: '8px', textAlign: 'center', color: '#8f93a2' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredBooks.map((book) => (
              <tr key={book.id} style={{ borderBottom: '1px solid #6272a4' }}>
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
                      fontSize: '0.85rem',
                    }}
                  >
                    Delete
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
