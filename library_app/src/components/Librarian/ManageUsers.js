import React, { useEffect, useState } from 'react';
import '../../App.css';

const EMPTY_NEW_USER = {
  username: '',
  fullName: '',
  password: '',
  role: 'student',
  bio: '',
  employeeId: '',
};

const ManageUsers = ({ currentUser }) => {
  const [users, setUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [editingUser, setEditingUser] = useState(null);
  const [viewingUser, setViewingUser] = useState(null);
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [bulkAction, setBulkAction] = useState('deactivate');
  const [bulkRole, setBulkRole] = useState('student');
  const [newUser, setNewUser] = useState(EMPTY_NEW_USER);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchUsers = () => {
    setLoading(true);
    setError('');

    fetch('http://localhost:4000/api/users')
      .then((response) => {
        if (!response.ok) {
          throw new Error('Failed to fetch users');
        }

        return response.json();
      })
      .then((data) => {
        setUsers(Array.isArray(data) ? data : []);
      })
      .catch((fetchError) => {
        console.error('Error fetching users:', fetchError);
        setError('Unable to load users. Please check server status and try again.');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const isSelfManagedUser = (user) => Boolean(currentUser?.username && user?.username === currentUser.username);

  const handleSearch = (event) => {
    setSearchTerm(event.target.value);
  };

  const filteredUsers = users.filter((user) => {
    const normalizedSearch = searchTerm.toLowerCase();
    const userName = String(user.name || user.fullName || '').toLowerCase();
    const username = String(user.username || '').toLowerCase();
    const role = String(user.role || '').toLowerCase();
    const status = String(user.status || '').toLowerCase();

    const matchesSearch =
      userName.includes(normalizedSearch) ||
      username.includes(normalizedSearch) ||
      role.includes(normalizedSearch);

    const matchesStatus = statusFilter === 'all' || status === statusFilter;
    const matchesRole = roleFilter === 'all' || role === roleFilter;

    return matchesSearch && matchesStatus && matchesRole;
  });

  const selectableVisibleUsers = filteredUsers.filter((user) => !isSelfManagedUser(user));

  const allVisibleSelected =
    selectableVisibleUsers.length > 0 &&
    selectableVisibleUsers.every((user) => selectedUserIds.includes(user.id));

  const toggleUserSelection = (userId) => {
    setSelectedUserIds((prev) => {
      if (prev.includes(userId)) {
        return prev.filter((entry) => entry !== userId);
      }

      return [...prev, userId];
    });
  };

  const toggleSelectAllVisible = () => {
    const visibleIds = selectableVisibleUsers.map((user) => user.id);
    const areAllSelected = visibleIds.every((id) => selectedUserIds.includes(id));

    if (areAllSelected) {
      setSelectedUserIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
      return;
    }

    setSelectedUserIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
  };

  const formatLastLogin = (value) => {
    if (!value) {
      return 'Never';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return 'Unknown';
    }

    return date.toLocaleString();
  };

  const handleNewUserChange = (event) => {
    const { name, value } = event.target;
    setNewUser((prev) => ({ ...prev, [name]: value }));
    setError('');
  };

  const handleCreateUser = () => {
    const username = String(newUser.username || '').trim();
    const fullName = String(newUser.fullName || '').trim();
    const password = String(newUser.password || '');
    const role = String(newUser.role || '').toLowerCase().trim();

    if (!username || !fullName || !password || !role) {
      setError('Username, full name, password, and role are required.');
      return;
    }

    if (password.length < 8 || !/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
      setError('Password must be at least 8 characters, include a letter and a number.');
      return;
    }

    if (!['student', 'staff', 'author', 'librarian'].includes(role)) {
      setError('Invalid role selected.');
      return;
    }

    setError('');

    fetch('http://localhost:4000/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username,
        fullName,
        password,
        role,
        bio: role === 'author' ? newUser.bio : undefined,
        employeeId: role === 'librarian' ? newUser.employeeId : undefined,
      }),
    })
      .then((response) => {
        if (!response.ok) {
          return response.json().then((data) => {
            throw new Error(data.error || 'Failed to create user');
          });
        }

        return response.json();
      })
      .then((data) => {
        setUsers((prevUsers) => [data.user, ...prevUsers]);
        setNewUser(EMPTY_NEW_USER);
        setSelectedUserIds([]);
      })
      .catch((createError) => {
        console.error('Error creating user:', createError);
        setError(createError.message || 'Failed to create user.');
      });
  };

  const handleStatusChange = (user, nextStatus) => {
    if (isSelfManagedUser(user)) {
      setError('Use Manage Profile for your own account changes.');
      return;
    }

    const actionLabel = nextStatus === 'deactivated' ? 'deactivate' : 'reactivate';
    if (!window.confirm(`Are you sure you want to ${actionLabel} ${user.username}?`)) {
      return;
    }

    fetch(`http://localhost:4000/api/users/${encodeURIComponent(user.id)}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: nextStatus }),
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error('Failed to update user status');
        }

        return response.json();
      })
      .then((updatedUser) => {
        setUsers((prevUsers) =>
          prevUsers.map((entry) => (entry.id === updatedUser.id ? updatedUser : entry))
        );
      })
      .catch((statusError) => {
        console.error('Error updating user status:', statusError);
        setError('Failed to update user status.');
      });
  };

  const handleBulkAction = () => {
    const eligibleUserIds = selectedUserIds.filter((id) => {
      const user = users.find((entry) => entry.id === id);
      return user && !isSelfManagedUser(user);
    });

    if (eligibleUserIds.length === 0) {
      setError('Select at least one user for bulk action.');
      return;
    }

    const actionDescription =
      bulkAction === 'update-role' ? `update role to ${bulkRole}` : bulkAction;

    if (!window.confirm(`Confirm bulk action: ${actionDescription} for ${eligibleUserIds.length} user(s)?`)) {
      return;
    }

    setError('');
    fetch('http://localhost:4000/api/users/bulk', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userIds: eligibleUserIds,
        action: bulkAction,
        updates: bulkAction === 'update-role' ? { role: bulkRole } : undefined,
      }),
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error('Failed to apply bulk action');
        }

        return response.json();
      })
      .then(() => {
        setSelectedUserIds([]);
        fetchUsers();
      })
      .catch((bulkError) => {
        console.error('Error applying bulk action:', bulkError);
        setError('Failed to apply bulk action.');
      });
  };

  const handleSaveEdit = () => {
    if (!editingUser) {
      return;
    }

    if (isSelfManagedUser(editingUser)) {
      setError('Use Manage Profile for your own account changes.');
      return;
    }

    const fullName = String(editingUser.fullName || '').trim();
    const role = String(editingUser.role || '').toLowerCase().trim();

    if (!fullName) {
      setError('Full name cannot be empty.');
      return;
    }

    if (!['student', 'staff', 'author', 'librarian'].includes(role)) {
      setError('Invalid role selected.');
      return;
    }

    if (!window.confirm(`Save changes for ${editingUser.username}?`)) {
      return;
    }

    fetch(`http://localhost:4000/api/users/${encodeURIComponent(editingUser.id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName,
        role,
        status: editingUser.status,
        employeeId: editingUser.employeeId,
        bio: editingUser.bio,
      }),
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error('Failed to update user');
        }

        return response.json();
      })
      .then((updatedUser) => {
        setUsers((prevUsers) =>
          prevUsers.map((entry) => (entry.id === updatedUser.id ? updatedUser : entry))
        );
        setEditingUser(null);
      })
      .catch((saveError) => {
        console.error('Error updating user:', saveError);
        setError('Failed to update user.');
      });
  };

  return (
    <div className="manage-users">
      <h1>Manage Users</h1>
      <p className="section-intro">Create accounts, manage roles, and filter librarian records from this screen.</p>
      {error && <p className="error">{error}</p>}

      <div className="manage-users-panel">
        <h2>Add New User</h2>
        <div className="filters">
          <input
            type="text"
            name="username"
            placeholder="Username"
            value={newUser.username}
            onChange={handleNewUserChange}
          />
          <input
            type="text"
            name="fullName"
            placeholder="Full name"
            value={newUser.fullName}
            onChange={handleNewUserChange}
          />
          <input
            type="password"
            name="password"
            placeholder="Temporary password"
            value={newUser.password}
            onChange={handleNewUserChange}
          />
          <select name="role" value={newUser.role} onChange={handleNewUserChange}>
            <option value="student">Student</option>
            <option value="staff">Staff</option>
            <option value="author">Author</option>
            <option value="librarian">Librarian</option>
          </select>
        </div>
        <div className="filters">
          {newUser.role === 'author' && (
            <input
              type="text"
              name="bio"
              placeholder="Author bio (optional)"
              value={newUser.bio}
              onChange={handleNewUserChange}
            />
          )}
          {newUser.role === 'librarian' && (
            <input
              type="text"
              name="employeeId"
              placeholder="Employee ID (optional)"
              value={newUser.employeeId}
              onChange={handleNewUserChange}
            />
          )}
          <button type="button" onClick={handleCreateUser}>Create User</button>
        </div>
      </div>

      <div className="filters">
        <input
          type="text"
          placeholder="Search by name, username, or role"
          value={searchTerm}
          onChange={handleSearch}
        />
        <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
          <option value="all">All Roles</option>
          <option value="student">Student</option>
          <option value="staff">Staff</option>
          <option value="author">Author</option>
          <option value="librarian">Librarian</option>
        </select>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="deactivated">Deactivated</option>
        </select>
      </div>

      <div className="filters">
        <label>
          Bulk Action:
          <select value={bulkAction} onChange={(event) => setBulkAction(event.target.value)}>
            <option value="deactivate">Deactivate</option>
            <option value="reactivate">Reactivate</option>
            <option value="update-role">Update Role</option>
          </select>
        </label>
        {bulkAction === 'update-role' && (
          <label>
            Target Role:
            <select value={bulkRole} onChange={(event) => setBulkRole(event.target.value)}>
              <option value="student">Student</option>
              <option value="staff">Staff</option>
              <option value="author">Author</option>
              <option value="librarian">Librarian</option>
            </select>
          </label>
        )}
        <button type="button" onClick={handleBulkAction}>Apply Bulk Action</button>
      </div>

      {loading && <p>Loading users...</p>}
      <table>
        <thead>
          <tr>
            <th>
              <input
                type="checkbox"
                checked={allVisibleSelected}
                onChange={toggleSelectAllVisible}
                aria-label="Select all visible users"
              />
            </th>
            <th>Username</th>
            <th>Name</th>
            <th>Role</th>
            <th>Status</th>
            <th>Last Login</th>
            <th>Borrowed Now</th>
            <th>Total Borrowed</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {filteredUsers.map((user) => (
            <tr key={user.id}>
              <td>
                <input
                  type="checkbox"
                  checked={selectedUserIds.includes(user.id)}
                  onChange={() => toggleUserSelection(user.id)}
                  aria-label={`Select user ${user.username}`}
                />
              </td>
              <td>{user.username}</td>
              <td>{user.name || user.fullName}</td>
              <td>{user.role}</td>
              <td>{user.status}</td>
              <td>{formatLastLogin(user.activity?.lastLoginAt)}</td>
              <td>{user.activity?.borrowedBooksCount ?? 0}</td>
              <td>{user.activity?.totalBorrowedCount ?? 0}</td>
              <td>
                <button type="button" onClick={() => setViewingUser(user)}>View</button>
                <button type="button" onClick={() => setEditingUser(user)} disabled={isSelfManagedUser(user)}>Edit</button>
                <button
                  type="button"
                  onClick={() => handleStatusChange(user, user.status === 'active' ? 'deactivated' : 'active')}
                  disabled={isSelfManagedUser(user)}
                >
                  {user.status === 'active' ? 'Deactivate' : 'Reactivate'}
                </button>
                {isSelfManagedUser(user) && <span className="self-account-tag">Manage in profile</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {viewingUser && (
        <div className="edit-modal">
          <h2>View User</h2>
          <p><strong>Username:</strong> {viewingUser.username}</p>
          <p><strong>Full Name:</strong> {viewingUser.fullName || viewingUser.name}</p>
          <p><strong>Role:</strong> {viewingUser.role}</p>
          <p><strong>Status:</strong> {viewingUser.status}</p>
          <p><strong>Last Login:</strong> {formatLastLogin(viewingUser.activity?.lastLoginAt)}</p>
          <p><strong>Borrowed Now:</strong> {viewingUser.activity?.borrowedBooksCount ?? 0}</p>
          <p><strong>Total Borrowed:</strong> {viewingUser.activity?.totalBorrowedCount ?? 0}</p>
          <button type="button" onClick={() => setViewingUser(null)}>Close</button>
        </div>
      )}

      {editingUser && (
        <div className="edit-modal">
          <h2>Edit User</h2>
          <form>
            <label>
              Name:
              <input
                type="text"
                value={editingUser.fullName || ''}
                onChange={(event) =>
                  setEditingUser({ ...editingUser, fullName: event.target.value })
                }
              />
            </label>
            <label>
              Role:
              <select
                value={editingUser.role}
                disabled={isSelfManagedUser(editingUser)}
                onChange={(event) =>
                  setEditingUser({ ...editingUser, role: event.target.value.toLowerCase() })
                }
              >
                <option value="student">Student</option>
                <option value="staff">Staff</option>
                <option value="author">Author</option>
                <option value="librarian">Librarian</option>
              </select>
            </label>
            <label>
              Status:
              <select
                value={editingUser.status}
                disabled={isSelfManagedUser(editingUser)}
                onChange={(event) => setEditingUser({ ...editingUser, status: event.target.value })}
              >
                <option value="active">Active</option>
                <option value="deactivated">Deactivated</option>
              </select>
            </label>
            <button type="button" onClick={handleSaveEdit}>Save</button>
            <button
              type="button"
              onClick={() => {
                setEditingUser(null);
                setError('');
              }}
            >
              Cancel
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

export default ManageUsers;