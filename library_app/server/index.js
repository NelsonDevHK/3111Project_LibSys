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
const NOTIFICATIONS_FILE = path.join(__dirname, 'notifications.json');
const PUBLISHED_BOOKS_FILE = path.join(__dirname, 'publishedBooks.json');

// Ignore already taken care
const app = express();
const PORT = 4000;
app.use(cors());
app.use(express.json());
app.use('/bookAssets', express.static(path.join(__dirname, 'bookAssets')));

// User helpers
function readUsers() {
  const data = fs.readFileSync(USERS_FILE, 'utf-8');
  return JSON.parse(data).users;
}
function writeUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify({ users }, null, 2));
}

function validatePassword(password) {
  const minLength = 8;
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  return password.length >= minLength && hasLetter && hasNumber;
}

// Notification helpers

function createNotificationBuckets() {
  return {
    bookApprovalUpdates: [],
    bookRejectionUpdates: [],
    bookUpdates: [],
    newSubmissions: [],
    accountUpdates: [],
    dueReminders: [],
    bookDeletionNotices: [],
    other: [],
  };
}

function readNotifications() {
  if (!fs.existsSync(NOTIFICATIONS_FILE)) {
    return {};
  }

  try {
    const raw = fs.readFileSync(NOTIFICATIONS_FILE, 'utf-8');
    return raw ? JSON.parse(raw) : {};
  } catch (err) {
    console.error('Error reading notifications.json:', err);
    return {};
  }
}

function writeNotifications(notifications) {
  fs.writeFileSync(NOTIFICATIONS_FILE, JSON.stringify(notifications, null, 2));
}

function ensureUserNotifications(notifications, username) {
  if (!notifications[username] || typeof notifications[username] !== 'object') {
    notifications[username] = createNotificationBuckets();
  }

  const buckets = notifications[username];
  const defaults = createNotificationBuckets();
  Object.keys(defaults).forEach((category) => {
    if (!Array.isArray(buckets[category])) {
      buckets[category] = [];
    }
  });

  // Migrate legacy rejectionReasons array into rejection notifications.
  if (Array.isArray(buckets.rejectionReasons) && buckets.bookRejectionUpdates.length === 0) {
    buckets.bookRejectionUpdates = buckets.rejectionReasons.map((entry) => {
      const bookTitle = entry?.bookTitle || 'Untitled Book';
      const reason = entry?.rejectionReason || 'No reason provided.';
      return {
        id: entry?.id || randomUUID(),
        category: 'bookRejectionUpdates',
        message: `Book rejected: "${bookTitle}".`,
        timestamp: entry?.timestamp || new Date().toISOString(),
        unread: typeof entry?.unread === 'boolean' ? entry.unread : true,
        archived: Boolean(entry?.hidden),
        showRejectionReasonToAuthor: true,
        rejectionReason: reason,
      };
    });
    delete buckets.rejectionReasons;
  }

  // Migrate legacy announcement strings into structured notifications.
  if (Array.isArray(buckets.other)) {
    buckets.other = buckets.other.map((entry) => {
      if (typeof entry === 'string') {
        return {
          id: randomUUID(),
          category: 'other',
          message: entry,
          timestamp: new Date().toISOString(),
          unread: true,
          archived: false,
        };
      }

      return {
        id: entry?.id || randomUUID(),
        category: 'other',
        message: entry?.message || '',
        timestamp: entry?.timestamp || new Date().toISOString(),
        unread: typeof entry?.unread === 'boolean' ? entry.unread : true,
        archived: typeof entry?.archived === 'boolean' ? entry.archived : false,
      };
    });
  }

  if (Array.isArray(buckets.bookUpdates) && buckets.bookUpdates.length > 0) {
    const normalizedLegacyEntries = buckets.bookUpdates.map((entry) => {
      const normalizedEntry = entry && typeof entry === 'object' ? { ...entry } : {
        id: randomUUID(),
        category: 'bookUpdates',
        message: '',
        timestamp: new Date().toISOString(),
        unread: true,
        archived: false,
      };

      const reasonMatch = (normalizedEntry.message || '').match(/\. Reason:\s*(.*)$/);
      const extractedReason = reasonMatch ? reasonMatch[1] : '';

      if (reasonMatch) {
        normalizedEntry.message = (normalizedEntry.message || '').replace(/\. Reason:\s*.*$/, '.');
      }

      normalizedEntry.showRejectionReasonToAuthor =
        typeof normalizedEntry.showRejectionReasonToAuthor === 'boolean'
          ? normalizedEntry.showRejectionReasonToAuthor
          : Boolean(extractedReason);

      normalizedEntry.rejectionReason =
        typeof normalizedEntry.rejectionReason === 'string'
          ? normalizedEntry.rejectionReason
          : extractedReason;

      return normalizedEntry;
    });

    normalizedLegacyEntries.forEach((entry) => {
      const isRejection =
        entry.showRejectionReasonToAuthor ||
        Boolean(entry.rejectionReason) ||
        /book\s+rejected/i.test(entry.message || '');

      if (isRejection) {
        buckets.bookRejectionUpdates.unshift({
          ...entry,
          category: 'bookRejectionUpdates',
        });
      } else {
        buckets.bookApprovalUpdates.unshift({
          ...entry,
          category: 'bookApprovalUpdates',
        });
      }
    });

    buckets.bookUpdates = [];
  }

  return buckets;
}

