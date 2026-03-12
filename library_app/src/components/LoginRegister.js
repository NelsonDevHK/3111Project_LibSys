import React, { useState } from 'react';
import StudentPortal from './StudentPortal';
import StaffPortal from './StaffPortal';
import AuthorPortal from './AuthorPortal';
import LibrarianPortal from './LibrarianPortal';

function validatePassword(password) {
  const minLength = 8;
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  return password.length >= minLength && hasLetter && hasNumber;
}

function LoginRegister() {
  const [isRegister, setIsRegister] = useState(false);
  const [form, setForm] = useState({ username: '', password: '', fullName: '', role: 'student', bio: '', employeeId: '' });
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [portalRole, setPortalRole] = useState(null); // null or 'student'|'staff'|'author'|'librarian'
  
  // add state variable to hold current user info for AuthorPortal
  const [currentUser, setCurrentUser] = useState(null);


  const handleChange = e => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const toggleForm = () => {
    setIsRegister(!isRegister);
    setMessage('');
    setMessageType('');
    setForm({ username: '', password: '', fullName: '', role: 'student', bio: '', employeeId: '' });
  };

  // Always reset role to 'student' when switching forms or after login
  React.useEffect(() => {
    setForm(form => ({ ...form, role: 'student' }));
  }, [isRegister]);

  const handleSubmit = async e => {
    e.preventDefault();
    setMessage('');
    setMessageType('');
    if (isRegister) {
      if (!form.username) {
        setMessage('Username cannot be empty.');
        setMessageType('error');
        return;
      }
      if (!form.fullName) {
        setMessage('Full Name cannot be empty.');
        setMessageType('error');
        return;
      }
      if (!validatePassword(form.password)) {
        setMessage('Password must be at least 8 characters, include a letter and a number.');
        setMessageType('error');
        return;
      }
      // Prepare payload
      // payload: registration data sent to backend
      // Contains username, fullName, password, role, and optionally bio/employeeId
      const payload = {
        username: form.username,
        fullName: form.fullName,
        password: form.password,
        role: form.role
      };
      if (form.role === 'author') payload.bio = form.bio;
      if (form.role === 'librarian') payload.employeeId = form.employeeId;
      try {
        const res = await fetch('http://localhost:4000/api/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (res.ok) {
          setMessage('Registration successful! You can now log in.');
          setMessageType('success');
          setForm({ username: '', password: '', fullName: '', role: 'student', bio: '', employeeId: '' });
          setIsRegister(false);
        } else {
          setMessage(data.error || 'Registration failed.');
          setMessageType('error');
        }
      } catch (err) {
        setMessage('Server error.');
        setMessageType('error');
      }
    } else {
      // Login
      try {
        const res = await fetch('http://localhost:4000/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: form.username, password: form.password, role: form.role })
        });
        const data = await res.json();
        if (res.ok) {
          setMessage(`Login successful! Welcome, ${data.user.fullName} (${data.user.role})`);
          setMessageType('success');
          setPortalRole(data.user.role); // Set portal role for routing
          setCurrentUser(data.user); // !!! This probably should be changed for all Portal logic to access user info, not just role
        } else {
          setMessage(data.error || 'Login failed.');
          setMessageType('error');
        }
      } catch (err) {
        setMessage('Server error.');
        setMessageType('error');
      }
    }
  };

  if (portalRole === 'student') return <StudentPortal currentUser={currentUser} />;
  if (portalRole === 'staff') return <StaffPortal />;
  if (portalRole === 'author') return <AuthorPortal currentUser={currentUser} />; // Other portals should be changed too i think
  if (portalRole === 'librarian') return <LibrarianPortal />;

  return (
    <div className="container">
      <h2>{isRegister ? 'Register' : 'Login'}</h2>
      <form onSubmit={handleSubmit}>
        {isRegister && (
          <>
            <label htmlFor="fullName">Full Name</label>
            <input type="text" id="fullName" name="fullName" value={form.fullName} onChange={handleChange} required />
            {/* Role selection for registration */}
            <label htmlFor="role">Role</label>
            <select id="role" name="role" value={form.role} onChange={handleChange}>
              <option value="student">Student</option>
              <option value="staff">Staff</option>
              <option value="author">Author</option>
              <option value="librarian">Librarian</option>
            </select>
            {form.role === 'author' && (
              <>
                <label htmlFor="bio">Bio (optional)</label>
                <input type="text" id="bio" name="bio" value={form.bio} onChange={handleChange} />
              </>
            )}
            {form.role === 'librarian' && (
              <>
                <label htmlFor="employeeId">Employee ID (optional)</label>
                <input type="text" id="employeeId" name="employeeId" value={form.employeeId} onChange={handleChange} />
              </>
            )}
          </>
        )}
        {/* Always show role selection for login */}
        {!isRegister && (
          <>
            <label htmlFor="role">Role</label>
            <select id="role" name="role" value={form.role} onChange={handleChange}>
              <option value="student">Student</option>
              <option value="staff">Staff</option>
              <option value="author">Author</option>
              <option value="librarian">Librarian</option>
            </select>
          </>
        )}
        <label htmlFor="username">Username</label>
        <input type="text" id="username" name="username" value={form.username} onChange={handleChange} required />
        <label htmlFor="password">Password</label>
        <input type="password" id="password" name="password" value={form.password} onChange={handleChange} required />
        <button type="submit">{isRegister ? 'Register' : 'Login'}</button>
        {message && <div className={messageType}>{message}</div>}
      </form>
      <button className="toggle" onClick={toggleForm}>
        {isRegister ? 'Already have an account? Login' : "Don't have an account? Register"}
      </button>
    </div>
  );
}

export default LoginRegister;