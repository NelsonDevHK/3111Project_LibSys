const multer = require('multer');
const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const { randomUUID } = require('crypto');
const { generateBookSummary, generateBookSummaryFromPdf, generateReviewSentiment } = require('./LLM');

// File paths
const USERS_FILE = path.join(__dirname, 'users.json');
const BOOKS_FILE = path.join(__dirname, 'books.json');
const BORROWED_BOOKS_FILE = path.join(__dirname, 'borrowedBooks.json');
const REJECTION_REASONS_FILE = path.join(__dirname, 'rejectionReason.json');
const NOTIFICATIONS_FILE = path.join(__dirname, 'notifications.json');
const PUBLISHED_BOOKS_FILE = path.join(__dirname, 'publishedBooks.json');
const READING_HISTORY_FILE = path.join(__dirname, 'readingHistory.json');
const BOOK_REVIEWS_FILE = path.join(__dirname, 'bookReviews.json');
const BOOK_REQUESTS_FILE = path.join(__dirname, 'bookRequests.json');

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

const VALID_PROFILE_PICTURE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);
const MAX_PROFILE_PICTURE_BYTES = 2 * 1024 * 1024;

function validateProfilePictureData(profilePicture) {
  if (typeof profilePicture !== 'string' || !profilePicture.trim()) {
    return '';
  }

  const trimmed = profilePicture.trim();
  const match = trimmed.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/);

  if (!match || !VALID_PROFILE_PICTURE_TYPES.has(match[1])) {
    return null;
  }

  const base64Body = match[2];
  const padding = base64Body.endsWith('==') ? 2 : base64Body.endsWith('=') ? 1 : 0;
  const estimatedBytes = Math.floor((base64Body.length * 3) / 4) - padding;

  if (estimatedBytes > MAX_PROFILE_PICTURE_BYTES) {
    return null;
  }

  return trimmed;
}

function buildUserAccountFromPayload(payload) {
  const username = String(payload?.username || '').trim();
  const fullName = String(payload?.fullName || '').trim();
  const password = String(payload?.password || '');
  const role = String(payload?.role || '').toLowerCase().trim();
  const bio = typeof payload?.bio === 'string' ? payload.bio.trim() : '';
  const employeeId = typeof payload?.employeeId === 'string' ? payload.employeeId.trim() : '';
  const profilePictureInput = payload?.profilePicture;
  const profilePicture = validateProfilePictureData(profilePictureInput);

  if (!username || !fullName || !password || !role) {
    return { error: 'Missing required fields.' };
  }

  if (!VALID_USER_ROLES.includes(role)) {
    return { error: 'Invalid role selected.' };
  }

  if (!validatePassword(password)) {
    return {
      error: 'Password must be at least 8 characters, include a letter and a number.',
    };
  }

  if (typeof profilePictureInput === 'string' && profilePictureInput.trim() && profilePicture === null) {
    return {
      error: 'Profile picture must be a JPG, PNG, GIF, or WEBP image under 2 MB.',
    };
  }

  const user = {
    username,
    fullName,
    password,
    role,
    status: 'active',
  };

  if (role === 'author' && bio) {
    user.bio = bio;
  }
  if (role === 'librarian' && employeeId) {
    user.employeeId = employeeId;
  }
  if (profilePicture) {
    user.profilePicture = profilePicture;
  }

  return { user };
}

