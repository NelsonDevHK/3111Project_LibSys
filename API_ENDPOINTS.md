# API Endpoints Reference

## New Endpoints Added for Three Features

### 1. Author Statistics

#### GET `/api/author-statistics/:username`
**Purpose**: Fetch comprehensive statistics for an author's published books

**Parameters**:
- `username` (path param): Author's username

**Response**:
```json
{
  "totalBooks": 3,
  "totalReads": 25,
  "averageRating": 4.2,
  "totalReviews": 15,
  "books": [
    {
      "id": "1234567890",
      "title": "Book Title",
      "genre": "Fiction",
      "reads": 10,
      "rating": 4.5,
      "reviewCount": 8
    }
  ]
}
```

**Used By**: AuthorStatisticsScreen component in Author Portal

---

### 2. Librarian - Manage All Published Books

#### GET `/api/librarian/published-books`
**Purpose**: Fetch all published books across all authors in the system

**Response**:
```json
{
  "books": [
    {
      "id": "1234567890",
      "title": "Book Title",
      "author": "author_username",
      "genre": "Fiction",
      "description": "Book description",
      "status": "approved",
      "reads": 5,
      "coverPath": "path/to/cover.jpg",
      "filePath": "path/to/book.pdf"
    }
  ]
}
```

**Used By**: LibrarianManagePublishedBooksScreen component

---

#### POST `/api/librarian/add-book`
**Purpose**: Add a new book directly to the library system

**Content-Type**: `multipart/form-data`

**Body Parameters**:
- `title` (string, required): Book title
- `author` (string, required): Author full name
- `genre` (string, required): Book genre
- `description` (string, optional): Book description
- `file` (file, required): PDF file (max 25 MB)
- `cover` (file, optional): Cover image - JPEG/PNG (max 5 MB)

**Response**:
```json
{
  "message": "Book added successfully.",
  "book": {
    "id": "1234567890",
    "title": "Book Title",
    "author": "library",
    "genre": "Fiction",
    "description": "Description",
    "filePath": "bookAssets/1234567890.pdf",
    "coverPath": "bookAssets/1234567891.jpg",
    "publishDate": "2026-05-02",
    "status": "available"
  }
}
```

**Error Responses**:
- 400: Missing required fields or invalid file
- 500: Server error

---

#### PATCH `/api/librarian/published-books/:bookId`
**Purpose**: Update any published book's details

**Parameters**:
- `bookId` (path param): Book ID to update

**Body**:
```json
{
  "title": "New Title",
  "genre": "New Genre",
  "description": "New Description"
}
```

**Response**:
```json
{
  "message": "Book updated successfully.",
  "book": {
    "id": "1234567890",
    "title": "New Title",
    "genre": "New Genre",
    "description": "New Description",
    "status": "approved",
    "borrowed": false
  }
}
```

**Updates**:
- Automatically syncs changes to `publishedBooks.json`, `books.json`, and `pendingBooks.json`
- Updates reading history references if needed

---

#### DELETE `/api/librarian/published-books/:bookId`
**Purpose**: Delete a published book from the system

**Parameters**:
- `bookId` (path param): Book ID to delete

**Response**:
```json
{
  "message": "Book deleted successfully."
}
```

**Side Effects**:
- Removes from all system files (books.json, publishedBooks.json)
- Notifies currently borrowing user (if applicable)
- Logs deletion notification for librarians

**Error Responses**:
- 404: Book not found
- 500: Server error

---

## Existing Endpoints Used

### Reading History (Already Existed)

#### GET `/api/reading-history/:username`
**Purpose**: Fetch reading history for a user

**Response**:
```json
{
  "history": [
    {
      "id": "history-id",
      "bookId": "123",
      "bookTitle": "Book Title",
      "author": "Author Name",
      "genre": "Fiction",
      "borrowDate": "2026-04-01T10:00:00Z",
      "returnDate": "2026-04-15T10:00:00Z",
      "status": "returned",
      "readingDurationMinutes": 14400,
      "progress": {
        "bookmarkPage": 250,
        "highlightsCount": 5,
        "lastReadAt": "2026-04-15T09:30:00Z"
      }
    }
  ]
}
```

---

## Data Synchronization

### When a Book is Added (Librarian)
1. Added to `books.json` (with status: "available")
2. Added to `publishedBooks.json` (with author: "librarian")
3. Notification sent to all librarians

### When a Book is Updated (Librarian)
1. Updated in `publishedBooks.json`
2. Updated in `books.json` (if exists)
3. Updated in `pendingBooks.json` (if still pending)
4. No user notifications (internal system update)

### When a Book is Deleted (Librarian)
1. Deleted from `publishedBooks.json`
2. Deleted from `books.json` (if exists)
3. Borrowing user notified (if book was borrowed)
4. Notification sent to all librarians

---

## Rate Limiting & Performance
- No rate limiting implemented (add if needed)
- File upload limits:
  - Books: 25 MB max
  - Covers: 5 MB max
- Data refresh interval: 15 seconds (automatic polling)

---

## Error Handling Standards

### Standard Error Response Format
```json
{
  "error": "Descriptive error message"
}
```

### Common Error Codes
- 400: Bad Request (missing/invalid parameters)
- 404: Not Found (resource doesn't exist)
- 409: Conflict (operation cannot be completed)
- 500: Internal Server Error

---

## Testing the APIs

### Using cURL

**Get Author Statistics**:
```bash
curl http://localhost:4000/api/author-statistics/author_username
```

**Get All Published Books** (Librarian):
```bash
curl http://localhost:4000/api/librarian/published-books
```

**Add New Book** (with files):
```bash
curl -X POST http://localhost:4000/api/librarian/add-book \
  -F "title=My Book" \
  -F "author=John Doe" \
  -F "genre=Fiction" \
  -F "description=A great book" \
  -F "file=@/path/to/book.pdf" \
  -F "cover=@/path/to/cover.jpg"
```

**Update Book**:
```bash
curl -X PATCH http://localhost:4000/api/librarian/published-books/123 \
  -H "Content-Type: application/json" \
  -d '{"title":"New Title","genre":"Fantasy"}'
```

**Delete Book**:
```bash
curl -X DELETE http://localhost:4000/api/librarian/published-books/123
```

---

## Frontend Integration Points

### AuthorStatisticsScreen
- Calls: `GET /api/author-statistics/:username`
- Frequency: On load + every 15 seconds
- Used for: Displaying author's book metrics and charts

### LibrarianManagePublishedBooksScreen
- Calls: 
  - `GET /api/librarian/published-books` (load + every 15s)
  - `POST /api/librarian/add-book` (on form submit)
  - `PATCH /api/librarian/published-books/:bookId` (on edit submit)
  - `DELETE /api/librarian/published-books/:bookId` (on delete confirm)
- Used for: Managing all published books in system

### ReadingHistoryScreen
- Calls: `GET /api/reading-history/:username`
- Frequency: On load + every 15 seconds
- Used for: Displaying user's reading history with filters

