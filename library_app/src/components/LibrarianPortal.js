import React from 'react';
import NewBookSubmissions from './NewBookSubmissions';

function LibrarianPortal({ onLogout }) {
  return (
    <div className="portal">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Librarian Portal</h2>
        <button onClick={onLogout} style={{ height: '100%', backgroundColor: '#ffb86c' }}>Log Out</button>
      </div>
      <p>Welcome, Librarian! This is your dashboard.</p>
      <NewBookSubmissions />
    </div>
  );
}

export default LibrarianPortal;
