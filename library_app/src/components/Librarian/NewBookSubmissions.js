import React, { useState, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

function NewBookSubmissions({ currentUser }) {
  const [submissions, setSubmissions] = useState([]);
  const [selectedSubmissions, setSelectedSubmissions] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [previewBook, setPreviewBook] = useState(null);
  const [numPages, setNumPages] = useState(null);

  const fetchSubmissions = async () => {
    try {
      const authorRes = await fetch('http://localhost:4000/api/submissions');
      const authorPayload = await authorRes.json().catch(() => []);

      const authorSubmissions = Array.isArray(authorPayload)
        ? authorPayload.map((item) => ({
            ...item,
            submissionType: 'author',
            selectionId: `author:${item.id}`,
            submittedDate: item.submittedDate || item.publishDate || '',
          }))
        : [];

      setSubmissions(authorSubmissions);
    } catch {
      console.error('Failed to fetch submissions.');
    }
  };

  const handleBulkAction = async (isApproved) => {
    if (selectedSubmissions.length === 0) {
      alert("No submissions selected.");
      return;
    }

    let rejectionReason = '';
    if (!isApproved) {
      const enteredReason = window.prompt('Please provide a rejection reason for selected submissions:');
      rejectionReason = enteredReason ? enteredReason.trim() : '';

      if (!rejectionReason) {
        alert('A rejection reason is required.');
        return;
      }
    }

    if (!window.confirm(`Are you sure you want to ${isApproved ? 'approve' : 'reject'} the selected submissions?`)) {
      return;
    }

    try {
      const responses = await Promise.all(
        selectedSubmissions.map(async (selectionId) => {
          const [, id] = selectionId.split(':');
          const response = await fetch(`http://localhost:4000/api/submissions/${id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              isApproved,
              rejectionReason: isApproved ? undefined : rejectionReason,
              sendToAuthor: !isApproved,
            }),
          });

          const payload = await response.json().catch(() => ({}));
          if (!response.ok) {
            throw new Error(payload.error || `Failed to ${isApproved ? 'approve' : 'reject'} submission ${selectionId}.`);
          }

          return response;
        })
      );

      if (responses.length > 0) {
        alert(`Selected submissions ${isApproved ? 'approved' : 'rejected'} successfully.`);
      }

      fetchSubmissions();
      setSelectedSubmissions([]);
    } catch (error) {
      console.error('Failed to perform bulk action.', error);
      alert(error.message || 'Failed to perform bulk action.');
    }
  };

  const handleSearch = (event) => {
    setSearchTerm(event.target.value);
  };

  const handleFilterChange = (event) => {
    setFilterStatus(event.target.value);
  };

  const filteredSubmissions = submissions.filter((submission) => {
    const normalizedStatus = String(submission.status || 'pending').toLowerCase();
    const normalizedTitle = String(submission.title || '').toLowerCase();
    const normalizedSubmitter = String(submission.authorUsername || '').toLowerCase();
    const normalizedSearchTerm = searchTerm.toLowerCase();
    const matchesSearch =
      normalizedTitle.includes(normalizedSearchTerm) || normalizedSubmitter.includes(normalizedSearchTerm);

    const matchesStatus =
      filterStatus === "all" || normalizedStatus === filterStatus.toLowerCase();

    return matchesSearch && matchesStatus;
  });

  const toggleSelection = (selectionId) => {
    setSelectedSubmissions((prev) =>
      prev.includes(selectionId)
        ? prev.filter((submissionId) => submissionId !== selectionId)
        : [...prev, selectionId]
    );
  };

  useEffect(() => {
    fetchSubmissions();
  }, []);

  return (
    <div className="submissions">
      <h3 style={{ color: '#ffb86c', marginBottom: '16px' }}>New Book Submissions</h3>
      <div className="filters">
        <input
          type="text"
          placeholder="Search by title or author"
          value={searchTerm}
          onChange={handleSearch}
        />
        <select value={filterStatus} onChange={handleFilterChange}>
          <option value="all">All</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="uploaded">Uploaded</option>
        </select>
      </div>
      <button onClick={() => handleBulkAction(true)}>Approve Selected</button>
      <button onClick={() => handleBulkAction(false)}>Reject Selected</button>
      <div style={{ overflowX: 'auto', marginBottom: '16px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '900px' }}>
          <thead>
            <tr style={{ backgroundColor: '#23232e', borderBottom: '2px solid #6272a4' }}>
              <th style={{ padding: '8px', textAlign: 'left', color: '#ffb86c', whiteSpace: 'nowrap' }}>Select</th>
              <th style={{ padding: '8px', textAlign: 'left', color: '#ffb86c', whiteSpace: 'nowrap' }}>Title</th>
              <th style={{ padding: '8px', textAlign: 'left', color: '#ffb86c', whiteSpace: 'nowrap' }}>Author Username</th>
              <th style={{ padding: '8px', textAlign: 'left', color: '#ffb86c', whiteSpace: 'nowrap' }}>Author</th>
              <th style={{ padding: '8px', textAlign: 'left', color: '#ffb86c', whiteSpace: 'nowrap' }}>Genre</th>
              <th style={{ padding: '8px', textAlign: 'left', color: '#ffb86c', whiteSpace: 'nowrap' }}>Reason/Description</th>
              <th style={{ padding: '8px', textAlign: 'left', color: '#ffb86c', whiteSpace: 'nowrap' }}>Submitted Date</th>
              <th style={{ padding: '8px', textAlign: 'center', color: '#ffb86c', whiteSpace: 'nowrap' }}>Status</th>
            </tr>
          </thead>
        <tbody>
          {filteredSubmissions.map((submission) => (
            <tr key={submission.selectionId}>
              <td>
                <input
                  type="checkbox"
                  checked={selectedSubmissions.includes(submission.selectionId)}
                  onChange={() => toggleSelection(submission.selectionId)}
                />
              </td>
              <td>{submission.title}</td>
              <td>{submission.authorUsername}</td>
              <td>{submission.author || '-'}</td>
              <td>{submission.genre}</td>
              <td>{submission.description || submission.reason || '-'}</td>
              <td>{submission.submittedDate}</td>
              <td>
                <div style={{ display: 'flex', gap: '4px', justifyContent: 'center', alignItems: 'center' }}>
                  {submission.filePath && (
                    <button
                      onClick={() => setPreviewBook(submission)}
                      style={{
                        backgroundColor: '#8f93a2',
                        color: '#23232e',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                        fontWeight: 'bold',
                        border: 'none',
                      }}
                    >
                      Preview
                    </button>
                  )}
                  <span style={{ color: '#f8f8f2', fontSize: '0.9rem' }}>{submission.status || 'pending'}</span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
        </table>
      </div>

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
              <strong>Author:</strong> {previewBook.author || previewBook.authorFullName || 'N/A'}
            </p>
            <p style={{ color: '#8f93a2', margin: '4px 0' }}>
              <strong>Genre:</strong> {previewBook.genre}
            </p>
            <p style={{ color: '#8f93a2', margin: '4px 0' }}>
              <strong>Submitted By:</strong> {previewBook.authorUsername}
            </p>
            
            <div style={{ marginTop: '16px', marginBottom: '16px', textAlign: 'center' }}>
              {previewBook.filePath ? (
                <>
                  <Document
                    file={`http://localhost:4000/${previewBook.filePath}`}
                    onLoadSuccess={({ numPages: pages }) => setNumPages(pages)}
                    onLoadError={() => console.error('Failed to load PDF')}
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
                </>
              ) : (
                <p style={{ color: '#ff6188' }}>No PDF file available for preview</p>
              )}
            </div>
            
            <div style={{ textAlign: 'center' }}>
              {previewBook.filePath && (
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
              )}
              <button
                onClick={() => setPreviewBook(null)}
                style={{
                  backgroundColor: '#6272a4',
                  color: '#f8f8f2',
                  padding: '8px 16px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  border: 'none',
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default NewBookSubmissions;