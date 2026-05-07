import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

function LibrarianBookRequestsScreen({ currentUser }) {
  const [bookRequests, setBookRequests] = useState([]);
  const [analytics, setAnalytics] = useState({
    totalRequests: 0,
    byStatus: {},
    topGenres: [],
    topAuthors: [],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [statusFilter, setStatusFilter] = useState('pending');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [bookDescription, setBookDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const isFetchingRef = useRef(false);
  const pdfUploadInputRef = useRef(null);

  const fetchBookRequests = useCallback(async ({ silent = false } = {}) => {
    if (isFetchingRef.current) {
      return;
    }

    isFetchingRef.current = true;
    if (!silent) {
      setLoading(true);
    }
    setError('');

    try {
      const params = new URLSearchParams();
      if (statusFilter) {
        params.append('status', statusFilter);
      }

      const [requestsResponse, analyticsResponse] = await Promise.all([
        fetch(`http://localhost:4000/api/book-requests?${params.toString()}`),
        fetch('http://localhost:4000/api/book-requests/analytics'),
      ]);

      if (!requestsResponse.ok) {
        throw new Error('Failed to fetch book requests.');
      }
      if (!analyticsResponse.ok) {
        throw new Error('Failed to fetch book request analytics.');
      }

      const requestsData = await requestsResponse.json();
      const analyticsData = await analyticsResponse.json();

      const requests = requestsData.bookRequests || [];
      setBookRequests(
        priorityFilter === 'all'
          ? requests
          : requests.filter((request) => request.priorityLevel === priorityFilter)
      );
      setAnalytics(analyticsData.analytics || {
        totalRequests: 0,
        byStatus: {},
        topGenres: [],
        topAuthors: [],
      });
    } catch (err) {
      setError(err.message);
    } finally {
      if (!silent) {
        setLoading(false);
      }
      isFetchingRef.current = false;
    }
  }, [statusFilter, priorityFilter]);

  useEffect(() => {
    fetchBookRequests();
  }, [fetchBookRequests]);

  useEffect(() => {
    const timer = setInterval(() => {
      fetchBookRequests({ silent: true });
    }, 8000);
    return () => clearInterval(timer);
  }, [fetchBookRequests]);

  const resetModalState = () => {
    setSelectedRequest(null);
    setRejectionReason('');
    setBookDescription('');
  };

  const handleApproveRequest = async (requestId) => {
    const request = bookRequests.find((item) => item.id === requestId);
    const requestPdfPath = request?.pdfFilePath || request?.filePath || '';

    if (!requestPdfPath) {
      alert('Attach a PDF before approving this request.');
      return;
    }

    setSubmitting(true);
    setFeedback('');

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

      setFeedback('Book request approved successfully.');
      resetModalState();
      fetchBookRequests({ silent: true });
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
    setFeedback('');

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

      setFeedback('Book request rejected successfully.');
      resetModalState();
      fetchBookRequests({ silent: true });
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUploadBook = async (requestId) => {
    setSubmitting(true);
    setFeedback('');

    try {
      const request = bookRequests.find((r) => r.id === requestId);
      const requestPdfPath = request?.pdfFilePath || request?.filePath || '';
      if (!requestPdfPath) {
        throw new Error('Attach a PDF before uploading the requested book.');
      }

      let nextDescription = bookDescription.trim();

      if (!nextDescription && request) {
        const generatedDescription = await generateSummaryForRequest(request);
        nextDescription = generatedDescription;
        setBookDescription(generatedDescription);
      }

      const response = await fetch(
        `http://localhost:4000/api/book-requests/${requestId}/upload`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            librarianUsername: currentUser.username,
            description: nextDescription,
          }),
        }
      );

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to upload book.');
      }

      setFeedback(data.message || 'Book request processed successfully.');
      resetModalState();
      fetchBookRequests({ silent: true });
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadBook = async (requestId) => {
    setSubmitting(true);
    setFeedback('');

    try {
      const response = await fetch(
        `http://localhost:4000/api/book-requests/${requestId}/download`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ librarianUsername: currentUser.username }),
        }
      );

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to download requested book.');
      }

      setFeedback(data.message || 'Requested book downloaded successfully.');
      fetchBookRequests({ silent: true });
      if (selectedRequest && selectedRequest.id === requestId) {
        setSelectedRequest((prev) => (prev ? { ...prev, ...data.request } : prev));
      }
    } catch (err) {
      setFeedback(`Download failed: ${err.message}`);
      fetchBookRequests({ silent: true });
    } finally {
      setSubmitting(false);
    }
  };

  const openPdfPicker = () => {
    pdfUploadInputRef.current?.click();
  };

  const attachPdfToRequest = async (requestId, file) => {
    if (!file) {
      return;
    }

    setSubmitting(true);
    setFeedback('');

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('librarianUsername', currentUser.username);

      const response = await fetch(`http://localhost:4000/api/book-requests/${requestId}/attach-pdf`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || 'Failed to attach PDF.');
      }

      setFeedback(data.message || 'PDF attached successfully.');
      if (selectedRequest && selectedRequest.id === requestId) {
        setSelectedRequest((prev) => (prev ? { ...prev, ...data.request, pdfFilePath: data.pdfFilePath } : prev));
      }
      fetchBookRequests({ silent: true });
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setSubmitting(false);
      if (pdfUploadInputRef.current) {
        pdfUploadInputRef.current.value = '';
      }
    }
  };

  const handlePdfSelection = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !selectedRequest) {
      return;
    }

    if (file.type !== 'application/pdf') {
      alert('Please select a PDF file.');
      event.target.value = '';
      return;
    }

    await attachPdfToRequest(selectedRequest.id, file);
  };

  const generateSummaryForRequest = async (request) => {
    if (!request) return '';

    try {
      const response = await fetch('http://localhost:4000/api/generate-request-summary', {
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
      return data.summary || '';
    } catch (err) {
      alert('Failed to generate summary: ' + err.message);
      return '';
    }
  };

  const generateSummary = async (requestId) => {
    const request = bookRequests.find((r) => r.id === requestId);
    if (!request) return;

    setSubmitting(true);
    const summary = await generateSummaryForRequest(request);
    setBookDescription(summary);
    setSubmitting(false);
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

  const priorityClass = (level) => {
    if (level === 'high') return 'priority-high';
    if (level === 'medium') return 'priority-medium';
    return 'priority-low';
  };

  const renderProgress = (request) => {
    const progress = Number(request.downloadProgress || 0);
    const status = String(request.downloadStatus || 'idle');
    if (status === 'idle') {
      return <span className="progress-idle">Not started</span>;
    }

    return (
      <div className="progress-wrapper">
        <div className="progress-bar-track">
          <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
        </div>
        <small>
          {status} {progress}%
        </small>
      </div>
    );
  };

  const resolvedPdfPath = selectedRequest?.pdfFilePath || selectedRequest?.filePath || '';
  const hasPdf = Boolean(resolvedPdfPath);

  return (
    <div className="librarian-book-requests-screen">
      <h3>Book Request Management</h3>
      {feedback && <p className="process-feedback">{feedback}</p>}

      <div className="analytics-strip">
        <div className="analytics-card">
          <span>Total Requests</span>
          <strong>{analytics.totalRequests || 0}</strong>
        </div>
        <div className="analytics-card">
          <span>Pending</span>
          <strong>{analytics.byStatus?.pending || 0}</strong>
        </div>
        <div className="analytics-card">
          <span>Top Genre</span>
          <strong>{analytics.topGenres?.[0]?.label || 'N/A'}</strong>
        </div>
        <div className="analytics-card">
          <span>Top Author</span>
          <strong>{analytics.topAuthors?.[0]?.label || 'N/A'}</strong>
        </div>
      </div>

      <div className="analytics-list-grid">
        <div className="analytics-list-panel">
          <h4>Most Requested Genres</h4>
          {Array.isArray(analytics.topGenres) && analytics.topGenres.length > 0 ? (
            <ul>
              {analytics.topGenres.slice(0, 5).map((entry) => (
                <li key={entry.label}>
                  <span>{entry.label}</span>
                  <strong>{entry.count}</strong>
                </li>
              ))}
            </ul>
          ) : (
            <p>No genre requests yet.</p>
          )}
        </div>

        <div className="analytics-list-panel">
          <h4>Most Requested Authors</h4>
          {Array.isArray(analytics.topAuthors) && analytics.topAuthors.length > 0 ? (
            <ul>
              {analytics.topAuthors.slice(0, 5).map((entry) => (
                <li key={entry.label}>
                  <span>{entry.label}</span>
                  <strong>{entry.count}</strong>
                </li>
              ))}
            </ul>
          ) : (
            <p>No author requests yet.</p>
          )}
        </div>
      </div>

      <div className="filter-section">
        <label htmlFor="statusFilter">Status:</label>
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

        <label htmlFor="priorityFilter">Priority:</label>
        <select
          id="priorityFilter"
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
        >
          <option value="all">All</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
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
                <th>Priority</th>
                <th>Popularity</th>
                <th>Status</th>
                <th>Download Progress</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {bookRequests.map((request) => (
                <tr key={request.id} className={`priority-row-${request.priorityLevel}`}>
                  <td data-label="Title">{request.title}</td>
                  <td data-label="Author">{request.author}</td>
                  <td data-label="Genre">{request.genre}</td>
                  <td data-label="Requested By">
                    {request.requestedBy}
                    <span className="role-badge">{request.requestedByRole}</span>
                  </td>
                  <td data-label="Priority">
                    <span className={`priority-badge ${priorityClass(request.priorityLevel)}`}>
                      {request.priorityLevel} ({request.priorityScore || 0})
                    </span>
                  </td>
                  <td data-label="Popularity">{request.popularityCount || 1} request(s)</td>
                  <td data-label="Status">
                    <span className={`status-badge ${statusBadgeClass(request.status)}`}>
                      {request.status}
                    </span>
                  </td>
                  <td data-label="Download Progress">{renderProgress(request)}</td>
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

      {selectedRequest && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h4>Book Request Details</h4>
              <button className="modal-close" onClick={resetModalState}>x</button>
            </div>

            <div className="modal-body">
              <div className="request-details">
                <div className="detail-row"><strong>Title:</strong><span>{selectedRequest.title}</span></div>
                <div className="detail-row"><strong>Author:</strong><span>{selectedRequest.author}</span></div>
                <div className="detail-row"><strong>Genre:</strong><span>{selectedRequest.genre}</span></div>
                <div className="detail-row"><strong>Priority:</strong><span className={`priority-badge ${priorityClass(selectedRequest.priorityLevel)}`}>{selectedRequest.priorityLevel} ({selectedRequest.priorityScore || 0})</span></div>
                <div className="detail-row"><strong>Reason:</strong><p className="reason-text">{selectedRequest.reason}</p></div>
                <div className="detail-row"><strong>Download:</strong><span>{selectedRequest.downloadStatus || 'idle'} ({selectedRequest.downloadProgress || 0}%)</span></div>

                {selectedRequest.downloadError && (
                  <div className="detail-row">
                    <strong>Download Error:</strong>
                    <p className="rejection-text">{selectedRequest.downloadError}</p>
                  </div>
                )}

                {Array.isArray(selectedRequest.alternativeSuggestions) && selectedRequest.alternativeSuggestions.length > 0 && (
                  <div className="detail-row alternatives-row">
                    <strong>Alternatives:</strong>
                    <ul className="alternatives-list">
                      {selectedRequest.alternativeSuggestions.map((alternative, index) => (
                        <li key={`${alternative.title}-${index}`}>
                          <span>{alternative.title} by {alternative.author}</span>
                          {alternative.sourceUrl && (
                            <a href={alternative.sourceUrl} target="_blank" rel="noreferrer">Source</a>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <div className="pdf-preview-section">
                <div className="detail-row pdf-status-row">
                  <strong>PDF:</strong>
                  <span className={hasPdf ? 'pdf-ready' : 'pdf-missing'}>
                    {hasPdf ? 'Attached and ready to preview' : 'No PDF attached yet'}
                  </span>
                </div>

                {hasPdf ? (
                  <div className="pdf-preview-frame">
                    <Document
                      file={`http://localhost:4000/${resolvedPdfPath}`}
                      onLoadError={() => setFeedback('Unable to load the attached PDF preview.')}
                    >
                      <Page pageNumber={1} width={560} renderTextLayer={false} />
                    </Document>
                  </div>
                ) : (
                  <p className="pdf-placeholder">
                    Attach a PDF to preview it here before approving the request.
                  </p>
                )}
              </div>

              {['pending', 'approved'].includes(selectedRequest.status) && (
                <div className="action-section">
                  <h5>Actions</h5>

                  <div className="form-group">
                    <label htmlFor="description">Book Description/Summary:</label>
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
                      Generate Summary (LLM)
                    </button>
                  </div>

                  <input
                    ref={pdfUploadInputRef}
                    type="file"
                    accept="application/pdf"
                    style={{ display: 'none' }}
                    onChange={handlePdfSelection}
                  />

                  <div className="decision-buttons">
                    <button
                      className="btn-attach"
                      onClick={openPdfPicker}
                      disabled={submitting}
                    >
                      Attach PDF
                    </button>

                    <button
                      className="btn-download"
                      onClick={() => handleDownloadBook(selectedRequest.id)}
                      disabled={submitting}
                    >
                      Download Requested Book Online
                    </button>
                  </div>

                  <div className="decision-buttons">
                    <button
                      className="btn-upload"
                      onClick={() => handleUploadBook(selectedRequest.id)}
                      disabled={submitting || !hasPdf}
                    >
                      Upload Attached PDF to Library
                    </button>

                    <button
                      className="btn-reject"
                      onClick={() => handleRejectRequest(selectedRequest.id)}
                      disabled={submitting}
                    >
                      Reject Request
                    </button>
                  </div>

                  <div className="approve-footer">
                    <button
                      className="btn-approve"
                      onClick={() => handleApproveRequest(selectedRequest.id)}
                      disabled={submitting || !hasPdf}
                    >
                      Approve Request
                    </button>
                    {!hasPdf && <p className="approval-note">A PDF must be attached before approval.</p>}
                  </div>

                  <div className="reject-section">
                    <textarea
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="Rejection reason (required if rejecting)..."
                      rows={2}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn-close-modal" onClick={resetModalState}>Close</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .librarian-book-requests-screen { padding: 20px; max-width: 1200px; margin: 0 auto; }
        .librarian-book-requests-screen h3 { margin-bottom: 20px; color: #ffb86c; }
        .analytics-strip { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin-bottom: 16px; }
        .analytics-card { background: #23232e; border: 1px solid #44475a; border-radius: 8px; padding: 10px; }
        .analytics-card span { display: block; color: #b8b9c2; font-size: 12px; }
        .analytics-card strong { color: #f8f8f2; font-size: 16px; }
        .analytics-list-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin-bottom: 16px; }
        .analytics-list-panel { background: #23232e; border: 1px solid #44475a; border-radius: 8px; padding: 10px; }
        .analytics-list-panel h4 { margin: 0 0 8px; color: #8be9fd; font-size: 14px; }
        .analytics-list-panel ul { margin: 0; padding: 0; list-style: none; }
        .analytics-list-panel li { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #44475a; color: #e6e6e6; font-size: 13px; }
        .analytics-list-panel li:last-child { border-bottom: none; }
        .analytics-list-panel p { margin: 0; color: #b8b9c2; }
        .process-feedback { margin: -8px 0 16px; color: #50fa7b; font-weight: 600; }
        .filter-section { margin-bottom: 20px; display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
        .filter-section label { font-weight: bold; color: #ffb86c; }
        .filter-section select { padding: 8px 12px; border: 1px solid #44475a; border-radius: 4px; font-size: 14px; background-color: #21222c; color: #e6e6e6; }
        .requests-table-container { overflow-x: auto; }
        .requests-table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        .requests-table th { background-color: #292a2d; color: #ffb86c; padding: 12px; text-align: left; border-bottom: 2px solid #44475a; font-weight: bold; }
        .requests-table td { padding: 12px; border-bottom: 1px solid #44475a; }
        .requests-table tbody tr:hover { background-color: #2e2f35; }
        .priority-row-high { box-shadow: inset 3px 0 0 #ff6188; }
        .priority-row-medium { box-shadow: inset 3px 0 0 #ffb86c; }
        .priority-row-low { box-shadow: inset 3px 0 0 #50fa7b; }
        .role-badge { display: inline-block; background-color: #44475a; color: #8be9fd; padding: 2px 6px; border-radius: 3px; font-size: 11px; margin-left: 5px; }
        .status-badge, .priority-badge { display: inline-block; padding: 6px 12px; border-radius: 4px; font-size: 12px; font-weight: bold; }
        .status-pending { background-color: #ffb86c; color: #23232e; }
        .status-approved { background-color: #50fa7b; color: #23232e; }
        .status-rejected { background-color: #ff6188; color: #fff; }
        .status-uploaded { background-color: #6272a4; color: #fff; }
        .priority-high { background: rgba(255, 97, 136, 0.2); color: #ff97b3; border: 1px solid rgba(255, 97, 136, 0.35); }
        .priority-medium { background: rgba(255, 184, 108, 0.2); color: #ffca8a; border: 1px solid rgba(255, 184, 108, 0.35); }
        .priority-low { background: rgba(80, 250, 123, 0.2); color: #7dffa0; border: 1px solid rgba(80, 250, 123, 0.35); }
        .progress-wrapper { min-width: 170px; }
        .progress-bar-track { width: 100%; height: 8px; border-radius: 999px; background: #44475a; overflow: hidden; margin-bottom: 4px; }
        .progress-bar-fill { height: 100%; background: linear-gradient(90deg, #8be9fd, #50fa7b); }
        .progress-idle { color: #b8b9c2; font-size: 12px; }
        .pdf-preview-section { margin-bottom: 16px; }
        .pdf-preview-frame { border: 1px solid #44475a; border-radius: 8px; padding: 12px; background: #1f2028; overflow-x: auto; }
        .pdf-placeholder { margin: 0; padding: 16px; border: 1px dashed #6272a4; border-radius: 8px; color: #b8b9c2; background: rgba(98, 114, 164, 0.08); }
        .pdf-ready { color: #50fa7b; font-weight: 700; }
        .pdf-missing { color: #ffb86c; font-weight: 700; }
        .approve-footer { margin-top: 12px; display: flex; flex-direction: column; gap: 8px; align-items: stretch; }
        .approval-note { margin: 0; color: #ffb86c; font-size: 13px; }
        .btn-view-details, .btn-download, .btn-approve, .btn-upload, .btn-attach, .btn-reject, .btn-generate-summary, .btn-close-modal { border: none; border-radius: 4px; cursor: pointer; font-size: 13px; padding: 8px 12px; }
        .btn-view-details { background-color: #ffb86c; color: #23232e; }
        .btn-approve { background-color: #50fa7b; color: #23232e; }
        .btn-download { background-color: #8be9fd; color: #23232e; }
        .btn-upload { background-color: #ffb86c; color: #23232e; }
        .btn-attach { background-color: #6272a4; color: #fff; }
        .btn-reject { background-color: #ff6188; color: #fff; width: 100%; }
        .btn-generate-summary { background-color: #ffb86c; color: #23232e; width: 100%; }
        .btn-close-modal { background-color: #44475a; color: #e6e6e6; }
        .btn-view-details:hover, .btn-approve:hover, .btn-download:hover, .btn-upload:hover, .btn-attach:hover, .btn-reject:hover, .btn-generate-summary:hover, .btn-close-modal:hover { opacity: 0.88; }
        .modal-overlay { position: fixed; inset: 0; background-color: rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center; z-index: 1000; }
        .modal-content { background-color: #292a2d; color: #e6e6e6; border-radius: 8px; max-width: 700px; width: 92%; max-height: 85vh; overflow-y: auto; }
        .modal-header { display: flex; justify-content: space-between; align-items: center; padding: 20px; border-bottom: 1px solid #44475a; }
        .modal-close { background: none; border: none; font-size: 24px; cursor: pointer; color: #b8b9c2; }
        .modal-close:hover { color: #ffb86c; }
        .modal-body { padding: 20px; }
        .detail-row { margin-bottom: 12px; display: flex; gap: 10px; align-items: flex-start; }
        .detail-row strong { min-width: 160px; color: #ffb86c; }
        .reason-text, .rejection-text { margin: 0; padding: 8px; background-color: #23232e; border-left: 3px solid #ffb86c; border-radius: 2px; }
        .rejection-text { border-left-color: #ff6188; }
        .action-section { background-color: #23232e; border: 1px solid #44475a; padding: 15px; border-radius: 4px; margin-bottom: 12px; }
        .form-group label { display: block; margin-bottom: 6px; color: #ffb86c; font-weight: 700; }
        .form-group textarea, .reject-section textarea { width: 100%; padding: 10px; border: 1px solid #44475a; border-radius: 4px; background: #21222c; color: #e6e6e6; margin-bottom: 8px; }
        .decision-buttons { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin-bottom: 10px; }
        .alternatives-row { flex-direction: column; }
        .alternatives-list { margin: 0; padding-left: 18px; }
        .alternatives-list li { margin-bottom: 6px; display: flex; justify-content: space-between; gap: 8px; }
        .alternatives-list a { color: #8be9fd; }
        .modal-footer { padding: 15px 20px; border-top: 1px solid #44475a; display: flex; justify-content: flex-end; }
        .loading, .error, .no-requests { text-align: center; padding: 20px; font-size: 16px; }
        .error { color: #ff6188; }
        .loading, .no-requests { color: #b8b9c2; }
        @media (max-width: 900px) {
          .analytics-strip { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .analytics-list-grid { grid-template-columns: 1fr; }
          .decision-buttons { grid-template-columns: 1fr; }
          .detail-row { flex-direction: column; }
          .detail-row strong { min-width: 0; }
        }
      `}</style>
    </div>
  );
}

export default LibrarianBookRequestsScreen;
