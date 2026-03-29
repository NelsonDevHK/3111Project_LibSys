import React, { useState, useEffect, useCallback } from 'react';

const PublishedBooksScreen = ({ currentUser, refreshKey }) => {
  const [books, setBooks] = useState([]);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [editingBook, setEditingBook] = useState(null);
  const [editForm, setEditForm] = useState({ title: '', genre: '', description: '' });
  const [showEditModal, setShowEditModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // Fetch published books
  const fetchPublishedBooks = useCallback(async () => {
    try {
      const response = await fetch(`http://localhost:4000/api/published-books/${currentUser?.username}`);
      if (response.ok) {
        const data = await response.json();
        setBooks(data);
      } else {
        setMessage('Failed to fetch published books.');
        setMessageType('error');
      }
    } catch (error) {
      console.error('Error fetching published books:', error);
      setMessage('Error loading published books.');
      setMessageType('error');
    }
  }, [currentUser?.username]);

  useEffect(() => {
    if (currentUser?.username) {
      fetchPublishedBooks();
    }
  }, [currentUser?.username, fetchPublishedBooks, refreshKey]);

  // Handle edit button click
  const handleEditClick = (book) => {
    setEditingBook(book);
    setEditForm({
      title: book.title,
      genre: book.genre,
      description: book.description || '',
    });
    setShowEditModal(true);
    setMessage('');
  };

  // Handle edit form change
  const handleEditFormChange = (e) => {
    const { name, value } = e.target;
    setEditForm(prev => ({ ...prev, [name]: value }));
  };

  // Handle edit form submit
  const handleEditSubmit = async () => {
    if (!editForm.title.trim() || !editForm.genre.trim()) {
      setMessage('Title and Genre are required.');
      setMessageType('error');
      return;
    }

    try {
      const response = await fetch(
        `http://localhost:4000/api/published-books/${currentUser?.username}/${editingBook.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: editForm.title.trim(),
            genre: editForm.genre.trim(),
            description: editForm.description.trim(),
          }),
        }
      );

      if (response.ok) {
        setMessage('Book updated successfully!');
        setMessageType('success');
        setShowEditModal(false);
        fetchPublishedBooks();
      } else {
        const data = await response.json();
        setMessage(data.error || 'Failed to update book.');
        setMessageType('error');
      }
    } catch (error) {
      console.error('Error updating book:', error);
      setMessage('Error updating book.');
      setMessageType('error');
    }
  };

  // Handle delete button click (show confirmation)
  const handleDeleteClick = (book) => {
    setDeleteConfirm(book);
  };

  // Handle delete confirmation
  const handleDeleteConfirm = async () => {
    try {
      const response = await fetch(
        `http://localhost:4000/api/published-books/${currentUser?.username}/${deleteConfirm.id}`,
        { method: 'DELETE' }
      );

      if (response.ok) {
        setMessage('Book deleted successfully!');
        setMessageType('success');
        setDeleteConfirm(null);
        fetchPublishedBooks();
      } else {
        const data = await response.json();
        setMessage(data.error || 'Failed to delete book.');
        setMessageType('error');
      }
    } catch (error) {
      console.error('Error deleting book:', error);
      setMessage('Error deleting book.');
      setMessageType('error');
    }
  };

  // Get status text color
  const getStatusTextColor = (status) => {
    switch (status) {
      case 'approved':
        return '#4fd6b0';
      case 'rejected':
        return '#ff6188';
      case 'pending':
        return '#ffb86c';
      default:
        return '#8f93a2';
    }
  };

  return (
    <div className="published-books-section">
      <h3 style={{ color: '#ffb86c', marginBottom: '16px' }}>Published Books</h3>

      {books.length === 0 ? (
        <p style={{ color: '#8f93a2' }}>No books published yet.</p>
      ) : (
        <table className="published-books-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Genre</th>
              <th>Status</th>
              <th>Published Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {books.map(book => (
              <tr key={String(book.id)}>
                <td>{book.title}</td>
                <td>{book.genre}</td>
                <td>
                  <span
                    style={{
                      padding: '4px 8px',
                      borderRadius: '4px',
                      backgroundColor: '#23232e',
                      color: getStatusTextColor(book.status),
                      fontWeight: '500',
                      textTransform: 'capitalize',
                    }}
                  >
                    {book.status}
                  </span>
                </td>
                <td>{new Date(book.publishDate).toLocaleDateString()}</td>
                <td>
                  <button
                    onClick={() => handleEditClick(book)}
                    style={{
                      marginRight: '8px',
                      backgroundColor: '#6272a4',
                      padding: '6px 12px',
                      fontSize: '0.85rem',
                    }}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteClick(book)}
                    style={{
                      backgroundColor: '#ff6188',
                      padding: '6px 12px',
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

      {/* Edit Modal */}
      {showEditModal && editingBook && (
        <div className="modal-overlay">
          <div className="modal-box">
            <h4 style={{ color: '#ffb86c', marginTop: 0 }}>Edit Book Details</h4>

            <div className="form-row" style={{ marginBottom: '12px' }}>
              <label htmlFor="edit-title" style={{ width: '80px', marginRight: '8px' }}>
                Title:
              </label>
              <input
                id="edit-title"
                type="text"
                name="title"
                value={editForm.title}
                onChange={handleEditFormChange}
                className="input"
                style={{ flex: 1 }}
              />
            </div>

            <div className="form-row" style={{ marginBottom: '12px' }}>
              <label htmlFor="edit-genre" style={{ width: '80px', marginRight: '8px' }}>
                Genre:
              </label>
              <input
                id="edit-genre"
                type="text"
                name="genre"
                value={editForm.genre}
                onChange={handleEditFormChange}
                className="input"
                style={{ flex: 1 }}
              />
            </div>

            <div className="form-row" style={{ marginBottom: '12px' }}>
              <label htmlFor="edit-description" style={{ width: '80px', marginRight: '8px', alignItems: 'flex-start', marginTop: '5px' }}>
                Description:
              </label>
              <textarea
                id="edit-description"
                name="description"
                value={editForm.description}
                onChange={handleEditFormChange}
                className="input"
                style={{ flex: 1, minHeight: '100px' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button
                onClick={() => setShowEditModal(false)}
                style={{
                  backgroundColor: '#6272a4',
                  padding: '8px 16px',
                  fontSize: '0.9rem',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleEditSubmit}
                style={{
                  backgroundColor: '#4fd6b0',
                  color: '#23232e',
                  padding: '8px 16px',
                  fontSize: '0.9rem',
                }}
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="modal-overlay">
          <div className="modal-box">
            <h4 style={{ color: '#ff6188', marginTop: 0 }}>Confirm Deletion</h4>
            <p>Are you sure you want to delete "{deleteConfirm.title}"? This action cannot be undone.</p>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button
                onClick={() => setDeleteConfirm(null)}
                style={{
                  backgroundColor: '#6272a4',
                  padding: '8px 16px',
                  fontSize: '0.9rem',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                style={{
                  backgroundColor: '#ff6188',
                  padding: '8px 16px',
                  fontSize: '0.9rem',
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Messages */}
      {message && (
        <p
          style={{
            marginTop: '16px',
            color: messageType === 'success' ? '#4fd6b0' : '#ff6188',
            fontWeight: '500',
          }}
        >
          {message}
        </p>
      )}
    </div>
  );
};

export default PublishedBooksScreen;
