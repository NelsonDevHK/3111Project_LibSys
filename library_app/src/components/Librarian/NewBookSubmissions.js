import React, { useState, useEffect } from 'react';

function NewBookSubmissions({ currentUser }) {
  const [submissions, setSubmissions] = useState([]);
  const [selectedSubmissions, setSelectedSubmissions] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  const fetchSubmissions = async () => {
    try {
      const [authorRes, requestRes] = await Promise.all([
        fetch('http://localhost:4000/api/submissions'),
        fetch('http://localhost:4000/api/book-requests'),
      ]);

      const authorPayload = await authorRes.json().catch(() => []);
      const requestPayload = await requestRes.json().catch(() => ({ bookRequests: [] }));

      const authorSubmissions = Array.isArray(authorPayload)
        ? authorPayload.map((item) => ({
            ...item,
            submissionType: 'author',
            selectionId: `author:${item.id}`,
            submittedDate: item.submittedDate || item.publishDate,
          }))
        : [];

      const requestSubmissions = Array.isArray(requestPayload?.bookRequests)
        ? requestPayload.bookRequests.map((item) => ({
            id: item.id,
            title: item.title,
            authorUsername: item.requestedBy,
            author: item.author,
            genre: item.genre,
            status: item.status,
            submittedDate: item.submittedAt
              ? new Date(item.submittedAt).toISOString().split('T')[0]
              : '',
            submissionType: 'request',
            reason: item.reason,
            selectionId: `request:${item.id}`,
          }))
        : [];

      setSubmissions([...authorSubmissions, ...requestSubmissions]);
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
          const [submissionType, id] = selectionId.split(':');
          let response;

          if (submissionType === 'request') {
            if (isApproved) {
              response = await fetch(`http://localhost:4000/api/book-requests/${id}/upload`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  librarianUsername: currentUser?.username,
                }),
              });
            } else {
              response = await fetch(`http://localhost:4000/api/book-requests/${id}/review`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  isApproved: false,
                  rejectionReason,
                  librarianUsername: currentUser?.username,
                }),
              });
            }
          } else {
            response = await fetch(`http://localhost:4000/api/submissions/${id}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                isApproved,
                rejectionReason: isApproved ? undefined : rejectionReason,
                sendToAuthor: !isApproved,
              }),
            });
          }

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
      <h3>New Book Submissions</h3>
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
      <button onClick={() => handleBulkAction(true)}>Approve Selected (Requests auto-upload)</button>
      <button onClick={() => handleBulkAction(false)}>Reject Selected</button>
      <table>
        <thead>
          <tr>
            <th>Select</th>
            <th>Type</th>
            <th>Title</th>
            <th>Submitted By</th>
            <th>Requested Author</th>
            <th>Genre</th>
            <th>Reason/Description</th>
            <th>Submitted Date</th>
            <th>Status</th>
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
              <td>{submission.submissionType}</td>
              <td>{submission.title}</td>
              <td>{submission.authorUsername}</td>
              <td>{submission.author || '-'}</td>
              <td>{submission.genre}</td>
              <td>{submission.reason || submission.description || '-'}</td>
              <td>{submission.submittedDate}</td>
              <td>{submission.status || 'pending'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default NewBookSubmissions;