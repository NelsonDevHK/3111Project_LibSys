const multer = require('multer');
const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const { randomUUID } = require('crypto');

// File paths
const USERS_FILE = path.join(__dirname, 'users.json');
const BOOKS_FILE = path.join(__dirname, 'books.json');
const REJECTION_REASONS_FILE = path.join(__dirname, 'rejectionReason.json');

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

function readRejectionReasons() {
  if (!fs.existsSync(REJECTION_REASONS_FILE)) {
    return {};
  }
  try {
    const data = fs.readFileSync(REJECTION_REASONS_FILE, 'utf-8');
    const parsed = JSON.parse(data);
    let didNormalize = false;

    // Normalize legacy schema where values were plain strings.
    Object.keys(parsed).forEach((authorUsername) => {
      const entries = Array.isArray(parsed[authorUsername]) ? parsed[authorUsername] : [];
      parsed[authorUsername] = entries.map((entry) => {
        if (typeof entry === 'string') {
          didNormalize = true;
          return {
            id: randomUUID(),
            bookTitle: '',
            rejectionReason: entry,
            hidden: false,
          };
        }

        if (!entry || typeof entry !== 'object') {
          didNormalize = true;
          return {
            id: randomUUID(),
            bookTitle: '',
            rejectionReason: '',
            hidden: false,
          };
        }

        const normalizedEntry = {
          id: entry.id || randomUUID(),
          bookTitle: entry.bookTitle || '',
          rejectionReason: entry.rejectionReason || '',
          hidden: typeof entry.hidden === 'boolean' ? entry.hidden : false,
        };

        if (
          normalizedEntry.bookTitle !== entry.bookTitle ||
          normalizedEntry.rejectionReason !== entry.rejectionReason ||
          normalizedEntry.hidden !== entry.hidden
        ) {
          didNormalize = true;
        }

        return normalizedEntry;
      });
    });

    if (didNormalize) {
      writeRejectionReasons(parsed);
    }

    return parsed;
  } catch (err) {
    console.error('Error reading rejectionReason.json:', err);
    return {};
  }
}

function writeRejectionReasons(rejectionReasons) {
  fs.writeFileSync(REJECTION_REASONS_FILE, JSON.stringify(rejectionReasons, null, 2));
}

function addRejectionReason(authorUsername, bookTitle, rejectionReason, hidden = false) {
  const rejectionReasons = readRejectionReasons();
  if (!rejectionReasons[authorUsername]) {
    rejectionReasons[authorUsername] = [];
  }

  rejectionReasons[authorUsername].push({
    id: randomUUID(),
    bookTitle: bookTitle || '',
    rejectionReason: rejectionReason.trim(),
    hidden,
  });

  writeRejectionReasons(rejectionReasons);
}

// ensure upload directory exists (no subfolders)
const assetsDir = path.join(__dirname, 'bookAssets');
if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir);

