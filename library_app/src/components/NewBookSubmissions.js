import React, { useState, useEffect } from 'react';

function NewBookSubmissions() {
  const [submissions, setSubmissions] = useState([]);
  const [feedbackMessage, setFeedbackMessage] = useState('');

  const fetchSubmissions = async () => {
    try {
      const res = await fetch('http://localhost:4000/api/submissions');
      const data = await res.json();
      setSubmissions(data);
    } catch {
      setFeedbackMessage('Failed to fetch submissions.');
    }
  };

  const handleRejectionReason = async (authorUsername, rejectionReason) => {
    try {
      const res = await fetch('http://localhost:4000/api/rejectionReason', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ authorUsername, rejectionReason })
      });
      if (!res.ok) {
        throw new Error('Failed to save rejection reason.');
      }
    } catch {
      setFeedbackMessage('Failed to save rejection reason.');
    }
  };

  const storeRejectedBook = async (book) => {
    try {
      const res = await fetch('http://localhost:4000/api/pendingBooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(book)
      });
      if (!res.ok) {
        throw new Error('Failed to store rejected book.');
      }
    } catch {
      setFeedbackMessage('Failed to store rejected book.');
    }
  };

  const handleApproval = async (submissionId, isApproved, rejectionReason = '', book = null) => {
    setFeedbackMessage('');
    try {
      const res = await fetch(`http://localhost:4000/api/submissions/${submissionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isApproved })
      });
      const data = await res.json();
      if (res.ok) {
        if (!isApproved) {
          await handleRejectionReason(data.authorUsername, rejectionReason);
          if (book) {
            await storeRejectedBook(book);
          }
        }
        setFeedbackMessage(`Submission ${isApproved ? 'approved' : 'rejected'} successfully.`);
        fetchSubmissions();
      } else {
        setFeedbackMessage(data.error || 'Failed to update submission.');
      }
    } catch {
      setFeedbackMessage('Server error.');
    }
  };

  const confirmAction = (submissionId, isApproved, authorUsername, book) => {
    if (!isApproved) {
      const reason = prompt('Enter rejection reason:');
      if (!reason) return;
      handleApproval(submissionId, false, reason, book);
    } else {
      handleApproval(submissionId, true);
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
                  <button onClick={() => confirmAction(submission.id, false, submission.authorUsername, submission)}>Reject</button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      {feedbackMessage && <div className="feedback">{feedbackMessage}</div>}
    </div>
  );
}

export default NewBookSubmissions;