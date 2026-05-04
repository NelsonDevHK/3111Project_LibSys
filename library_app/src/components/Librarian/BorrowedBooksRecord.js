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

  const isOverdue = (record) => String(record.status || '').toLowerCase() === 'overdue';

  const escapeCsvValue = (value) => {
    const text = String(value ?? '');
    if (/[",\n]/.test(text)) {
      return `"${text.replace(/"/g, '""')}"`;
    }

    return text;
  };

  const exportRecords = (format) => {
    if (filteredRecords.length === 0) {
      setError('No filtered records available to export.');
      return;
    }

    const rows = filteredRecords.map((record) => ({
      bookTitle: record.bookTitle || '',
      borrowerUsername: record.borrowerUsername || '',
      borrowDate: record.borrowDate || '',
      returnDate: record.returnDate || '-',
      status: record.status || '',
    }));

    if (format === 'csv') {
      const header = ['Book Title', 'Borrower Username', 'Borrow Date', 'Return Date', 'Status'];
      const csvContent = [header, ...rows.map((row) => [row.bookTitle, row.borrowerUsername, row.borrowDate, row.returnDate, row.status])]
        .map((row) => row.map(escapeCsvValue).join(','))
        .join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'borrowed-books-records.csv';
      link.click();
      URL.revokeObjectURL(url);
      return;
    }

    const htmlTable = `
      <html>
        <head><meta charset="utf-8" /></head>
        <body>
          <table border="1">
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
              ${rows.map((row) => `
                <tr>
                  <td>${row.bookTitle}</td>
                  <td>${row.borrowerUsername}</td>
                  <td>${row.borrowDate}</td>
                  <td>${row.returnDate}</td>
                  <td>${row.status}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `;

    const blob = new Blob([htmlTable], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'borrowed-books-records.xls';
    link.click();
    URL.revokeObjectURL(url);
  };

  const filteredRecords = records.filter((record) => {
    const matchesSearch =
      String(record.bookTitle || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      String(record.borrowerUsername || '').toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      filterStatus === "all" ||
      (filterStatus === 'active' && String(record.status || '').toLowerCase() === 'borrowed') ||
      (filterStatus === 'returned' && String(record.status || '').toLowerCase() === 'returned') ||
      (filterStatus === 'overdue' && String(record.status || '').toLowerCase() === 'overdue');

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
          <option value="active">Active Borrowings</option>
          <option value="returned">Returned</option>
          <option value="overdue">Overdue</option>
        </select>
        <button type="button" onClick={() => exportRecords('csv')}>Export CSV</button>
        <button type="button" onClick={() => exportRecords('excel')}>Export Excel</button>
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
            <tr key={index} className={isOverdue(record) ? 'overdue-row' : ''}>
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