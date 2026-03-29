import React from 'react';
import PublishPage from './PublishPage';
import ManageProfileScreen from '../ManageProfileScreen';
import NotificationBoard from '../NotificationBoard';

const AuthorPortal = ({ currentUser, onLogout, onProfileUpdated }) => {
  return (
    <div className="portal">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Author Portal</h2>
        <button onClick={() => onLogout()} style={{ height: '100%', backgroundColor: '#ffb86c' }}>Log Out</button>
      </div>
      <p>Welcome, {currentUser.username}! This is your dashboard.</p>
      <NotificationBoard currentUser={currentUser} />
      <PublishPage currentUser={currentUser} />
      <ManageProfileScreen
        currentUser={currentUser}
        onProfileUpdated={onProfileUpdated}
        onForceLogout={onLogout}
      />
    </div>
  );
};

export default AuthorPortal;
