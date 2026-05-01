import React from 'react';
import BookBorrowSection from './BookBorrowSection';
import ManageProfileScreen from '../ManageProfileScreen';
import NotificationBoard from '../NotificationBoard';
import ReadingHistoryScreen from './ReadingHistoryScreen';

function StudentPortal({ currentUser, onLogout, onProfileUpdated }) {
  return (
    <div className="portal">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Student Portal</h2>
        <button onClick={() => onLogout()} style={{ height: '100%', backgroundColor: '#ffb86c' }}>Log Out</button>
      </div>
      <p>Welcome, {currentUser ? currentUser.username : 'Student'}! This is your dashboard.</p>
      <NotificationBoard currentUser={currentUser} />
      <BookBorrowSection currentUser={currentUser} />
      <ReadingHistoryScreen currentUser={currentUser} />
      <ManageProfileScreen
        currentUser={currentUser}
        onProfileUpdated={onProfileUpdated}
        onForceLogout={onLogout}
      />
    </div>
  );
}

export default StudentPortal;