function createNotification(message, category, metadata = {}) {
  const base = {
    id: randomUUID(),
    category,
    message,
    timestamp: new Date().toISOString(),
    unread: true,
    archived: false,
  };

  if (category === 'bookUpdates' || category === 'bookRejectionUpdates') {
    return {
      ...base,
      showRejectionReasonToAuthor:
        typeof metadata.showRejectionReasonToAuthor === 'boolean'
          ? metadata.showRejectionReasonToAuthor
          : false,
      rejectionReason:
        typeof metadata.rejectionReason === 'string' ? metadata.rejectionReason : '',
    };
  }

  return base;
}

function addNotificationForUser(username, category, message, metadata = {}) {
  const notifications = readNotifications();
  const buckets = ensureUserNotifications(notifications, username);
  if (!Array.isArray(buckets[category])) {
    buckets[category] = [];
  }

  buckets[category].unshift(createNotification(message, category, metadata));
  writeNotifications(notifications);
}

function addNotificationForRole(role, category, message, metadata = {}) {
  const users = readUsers().filter((user) => user.role === role);
  if (users.length === 0) return;

  const notifications = readNotifications();
  users.forEach((user) => {
    const buckets = ensureUserNotifications(notifications, user.username);
    if (!Array.isArray(buckets[category])) {
      buckets[category] = [];
    }
    buckets[category].unshift(createNotification(message, category, metadata));
  });

  writeNotifications(notifications);
}

function categoriesForRole(role) {
  if (role === 'author') {
    return ['bookApprovalUpdates', 'bookRejectionUpdates', 'other'];
  }
  if (role === 'librarian') {
    return ['newSubmissions', 'accountUpdates', 'other'];
  }
  if (role === 'student' || role === 'staff') {
    return ['dueReminders', 'bookDeletionNotices', 'other'];
  }
  return ['other'];
}

// Notifications helpers end

// Book helpers
function readBooks() {
  const data = fs.readFileSync(BOOKS_FILE, 'utf-8');
  return JSON.parse(data).books;
}
function writeBooks(books) {
  fs.writeFileSync(BOOKS_FILE, JSON.stringify({ books }, null, 2));
}

function getBookDueTime(book) {
  if (book?.dueAt) {
    const dueAtMs = new Date(book.dueAt).getTime();
    if (Number.isFinite(dueAtMs)) {
      return dueAtMs;
    }
  }

  if (book?.dueDate) {
    const dueDateMs = new Date(`${book.dueDate}T23:59:59`).getTime();
    if (Number.isFinite(dueDateMs)) {
      return dueDateMs;
    }
  }

  return null;
}

function releaseBorrowedBook(book) {
  book.status = 'available';
  delete book.borrowedBy;
  delete book.borrowedAt;
  delete book.dueDate;
  delete book.dueAt;
  updatePublishedBookBorrowedState(book.id, false);
}

function sweepExpiredBorrows(books) {
  const now = Date.now();
  let changed = false;

  books.forEach((book) => {
    if (book.status !== 'borrowed' || !book.borrowedBy) {
      return;
    }

    const dueTime = getBookDueTime(book);
    if (dueTime !== null && dueTime <= now) {
      const previousBorrower = book.borrowedBy;
      const previousTitle = book.title;
      releaseBorrowedBook(book);
      changed = true;

      addNotificationForUser(
        previousBorrower,
        'dueReminders',
        `Auto-return complete: "${previousTitle}" was returned because the borrowing period expired.`
      );
    }
  });

  if (changed) {
    writeBooks(books);
  }
}

