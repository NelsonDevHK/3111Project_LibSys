import React, { useState } from 'react';
import PublishPage from './PublishPage';
import ManageProfileScreen from '../ManageProfileScreen';
import NotificationBoard from '../NotificationBoard';
import PublishedBooksScreen from './PublishedBooksScreen';
import AuthorStatisticsScreen from './AuthorStatisticsScreen';

const AuthorPortal = ({ currentUser, onLogout, onProfileUpdated }) => {
  const [publishRefreshKey, setPublishRefreshKey] = useState(0);

  const handleBookPublished = () => {
    // Increment the refresh key to trigger a refetch in PublishedBooksScreen
    setPublishRefreshKey(prev => prev + 1);
  };

  return (
    <div className="portal">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Author Portal</h2>
        <button onClick={() => onLogout()} style={{ height: '100%', backgroundColor: '#ffb86c' }}>Log Out</button>
      </div>
      <p>Welcome, {currentUser.username}! This is your dashboard.</p>
      <NotificationBoard currentUser={currentUser} />
        <AuthorStatisticsScreen currentUser={currentUser} />
      <PublishedBooksScreen currentUser={currentUser} refreshKey={publishRefreshKey} />
      <PublishPage currentUser={currentUser} onBookPublished={handleBookPublished} />
      <ManageProfileScreen
        currentUser={currentUser}
        onProfileUpdated={onProfileUpdated}
        onForceLogout={onLogout}
      />
    </div>
  );
};

export default AuthorPortal;
