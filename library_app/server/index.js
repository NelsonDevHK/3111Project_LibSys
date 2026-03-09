const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

// File paths
const USERS_FILE = path.join(__dirname, 'users.json');
const BOOKS_FILE = path.join(__dirname, 'books.json');

// Ignore already taken care
const app = express();
const PORT = 4000;
app.use(cors());
app.use(express.json());

// User helpers
function readUsers() {
  const data = fs.readFileSync(USERS_FILE, 'utf-8');
  return JSON.parse(data).users;
}
function writeUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify({ users }, null, 2));
}

// Book helpers
function readBooks() {
  const data = fs.readFileSync(BOOKS_FILE, 'utf-8');
  return JSON.parse(data).books;
}
function writeBooks(books) {
  fs.writeFileSync(BOOKS_FILE, JSON.stringify({ books }, null, 2));
}

// Ignore already taken care
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

app.post('/api/login', (req, res) => {
  const { username, password, role } = req.body;
  const users = readUsers();
  const user = users.find(u => u.username === username && u.password === password && u.role === role);
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials.' });
  }
  res.json({ message: 'Login successful!', user });
});

// Ennnnnnnnnnnnd Ignore already taken care

// Book routes
app.get('/api/books', (req, res) => {
  const books = readBooks();
  res.json({ books });
});

app.post('/api/borrow', (req, res) => {
  const { bookId } = req.body;
  if (!bookId) return res.status(400).json({ error: 'Missing bookId.' });
  const books = readBooks();
  const book = books.find(b => b.id === bookId);
  if (!book) return res.status(404).json({ error: 'Book not found.' });
  if (book.status !== 'available') return res.status(409).json({ error: 'Book is not available.' });
  book.status = 'borrowed';
  writeBooks(books);
  res.json({ message: 'Book borrowed successfully!', book });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
