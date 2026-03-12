import React from 'react';
import PublishPage from './PublishPage';
import RejectedBooksSection from './RejectedBooksSection';

const AuthorPortal = ({ currentUser }) => {

  return (
    <div className="portal">
      <h2>Author Portal</h2>
      <p>Welcome, {currentUser.username}! This is your dashboard.</p>
      <RejectedBooksSection currentUser={currentUser} />
      <PublishPage currentUser={currentUser} />
    </div>
  );
}

export default AuthorPortal;
