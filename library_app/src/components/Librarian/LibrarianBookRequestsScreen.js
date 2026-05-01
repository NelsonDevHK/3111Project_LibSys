import React, { useState, useEffect } from 'react';

function LibrarianBookRequestsScreen({ currentUser }) {
  const [bookRequests, setBookRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('pending');
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [bookDescription, setBookDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchBookRequests();
  }, [statusFilter]);

  const fetchBookRequests = async () => {
    setLoading(true);
    setError('');

    try {
      const params = new URLSearchParams();
      if (statusFilter) {
        params.append('status', statusFilter);
      }

      const response = await fetch(
        `http://localhost:4000/api/book-requests?${params.toString()}`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch book requests.');
      }

      const data = await response.json();
      setBookRequests(data.bookRequests || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveRequest = async (requestId) => {
    setSubmitting(true);

    try {
      const response = await fetch(
        `http://localhost:4000/api/book-requests/${requestId}/review`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            isApproved: true,
            librarianUsername: currentUser.username,
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to approve request.');
      }

      setSelectedRequest(null);
      setRejectionReason('');
      setBookDescription('');
      fetchBookRequests();
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRejectRequest = async (requestId) => {
    if (!rejectionReason.trim()) {
      alert('Please provide a rejection reason.');
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch(
        `http://localhost:4000/api/book-requests/${requestId}/review`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            isApproved: false,
            librarianUsername: currentUser.username,
            rejectionReason: rejectionReason.trim(),
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to reject request.');
      }

      setSelectedRequest(null);
      setRejectionReason('');
      setBookDescription('');
      fetchBookRequests();
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUploadBook = async (requestId) => {
    setSubmitting(true);

    try {
      const response = await fetch(
        `http://localhost:4000/api/book-requests/${requestId}/upload`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            librarianUsername: currentUser.username,
            description: bookDescription.trim(),
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to upload book.');
      }

      setSelectedRequest(null);
      setRejectionReason('');
      setBookDescription('');
      fetchBookRequests();
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const generateSummary = async (requestId) => {
    const request = bookRequests.find((r) => r.id === requestId);
    if (!request) return;

    try {
      setSubmitting(true);
      // Call the LLM endpoint to generate a summary
      const response = await fetch('http://localhost:4000/api/generate-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: request.title,
          author: request.author,
          genre: request.genre,
          reason: request.reason,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate summary.');
      }

      const data = await response.json();
      setBookDescription(data.summary || '');
    } catch (err) {
      alert('Failed to generate summary: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const statusBadgeClass = (status) => {
    switch (status) {
      case 'pending':
        return 'status-pending';
      case 'approved':
        return 'status-approved';
      case 'rejected':
        return 'status-rejected';
      case 'uploaded':
        return 'status-uploaded';
      default:
        return '';
    }
  };

  return (
    <div className="librarian-book-requests-screen">
      <h3>📚 Book Request Management</h3>

      <div className="filter-section">
        <label htmlFor="statusFilter">Filter by Status:</label>
        <select
          id="statusFilter"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="uploaded">Uploaded</option>
          <option value="">All Requests</option>
        </select>
      </div>

      {loading && <p className="loading">Loading book requests...</p>}
      {error && <p className="error">Error: {error}</p>}

      {!loading && bookRequests.length === 0 && (
        <p className="no-requests">No book requests found.</p>
      )}

      {!loading && bookRequests.length > 0 && (
        <div className="requests-table-container">
          <table className="requests-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Author</th>
                <th>Genre</th>
                <th>Requested By</th>
                <th>Status</th>
                <th>Submitted</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {bookRequests.map((request) => (
                <tr key={request.id}>
                  <td data-label="Title">{request.title}</td>
                  <td data-label="Author">{request.author}</td>
                  <td data-label="Genre">{request.genre}</td>
                  <td data-label="Requested By">
                    {request.requestedBy}
                    <span className="role-badge">{request.requestedByRole}</span>
                  </td>
                  <td data-label="Status">
                    <span className={`status-badge ${statusBadgeClass(request.status)}`}>
                      {request.status}
                    </span>
                  </td>
                  <td data-label="Submitted">
                    {new Date(request.submittedAt).toLocaleDateString()}
                  </td>
                  <td data-label="Action">
                    <button
                      className="btn-view-details"
                      onClick={() => setSelectedRequest(request)}
                    >
                      View Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Details Modal */}
      {selectedRequest && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h4>Book Request Details</h4>
              <button
                className="modal-close"
                onClick={() => {
                  setSelectedRequest(null);
                  setRejectionReason('');
                  setBookDescription('');
                }}
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              <div className="request-details">
                <div className="detail-row">
                  <strong>Title:</strong>
                  <span>{selectedRequest.title}</span>
                </div>
                <div className="detail-row">
                  <strong>Author:</strong>
                  <span>{selectedRequest.author}</span>
                </div>
                <div className="detail-row">
                  <strong>Genre:</strong>
                  <span>{selectedRequest.genre}</span>
                </div>
                <div className="detail-row">
                  <strong>Requested By:</strong>
                  <span>
                    {selectedRequest.requestedBy} ({selectedRequest.requestedByRole})
                  </span>
                </div>
                <div className="detail-row">
                  <strong>Status:</strong>
                  <span className={`status-badge ${statusBadgeClass(selectedRequest.status)}`}>
                    {selectedRequest.status}
                  </span>
                </div>
                <div className="detail-row">
                  <strong>Reason for Request:</strong>
                  <p className="reason-text">{selectedRequest.reason}</p>
                </div>

                {selectedRequest.rejectionReason && (
                  <div className="detail-row">
                    <strong>Rejection Reason:</strong>
                    <p className="rejection-text">{selectedRequest.rejectionReason}</p>
                  </div>
                )}
              </div>

              {selectedRequest.status === 'pending' && (
                <div className="action-section">
                  <h5>Actions</h5>

                  <div className="form-group">
                    <label htmlFor="description">
                      Book Description/Summary:
                    </label>
                    <textarea
                      id="description"
                      value={bookDescription}
                      onChange={(e) => setBookDescription(e.target.value)}
                      placeholder="Enter or generate a description for the book..."
                      rows={4}
                    />
                    <button
                      className="btn-generate-summary"
                      onClick={() => generateSummary(selectedRequest.id)}
                      disabled={submitting}
                    >
                      🤖 Generate Summary (LLM)
                    </button>
                  </div>

                  <div className="decision-buttons">
                    <div className="approve-section">
                      <button
                        className="btn-approve"
                        onClick={() => handleApproveRequest(selectedRequest.id)}
                        disabled={submitting}
                      >
                        ✓ Approve Request
                      </button>
                    </div>

                    <div className="reject-section">
                      <textarea
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        placeholder="Rejection reason (required if rejecting)..."
                        rows={2}
                      />
                      <button
                        className="btn-reject"
                        onClick={() => handleRejectRequest(selectedRequest.id)}
                        disabled={submitting}
                      >
                        ✕ Reject Request
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {selectedRequest.status === 'approved' && (
                <div className="action-section">
                  <h5>Upload Book</h5>
                  <p className="info-text">
                    This request has been approved. You can now upload the book to the library system.
                  </p>

                  <div className="form-group">
                    <label htmlFor="uploadDescription">
                      Book Description (optional):
                    </label>
                    <textarea
                      id="uploadDescription"
                      value={bookDescription}
                      onChange={(e) => setBookDescription(e.target.value)}
                      placeholder="Enter a description for the book..."
                      rows={4}
                    />
                    <button
                      className="btn-generate-summary"
                      onClick={() => generateSummary(selectedRequest.id)}
                      disabled={submitting}
                    >
                      🤖 Generate Summary (LLM)
                    </button>
                  </div>

                  <button
                    className="btn-upload"
                    onClick={() => handleUploadBook(selectedRequest.id)}
                    disabled={submitting}
                  >
                    📤 Upload Book to Library
                  </button>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button
                className="btn-close-modal"
                onClick={() => {
                  setSelectedRequest(null);
                  setRejectionReason('');
                  setBookDescription('');
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .librarian-book-requests-screen {
          padding: 20px;
          max-width: 1200px;
          margin: 0 auto;
        }

        .librarian-book-requests-screen h3 {
          margin-bottom: 20px;
          color: #333;
        }

        .filter-section {
          margin-bottom: 20px;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .filter-section label {
          font-weight: bold;
        }

        .filter-section select {
          padding: 8px 12px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 14px;
        }

        .requests-table-container {
          overflow-x: auto;
        }

        .requests-table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 10px;
        }

        .requests-table th {
          background-color: #f5f5f5;
          padding: 12px;
          text-align: left;
          border-bottom: 2px solid #ddd;
          font-weight: bold;
        }

        .requests-table td {
          padding: 12px;
          border-bottom: 1px solid #ddd;
        }

        .requests-table tbody tr:hover {
          background-color: #f9f9f9;
        }

        .role-badge {
          display: inline-block;
          background-color: #e3f2fd;
          color: #1976d2;
          padding: 2px 6px;
          border-radius: 3px;
          font-size: 11px;
          margin-left: 5px;
        }

        .status-badge {
          display: inline-block;
          padding: 6px 12px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: bold;
          color: white;
        }

        .status-pending {
          background-color: #ff9800;
        }

        .status-approved {
          background-color: #4caf50;
        }

        .status-rejected {
          background-color: #f44336;
        }

        .status-uploaded {
          background-color: #2196f3;
        }

        .btn-view-details {
          background-color: #2196f3;
          color: white;
          border: none;
          padding: 6px 12px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
        }

        .btn-view-details:hover {
          background-color: #1976d2;
        }

        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: rgba(0, 0, 0, 0.5);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 1000;
        }

        .modal-content {
          background-color: white;
          border-radius: 8px;
          max-width: 600px;
          width: 90%;
          max-height: 80vh;
          overflow-y: auto;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px;
          border-bottom: 1px solid #ddd;
        }

        .modal-header h4 {
          margin: 0;
        }

        .modal-close {
          background: none;
          border: none;
          font-size: 24px;
          cursor: pointer;
          color: #666;
        }

        .modal-close:hover {
          color: #000;
        }

        .modal-body {
          padding: 20px;
        }

        .request-details {
          margin-bottom: 20px;
        }

        .detail-row {
          margin-bottom: 12px;
          display: flex;
          gap: 10px;
        }

        .detail-row strong {
          min-width: 150px;
          color: #333;
        }

        .reason-text,
        .rejection-text {
          margin: 5px 0;
          padding: 8px;
          background-color: #f5f5f5;
          border-left: 3px solid #ff9800;
          border-radius: 2px;
        }

        .rejection-text {
          border-left-color: #f44336;
        }

        .action-section {
          background-color: #fafafa;
          padding: 15px;
          border-radius: 4px;
          margin-bottom: 20px;
        }

        .action-section h5 {
          margin-top: 0;
          color: #333;
        }

        .form-group {
          margin-bottom: 15px;
        }

        .form-group label {
          display: block;
          font-weight: bold;
          margin-bottom: 5px;
          color: #333;
        }

        .form-group textarea {
          width: 100%;
          padding: 10px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-family: Arial, sans-serif;
          resize: vertical;
          margin-bottom: 8px;
        }

        .btn-generate-summary {
          background-color: #9c27b0;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
          width: 100%;
        }

        .btn-generate-summary:hover {
          background-color: #7b1fa2;
        }

        .btn-generate-summary:disabled {
          background-color: #ccc;
          cursor: not-allowed;
        }

        .decision-buttons {
          display: flex;
          gap: 15px;
          margin-top: 15px;
        }

        .approve-section,
        .reject-section {
          flex: 1;
        }

        .approve-section button {
          width: 100%;
          background-color: #4caf50;
          color: white;
          border: none;
          padding: 10px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
          font-weight: bold;
        }

        .approve-section button:hover {
          background-color: #45a049;
        }

        .approve-section button:disabled {
          background-color: #ccc;
          cursor: not-allowed;
        }

        .reject-section textarea {
          width: 100%;
          margin-bottom: 8px;
        }

        .reject-section button {
          width: 100%;
          background-color: #f44336;
          color: white;
          border: none;
          padding: 10px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
          font-weight: bold;
        }

        .reject-section button:hover {
          background-color: #da190b;
        }

        .reject-section button:disabled {
          background-color: #ccc;
          cursor: not-allowed;
        }

        .btn-upload {
          width: 100%;
          background-color: #2196f3;
          color: white;
          border: none;
          padding: 10px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
          font-weight: bold;
        }

        .btn-upload:hover {
          background-color: #1976d2;
        }

        .btn-upload:disabled {
          background-color: #ccc;
          cursor: not-allowed;
        }

        .info-text {
          color: #666;
          background-color: #e3f2fd;
          padding: 10px;
          border-radius: 4px;
          margin-bottom: 15px;
        }

        .modal-footer {
          padding: 15px 20px;
          border-top: 1px solid #ddd;
          display: flex;
          justify-content: flex-end;
        }

        .btn-close-modal {
          background-color: #ddd;
          color: #333;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
        }

        .btn-close-modal:hover {
          background-color: #ccc;
        }

        .loading,
        .error,
        .no-requests {
          text-align: center;
          padding: 20px;
          font-size: 16px;
        }

        .error {
          color: #f44336;
        }

        .loading {
          color: #666;
        }

        .no-requests {
          color: #999;
        }

        @media (max-width: 768px) {
          .requests-table {
            font-size: 14px;
          }

          .requests-table th,
          .requests-table td {
            padding: 8px;
          }

          .decision-buttons {
            flex-direction: column;
          }
        }
      `}</style>
    </div>
  );
}

export default LibrarianBookRequestsScreen;