function removePendingBookAssets(book) {
  const assetPaths = [book?.filePath, book?.coverPath].filter(
    (assetPath) => typeof assetPath === 'string' && assetPath.trim()
  );

  assetPaths.forEach((assetPath) => {
    const resolvedPath = path.resolve(__dirname, assetPath);
    const relativeToAssetsDir = path.relative(assetsDir, resolvedPath);
    const isInAssetsDir =
      relativeToAssetsDir &&
      !relativeToAssetsDir.startsWith('..') &&
      !path.isAbsolute(relativeToAssetsDir);

    if (!isInAssetsDir) {
      console.warn(`Skipped deleting asset outside bookAssets: ${assetPath}`);
      return;
    }

    try {
      if (fs.existsSync(resolvedPath)) {
        fs.unlinkSync(resolvedPath);
      }
    } catch (err) {
      console.error(`Failed to delete asset ${resolvedPath}:`, err);
    }
  });
}

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
    const { title, authorUsername, authorFullName, genre, description } = req.body;
    if (!title || !authorUsername || !authorFullName || !genre  || !req.files.file) {
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
      authorFullName,
      genre,
      description,
      filePath: relativePdfPath,
      coverPath: relativeCoverPath,
      publishDate: new Date().toISOString().split('T')[0],  // Date only (YYYY-MM-DD)
      approved: false,
    };
    pendingBooks.push(newBook);
    writePendingBooks(pendingBooks);

    res.status(200).json({ message: 'Book submitted' });
  } catch (err) {
    console.error('publish error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Endpoint to fetch pending book submissions
app.get('/api/submissions', (req, res) => {
  try {
    const pendingBooks = readPendingBooks();
    res.json(pendingBooks);
  } catch (err) {
    console.error('Error fetching submissions:', err);
    res.status(500).json({ error: 'Failed to fetch submissions.' });
  }
});

// Compatibility endpoint for older flows that fetch pending books directly.
app.get('/api/pendingBooks', (req, res) => {
  try {
    const pendingBooks = readPendingBooks();
    res.json({ pendingBooks });
  } catch (err) {
    console.error('Error fetching pendingBooks:', err);
    res.status(500).json({ error: 'Failed to fetch pending books.' });
  }
});

// Compatibility endpoint for older flows that restore rejected books.
app.post('/api/pendingBooks', (req, res) => {
  try {
    const book = req.body;
    if (!book || !book.id) {
      return res.status(400).json({ error: 'Invalid book payload.' });
    }

    const pendingBooks = readPendingBooks();
    if (!pendingBooks.some((pendingBook) => pendingBook.id === book.id)) {
      pendingBooks.push(book);
      writePendingBooks(pendingBooks);
    }

    res.json({ message: 'Pending book stored.' });
  } catch (err) {
    console.error('Error storing pending book:', err);
    res.status(500).json({ error: 'Failed to store pending book.' });
  }
});

// Compatibility endpoint for older flows that save rejection reasons separately.
app.post('/api/rejectionReason', (req, res) => {
  const { authorUsername, bookTitle, rejectionReason, hidden } = req.body;

  if (!authorUsername || !rejectionReason || !rejectionReason.trim()) {
    return res.status(400).json({ error: 'authorUsername and rejectionReason are required.' });
  }

  try {
    addRejectionReason(authorUsername, bookTitle, rejectionReason, Boolean(hidden));
    res.json({ message: 'Rejection reason saved.' });
  } catch (err) {
    console.error('Error saving rejection reason:', err);
    res.status(500).json({ error: 'Failed to save rejection reason.' });
  }
});

app.get('/api/rejectionReason/:authorUsername', (req, res) => {
  const { authorUsername } = req.params;

  try {
    const rejectionReasons = readRejectionReasons();
    const authorReasons = Array.isArray(rejectionReasons[authorUsername])
      ? rejectionReasons[authorUsername]
      : [];

    const visibleReasons = authorReasons.filter((entry) => !entry.hidden);

    res.json({ rejectionReasons: visibleReasons });
  } catch (err) {
    console.error('Error fetching rejection reasons:', err);
    res.status(500).json({ error: 'Failed to fetch rejection reasons.' });
  }
});

app.delete('/api/rejectionReason/:authorUsername/:reasonId', (req, res) => {
  const { authorUsername, reasonId } = req.params;

  try {
    const rejectionReasons = readRejectionReasons();
    const authorReasons = Array.isArray(rejectionReasons[authorUsername])
      ? rejectionReasons[authorUsername]
      : null;

    const reasonIndex = authorReasons
      ? authorReasons.findIndex((entry) => entry.id === reasonId)
      : -1;

    if (!authorReasons || reasonIndex === -1) {
      return res.status(404).json({ error: 'Rejection reason not found.' });
    }

    authorReasons.splice(reasonIndex, 1);

    if (authorReasons.length === 0) {
      delete rejectionReasons[authorUsername];
    } else {
      rejectionReasons[authorUsername] = authorReasons;
    }

    writeRejectionReasons(rejectionReasons);
    res.json({ message: 'Rejection reason removed.' });
  } catch (err) {
    console.error('Error removing rejection reason:', err);
    res.status(500).json({ error: 'Failed to remove rejection reason.' });
  }
});

// Endpoint to approve or reject a book submission
app.post('/api/submissions/:id', (req, res) => {
  const { id } = req.params;
  const { isApproved, rejectionReason, sendToAuthor } = req.body;

  try {
    console.log(`Processing submission with ID: ${id}`);
    console.log(`Request body:`, req.body);

    const pendingBooks = readPendingBooks();
    console.log(`Pending books:`, pendingBooks);

    const bookIndex = pendingBooks.findIndex((b) => b.id === Number(id)); // Ensure `id` is treated as a number

    if (bookIndex === -1) {
      console.error(`Book with ID ${id} not found in pendingBooks.`);
      return res.status(404).json({ error: 'Book not found.' });
    }

    const book = pendingBooks[bookIndex];
    console.log(`Found book:`, book);

    if (isApproved) {
      const books = readBooks();
      book.status = 'available'; // Set the status to 'available' instead of 'borrowed'
      book.approved = true;
      books.push(book);
      writeBooks(books);
      console.log(`Book approved and added to books.json.`);
    } else {
      if (!rejectionReason || !rejectionReason.trim()) {
        console.error(`Rejection reason is missing or empty.`);
        return res.status(400).json({ error: 'Rejection reason is required.' });
      }
      book.status = 'rejected';
      book.rejectionReason = rejectionReason;
      addRejectionReason(book.authorUsername, book.title, rejectionReason, !sendToAuthor);
      removePendingBookAssets(book);
      console.log(`Book rejected with reason: ${rejectionReason}`);
    }

    // Remove the processed book (approved or rejected) from pendingBooks
    pendingBooks.splice(bookIndex, 1);
    writePendingBooks(pendingBooks);
    console.log(`Book removed from pendingBooks.json.`);

    res.json({ message: `Submission ${isApproved ? 'approved' : 'rejected'} successfully.` });
  } catch (err) {
    console.error('Error updating submission:', err);
    res.status(500).json({ error: 'Failed to update submission.' });
  }
});

// End of Author helper


// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
