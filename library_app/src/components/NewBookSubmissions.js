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

  const handleApproval = async (submissionId, isApproved, rejectionReason = '') => {
    setFeedbackMessage('');
    try {
      const res = await fetch(`http://localhost:4000/api/submissions/${submissionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isApproved, rejectionReason })
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
    const reason = !isApproved ? prompt('Enter rejection reason:') : '';
    if (!isApproved && !reason) return;
    handleApproval(submissionId, isApproved, reason);
  };

  useEffect(() => {
    fetchSubmissions();
  }, []);

  return (
    <div className="submissions">
      <h3>New Book Submissions</h3>
      {submissions.length === 0 ? (
        <p>No submissions awaiting approval.</p>
      ) : (
        <ul>
          {submissions.map((submission) => (
            <li key={submission.id}>
              <p>Title: {submission.title}</p>
              <p>Author Username: {submission.authorUsername}</p>
              <p>Author Full Name: {submission.authorFullName}</p>
              <p>Genre: {submission.genre}</p>
              <p>Submitted Date: {submission.submittedDate}</p>
              <p>Status: {submission.status}</p>
              <button onClick={() => confirmAction(submission.id, true)}>Approve</button>
              <button onClick={() => confirmAction(submission.id, false)}>Reject</button>
            </li>
          ))}
        </ul>
      )}
      {feedbackMessage && <div className="feedback">{feedbackMessage}</div>}
    </div>
  );
}

export default NewBookSubmissions;