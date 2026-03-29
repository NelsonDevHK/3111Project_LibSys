import React from 'react';
import NewBookSubmissions from './NewBookSubmissions';
import ManageProfileScreen from '../ManageProfileScreen';

function LibrarianPortal({ currentUser, onLogout, onProfileUpdated }) {
  return (
    <div className="portal">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Librarian Portal</h2>
        <button onClick={onLogout} style={{ height: '100%', backgroundColor: '#ffb86c' }}>Log Out</button>
      </div>
      <p>Welcome, {currentUser ? currentUser.username : 'Librarian'}! This is your dashboard.</p>
      <NewBookSubmissions />
      <ManageProfileScreen
        currentUser={currentUser}
        onProfileUpdated={onProfileUpdated}
        onForceLogout={onLogout}
      />
    </div>
  );
}

export default LibrarianPortal;
