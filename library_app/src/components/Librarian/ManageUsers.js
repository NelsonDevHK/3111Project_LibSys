import React, { useState, useEffect } from 'react';
import "../../App.css";

const ManageUsers = () => {
  const [users, setUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingUser, setEditingUser] = useState(null);

  useEffect(() => {
    // Fetch users from the server API
    fetch("/users")
      .then((response) => {
        if (!response.ok) {
          throw new Error("Failed to fetch users");
        }
        return response.json();
      })
      .then((data) => setUsers(data))
      .catch((error) => console.error("Error fetching users:", error));
  }, []);

  const handleEdit = (user) => {
    setEditingUser(user);
  };

  const handleDeactivate = (userId) => {
    if (window.confirm("Are you sure you want to deactivate this user?")) {
      fetch(`/users/${userId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "deactivated" }),
      })
        .then(() => {
          setUsers((prevUsers) =>
            prevUsers.map((user) =>
              user.id === userId ? { ...user, status: "deactivated" } : user
            )
          );
        })
        .catch((error) => console.error("Error deactivating user:", error));
    }
  };

  const handleSearch = (event) => {
    setSearchTerm(event.target.value);
  };

  const filteredUsers = users.filter(
    (user) =>
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.role.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="manage-users">
      <h1>Manage Users</h1>
      <input
        type="text"
        placeholder="Search by name or role"
        value={searchTerm}
        onChange={handleSearch}
      />
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Name</th>
            <th>Role</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {filteredUsers.map((user) => (
            <tr key={user.id}>
              <td>{user.id}</td>
              <td>{user.name}</td>
              <td>{user.role}</td>
              <td>{user.status}</td>
              <td>
                <button onClick={() => handleEdit(user)}>Edit</button>
                <button onClick={() => handleDeactivate(user.id)}>
                  {user.status === "active" ? "Deactivate" : "Reactivate"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {editingUser && (
        <div className="edit-modal">
          <h2>Edit User</h2>
          <form>
            <label>
              Name:
              <input
                type="text"
                value={editingUser.name}
                onChange={(e) =>
                  setEditingUser({ ...editingUser, name: e.target.value })
                }
              />
            </label>
            <label>
              Role:
              <select
                value={editingUser.role}
                onChange={(e) =>
                  setEditingUser({ ...editingUser, role: e.target.value })
                }
              >
                <option value="Student">Student</option>
                <option value="Staff">Staff</option>
                <option value="Author">Author</option>
                <option value="Librarian">Librarian</option>
              </select>
            </label>
            <button
              type="button"
              onClick={() => {
                fetch(`/users/${editingUser.id}`, {
                  method: "PUT",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(editingUser),
                })
                  .then(() => {
                    setUsers((prevUsers) =>
                      prevUsers.map((user) =>
                        user.id === editingUser.id ? editingUser : user
                      )
                    );
                    setEditingUser(null);
                  })
                  .catch((error) => console.error("Error updating user:", error));
              }}
            >
              Save
            </button>
            <button type="button" onClick={() => setEditingUser(null)}>
              Cancel
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

export default ManageUsers;