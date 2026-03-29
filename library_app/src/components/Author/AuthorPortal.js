import React from 'react';
import PublishPage from './PublishPage';
import RejectedBooksSection from './RejectedBooksSection';

const AuthorPortal = ({ currentUser, onLogout }) => {
  return (
    <div className="portal">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Author Portal</h2>
        <button onClick={onLogout} style={{ height: '100%', backgroundColor: '#ffb86c' }}>Log Out</button>
      </div>
      <p>Welcome, {currentUser.username}! This is your dashboard.</p>
      <RejectedBooksSection currentUser={currentUser} />
      <PublishPage currentUser={currentUser} />
    </div>
  );
};

export default AuthorPortal;
