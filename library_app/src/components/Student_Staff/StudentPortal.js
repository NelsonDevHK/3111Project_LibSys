import React from 'react';
import BookBorrowSection from './BookBorrowSection';
import ManageProfileScreen from '../ManageProfileScreen';
import NotificationBoard from '../NotificationBoard';

function getProfilePicturePreview(profilePicture) {
  return typeof profilePicture === 'string' && profilePicture ? profilePicture : '';
}

function StudentPortal({ currentUser, onLogout, onProfileUpdated }) {
  const profilePicturePreview = getProfilePicturePreview(currentUser?.profilePicture);

  return (
    <div className="portal">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {profilePicturePreview ? (
            <img
              src={profilePicturePreview}
              alt={`${currentUser?.fullName || currentUser?.username || 'Student'} avatar`}
              style={{ width: '56px', height: '56px', objectFit: 'cover', borderRadius: '50%', border: '2px solid #ffb86c' }}
            />
          ) : null}
          <div>
            <h2 style={{ marginBottom: '4px' }}>Student Portal</h2>
            <p style={{ margin: 0, opacity: 0.8 }}>Welcome, {currentUser ? currentUser.username : 'Student'}! This is your dashboard.</p>
          </div>
        </div>
        <button onClick={() => onLogout()} style={{ height: '100%', backgroundColor: '#ffb86c' }}>Log Out</button>
      </div>
      <NotificationBoard currentUser={currentUser} />
      <BookBorrowSection currentUser={currentUser} />
      <ManageProfileScreen
        currentUser={currentUser}
        onProfileUpdated={onProfileUpdated}
        onForceLogout={onLogout}
      />
    </div>
  );
}

export default StudentPortal;
