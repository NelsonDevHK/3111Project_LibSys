import React, { useState, useEffect } from 'react';

function NewBookSubmissions() {
  const [submissions, setSubmissions] = useState([]);
  const [selectedSubmissions, setSelectedSubmissions] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  const fetchSubmissions = async () => {
    try {
      const res = await fetch('http://localhost:4000/api/submissions');
      const data = await res.json();
      setSubmissions(data);
    } catch {
      console.error('Failed to fetch submissions.');
    }
  };

  const handleBulkAction = async (isApproved) => {
    if (selectedSubmissions.length === 0) {
      alert("No submissions selected.");
      return;
    }

    if (!window.confirm(`Are you sure you want to ${isApproved ? 'approve' : 'reject'} the selected submissions?`)) {
      return;
    }

    try {
      await Promise.all(
        selectedSubmissions.map((id) =>
          fetch(`http://localhost:4000/api/submissions/${id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isApproved })
          })
        )
      );
      fetchSubmissions();
      setSelectedSubmissions([]);
    } catch {
      console.error('Failed to perform bulk action.');
    }
  };

  const handleSearch = (event) => {
    setSearchTerm(event.target.value);
  };

  const handleFilterChange = (event) => {
    setFilterStatus(event.target.value);
  };

  const filteredSubmissions = submissions.filter((submission) => {
    const matchesSearch =
      submission.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      submission.authorUsername.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      filterStatus === "all" || submission.status.toLowerCase() === filterStatus.toLowerCase();

    return matchesSearch && matchesStatus;
  });

  const toggleSelection = (id) => {
    setSelectedSubmissions((prev) =>
      prev.includes(id) ? prev.filter((submissionId) => submissionId !== id) : [...prev, id]
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
        </select>
      </div>
      <button onClick={() => handleBulkAction(true)}>Approve Selected</button>
      <button onClick={() => handleBulkAction(false)}>Reject Selected</button>
      <table>
        <thead>
          <tr>
            <th>Select</th>
            <th>Title</th>
            <th>Author</th>
            <th>Genre</th>
            <th>Submitted Date</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {filteredSubmissions.map((submission) => (
            <tr key={submission.id}>
              <td>
                <input
                  type="checkbox"
                  checked={selectedSubmissions.includes(submission.id)}
                  onChange={() => toggleSelection(submission.id)}
                />
              </td>
              <td>{submission.title}</td>
              <td>{submission.authorUsername}</td>
              <td>{submission.genre}</td>
              <td>{submission.submittedDate}</td>
              <td>{submission.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default NewBookSubmissions;