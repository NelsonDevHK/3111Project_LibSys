import React from 'react';
import PublishPage from './PublishPage';

const AuthorPortal = ({ currentUser }) => {
  // defensive guard – the login component may render this
  // before the user object is available
  // if (!currentUser) {
  //   return (
  //     <div className="portal">
  //       <h2>Author Portal</h2>
  //       <p>Loading user…</p>
  //     </div>
  //   );
  // }

  return (
    <div className="portal">
      <h2>Author Portal</h2>
      <p>Welcome, {currentUser.username}! This is your dashboard.</p>
      <PublishPage currentUser={currentUser} />
    </div>
  );
}

export default AuthorPortal;
