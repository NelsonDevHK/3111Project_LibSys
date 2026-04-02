import React, { useState, useEffect } from 'react';
import "../../App.css";

const BorrowedBooksRecord = () => {
  const [records, setRecords] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError('');

    fetch('http://localhost:4000/api/borrowed-books')
      .then((response) => {
        if (!response.ok) {
          throw new Error('Failed to fetch borrowed books records');
        }

        return response.json();
      })
      .then((data) => {
        const fetchedRecords = Array.isArray(data?.records) ? data.records : [];
        setRecords(fetchedRecords);
      })
      .catch((fetchError) => {
        console.error('Error fetching borrowed books records:', fetchError);
        setError('Unable to load borrowed books records.');
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSearch = (event) => {
    setSearchTerm(event.target.value);
  };

  const handleFilterChange = (event) => {
    setFilterStatus(event.target.value);
  };

  const filteredRecords = records.filter((record) => {
    const matchesSearch =
      String(record.bookTitle || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      String(record.borrowerUsername || '').toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      filterStatus === "all" ||
      String(record.status || '').toLowerCase() === filterStatus.toLowerCase();

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="borrowed-books-record">
      <h1>Borrowed Books Record</h1>
      {error && <p className="error">{error}</p>}
      <div className="filters">
        <input
          type="text"
          placeholder="Search by book title or username"
          value={searchTerm}
          onChange={handleSearch}
        />
        <select value={filterStatus} onChange={handleFilterChange}>
          <option value="all">All</option>
          <option value="borrowed">Borrowed</option>
          <option value="returned">Returned</option>
          <option value="overdue">Overdue</option>
        </select>
      </div>
      {loading && <p>Loading borrowed books records...</p>}
      <table>
        <thead>
          <tr>
            <th>Book Title</th>
            <th>Borrower Username</th>
            <th>Borrow Date</th>
            <th>Return Date</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {filteredRecords.map((record, index) => (
            <tr key={index}>
              <td>{record.bookTitle}</td>
              <td>{record.borrowerUsername}</td>
              <td>{record.borrowDate}</td>
              <td>{record.returnDate || '-'}</td>
              <td>{record.status}</td>
            </tr>
          ))}
          {!loading && filteredRecords.length === 0 && (
            <tr>
              <td colSpan="5">No borrowed books records match your filters.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default BorrowedBooksRecord;