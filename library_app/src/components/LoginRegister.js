import React, { useState } from 'react';

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

  const handleChange = e => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const toggleForm = () => {
    setIsRegister(!isRegister);
    setMessage('');
    setMessageType('');
    setForm({ username: '', password: '', fullName: '', role: 'student', bio: '', employeeId: '' });
  };

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