import React from 'react';
import NewBookSubmissions from './NewBookSubmissions';
import ManageProfileScreen from '../ManageProfileScreen';
import NotificationBoard from '../NotificationBoard';
import ManageUsers from './ManageUsers';
import BorrowedBooksRecord from './BorrowedBooksRecord';
import LibrarianManagePublishedBooksScreen from './LibrarianManagePublishedBooksScreen';
import LibrarianBookRequestsScreen from './LibrarianBookRequestsScreen';

function LibrarianPortal({ currentUser, onLogout, onProfileUpdated }) {
  return (
    <div className="portal">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Librarian Portal</h2>
        <button onClick={() => onLogout()} style={{ height: '100%', backgroundColor: '#ffb86c' }}>Log Out</button>
      </div>
      <p>Welcome, {currentUser ? currentUser.username : 'Librarian'}! This is your dashboard.</p>
      <NotificationBoard currentUser={currentUser} />
      <NewBookSubmissions currentUser={currentUser} />
      <LibrarianBookRequestsScreen currentUser={currentUser} />
      <LibrarianManagePublishedBooksScreen currentUser={currentUser} />
      <ManageProfileScreen
        currentUser={currentUser}
        onProfileUpdated={onProfileUpdated}
        onForceLogout={onLogout}
      />
      <ManageUsers />
      <BorrowedBooksRecord />
    </div>
  );
}

export default LibrarianPortal;
