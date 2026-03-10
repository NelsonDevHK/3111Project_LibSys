const multer = require('multer');
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

// Author helper to handle book publishing with file upload

// Pending books helpers (updated to handle errors)
function readPendingBooks() {
  const filePath = path.join(__dirname, 'pendingBooks.json');
  if (!fs.existsSync(filePath)) {
    return [];
  }
  try {
    const data = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(data);
    return parsed.pendingBooks || [];  // Fallback if pendingBooks key is missing
  } catch (err) {
    console.error('Error reading pendingBooks.json:', err);
    return [];  // Return empty array on error
  }
}
function writePendingBooks(pendingBooks) {
  fs.writeFileSync(path.join(__dirname, 'pendingBooks.json'), JSON.stringify({ pendingBooks }, null, 2));
}

// ensure upload directory exists (no subfolders)
const assetsDir = path.join(__dirname, 'bookAssets');
if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir);

// storage + filtering (simplified – everything goes to assetsDir)
const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, assetsDir);  // all files (PDF + cover) go here
  },
  filename(req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  if (file.fieldname === 'file') {
    // book must be PDF
    if (file.mimetype === 'application/pdf') cb(null, true);
    else cb(new Error('Book must be a PDF'));
  } else if (file.fieldname === 'cover') {
    // optional cover must be jpg/png
    if (['image/jpeg', 'image/png'].includes(file.mimetype)) cb(null, true);
    else cb(new Error('Cover image must be JPEG or PNG'));
  } else {
    cb(null, false);
  }
};

// 10‑MB limit on any single file
const upload = multer({ storage, fileFilter, limits: { fileSize: 10 * 1024 * 1024 } });

app.post('/api/publish',
    upload.fields([{ name: 'file', maxCount: 1 }, { name: 'cover', maxCount: 1 }]),
    (req, res) => {
  // console.log('Received publish request', req.body, req.files);
  try {
    const { title, authorUsername, genre, description } = req.body;
    if (!title || !authorUsername || !genre || !description || !req.files.file) {
      return res.status(400).json({ error: 'All fields required' });
    }

    const pendingBooks = readPendingBooks();

    const pdfFile = req.files.file[0];
    const coverFile = req.files.cover && req.files.cover[0];

    const relativePdfPath = path.relative(__dirname, pdfFile.path);
    const relativeCoverPath = coverFile ? path.relative(__dirname, coverFile.path) : '';

    const newBook = {
      id: Date.now(),
      title,
      authorUsername,
      genre,
      description,
      filePath: relativePdfPath,
      coverPath: relativeCoverPath,
      status: 'pending',
    };
    pendingBooks.push(newBook);
    writePendingBooks(pendingBooks);

    res.status(200).json({ message: 'Book submitted' });
  } catch (err) {
    console.error('publish error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// End of Author helper


// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