function persistCreatedUserAccount(user) {
  const users = readUsers();
  if (users.some((entry) => entry.username === user.username)) {
    return { error: 'Username already exists.' };
  }

  users.push(user);
  writeUsers(users);

  const notifications = readNotifications();
  ensureUserNotifications(notifications, user.username);
  writeNotifications(notifications);

  addNotificationForRole('librarian', 'accountUpdates', `New user account created: ${user.username} (${user.role}).`);

  return { user };
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

function readBorrowedBooksRecords() {
  if (!fs.existsSync(BORROWED_BOOKS_FILE)) {
    return [];
  }

  try {
    const data = fs.readFileSync(BORROWED_BOOKS_FILE, 'utf-8');
    if (!data) {
      return [];
    }

    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('Error reading borrowedBooks.json:', err);
    return [];
  }
}

function writeBorrowedBooksRecords(records) {
  fs.writeFileSync(BORROWED_BOOKS_FILE, JSON.stringify(records, null, 2));
}

function trackBorrowedBooksEvent(book, borrowerUsername, status) {
  if (!book || !borrowerUsername) {
    return;
  }

  const records = readBorrowedBooksRecords();
  const borrowedDateValue = book.borrowedAt
    ? new Date(book.borrowedAt).toISOString().split('T')[0]
    : new Date().toISOString().split('T')[0];

  const existingIndex = records.findIndex((record) => {
    return (
      String(record.bookId || '') === String(book.id) &&
      String(record.borrowerUsername || '') === String(borrowerUsername) &&
      String(record.borrowDate || '') === String(borrowedDateValue)
    );
  });

  const nextRecord = {
    bookId: book.id,
    bookTitle: book.title || 'Untitled Book',
    borrowerUsername,
    borrowDate: borrowedDateValue,
    returnDate: status === 'returned' ? new Date().toISOString().split('T')[0] : (book.dueDate || ''),
    status,
  };

  if (existingIndex === -1) {
    records.unshift(nextRecord);
  } else {
    records[existingIndex] = {
      ...records[existingIndex],
      ...nextRecord,
    };
  }

  writeBorrowedBooksRecords(records);
}

function getAllBorrowedBooksRecords() {
  const now = Date.now();
  const historicalRecords = readBorrowedBooksRecords();
  const books = readBooks();

  const activeRecords = books
    .filter((book) => book.status === 'borrowed' && book.borrowedBy)
    .map((book) => {
      const dueTime = getBookDueTime(book);
      const status = dueTime !== null && dueTime <= now ? 'overdue' : 'borrowed';
      const borrowDate = book.borrowedAt
        ? new Date(book.borrowedAt).toISOString().split('T')[0]
        : '';

      return {
        bookId: book.id,
        bookTitle: book.title || 'Untitled Book',
        borrowerUsername: book.borrowedBy,
        borrowDate,
        returnDate: book.dueDate || '',
        status,
      };
    });

  const merged = [...historicalRecords];
  activeRecords.forEach((activeRecord) => {
    const exists = merged.some((record) => {
      return (
        String(record.bookId || '') === String(activeRecord.bookId || '') &&
        String(record.borrowerUsername || '') === String(activeRecord.borrowerUsername || '') &&
        String(record.borrowDate || '') === String(activeRecord.borrowDate || '') &&
        ['borrowed', 'overdue'].includes(String(record.status || '').toLowerCase())
      );
    });

    if (!exists) {
      merged.unshift(activeRecord);
    }
  });

  return merged;
}

const VALID_USER_ROLES = ['student', 'staff', 'author', 'librarian'];
const VALID_USER_STATUSES = ['active', 'deactivated'];

function normalizeUserRecord(user) {
  if (!user || typeof user !== 'object') {
    return null;
  }

  return {
    ...user,
    username: String(user.username || '').trim(),
    fullName: String(user.fullName || '').trim(),
    role: String(user.role || '').toLowerCase(),
    status: VALID_USER_STATUSES.includes(String(user.status || '').toLowerCase())
      ? String(user.status).toLowerCase()
      : 'active',
    lastLoginAt: typeof user.lastLoginAt === 'string' ? user.lastLoginAt : '',
    profilePicture: typeof user.profilePicture === 'string' ? user.profilePicture : '',
  };
}

function buildUserActivityMetrics(username, books = null) {
  const sourceBooks = Array.isArray(books) ? books : readBooks();
  const normalizedUsername = String(username || '');
  let currentlyBorrowedCount = 0;
  let totalBorrowedCount = 0;

  sourceBooks.forEach((book) => {
    if (String(book.borrowedBy || '') === normalizedUsername) {
      currentlyBorrowedCount += 1;
    }

    if (Array.isArray(book.borrowHistory)) {
      totalBorrowedCount += book.borrowHistory.filter(
        (entry) => String(entry?.username || '') === normalizedUsername
      ).length;
    }
  });

  return {
    currentlyBorrowedCount,
    totalBorrowedCount,
  };
}

function toManageableUserView(user, books = null) {
  const normalized = normalizeUserRecord(user);
  if (!normalized) {
    return null;
  }

  const activity = buildUserActivityMetrics(normalized.username, books);
  return {
    id: normalized.username,
    username: normalized.username,
    name: normalized.fullName,
    fullName: normalized.fullName,
    role: normalized.role,
    status: normalized.status,
    employeeId: normalized.employeeId || '',
    bio: normalized.bio || '',
    profilePicture: normalized.profilePicture || '',
    activity: {
      lastLoginAt: normalized.lastLoginAt || null,
      borrowedBooksCount: activity.currentlyBorrowedCount,
      totalBorrowedCount: activity.totalBorrowedCount,
    },
  };
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
      const returnDateIso = new Date().toISOString();
      trackBookReturnHistory(previousBorrower, book, returnDateIso);
      trackBorrowedBooksEvent(book, previousBorrower, 'returned');
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

// Reading history helpers
function readReadingHistory() {
  if (!fs.existsSync(READING_HISTORY_FILE)) {
    return {};
  }

  try {
    const data = fs.readFileSync(READING_HISTORY_FILE, 'utf-8');
    const parsed = data ? JSON.parse(data) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (err) {
    console.error('Error reading readingHistory.json:', err);
    return {};
  }
}

function writeReadingHistory(readingHistory) {
  fs.writeFileSync(READING_HISTORY_FILE, JSON.stringify(readingHistory, null, 2));
}

function ensureUserReadingHistory(readingHistory, username) {
  if (!Array.isArray(readingHistory[username])) {
    readingHistory[username] = [];
  }
  return readingHistory[username];
}

function getActiveReadingHistoryEntry(entries, bookId) {
  return entries.find((entry) => String(entry?.bookId) === String(bookId) && !entry?.returnDate);
}

function trackBookBorrowHistory(username, book) {
  if (!username || !book) return;

  const readingHistory = readReadingHistory();
  const userHistory = ensureUserReadingHistory(readingHistory, username);
  const nowIso = new Date().toISOString();
  const activeEntry = getActiveReadingHistoryEntry(userHistory, book.id);

  if (activeEntry) {
    activeEntry.borrowDate = book.borrowedAt || activeEntry.borrowDate || nowIso;
    activeEntry.dueDate = book.dueAt || activeEntry.dueDate || null;
    activeEntry.bookTitle = book.title || activeEntry.bookTitle || 'Untitled Book';
    activeEntry.author = book.authorFullName || activeEntry.author || 'Unknown';
    activeEntry.genre = book.genre || activeEntry.genre || 'Unknown';
    activeEntry.status = 'borrowed';
    activeEntry.publishDate = book.publishDate || activeEntry.publishDate || null;
  } else {
    userHistory.unshift({
      id: randomUUID(),
      bookId: book.id,
      bookTitle: book.title || 'Untitled Book',
      author: book.authorFullName || 'Unknown',
      genre: book.genre || 'Unknown',
      borrowDate: book.borrowedAt || nowIso,
      dueDate: book.dueAt || null,
      returnDate: null,
      publishDate: book.publishDate || null,
      status: 'borrowed',
      readingDurationMinutes: 0,
      progress: {
        bookmarkPage: 1,
        highlightsCount: 0,
        lastReadAt: null,
      },
    });
  }

  writeReadingHistory(readingHistory);
}

function trackBookReturnHistory(username, book, returnDateIso = new Date().toISOString()) {
  if (!username || !book) return;

  const readingHistory = readReadingHistory();
  const userHistory = ensureUserReadingHistory(readingHistory, username);
  const activeEntry = getActiveReadingHistoryEntry(userHistory, book.id);

  if (!activeEntry) {
    return;
  }

  activeEntry.returnDate = returnDateIso;
  activeEntry.status = 'returned';

  const startMs = new Date(activeEntry.borrowDate || book.borrowedAt || returnDateIso).getTime();
  const endMs = new Date(returnDateIso).getTime();
  if (Number.isFinite(startMs) && Number.isFinite(endMs) && endMs >= startMs) {
    activeEntry.readingDurationMinutes = Math.max(1, Math.round((endMs - startMs) / 60000));
  }

  writeReadingHistory(readingHistory);
}

function trackReadingProgressHistory(username, book, updates = {}) {
  if (!username || !book) return;

  const readingHistory = readReadingHistory();
  const userHistory = ensureUserReadingHistory(readingHistory, username);
  let activeEntry = getActiveReadingHistoryEntry(userHistory, book.id);

  if (!activeEntry) {
    activeEntry = {
      id: randomUUID(),
      bookId: book.id,
      bookTitle: book.title || 'Untitled Book',
      author: book.authorFullName || 'Unknown',
      genre: book.genre || 'Unknown',
      borrowDate: book.borrowedAt || new Date().toISOString(),
      dueDate: book.dueAt || null,
      returnDate: null,
      status: 'borrowed',
      readingDurationMinutes: 0,
      progress: {
        bookmarkPage: 1,
        highlightsCount: 0,
        lastReadAt: null,
      },
    };
    userHistory.unshift(activeEntry);
  }

  if (!activeEntry.progress || typeof activeEntry.progress !== 'object') {
    activeEntry.progress = {
      bookmarkPage: 1,
      highlightsCount: 0,
      lastReadAt: null,
    };
  }

  if (Number.isFinite(Number(updates.bookmarkPage))) {
    activeEntry.progress.bookmarkPage = Math.max(1, Math.floor(Number(updates.bookmarkPage)));
  }
  if (Number.isFinite(Number(updates.highlightsCount))) {
    activeEntry.progress.highlightsCount = Math.max(0, Math.floor(Number(updates.highlightsCount)));
  }

  activeEntry.progress.lastReadAt = updates.lastReadAt || new Date().toISOString();
  activeEntry.bookTitle = book.title || activeEntry.bookTitle;
  activeEntry.author = book.authorFullName || activeEntry.author;
  activeEntry.genre = book.genre || activeEntry.genre;

  writeReadingHistory(readingHistory);
}

// Book reviews helpers
function readBookReviews() {
  if (!fs.existsSync(BOOK_REVIEWS_FILE)) {
    return {};
  }

  try {
    const data = fs.readFileSync(BOOK_REVIEWS_FILE, 'utf-8');
    const parsed = data ? JSON.parse(data) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (err) {
    console.error('Error reading bookReviews.json:', err);
    return {};
  }
}

function writeBookReviews(bookReviews) {
  fs.writeFileSync(BOOK_REVIEWS_FILE, JSON.stringify(bookReviews, null, 2));
}

function ensureBookReviews(bookReviews, bookId) {
  const bookIdStr = String(bookId);
  if (!Array.isArray(bookReviews[bookIdStr])) {
    bookReviews[bookIdStr] = [];
  }
  return bookReviews[bookIdStr];
}

function normalizeReviewSentimentValue(sentiment) {
  const normalized = String(sentiment || '').toLowerCase().trim();
  if (normalized.includes('positive')) return 'positive';
  if (normalized.includes('neutral')) return 'neutral';
  if (normalized.includes('negative')) return 'negative';
  return null;
}

function buildReviewSentimentFallback(review) {
  const rating = Number(review?.rating);
  const reviewText = String(review?.reviewText || '').toLowerCase();

  if (Number.isFinite(rating)) {
    if (rating >= 4) return 'positive';
    if (rating <= 2) return 'negative';
  }

  if (/\b(love|excellent|great|amazing|wonderful|fantastic|enjoyed)\b/.test(reviewText)) {
    return 'positive';
  }
  if (/\b(bad|poor|terrible|awful|boring|hate|disappointing)\b/.test(reviewText)) {
    return 'negative';
  }

  return 'neutral';
}

async function resolveReviewSentiment(review, context = {}) {
  const existingSentiment = normalizeReviewSentimentValue(review?.sentiment);
  if (existingSentiment) {
    return existingSentiment;
  }

  try {
    const sentiment = await generateReviewSentiment({
      reviewText: review?.reviewText,
      rating: review?.rating,
      bookTitle: context.bookTitle || review?.bookTitle,
      username: review?.username,
    });

    return normalizeReviewSentimentValue(sentiment) || buildReviewSentimentFallback(review);
  } catch (error) {
    console.warn('Unable to resolve review sentiment, falling back to rating-based analysis:', error.message);
    return buildReviewSentimentFallback(review);
  }
}

async function enrichReviewsWithSentiment(bookReviews, reviewEntries, context = {}) {
  let changed = false;

  for (const review of reviewEntries) {
    if (!review) {
      continue;
    }

    if (normalizeReviewSentimentValue(review.sentiment)) {
      continue;
    }

    review.sentiment = await resolveReviewSentiment(review, context);
    changed = true;
  }

  if (changed) {
    writeBookReviews(bookReviews);
  }

  return changed;
}

function buildReviewAnalytics(reviews) {
  const totals = reviews.reduce(
    (acc, review) => {
      const sentiment = normalizeReviewSentimentValue(review?.sentiment) || 'neutral';
      acc.totalReviews += 1;
      acc.totalRating += Number(review?.rating) || 0;
      acc.sentiments[sentiment] += 1;
      return acc;
    },
    {
      totalReviews: 0,
      totalRating: 0,
      sentiments: { positive: 0, neutral: 0, negative: 0 },
    }
  );

  const averageRating = totals.totalReviews > 0 ? Number((totals.totalRating / totals.totalReviews).toFixed(1)) : 0;

  return {
    totalReviews: totals.totalReviews,
    averageRating,
    sentimentCounts: totals.sentiments,
    sentimentPercentages: totals.totalReviews > 0
      ? {
          positive: Number(((totals.sentiments.positive / totals.totalReviews) * 100).toFixed(1)),
          neutral: Number(((totals.sentiments.neutral / totals.totalReviews) * 100).toFixed(1)),
          negative: Number(((totals.sentiments.negative / totals.totalReviews) * 100).toFixed(1)),
        }
      : { positive: 0, neutral: 0, negative: 0 },
  };
}

function submitReview(username, book, rating, reviewText) {
  if (!username || !book || !rating) {
    return null;
  }

  const bookReviews = readBookReviews();
  const bookIdStr = String(book.id);
  const reviews = ensureBookReviews(bookReviews, bookIdStr);

  // Check if user already reviewed this book
  const existingReviewIndex = reviews.findIndex(
    (r) => String(r.username) === String(username)
  );

  const newReview = {
    id: randomUUID(),
    username,
    userFullName: book.borrowedBy === username ? book.borrowedByFullName || username : username,
    rating: Math.min(5, Math.max(1, Number(rating))),
    reviewText: String(reviewText || '').trim(),
    submittedAt: new Date().toISOString(),
    helpful: 0,
    sentiment: null,
  };

  if (existingReviewIndex !== -1) {
    // Replace existing review
    reviews[existingReviewIndex] = newReview;
  } else {
    // Add new review
    reviews.unshift(newReview);
  }

  writeBookReviews(bookReviews);
  return newReview;
}

function getReviewsForBook(bookId) {
  const bookReviews = readBookReviews();
  const bookIdStr = String(bookId);
  return bookReviews[bookIdStr] || [];
}

function getAverageRating(bookId) {
  const reviews = getReviewsForBook(bookId);
  if (reviews.length === 0) {
    return { average: 0, totalReviews: 0 };
  }

  const sum = reviews.reduce((acc, r) => acc + (Number(r.rating) || 0), 0);
  return {
    average: Number((sum / reviews.length).toFixed(1)),
    totalReviews: reviews.length,
  };
}

function canUserReviewBook(username, bookId) {
  if (!username || !bookId) {
    return false;
  }

  const users = readUsers().map(normalizeUserRecord).filter(Boolean);
  const user = users.find((entry) => String(entry.username) === String(username));
  if (!user || !['student', 'staff'].includes(user.role)) {
    return false;
  }

  const targetBookId = String(bookId);
  const books = readBooks();
  const currentlyBorrowed = books.some((book) => {
    return String(book.id) === targetBookId && String(book.borrowedBy || '') === String(username);
  });

  if (currentlyBorrowed) {
    return true;
  }

  const readingHistory = readReadingHistory();
  const userHistory = Array.isArray(readingHistory[username]) ? readingHistory[username] : [];
  return userHistory.some((entry) => String(entry?.bookId) === targetBookId);
}

// Ignore already taken care
app.post('/api/register', (req, res) => {
  const creationResult = buildUserAccountFromPayload(req.body);

  if (creationResult.error) {
    return res.status(400).json({ error: creationResult.error });
  }

  const persistedResult = persistCreatedUserAccount(creationResult.user);

  if (persistedResult.error) {
    return res.status(409).json({ error: persistedResult.error });
  }

  res.json({
    message: 'Registration successful!',
    user: toManageableUserView(persistedResult.user, readBooks()),
  });
});

app.post('/api/users', (req, res) => {
  const creationResult = buildUserAccountFromPayload(req.body);

  if (creationResult.error) {
    return res.status(400).json({ error: creationResult.error });
  }

  const persistedResult = persistCreatedUserAccount(creationResult.user);

  if (persistedResult.error) {
    return res.status(409).json({ error: persistedResult.error });
  }

  res.status(201).json({
    message: 'User account created successfully.',
    user: toManageableUserView(persistedResult.user, readBooks()),
  });
});

app.post('/api/login', (req, res) => {
  const { username, password, role } = req.body;
  const users = readUsers().map(normalizeUserRecord).filter(Boolean);
  const user = users.find(u => u.username === username && u.password === password && u.role === role);
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials.' });
  }

  if (user.status === 'deactivated') {
    return res.status(403).json({ error: 'Account is deactivated. Please contact a librarian.' });
  }

  const userIndex = users.findIndex((entry) => entry.username === user.username && entry.role === user.role);
  if (userIndex !== -1) {
    users[userIndex].lastLoginAt = new Date().toISOString();
    writeUsers(users);
  }

  res.json({ message: 'Login successful!', user });
});

//Update profile start


app.post('/api/profile/update', (req, res) => {
  const { username, role, currentPassword, fullName, password, employeeId, bio, profilePicture } = req.body;

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
  const nextProfilePictureInput = typeof profilePicture === 'string' ? profilePicture : undefined;
  const nextProfilePicture = typeof nextProfilePictureInput === 'undefined'
    ? (user.profilePicture || '')
    : validateProfilePictureData(nextProfilePictureInput);

  if (typeof nextProfilePictureInput === 'string' && nextProfilePictureInput.trim() && nextProfilePicture === null) {
    return res.status(400).json({
      error: 'Profile picture must be a JPG, PNG, GIF, or WEBP image under 2 MB.',
    });
  }

  const hasFullNameChange = nextFullName !== user.fullName;
  const hasPasswordChange = wantsPasswordChange && password !== user.password;
  const hasEmployeeIdChange = isLibrarian && nextEmployeeId !== (user.employeeId || '');
  const hasBioChange = isAuthor && nextBio !== (user.bio || '');
  const hasProfilePictureChange = typeof nextProfilePictureInput === 'string'
    && nextProfilePicture !== (user.profilePicture || '');

  if (!hasFullNameChange && !hasPasswordChange && !hasEmployeeIdChange && !hasBioChange && !hasProfilePictureChange) {
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
  if (hasProfilePictureChange) {
    user.profilePicture = nextProfilePicture || '';
  }

  users[userIndex] = user;
  writeUsers(users);

  const changedFields = [];
  if (hasFullNameChange) changedFields.push('Full Name');
  if (hasPasswordChange) changedFields.push('Password');
  if (hasEmployeeIdChange) changedFields.push('Employee ID');
  if (hasBioChange) changedFields.push('Bio');
  if (hasProfilePictureChange) changedFields.push('Profile Picture');

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
    trackBorrowedBooksEvent(book, username, 'borrowed');
  }

  writeBooks(books);
  updatePublishedBookBorrowedState(book.id, true);
  if (username) {
    trackBookBorrowHistory(username, book);
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
  const returnedBy = book.borrowedBy;
  const returnDateIso = new Date().toISOString();
  trackBookReturnHistory(returnedBy, book, returnDateIso);
  releaseBorrowedBook(book);
  writeBooks(books);

  if (returnedBy) {
    trackBorrowedBooksEvent({ ...book, title: returnedTitle }, returnedBy, 'returned');
  }

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

  trackReadingProgressHistory(username, book, {
    bookmarkPage: page,
    highlightsCount: book.readingData[username].highlights.length,
    lastReadAt: book.readingData[username].updatedAt,
  });

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

  trackReadingProgressHistory(username, book, {
    bookmarkPage: book.readingData[username].bookmarkPage,
    highlightsCount: book.readingData[username].highlights.length,
    lastReadAt: new Date().toISOString(),
  });

  writeBooks(books);

  res.json({ message: 'Highlight saved.', highlight });
});

app.get('/api/reading-history/:username', (req, res) => {
  const { username } = req.params;
  if (!username) {
    return res.status(400).json({ error: 'Missing username.' });
  }

  const readingHistory = readReadingHistory();
  const userHistory = ensureUserReadingHistory(readingHistory, username);

  const history = userHistory
    .map((entry) => {
      // Use publishDate if available, otherwise use borrowDate
      const startDate = entry.publishDate || entry.borrowDate;
      const returnDate = entry.returnDate || null;
      
      const startMs = startDate ? new Date(startDate).getTime() : NaN;
      const endMs = returnDate ? new Date(returnDate).getTime() : Date.now();

      let computedDurationMinutes = Number(entry.readingDurationMinutes) || 0;
      if (Number.isFinite(startMs) && Number.isFinite(endMs) && endMs >= startMs) {
        computedDurationMinutes = Math.max(1, Math.round((endMs - startMs) / 60000));
      }

      return {
        ...entry,
        readingDurationMinutes: computedDurationMinutes,
      };
    })
    .sort((a, b) => {
      const aTime = new Date(a.borrowDate || 0).getTime();
      const bTime = new Date(b.borrowDate || 0).getTime();
      return bTime - aTime;
    });

  res.json({ history });
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

app.get('/api/borrowed-books', (req, res) => {
  try {
    const books = readBooks();
    sweepExpiredBorrows(books);
    const records = getAllBorrowedBooksRecords();
    res.json({ records });
  } catch (error) {
    console.error('Error fetching borrowed books records:', error);
    res.status(500).json({ error: 'Failed to fetch borrowed books records.' });
  }
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

function readBookRequests() {
  if (!fs.existsSync(BOOK_REQUESTS_FILE)) {
    return [];
  }

  try {
    const data = fs.readFileSync(BOOK_REQUESTS_FILE, 'utf-8');
    if (!data) {
      return [];
    }

    const parsed = JSON.parse(data);
    if (Array.isArray(parsed)) {
      return parsed;
    }

    if (Array.isArray(parsed?.bookRequests)) {
      return parsed.bookRequests;
    }

    return [];
  } catch (err) {
    console.error('Error reading bookRequests.json:', err);
    return [];
  }
}

function writeBookRequests(bookRequests) {
  fs.writeFileSync(BOOK_REQUESTS_FILE, JSON.stringify({ bookRequests }, null, 2));
}

function findBookRequestIndex(bookRequests, requestId) {
  return bookRequests.findIndex((request) => String(request?.id) === String(requestId));
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
const summaryUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: MAX_BOOK_FILE_SIZE_BYTES },
});

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

    const relativePdfPath = path.relative(__dirname, pdfFile.path).replace(/\\/g, '/');
    const relativeCoverPath = coverFile ? path.relative(__dirname, coverFile.path).replace(/\\/g, '/') : '';

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

app.post('/api/book-requests', (req, res) => {
  try {
    const { title, author, genre, reason, requestedBy, requestedByRole } = req.body || {};

    if (!title || !author || !genre || !reason || !requestedBy || !requestedByRole) {
      return res.status(400).json({
        error: 'title, author, genre, reason, requestedBy, and requestedByRole are required.',
      });
    }

    const normalizedRole = String(requestedByRole).toLowerCase();
    if (!['student', 'staff'].includes(normalizedRole)) {
      return res.status(403).json({ error: 'Only students and staff can submit book requests.' });
    }

    const requestEntry = {
      id: randomUUID(),
      title: String(title).trim(),
      author: String(author).trim(),
      genre: String(genre).trim(),
      reason: String(reason).trim(),
      requestedBy: String(requestedBy).trim(),
      requestedByRole: normalizedRole,
      status: 'pending',
      submittedAt: new Date().toISOString(),
      reviewedAt: null,
      reviewedBy: null,
      rejectionReason: '',
      uploadedAt: null,
      uploadedBookId: null,
    };

    if (!requestEntry.title || !requestEntry.author || !requestEntry.genre || !requestEntry.reason) {
      return res.status(400).json({ error: 'All fields must be non-empty.' });
    }

    const bookRequests = readBookRequests();
    bookRequests.unshift(requestEntry);
    writeBookRequests(bookRequests);

    addNotificationForRole(
      'librarian',
      'newSubmissions',
      `New book request: "${requestEntry.title}" requested by ${requestEntry.requestedBy}.`
    );

    res.status(201).json({ message: 'Book request submitted successfully.', request: requestEntry });
  } catch (err) {
    console.error('Error creating book request:', err);
    res.status(500).json({ error: 'Failed to submit book request.' });
  }
});

app.get('/api/book-requests', (req, res) => {
  try {
    const { requestedBy, status } = req.query;
    let bookRequests = readBookRequests();

    if (requestedBy) {
      bookRequests = bookRequests.filter(
        (request) => String(request?.requestedBy) === String(requestedBy)
      );
    }

    if (status) {
      const normalizedStatus = String(status).toLowerCase();
      bookRequests = bookRequests.filter(
        (request) => String(request?.status || '').toLowerCase() === normalizedStatus
      );
    }

    res.json({ bookRequests });
  } catch (err) {
    console.error('Error fetching book requests:', err);
    res.status(500).json({ error: 'Failed to fetch book requests.' });
  }
});

app.post('/api/book-requests/:id/review', (req, res) => {
  try {
    const { id } = req.params;
    const { isApproved, librarianUsername, rejectionReason } = req.body || {};
    const bookRequests = readBookRequests();
    const requestIndex = findBookRequestIndex(bookRequests, id);

    if (requestIndex === -1) {
      return res.status(404).json({ error: 'Book request not found.' });
    }

    const requestEntry = bookRequests[requestIndex];
    const nextStatus = isApproved ? 'approved' : 'rejected';

    if (!isApproved && !String(rejectionReason || '').trim()) {
      return res.status(400).json({ error: 'rejectionReason is required when rejecting.' });
    }

    requestEntry.status = nextStatus;
    requestEntry.reviewedAt = new Date().toISOString();
    requestEntry.reviewedBy = librarianUsername ? String(librarianUsername) : 'librarian';
    requestEntry.rejectionReason = isApproved ? '' : String(rejectionReason).trim();
    bookRequests[requestIndex] = requestEntry;
    writeBookRequests(bookRequests);

    if (!isApproved) {
      addNotificationForUser(
        requestEntry.requestedBy,
        'other',
        `Book request rejected: "${requestEntry.title}" was rejected. Reason: ${requestEntry.rejectionReason}`
      );
    }

    res.json({
      message: `Book request ${isApproved ? 'approved' : 'rejected'} successfully.`,
      request: requestEntry,
    });
  } catch (err) {
    console.error('Error reviewing book request:', err);
    res.status(500).json({ error: 'Failed to review book request.' });
  }
});

app.post('/api/book-requests/:id/upload', async (req, res) => {
  try {
    const { id } = req.params;
    const { librarianUsername, description } = req.body || {};

    const bookRequests = readBookRequests();
    const requestIndex = findBookRequestIndex(bookRequests, id);
    if (requestIndex === -1) {
      return res.status(404).json({ error: 'Book request not found.' });
    }

    const requestEntry = bookRequests[requestIndex];
    if (!['approved', 'pending'].includes(String(requestEntry.status))) {
      return res.status(409).json({ error: 'Only pending or approved requests can be uploaded.' });
    }

    const books = readBooks();
    const generatedDescription = String(description || '').trim() || await generateBookSummary({
      title: requestEntry.title,
      author: requestEntry.author,
      genre: requestEntry.genre,
      summaryStyle: 'medium',
      notes: requestEntry.reason,
    });
    const newBook = {
      id: Date.now(),
      title: requestEntry.title,
      authorUsername: 'library',
      authorFullName: requestEntry.author,
      genre: requestEntry.genre,
      summary: generatedDescription,
      publishDate: new Date().toISOString().split('T')[0],
      approved: true,
      status: 'available',
      borrowCount: 0,
    };

    books.push(newBook);
    writeBooks(books);

    requestEntry.status = 'uploaded';
    requestEntry.reviewedAt = requestEntry.reviewedAt || new Date().toISOString();
    requestEntry.reviewedBy = requestEntry.reviewedBy || (librarianUsername ? String(librarianUsername) : 'librarian');
    requestEntry.uploadedAt = new Date().toISOString();
    requestEntry.uploadedBookId = newBook.id;
    requestEntry.rejectionReason = '';
    bookRequests[requestIndex] = requestEntry;
    writeBookRequests(bookRequests);

    addNotificationForUser(
      requestEntry.requestedBy,
      'other',
      `Your requested book "${requestEntry.title}" has been approved and uploaded to the library system.`
    );

    res.json({
      message: 'Book request uploaded successfully.',
      request: requestEntry,
      book: newBook,
      summaryGenerated: !String(description || '').trim(),
    });
  } catch (err) {
    console.error('Error uploading requested book:', err);
    res.status(500).json({ error: 'Failed to upload requested book.' });
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
    const books = readBooks();
    const users = readUsers()
      .map((user) => toManageableUserView(user, books))
      .filter(Boolean);
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

app.get('/api/users', (req, res) => {
  try {
    const books = readBooks();
    const users = readUsers()
      .map((user) => toManageableUserView(user, books))
      .filter(Boolean);
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Update user details
function updateUserDetails(req, res) {
  try {
    const userId = req.params.id;
    const { fullName, role, status, employeeId, bio } = req.body || {};

    const users = readUsers().map(normalizeUserRecord).filter(Boolean);
    const userIndex = users.findIndex((user) => String(user.username) === String(userId));
    if (userIndex === -1) {
      return res.status(404).json({ error: 'User not found' });
    }

    const nextFullName = typeof fullName === 'string' ? fullName.trim() : users[userIndex].fullName;
    const nextRole = typeof role === 'string' ? role.toLowerCase().trim() : users[userIndex].role;
    const nextStatus = typeof status === 'string' ? status.toLowerCase().trim() : users[userIndex].status;

    if (!nextFullName) {
      return res.status(400).json({ error: 'Full name is required.' });
    }
    if (!VALID_USER_ROLES.includes(nextRole)) {
      return res.status(400).json({ error: 'Invalid role.' });
    }
    if (!VALID_USER_STATUSES.includes(nextStatus)) {
      return res.status(400).json({ error: 'Invalid status.' });
    }

    users[userIndex].fullName = nextFullName;
    users[userIndex].role = nextRole;
    users[userIndex].status = nextStatus;
    if (typeof employeeId === 'string') {
      users[userIndex].employeeId = employeeId.trim();
    }
    if (typeof bio === 'string') {
      users[userIndex].bio = bio.trim();
    }

    writeUsers(users);
    const books = readBooks();
    const userView = toManageableUserView(users[userIndex], books);
    res.json(userView);
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
}

app.put('/users/:id', updateUserDetails);
app.put('/api/users/:id', updateUserDetails);

// Change user status
function updateUserStatus(req, res) {
  try {
    const userId = req.params.id;
    const { status } = req.body || {};
    const nextStatus = typeof status === 'string' ? status.toLowerCase().trim() : '';

    if (!VALID_USER_STATUSES.includes(nextStatus)) {
      return res.status(400).json({ error: 'Invalid status.' });
    }

    const users = readUsers().map(normalizeUserRecord).filter(Boolean);
    const userIndex = users.findIndex((user) => String(user.username) === String(userId));
    if (userIndex === -1) {
      return res.status(404).json({ error: 'User not found' });
    }

    users[userIndex].status = nextStatus;
    writeUsers(users);

    const books = readBooks();
    const userView = toManageableUserView(users[userIndex], books);
    res.json(userView);
  } catch (error) {
    console.error('Error updating user status:', error);
    res.status(500).json({ error: 'Failed to update user status' });
  }
}

app.patch('/users/:id/status', updateUserStatus);
app.patch('/api/users/:id/status', updateUserStatus);

app.patch('/api/users/bulk', (req, res) => {
  try {
    const { userIds, action, updates } = req.body || {};
    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ error: 'At least one userId is required.' });
    }

    const users = readUsers().map(normalizeUserRecord).filter(Boolean);
    const userSet = new Set(userIds.map((id) => String(id)));
    let changedCount = 0;

    users.forEach((user) => {
      if (!userSet.has(String(user.username))) {
        return;
      }

      if (action === 'deactivate') {
        if (user.status !== 'deactivated') {
          user.status = 'deactivated';
          changedCount += 1;
        }
        return;
      }

      if (action === 'reactivate') {
        if (user.status !== 'active') {
          user.status = 'active';
          changedCount += 1;
        }
        return;
      }

      if (action === 'update-role') {
        const targetRole = String(updates?.role || '').toLowerCase().trim();
        if (!VALID_USER_ROLES.includes(targetRole)) {
          return;
        }
        if (user.role !== targetRole) {
          user.role = targetRole;
          changedCount += 1;
        }
      }
    });

    if (!['deactivate', 'reactivate', 'update-role'].includes(action)) {
      return res.status(400).json({ error: 'Invalid bulk action.' });
    }

    if (action === 'update-role') {
      const targetRole = String(updates?.role || '').toLowerCase().trim();
      if (!VALID_USER_ROLES.includes(targetRole)) {
        return res.status(400).json({ error: 'Invalid role for bulk update.' });
      }
    }

    writeUsers(users);
    const books = readBooks();
    const updatedUsers = users
      .filter((user) => userSet.has(String(user.username)))
      .map((user) => toManageableUserView(user, books))
      .filter(Boolean);

    res.json({ changedCount, users: updatedUsers });
  } catch (error) {
    console.error('Error applying bulk user action:', error);
    res.status(500).json({ error: 'Failed to apply bulk user action.' });
  }
});

// Book Reviews Endpoints
app.post('/api/reviews', (req, res) => {
  const { username, bookId, rating, reviewText } = req.body;

  if (!username || !bookId || !rating) {
    return res.status(400).json({ error: 'username, bookId, and rating are required.' });
  }

  const books = readBooks();
  const numericBookId = Number(bookId);
  const book = books.find((b) => b.id === numericBookId || String(b.id) === String(bookId));

  if (!book) {
    return res.status(404).json({ error: 'Book not found.' });
  }

  if (!canUserReviewBook(username, bookId)) {
    return res.status(403).json({
      error: 'You can only review books you have borrowed or are currently borrowing.',
    });
  }

  const review = submitReview(username, book, rating, reviewText);

  // Send notification to all users (public notification)
  addNotificationForUser(
    username,
    'other',
    `Your review for "${book.title}" was submitted successfully.`
  );

  // Add a notification to librarians about the review
  addNotificationForRole(
    'librarian',
    'other',
    `New review submitted by ${username} for "${book.title}".`
  );

  res.json({ message: 'Review submitted successfully.', review });
});

app.get('/api/reviews/:bookId', async (req, res) => {
  try {
    const { bookId } = req.params;
    const bookReviews = readBookReviews();
    const reviewEntries = ensureBookReviews(bookReviews, bookId);
    const books = readBooks();
    const book = books.find((entry) => String(entry.id) === String(bookId));

    await enrichReviewsWithSentiment(bookReviews, reviewEntries, { bookTitle: book?.title });

    const ratingInfo = getAverageRating(bookId);

    res.json({
      reviews: reviewEntries,
      rating: ratingInfo.average,
      totalReviews: ratingInfo.totalReviews,
    });
  } catch (err) {
    console.error('Error fetching reviews for book:', err);
    res.status(500).json({ error: 'Failed to fetch reviews.' });
  }
});

app.get('/api/book/:bookId/rating', (req, res) => {
  const { bookId } = req.params;

  const ratingInfo = getAverageRating(bookId);
  res.json(ratingInfo);
});

// Author Statistics Endpoints
// GET /api/author-statistics/:username - Fetch statistics for author's published books
app.get('/api/author-statistics/:username', (req, res) => {
  try {
    const { username } = req.params;
    const publishedBooks = readPublishedBooks();
    const authorBooks = publishedBooks[username] || {};
    const books = readBooks();
    
    const statistics = {
      totalBooks: 0,
      totalReads: 0,
      averageRating: 0,
      totalReviews: 0,
      totalBorrows: 0,
      books: []
    };
    
    Object.entries(authorBooks).forEach(([bookId, publishedBook]) => {
      if (publishedBook.status === 'approved') {
        statistics.totalBooks += 1;
        
        // Find corresponding book in books.json for borrow count
        const libraryBook = books.find(b => String(b.id) === String(bookId));
        const borrowCount = libraryBook ? (Number(libraryBook.borrowCount) || 0) : 0;
        statistics.totalBorrows += borrowCount;
        
        // Get reviews and ratings
        const reviews = getReviewsForBook(bookId);
        const ratingInfo = getAverageRating(bookId);
        statistics.totalReviews += ratingInfo.totalReviews;
        statistics.totalReads += borrowCount;
        
        const bookStats = {
          id: bookId,
          title: publishedBook.title || 'Untitled',
          genre: publishedBook.genre || 'Unknown',
          reads: borrowCount,
          rating: ratingInfo.average,
          reviewCount: ratingInfo.totalReviews,
        };
        statistics.books.push(bookStats);
      }
    });
    
    // Calculate average rating
    if (statistics.totalReviews > 0) {
      let totalRating = 0;
      Object.keys(authorBooks).forEach(bookId => {
        const reviews = getReviewsForBook(bookId);
        reviews.forEach(review => {
          totalRating += review.rating;
        });
      });
      statistics.averageRating = (totalRating / statistics.totalReviews).toFixed(1);
    }
    
    res.json(statistics);
  } catch (err) {
    console.error('Error fetching author statistics:', err);
    res.status(500).json({ error: 'Failed to fetch author statistics.' });
  }
});

// GET /api/author-trends/:username - Fetch borrowing trends for author's published books
app.get('/api/author-trends/:username', (req, res) => {
  try {
    const { username } = req.params;
    const { period = 'monthly' } = req.query; // 'weekly' or 'monthly'
    const publishedBooks = readPublishedBooks();
    const authorBooks = publishedBooks[username] || {};
    const readingHistory = readReadingHistory();

    // Get author's book IDs
    const authorBookIds = new Set();
    Object.entries(authorBooks).forEach(([bookId, publishedBook]) => {
      if (publishedBook.status === 'approved') {
        authorBookIds.add(String(bookId));
      }
    });

    // Build trends
    const trends = {};
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    // Process reading history for all users
    Object.entries(readingHistory).forEach(([historyUsername, entries]) => {
      entries.forEach(entry => {
        if (authorBookIds.has(String(entry.bookId))) {
          const date = new Date(entry.borrowDate);
          if (date >= sixMonthsAgo) {
            let key;
            if (period === 'weekly') {
              const weekStart = new Date(date);
              weekStart.setDate(date.getDate() - date.getDay());
              key = weekStart.toISOString().split('T')[0];
            } else {
              key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            }

            if (!trends[key]) {
              trends[key] = { date: key, borrows: 0, reads: 0, returns: 0 };
            }
            trends[key].borrows += 1;
            trends[key].reads += 1;

            if (entry.returnDate) {
              trends[key].returns += 1;
            }
          }
        }
      });
    });

    const trendArray = Object.values(trends)
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    res.json({
      period,
      trends: trendArray,
      authorBookCount: authorBookIds.size,
    });
  } catch (err) {
    console.error('Error fetching author trends:', err);
    res.status(500).json({ error: 'Failed to fetch author trends.' });
  }
});

// Librarian Endpoints - Manage All Published Books
// GET /api/librarian/published-books - Fetch all published books (across all authors)
app.get('/api/librarian/published-books', (req, res) => {
  try {
    const publishedBooks = readPublishedBooks();
    const books = readBooks();
    const allBooks = [];
    
    Object.entries(publishedBooks).forEach(([authorUsername, authorBooks]) => {
      Object.entries(authorBooks).forEach(([bookId, publishedBook]) => {
        const libraryBook = books.find(b => String(b.id) === String(bookId));
        const borrowCount = libraryBook ? (Number(libraryBook.borrowCount) || 0) : 0;
        
        allBooks.push({
          id: bookId,
          title: publishedBook.title || 'Untitled',
          author: authorUsername,
          genre: publishedBook.genre || 'Unknown',
          description: publishedBook.description || '',
          status: publishedBook.status || 'pending',
          reads: borrowCount,
          coverPath: publishedBook.coverPath || '',
          filePath: publishedBook.filePath || '',
        });
      });
    });
    
    res.json({ books: allBooks });
  } catch (err) {
    console.error('Error fetching all published books:', err);
    res.status(500).json({ error: 'Failed to fetch published books.' });
  }
});

// POST /api/librarian/add-book - Librarian adds a new book directly
app.post('/api/librarian/add-book',
  upload.fields([{ name: 'file', maxCount: 1 }, { name: 'cover', maxCount: 1 }]),
  (req, res) => {
    try {
      const { title, author, genre, description } = req.body;
      
      if (!title || !author || !genre) {
        return res.status(400).json({ error: 'Title, Author, and Genre are required.' });
      }
      
      if (!req.files || !req.files.file) {
        return res.status(400).json({ error: 'Book PDF file is required.' });
      }
      
      const pdfFile = req.files.file[0];
      const coverFile = req.files.cover && req.files.cover[0];
      
      // Normalize paths to forward slashes for consistency across platforms
      const normalizedPdfPath = pdfFile.path.replace(/\\/g, '/');
      const normalizedCoverPath = coverFile ? coverFile.path.replace(/\\/g, '/') : '';
      
      if (pdfFile.size > MAX_BOOK_FILE_SIZE_BYTES) {
        return res.status(400).json({ error: 'Book PDF must be smaller than 25 MB.' });
      }
      
      if (coverFile && coverFile.size > MAX_COVER_FILE_SIZE_BYTES) {
        return res.status(400).json({ error: 'Cover image must be smaller than 5 MB.' });
      }
      
      const relativePdfPath = path.relative(__dirname, normalizedPdfPath).replace(/\\/g, '/');
      const relativeCoverPath = coverFile ? path.relative(__dirname, normalizedCoverPath).replace(/\\/g, '/') : '';
      
      const books = readBooks();
      const newBook = {
        id: Date.now(),
        title,
        authorUsername: 'librarian',
        authorFullName: author,
        genre,
        description,
        filePath: relativePdfPath,
        coverPath: relativeCoverPath,
        publishDate: new Date().toISOString().split('T')[0],
        status: 'available',
        approved: true,
        borrowCount: 0,
      };
      
      books.push(newBook);
      writeBooks(books);
      
      // Also add to publishedBooks.json
      const publishedBooks = readPublishedBooks();
      const librarianBooks = ensureAuthorPublishedBooks(publishedBooks, 'librarian');
      librarianBooks[newBook.id] = {
        id: newBook.id,
        title,
        genre,
        description,
        status: 'approved',
        borrowed: false,
        filePath: relativePdfPath,
        coverPath: relativeCoverPath,
        publishDate: newBook.publishDate,
      };
      writePublishedBooks(publishedBooks);
      
      addNotificationForRole(
        'librarian',
        'other',
        `New book added: "${title}" by ${author}.`
      );
      
      res.json({ message: 'Book added successfully.', book: newBook });
    } catch (err) {
      console.error('Error adding book:', err);
      res.status(500).json({ error: 'Failed to add book.' });
    }
  }
);

// PATCH /api/librarian/published-books/:bookId - Librarian updates any book
app.patch('/api/librarian/published-books/:bookId', (req, res) => {
  try {
    const { bookId } = req.params;
    const { title, genre, description } = req.body;
    
    const publishedBooks = readPublishedBooks();
    let targetBook = null;
    let authorUsername = null;
    
    // Find the book in published books
    for (const [author, authorBooks] of Object.entries(publishedBooks)) {
      if (authorBooks[bookId]) {
        targetBook = authorBooks[bookId];
        authorUsername = author;
        break;
      }
    }
    
    if (!targetBook) {
      return res.status(404).json({ error: 'Book not found.' });
    }
    
    // Update fields
    if (title !== undefined) targetBook.title = title;
    if (genre !== undefined) targetBook.genre = genre;
    if (description !== undefined) targetBook.description = description;
    
    // Sync with books.json
    const books = readBooks();
    const libraryBook = books.find(b => String(b.id) === String(bookId));
    if (libraryBook) {
      if (title !== undefined) libraryBook.title = title;
      if (genre !== undefined) libraryBook.genre = genre;
      if (description !== undefined) libraryBook.description = description;
      writeBooks(books);
    }
    
    writePublishedBooks(publishedBooks);
    res.json({ message: 'Book updated successfully.', book: targetBook });
  } catch (err) {
    console.error('Error updating book:', err);
    res.status(500).json({ error: 'Failed to update book.' });
  }
});

// DELETE /api/librarian/published-books/:bookId - Librarian deletes any book
app.delete('/api/librarian/published-books/:bookId', (req, res) => {
  try {
    const { bookId } = req.params;
    
    const publishedBooks = readPublishedBooks();
    let bookTitle = null;
    let authorUsername = null;
    
    // Find and delete from published books
    for (const [author, authorBooks] of Object.entries(publishedBooks)) {
      if (authorBooks[bookId]) {
        bookTitle = authorBooks[bookId].title;
        authorUsername = author;
        delete authorBooks[bookId];
        break;
      }
    }
    
    if (!bookTitle) {
      return res.status(404).json({ error: 'Book not found.' });
    }
    
    writePublishedBooks(publishedBooks);
    
    // Also delete from books.json
    const books = readBooks();
    const libraryBookIndex = books.findIndex(b => String(b.id) === String(bookId));
    if (libraryBookIndex !== -1) {
      const removedBook = books[libraryBookIndex];
      books.splice(libraryBookIndex, 1);
      writeBooks(books);
      
      // Notify borrower if book is currently borrowed
      if (removedBook.borrowedBy) {
        addNotificationForUser(
          removedBook.borrowedBy,
          'bookDeletionNotices',
          `Book deletion notice: "${bookTitle}" was deleted by a librarian.`
        );
      }
    }
    
    addNotificationForRole(
      'librarian',
      'other',
      `Book deleted: "${bookTitle}".`
    );
    
    res.json({ message: 'Book deleted successfully.' });
  } catch (err) {
    console.error('Error deleting book:', err);
    res.status(500).json({ error: 'Failed to delete book.' });
  }
});

// Author Review Response Endpoints

// POST /api/reviews/:bookId/:reviewId/response - Author responds to a review
app.post('/api/reviews/:bookId/:reviewId/response', (req, res) => {
  try {
    const { bookId, reviewId } = req.params;
    const { authorUsername, responseText } = req.body;

    if (!authorUsername || !responseText || !String(responseText).trim()) {
      return res.status(400).json({ error: 'authorUsername and responseText are required.' });
    }

    const bookReviews = readBookReviews();
    const books = readBooks();
    const book = books.find((entry) => String(entry.id) === String(bookId));
    const bookIdStr = String(bookId);
    const reviews = bookReviews[bookIdStr] || [];
    const reviewIndex = reviews.findIndex((r) => r.id === reviewId);

    if (reviewIndex === -1) {
      return res.status(404).json({ error: 'Review not found.' });
    }

    const review = reviews[reviewIndex];
    if (!review.responses) {
      review.responses = [];
    }

    const response = {
      id: randomUUID(),
      authorUsername,
      responseText: String(responseText).trim(),
      respondedAt: new Date().toISOString(),
    };

    review.responses.push(response);
    writeBookReviews(bookReviews);

    // Send notification to the reviewer
    if (review.username) {
      addNotificationForUser(
        review.username,
        'other',
        `The author replied to your review for "${book?.title || review.bookTitle || 'your book'}": ${String(responseText).trim().slice(0, 180)}${String(responseText).trim().length > 180 ? '...' : ''}`
      );
    }

    res.json({ message: 'Response added successfully.', response });
  } catch (err) {
    console.error('Error adding review response:', err);
    res.status(500).json({ error: 'Failed to add review response.' });
  }
});

// POST /api/reviews/:bookId/:reviewId/flag - Flag a review as inappropriate
app.post('/api/reviews/:bookId/:reviewId/flag', (req, res) => {
  try {
    const { bookId, reviewId } = req.params;
    const { reason } = req.body;

    if (!reason || !String(reason).trim()) {
      return res.status(400).json({ error: 'reason is required.' });
    }

    const bookReviews = readBookReviews();
    const bookIdStr = String(bookId);
    const reviews = bookReviews[bookIdStr] || [];
    const reviewIndex = reviews.findIndex((r) => r.id === reviewId);

    if (reviewIndex === -1) {
      return res.status(404).json({ error: 'Review not found.' });
    }

    const review = reviews[reviewIndex];
    review.flagged = true;
    review.flagReason = String(reason).trim();
    review.flaggedAt = new Date().toISOString();

    writeBookReviews(bookReviews);

    // Notify librarians
    addNotificationForRole(
      'librarian',
      'other',
      `Review flagged as inappropriate: "${review.reviewText?.substring(0, 50)}" by ${review.username}.`
    );

    res.json({ message: 'Review flagged successfully.' });
  } catch (err) {
    console.error('Error flagging review:', err);
    res.status(500).json({ error: 'Failed to flag review.' });
  }
});

// GET /api/reviews/author/:authorUsername/books - Get all reviews for an author's books
app.get('/api/reviews/author/:authorUsername/books', async (req, res) => {
  try {
    const { authorUsername } = req.params;
    const publishedBooks = readPublishedBooks();
    const authorBooks = publishedBooks[authorUsername] || {};
    const bookReviews = readBookReviews();

    const allReviews = [];
    let changed = false;

    for (const [bookId, bookInfo] of Object.entries(authorBooks)) {
      if (bookInfo.status === 'approved') {
        const reviews = ensureBookReviews(bookReviews, bookId);
        const reviewSentimentChanged = await enrichReviewsWithSentiment(bookReviews, reviews, { bookTitle: bookInfo.title });
        changed = changed || reviewSentimentChanged;

        reviews.forEach((review) => {
          allReviews.push({
            ...review,
            bookId,
            bookTitle: bookInfo.title || 'Untitled',
          });
        });
      }
    }

    if (changed) {
      writeBookReviews(bookReviews);
    }

    const analytics = buildReviewAnalytics(allReviews);

    res.json({ reviews: allReviews, analytics });
  } catch (err) {
    console.error('Error fetching author reviews:', err);
    res.status(500).json({ error: 'Failed to fetch author reviews.' });
  }
});

// DELETE /api/reviews/:bookId/:reviewId/response/:responseId - Delete an author response
app.delete('/api/reviews/:bookId/:reviewId/response/:responseId', (req, res) => {
  try {
    const { bookId, reviewId, responseId } = req.params;

    const bookReviews = readBookReviews();
    const bookIdStr = String(bookId);
    const reviews = bookReviews[bookIdStr] || [];
    const reviewIndex = reviews.findIndex((r) => r.id === reviewId);

    if (reviewIndex === -1) {
      return res.status(404).json({ error: 'Review not found.' });
    }

    const review = reviews[reviewIndex];
    if (!Array.isArray(review.responses)) {
      return res.status(404).json({ error: 'Response not found.' });
    }

    const responseIndex = review.responses.findIndex((r) => r.id === responseId);
    if (responseIndex === -1) {
      return res.status(404).json({ error: 'Response not found.' });
    }

    review.responses.splice(responseIndex, 1);
    writeBookReviews(bookReviews);

    res.json({ message: 'Response deleted successfully.' });
  } catch (err) {
    console.error('Error deleting review response:', err);
    res.status(500).json({ error: 'Failed to delete review response.' });
  }
});

// LLM-Based Summary Generation Endpoint
// POST /api/generate-summary - Generate a book summary using LLM
app.post('/api/generate-summary', summaryUpload.single('file'), async (req, res) => {
  try {
    const { title, author, genre, summaryStyle } = req.body || {};

    if (!title || !genre || !req.file) {
      return res.status(400).json({ error: 'title, genre, and file are required.' });
    }

    const summary = await generateBookSummaryFromPdf({
      title,
      author,
      genre,
      summaryStyle,
      pdfBuffer: req.file.buffer,
    });

    res.json({ summary });
  } catch (err) {
    console.error('Error generating summary:', err);
    res.status(500).json({ error: 'Failed to generate summary.' });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
