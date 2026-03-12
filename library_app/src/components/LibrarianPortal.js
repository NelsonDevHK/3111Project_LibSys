import React from 'react';
import NewBookSubmissions from './NewBookSubmissions';

function LibrarianPortal() {
  return (
    <div className="portal">
      <h2>Librarian Portal</h2>
      <p>Welcome, Librarian! This is your dashboard.</p>
      <NewBookSubmissions />
    </div>
  );
}

export default LibrarianPortal;
