import React from 'react';
import PublishPage from './PublishPage';

const AuthorPortal = ({ currentUser }) => {

  return (
    <div className="portal">
      <h2>Author Portal</h2>
      <p>Welcome, {currentUser.username}! This is your dashboard.</p>
      <PublishPage currentUser={currentUser} />
    </div>
  );
}

export default AuthorPortal;
