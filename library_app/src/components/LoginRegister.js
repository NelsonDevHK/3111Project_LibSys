import React, { useState } from 'react';


// Use localStorage for persistent user storage
function getStoredUsers() {
  const data = localStorage.getItem('users');
  return data ? JSON.parse(data) : [];
}

function saveUsers(users) {
  localStorage.setItem('users', JSON.stringify(users));
}

function validatePassword(password) {
  const minLength = 8;
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  return password.length >= minLength && hasLetter && hasNumber;
}

function isUsernameUnique(username) {
  const users = getStoredUsers();
  return !users.some(user => user.username === username);
}


function LoginRegister() {

  const [isRegister, setIsRegister] = useState(false);
  const [form, setForm] = useState({ username: '', password: '', fullName: '', role: 'student' });
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');

  const handleChange = e => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const toggleForm = () => {
    setIsRegister(!isRegister);
    setMessage('');
    setMessageType('');
    setForm({ username: '', password: '', fullName: '', role: 'student' });
  };

  const handleSubmit = e => {
    e.preventDefault();
    setMessage('');
    setMessageType('');
    if (isRegister) {
      if (!isUsernameUnique(form.username)) {
        setMessage('Username already exists.');
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
      const users = getStoredUsers();
      users.push({ ...form });
      saveUsers(users);
      setMessage('Registration successful! You can now log in.');
      setMessageType('success');
      setForm({ username: '', password: '', fullName: '', role: 'student' });
      setIsRegister(false);
    } else {
      const users = getStoredUsers();
      const user = users.find(u => u.username === form.username && u.password === form.password);
      if (user) {
        setMessage(`Login successful! Welcome, ${user.fullName} (${user.role})`);
        setMessageType('success');
      } else {
        setMessage('Invalid username or password.');
        setMessageType('error');
      }
    }
  };

  return (
    <div className="container" style={{ maxWidth: 350, margin: '60px auto', background: '#fff', padding: '24px 32px', borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.07)' }}>
      <h2>{isRegister ? 'Register' : 'Login'}</h2>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {isRegister && (
          <>
            <label htmlFor="fullName">Full Name</label>
            <input type="text" id="fullName" name="fullName" value={form.fullName} onChange={handleChange} required />
            <label htmlFor="role">Role</label>
            <select id="role" name="role" value={form.role} onChange={handleChange}>
              <option value="student">Student</option>
              <option value="staff">Staff</option>
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
      <button className="toggle" onClick={toggleForm} style={{ background: 'none', color: '#007bff', border: 'none', cursor: 'pointer', textDecoration: 'underline', marginTop: 8 }}>
        {isRegister ? 'Already have an account? Login' : "Don't have an account? Register"}
      </button>
    </div>
  );
}

export default LoginRegister;