// Published Books helpers
function readPublishedBooks() {
  if (!fs.existsSync(PUBLISHED_BOOKS_FILE)) {
    return {};
  }
  try {
    const data = fs.readFileSync(PUBLISHED_BOOKS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    return {};
  }
}

function writePublishedBooks(publishedBooks) {
  fs.writeFileSync(PUBLISHED_BOOKS_FILE, JSON.stringify(publishedBooks, null, 2));
}

function ensureAuthorPublishedBooks(publishedBooks, username) {
  if (!publishedBooks[username] || typeof publishedBooks[username] !== 'object') {
    publishedBooks[username] = {};
  }
  return publishedBooks[username];
}

function updatePublishedBookBorrowedState(bookId, borrowed) {
  const publishedBooks = readPublishedBooks();
  const targetBookId = String(bookId);
  let updated = false;

  Object.values(publishedBooks).forEach((authorBooks) => {
    if (!authorBooks || typeof authorBooks !== 'object') {
      return;
    }

    Object.entries(authorBooks).forEach(([entryId, entry]) => {
      if (String(entryId) === targetBookId || String(entry?.id) === targetBookId) {
        authorBooks[entryId] = {
          ...entry,
          borrowed: Boolean(borrowed),
        };
        updated = true;
      }
    });
  });

  if (updated) {
    writePublishedBooks(publishedBooks);
  }
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

  const notifications = readNotifications();
  ensureUserNotifications(notifications, username);
  writeNotifications(notifications);

  addNotificationForRole('librarian', 'accountUpdates', `New user account created: ${username} (${role}).`);
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

//Update profile start


app.post('/api/profile/update', (req, res) => {
  const { username, role, currentPassword, fullName, password, employeeId, bio } = req.body;

  if (!username || !role || !currentPassword) {
    return res.status(400).json({ error: 'username, role, and currentPassword are required.' });
  }

  const users = readUsers();
  const userIndex = users.findIndex(
    (u) => u.username === username && u.role === role
  );

  if (userIndex === -1) {
    return res.status(404).json({ error: 'User not found.' });
  }

  const user = users[userIndex];
  if (user.password !== currentPassword) {
    return res.status(401).json({ error: 'Current password is incorrect.' });
  }

  const nextFullName = typeof fullName === 'string' ? fullName.trim() : user.fullName;
  if (!nextFullName) {
    return res.status(400).json({ error: 'Full Name cannot be empty.' });
  }

  const wantsPasswordChange = typeof password === 'string' && password.length > 0;
  if (wantsPasswordChange && !validatePassword(password)) {
    return res.status(400).json({
      error: 'Password must be at least 8 characters, include a letter and a number.'
    });
  }

  const isLibrarian = user.role === 'librarian';
  const isAuthor = user.role === 'author';
  const nextEmployeeId = isLibrarian
    ? (typeof employeeId === 'string' ? employeeId.trim() : (user.employeeId || ''))
    : undefined;
  const nextBio = isAuthor
    ? (typeof bio === 'string' ? bio.trim() : (user.bio || ''))
    : undefined;

  const hasFullNameChange = nextFullName !== user.fullName;
  const hasPasswordChange = wantsPasswordChange && password !== user.password;
  const hasEmployeeIdChange = isLibrarian && nextEmployeeId !== (user.employeeId || '');
  const hasBioChange = isAuthor && nextBio !== (user.bio || '');

  if (!hasFullNameChange && !hasPasswordChange && !hasEmployeeIdChange && !hasBioChange) {
    return res.status(400).json({ error: 'No profile changes detected.' });
  }

  user.fullName = nextFullName;
  if (hasPasswordChange) {
    user.password = password;
  }
  if (isLibrarian) {
    user.employeeId = nextEmployeeId;
  }
  if (isAuthor) {
    user.bio = nextBio;
  }

  users[userIndex] = user;
  writeUsers(users);

  const changedFields = [];
  if (hasFullNameChange) changedFields.push('Full Name');
  if (hasPasswordChange) changedFields.push('Password');
  if (hasEmployeeIdChange) changedFields.push('Employee ID');
  if (hasBioChange) changedFields.push('Bio');

  addNotificationForRole(
    'librarian',
    'accountUpdates',
    `User account updated: ${username} (${role}). Changed: ${changedFields.join(', ')}.`
  );

  res.json({
    message: 'Profile updated successfully.',
    passwordChanged: hasPasswordChange,
    user,
  });
});

// Update profile end

// Ennnnnnnnnnnnd Ignore already taken care

// Book routes
app.get('/api/books', (req, res) => {
  const books = readBooks();
  sweepExpiredBorrows(books);
  res.json({ books });
});

app.post('/api/borrow', (req, res) => {
  const { bookId, username, durationDays } = req.body;
  if (!bookId) return res.status(400).json({ error: 'Missing bookId.' });

  const books = readBooks();
  const numericBookId = Number(bookId);
  const book = books.find((b) => b.id === numericBookId || b.id === bookId);
  if (!book) return res.status(404).json({ error: 'Book not found.' });
  if (book.status !== 'available') return res.status(409).json({ error: 'Book is not available.' });

  const borrowDays = Number.isFinite(Number(durationDays))
    ? Math.max(1, Math.floor(Number(durationDays)))
    : 10;

  const dueAt = new Date();
  dueAt.setDate(dueAt.getDate() + borrowDays);

  book.status = 'borrowed';
  if (username) {
    book.borrowedBy = username;
  }
  book.borrowedAt = new Date().toISOString();
  book.dueDate = dueAt.toISOString().split('T')[0];
  book.dueAt = dueAt.toISOString();
  book.borrowCount = (Number(book.borrowCount) || 0) + 1;
  if (!Array.isArray(book.borrowHistory)) {
    book.borrowHistory = [];
  }
  if (username) {
    book.borrowHistory.unshift({
      username,
      borrowedAt: book.borrowedAt,
      dueDate: book.dueDate,
    });
  }

  writeBooks(books);
  updatePublishedBookBorrowedState(book.id, true);
  if (username) {
    addNotificationForUser(username, 'dueReminders', `Due reminder: "${book.title}" is due on ${book.dueDate}.`);
  }

  res.json({ message: 'Book borrowed successfully!', book });
});

app.get('/api/borrowed/:username', (req, res) => {
  const { username } = req.params;
  if (!username) {
    return res.status(400).json({ error: 'Missing username.' });
  }

  const books = readBooks();
  sweepExpiredBorrows(books);

  const now = Date.now();
  const borrowedBooks = books
    .filter((book) => book.status === 'borrowed' && book.borrowedBy === username)
    .map((book) => {
      const dueTime = getBookDueTime(book);
      return {
        ...book,
        isOverdue: dueTime !== null ? dueTime <= now : false,
      };
    });

  res.json({ books: borrowedBooks });
});

app.post('/api/return', (req, res) => {
  const { bookId, username } = req.body;

  if (!bookId || !username) {
    return res.status(400).json({ error: 'bookId and username are required.' });
  }

  const books = readBooks();
  sweepExpiredBorrows(books);

  const numericBookId = Number(bookId);
  const book = books.find((b) => b.id === numericBookId || String(b.id) === String(bookId));

  if (!book) {
    return res.status(404).json({ error: 'Book not found.' });
  }

  if (book.status !== 'borrowed' || book.borrowedBy !== username) {
    return res.status(409).json({ error: 'Book is not currently borrowed by this user.' });
  }

  const returnedTitle = book.title;
  releaseBorrowedBook(book);
  writeBooks(books);

  addNotificationForUser(username, 'dueReminders', `Return complete: "${returnedTitle}" was returned successfully.`);
  res.json({ message: 'Book returned successfully.', book });
});

app.get('/api/reading-progress/:username/:bookId', (req, res) => {
  const { username, bookId } = req.params;
  const books = readBooks();
  const numericBookId = Number(bookId);
  const book = books.find((b) => b.id === numericBookId || String(b.id) === String(bookId));

  if (!book) {
    return res.status(404).json({ error: 'Book not found.' });
  }

  const readingData = book.readingData && typeof book.readingData === 'object' ? book.readingData : {};
  const userData = readingData[username] || { bookmarkPage: 1, highlights: [] };
  if (!Array.isArray(userData.highlights)) {
    userData.highlights = [];
  }

  res.json({ readingProgress: userData });
});

app.post('/api/reading-progress', (req, res) => {
  const { username, bookId, bookmarkPage } = req.body;
  if (!username || !bookId) {
    return res.status(400).json({ error: 'username and bookId are required.' });
  }

  const page = Number.isFinite(Number(bookmarkPage)) ? Math.max(1, Math.floor(Number(bookmarkPage))) : 1;
  const books = readBooks();
  const numericBookId = Number(bookId);
  const book = books.find((b) => b.id === numericBookId || String(b.id) === String(bookId));

  if (!book) {
    return res.status(404).json({ error: 'Book not found.' });
  }

  if (!book.readingData || typeof book.readingData !== 'object') {
    book.readingData = {};
  }
  if (!book.readingData[username] || typeof book.readingData[username] !== 'object') {
    book.readingData[username] = { bookmarkPage: 1, highlights: [] };
  }
  if (!Array.isArray(book.readingData[username].highlights)) {
    book.readingData[username].highlights = [];
  }

  book.readingData[username].bookmarkPage = page;
  book.readingData[username].updatedAt = new Date().toISOString();

  writeBooks(books);
  res.json({ message: 'Reading progress saved.', readingProgress: book.readingData[username] });
});

app.post('/api/highlights', (req, res) => {
  const { username, bookId, text, page, color, rects } = req.body;
  if (!username || !bookId || !text || !String(text).trim()) {
    return res.status(400).json({ error: 'username, bookId and text are required.' });
  }

  const books = readBooks();
  const numericBookId = Number(bookId);
  const book = books.find((b) => b.id === numericBookId || String(b.id) === String(bookId));
  if (!book) {
    return res.status(404).json({ error: 'Book not found.' });
  }

  if (!book.readingData || typeof book.readingData !== 'object') {
    book.readingData = {};
  }
  if (!book.readingData[username] || typeof book.readingData[username] !== 'object') {
    book.readingData[username] = { bookmarkPage: 1, highlights: [] };
  }
  if (!Array.isArray(book.readingData[username].highlights)) {
    book.readingData[username].highlights = [];
  }

  const highlight = {
    id: randomUUID(),
    text: String(text).trim(),
    page: Number.isFinite(Number(page)) ? Math.max(1, Math.floor(Number(page))) : null,
    color: typeof color === 'string' && color.trim() ? color.trim() : '#fff59d',
    rects: Array.isArray(rects)
      ? rects
          .map((rect) => ({
            leftPct: Number(rect?.leftPct) || 0,
            topPct: Number(rect?.topPct) || 0,
            widthPct: Number(rect?.widthPct) || 0,
            heightPct: Number(rect?.heightPct) || 0,
          }))
          .filter((rect) => rect.widthPct > 0 && rect.heightPct > 0)
      : [],
    timestamp: new Date().toISOString(),
  };

  book.readingData[username].highlights.unshift(highlight);
  writeBooks(books);

  res.json({ message: 'Highlight saved.', highlight });
});

app.delete('/api/highlights/:username/:bookId/:highlightId', (req, res) => {
  const { username, bookId, highlightId } = req.params;
  const books = readBooks();
  const numericBookId = Number(bookId);
  const book = books.find((b) => b.id === numericBookId || String(b.id) === String(bookId));
  if (!book) {
    return res.status(404).json({ error: 'Book not found.' });
  }

  const userData = book.readingData && book.readingData[username];
  if (!userData || !Array.isArray(userData.highlights)) {
    return res.status(404).json({ error: 'Highlight not found.' });
  }

  const before = userData.highlights.length;
  userData.highlights = userData.highlights.filter((item) => item.id !== highlightId);

  if (userData.highlights.length === before) {
    return res.status(404).json({ error: 'Highlight not found.' });
  }

  writeBooks(books);
  res.json({ message: 'Highlight removed.' });
});

app.delete('/api/books/:id', (req, res) => {
  const { id } = req.params;
  const books = readBooks();
  const numericBookId = Number(id);

  const bookIndex = books.findIndex((book) => book.id === numericBookId || String(book.id) === id);
  if (bookIndex === -1) {
    return res.status(404).json({ error: 'Book not found.' });
  }

  const [removedBook] = books.splice(bookIndex, 1);
  writeBooks(books);

  if (removedBook.borrowedBy) {
    addNotificationForUser(
      removedBook.borrowedBy,
      'bookDeletionNotices',
      `Book deletion notice: "${removedBook.title}" was deleted while it was borrowed.`
    );
  }

  res.json({ message: 'Book deleted successfully.' });
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

// deprecated function to remove pending book assets (PDF + cover) when a book is rejected. 
// removed for nice-to-have feature for Task 2.4

// function removePendingBookAssets(book) {
//   const assetPaths = [book?.filePath, book?.coverPath].filter(
//     (assetPath) => typeof assetPath === 'string' && assetPath.trim()
//   );

//   assetPaths.forEach((assetPath) => {
//     const resolvedPath = path.resolve(__dirname, assetPath);
//     const relativeToAssetsDir = path.relative(assetsDir, resolvedPath);
//     const isInAssetsDir =
//       relativeToAssetsDir &&
//       !relativeToAssetsDir.startsWith('..') &&
//       !path.isAbsolute(relativeToAssetsDir);

//     if (!isInAssetsDir) {
//       console.warn(`Skipped deleting asset outside bookAssets: ${assetPath}`);
//       return;
//     }

//     try {
//       if (fs.existsSync(resolvedPath)) {
//         fs.unlinkSync(resolvedPath);
//       }
//     } catch (err) {
//       console.error(`Failed to delete asset ${resolvedPath}:`, err);
//     }
//   });
// }

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

const MAX_BOOK_FILE_SIZE_BYTES = 25 * 1024 * 1024;
const MAX_COVER_FILE_SIZE_BYTES = 5 * 1024 * 1024;

// Hard cap keeps uploads bounded before route logic runs.
const upload = multer({ storage, fileFilter, limits: { fileSize: MAX_BOOK_FILE_SIZE_BYTES } });

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

    if (pdfFile.size > MAX_BOOK_FILE_SIZE_BYTES) {
      return res.status(400).json({ error: 'Book PDF must be smaller than 15 MB.' });
    }

    if (coverFile && coverFile.size > MAX_COVER_FILE_SIZE_BYTES) {
      return res.status(400).json({ error: 'Cover image must be smaller than 5 MB.' });
    }

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

    // Also add to publishedBooks.json with "pending" status
    const publishedBooks = readPublishedBooks();
    const authorBooks = ensureAuthorPublishedBooks(publishedBooks, authorUsername);
    authorBooks[newBook.id] = {
      id: newBook.id,
      title,
      genre,
      description,
      status: 'pending',
      borrowed: false,
      filePath: relativePdfPath,
      coverPath: relativeCoverPath,
      publishDate: newBook.publishDate,
    };
    writePublishedBooks(publishedBooks);

    addNotificationForRole(
      'librarian',
      'newSubmissions',
      `New submission: "${title}" by ${authorUsername}.`
    );

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

app.get('/api/notifications/:username', (req, res) => {
  const { username } = req.params;
  const { role } = req.query;

  if (!username || !role) {
    return res.status(400).json({ error: 'username and role are required.' });
  }

  const notifications = readNotifications();
  const buckets = ensureUserNotifications(notifications, username);
  writeNotifications(notifications);

  const visibleCategories = categoriesForRole(role);
  const categories = {};

  visibleCategories.forEach((category) => {
    categories[category] = Array.isArray(buckets[category]) ? buckets[category] : [];
  });

  const unreadCount = Object.values(categories)
    .flat()
    .filter((item) => item && item.unread && !item.archived)
    .length;

  res.json({ categories, unreadCount, visibleCategories });
});

app.patch('/api/notifications/:username/:category/:notificationId', (req, res) => {
  const { username, category, notificationId } = req.params;
  const { action } = req.body;

  if (!['read', 'archive', 'unarchive'].includes(action)) {
    return res.status(400).json({ error: 'Invalid action.' });
  }

  const notifications = readNotifications();
  const buckets = ensureUserNotifications(notifications, username);
  const categoryItems = buckets[category];

  if (!Array.isArray(categoryItems)) {
    return res.status(404).json({ error: 'Notification category not found.' });
  }

  const item = categoryItems.find((entry) => entry.id === notificationId);
  if (!item) {
    return res.status(404).json({ error: 'Notification not found.' });
  }

  if (action === 'read') {
    item.unread = false;
  } else if (action === 'archive') {
    item.archived = true;
    item.unread = false;
  } else if (action === 'unarchive') {
    item.archived = false;
  }

  writeNotifications(notifications);
  res.json({ message: 'Notification updated.' });
});

app.delete('/api/notifications/:username/:category/:notificationId', (req, res) => {
  const { username, category, notificationId } = req.params;
  const notifications = readNotifications();
  const buckets = ensureUserNotifications(notifications, username);
  const categoryItems = buckets[category];

  if (!Array.isArray(categoryItems)) {
    return res.status(404).json({ error: 'Notification category not found.' });
  }

  const index = categoryItems.findIndex((entry) => entry.id === notificationId);
  if (index === -1) {
    return res.status(404).json({ error: 'Notification not found.' });
  }

  categoryItems.splice(index, 1);
  writeNotifications(notifications);
  res.json({ message: 'Notification deleted.' });
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
      
      // Update publishedBooks.json status to "approved"
      const publishedBooks = readPublishedBooks();
      const authorBooks = ensureAuthorPublishedBooks(publishedBooks, book.authorUsername);
      if (authorBooks[book.id]) {
        authorBooks[book.id].status = 'approved';
        authorBooks[book.id].borrowed = false;
      }
      writePublishedBooks(publishedBooks);
      
      addNotificationForUser(
        book.authorUsername,
        'bookApprovalUpdates',
        `Book approved: "${book.title}" has been approved and published.`
      );
      console.log(`Book approved and added to books.json.`);
    } else {
      if (!rejectionReason || !rejectionReason.trim()) {
        console.error(`Rejection reason is missing or empty.`);
        return res.status(400).json({ error: 'Rejection reason is required.' });
      }
      book.status = 'rejected';
      book.rejectionReason = rejectionReason;
      addRejectionReason(book.authorUsername, book.title, rejectionReason, !sendToAuthor);
      
      // Update publishedBooks.json status to "rejected"
      const publishedBooks = readPublishedBooks();
      const authorBooks = ensureAuthorPublishedBooks(publishedBooks, book.authorUsername);
      if (authorBooks[book.id]) {
        authorBooks[book.id].status = 'rejected';
        authorBooks[book.id].rejectionReason = rejectionReason;
      }
      writePublishedBooks(publishedBooks);
      
      addNotificationForUser(book.authorUsername, 'bookRejectionUpdates', `Book rejected: "${book.title}" was rejected.`, {
        showRejectionReasonToAuthor: Boolean(sendToAuthor),
        rejectionReason: rejectionReason.trim(),
      });
      // console.log(`Book rejected with reason: ${rejectionReason}`);
    }

    // Remove the processed book (approved or rejected) from pendingBooks
    pendingBooks.splice(bookIndex, 1);
    writePendingBooks(pendingBooks);
    // console.log(`Book removed from pendingBooks.json.`);

    res.json({ message: `Submission ${isApproved ? 'approved' : 'rejected'} successfully.` });
  } catch (err) {
    console.error('Error updating submission:', err);
    res.status(500).json({ error: 'Failed to update submission.' });
  }
});

// Published Books endpoints

// GET /api/published-books/:username - Fetch all published books for an author
app.get('/api/published-books/:username', (req, res) => {
  try {
    const { username } = req.params;
    const publishedBooks = readPublishedBooks();
    const authorBooks = publishedBooks[username] || {};
    
    // Convert to array format for easier frontend processing
    const booksArray = Object.values(authorBooks);
    res.json(booksArray);
  } catch (err) {
    console.error('Error fetching published books:', err);
    res.status(500).json({ error: 'Failed to fetch published books.' });
  }
});

// PATCH /api/published-books/:username/:bookId - Update book details (title, genre, description)
app.patch('/api/published-books/:username/:bookId', (req, res) => {
  try {
    const { username, bookId } = req.params;
    const { title, genre, description } = req.body;
    
    const publishedBooks = readPublishedBooks();
    const authorBooks = ensureAuthorPublishedBooks(publishedBooks, username);
    
    if (!authorBooks[bookId]) {
      return res.status(404).json({ error: 'Book not found.' });
    }

    const targetBook = authorBooks[bookId];
    const isPublished = targetBook.status === 'approved';
    const isBorrowed = Boolean(targetBook.borrowed);

    if (isPublished && isBorrowed) {
      return res.status(409).json({
        error: 'Cannot edit a published book while it is borrowed by a student/staff.',
      });
    }
    
    // Update allowed fields
    if (title !== undefined) targetBook.title = title;
    if (genre !== undefined) targetBook.genre = genre;
    if (description !== undefined) targetBook.description = description;

    // Keep pendingBooks.json in sync if this title exists in pending submissions.
    const pendingBooks = readPendingBooks();
    const pendingBookIndex = pendingBooks.findIndex(
      (book) => String(book.id) === String(bookId)
    );
    if (pendingBookIndex !== -1) {
      if (title !== undefined) pendingBooks[pendingBookIndex].title = title;
      if (genre !== undefined) pendingBooks[pendingBookIndex].genre = genre;
      if (description !== undefined) pendingBooks[pendingBookIndex].description = description;
      writePendingBooks(pendingBooks);
    }

    // Keep books.json in sync if this title exists in approved/available catalog.
    const books = readBooks();
    const libraryBookIndex = books.findIndex(
      (book) => String(book.id) === String(bookId)
    );
    if (libraryBookIndex !== -1) {
      if (title !== undefined) books[libraryBookIndex].title = title;
      if (genre !== undefined) books[libraryBookIndex].genre = genre;
      if (description !== undefined) books[libraryBookIndex].description = description;
      writeBooks(books);
    }
    
    writePublishedBooks(publishedBooks);
    res.json({ message: 'Book updated successfully.', book: targetBook });
  } catch (err) {
    console.error('Error updating published book:', err);
    res.status(500).json({ error: 'Failed to update published book.' });
  }
});

// DELETE /api/published-books/:username/:bookId - Delete a published book
app.delete('/api/published-books/:username/:bookId', (req, res) => {
  try {
    const { username, bookId } = req.params;
    const publishedBooks = readPublishedBooks();
    const authorBooks = ensureAuthorPublishedBooks(publishedBooks, username);
    
    if (!authorBooks[bookId]) {
      return res.status(404).json({ error: 'Book not found.' });
    }

    const bookTitle = authorBooks[bookId].title;
    delete authorBooks[bookId];
    writePublishedBooks(publishedBooks);

    // Also remove the same book from books.json if it exists there.
    const books = readBooks();
    const libraryBookIndex = books.findIndex((book) => String(book.id) === String(bookId));

    if (libraryBookIndex !== -1) {
      const [removedLibraryBook] = books.splice(libraryBookIndex, 1);
      writeBooks(books);

      if (removedLibraryBook?.borrowedBy) {
        addNotificationForUser(
          removedLibraryBook.borrowedBy,
          'bookDeletionNotices',
          `Book deletion notice: "${removedLibraryBook.title}" was deleted while it was borrowed.`
        );
      }
    }

    res.json({ message: 'Book deleted successfully.' });
  } catch (err) {
    console.error('Error deleting published book:', err);
    res.status(500).json({ error: 'Failed to delete published book.' });
  }
});

// End of Author helper


// Add endpoints for user management

// Fetch all users
app.get('/users', (req, res) => {
  try {
    const users = readUsers();
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Update user details
app.put('/users/:id', (req, res) => {
  const users = require('./users.json');
  const userId = req.params.id;
  const updatedUser = req.body;

  const userIndex = users.findIndex((user) => user.id === userId);
  if (userIndex === -1) {
    return res.status(404).json({ error: 'User not found' });
  }

  users[userIndex] = { ...users[userIndex], ...updatedUser };
  fs.writeFileSync('./users.json', JSON.stringify(users, null, 2));
  res.json(users[userIndex]);
});

// Change user status
app.patch('/users/:id/status', (req, res) => {
  const users = require('./users.json');
  const userId = req.params.id;
  const { status } = req.body;

  const userIndex = users.findIndex((user) => user.id === userId);
  if (userIndex === -1) {
    return res.status(404).json({ error: 'User not found' });
  }

  users[userIndex].status = status;
  fs.writeFileSync('./users.json', JSON.stringify(users, null, 2));
  res.json(users[userIndex]);
});

// API endpoint to fetch users
app.get('/api/users', (req, res) => {
  try {
    const users = readUsers();
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
