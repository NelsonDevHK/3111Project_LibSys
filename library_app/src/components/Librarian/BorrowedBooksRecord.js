import React, { useState, useEffect } from 'react';
import "../../App.css";

const BorrowedBooksRecord = () => {
  const [records, setRecords] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  useEffect(() => {
    fetch("http://localhost:4000/borrowed-books")
      .then((response) => response.json())
      .then((data) => setRecords(data))
      .catch((error) => console.error("Error fetching borrowed books records:", error));
  }, []);

  const handleSearch = (event) => {
    setSearchTerm(event.target.value);
  };

  const handleFilterChange = (event) => {
    setFilterStatus(event.target.value);
  };

  const filteredRecords = records.filter((record) => {
    const matchesSearch =
      record.bookTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.borrowerUsername.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      filterStatus === "all" || record.status.toLowerCase() === filterStatus.toLowerCase();

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="borrowed-books-record">
      <h1>Borrowed Books Record</h1>
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
              <td>{record.returnDate}</td>
              <td>{record.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default BorrowedBooksRecord;