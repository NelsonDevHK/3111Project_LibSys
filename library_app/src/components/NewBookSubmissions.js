import React, { useState, useEffect } from 'react';

function NewBookSubmissions() {
  const [submissions, setSubmissions] = useState([]);
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [selectedSubmissionId, setSelectedSubmissionId] = useState(null);
  const [sendToAuthor, setSendToAuthor] = useState(false);

  const fetchSubmissions = async () => {
    try {
      const res = await fetch('http://localhost:4000/api/submissions');
      const data = await res.json();
      setSubmissions(data);
    } catch {
      setFeedbackMessage('Failed to fetch submissions.');
    }
  };

  const handleApproval = async (submissionId, isApproved, rejectionReason = '', sendToAuthor = false) => {
    setFeedbackMessage('');
    try {
      const res = await fetch(`http://localhost:4000/api/submissions/${submissionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isApproved, rejectionReason, sendToAuthor })
      });
      const data = await res.json();
      if (res.ok) {
        setFeedbackMessage(`Submission ${isApproved ? 'approved' : 'rejected'} successfully.`);
        fetchSubmissions();
      } else {
        setFeedbackMessage(data.error || 'Failed to update submission.');
      }
    } catch {
      setFeedbackMessage('Server error.');
    }
  };

  const confirmAction = (submissionId, isApproved) => {
    if (!isApproved) {
      setSelectedSubmissionId(submissionId);
    } else {
      handleApproval(submissionId, true);
    }
  };

  const submitRejection = () => {
    if (selectedSubmissionId && rejectionReason.trim()) {
      handleApproval(selectedSubmissionId, false, rejectionReason, sendToAuthor);
      setRejectionReason('');
      setSendToAuthor(false);
      setSelectedSubmissionId(null);
    } else {
      setFeedbackMessage('Please provide a rejection reason.');
    }
  };

  useEffect(() => {
    fetchSubmissions();
  }, []);

  return (
    <div className="submissions">
      <h3 style={{ color: '#ffb86c' }}>New Book Submissions</h3>
      <table>
        <thead>
          <tr>
            <th>Title</th>
            <th>Author Username</th>
            <th>Author Full Name</th>
            <th>Genre</th>
            <th>Submitted Date</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {submissions.length === 0 ? (
            <tr>
              <td colSpan="7">No submissions awaiting approval.</td>
            </tr>
          ) : (
            submissions.map((submission) => (
              <tr key={submission.id}>
                <td>{submission.title}</td>
                <td>{submission.authorUsername}</td>
                <td>{submission.authorFullName}</td>
                <td>{submission.genre}</td>
                <td>{submission.submittedDate}</td>
                <td>{submission.status}</td>
                <td>
                  <button onClick={() => confirmAction(submission.id, true)}>Approve</button>
                  <button onClick={() => confirmAction(submission.id, false)}>Reject</button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      {selectedSubmissionId && (
        <div className="rejection-box" style={{ marginTop: '20px' }}>
          <h4 style={{ color: 'white' }}>Provide Rejection Reason</h4>
          <textarea
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            placeholder="Enter rejection reason here..."
            style={{ width: '300px', height: '150px', display: 'block', marginBottom: '10px' }}
          />
          <div style={{ marginBottom: '10px' }}>
            <input
              type="checkbox"
              id="sendToAuthor"
              checked={sendToAuthor}
              onChange={(e) => setSendToAuthor(e.target.checked)}
            />
            <label htmlFor="sendToAuthor" style={{ marginLeft: '5px' }}>Send to Author</label>
          </div>
          <button onClick={submitRejection}>Submit Rejection</button>
        </div>
      )}
      {feedbackMessage && <div className="feedback">{feedbackMessage}</div>}
    </div>
  );
}

export default NewBookSubmissions;