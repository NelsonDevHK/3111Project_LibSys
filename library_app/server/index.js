// server/index.js
const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const app = express();
const PORT = 4000;

app.use(cors());
app.use(express.json());

const USERS_FILE = path.join(__dirname, 'users.json');

function readUsers() {
  const data = fs.readFileSync(USERS_FILE, 'utf-8');
  return JSON.parse(data).users;
}

function writeUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify({ users }, null, 2));
}

// Registration endpoint
app.post('/api/register', (req, res) => {
  const { username, fullName, password, role, bio, employeeId } = req.body;
  if (!username || !fullName || !password || !role) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }
  const users = readUsers();
  if (users.some(u => u.username === username)) {
    return res.status(409).json({ error: 'Username already exists.' });
  }
  const newUser = { username, fullName, password, role };
  if (role === 'author' && bio) newUser.bio = bio;
  if (role === 'librarian' && employeeId) newUser.employeeId = employeeId;
  users.push(newUser);
  writeUsers(users);
  res.json({ message: 'Registration successful!' });
});

// Login endpoint
app.post('/api/login', (req, res) => {
  const { username, password, role } = req.body;
  const users = readUsers();
  const user = users.find(u => u.username === username && u.password === password && u.role === role);
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials.' });
  }
  res.json({ message: 'Login successful!', user });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
