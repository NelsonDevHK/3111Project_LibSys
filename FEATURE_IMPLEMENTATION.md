# Feature Implementation Summary

## Overview
This document summarizes the three major features implemented for the library management system:
1. **Student/Staff Review System** - Submit and view book reviews with ratings
2. **Author Response to Reviews** - Authors can respond to reviews and flag inappropriate feedback
3. **Librarian Book Request Management** - Manage student/staff book requests and upload books

---

## Feature 1: Student/Staff Review System

### Components & Locations
- **Frontend Components:**
  - [ReviewForm.js](src/components/Student_Staff/ReviewForm.js) - Form for submitting reviews
  - [ReviewsDisplay.js](src/components/Student_Staff/ReviewsDisplay.js) - Display reviews and ratings
  - Integrated in [AvailableBooks.js](src/components/Student_Staff/AvailableBooks.js)

### How It Works
1. **Submit a Review:**
   - Students/Staff click "Reviews" button on any book in Available Books screen
   - They can submit a rating (1-5 stars) and optional review text (max 500 characters)
   - Review is immediately stored and displayed

2. **View Reviews:**
   - All users can see average rating and all reviews for each book
   - Reviews display username, date, rating, and text
   - Users can edit their own review by clicking "Edit Your Review"

### API Endpoints
- `POST /api/reviews` - Submit a new review
  - Body: `{username, bookId, rating, reviewText}`
- `GET /api/reviews/:bookId` - Get all reviews for a book
  - Returns: `{reviews, rating, totalReviews}`
- `GET /api/book/:bookId/rating` - Get average rating for a book

### Data Storage
- Reviews stored in `server/bookReviews.json`
- Format: `{bookId: [{id, username, rating, reviewText, submittedAt, responses: [], flagged, flagReason}]}`

---

## Feature 2: Author Response to Reviews & Flagging

### Components & Locations
- **Frontend Component:**
  - [AuthorReviewsScreen.js](src/components/Author/AuthorReviewsScreen.js) - Author review management
  - Integrated in [AuthorPortal.js](src/components/Author/AuthorPortal.js)

### How It Works
1. **View Reviews:**
   - Authors see all reviews for their published books
   - Reviews are organized by book title
   - Each review shows: reviewer name, date, rating, and text

2. **Add Response:**
   - Authors click "Add Response" to expand the response form
   - They can write a response (max 500 characters)
   - Click "Submit Response" to post the response
   - The reviewer gets a notification

3. **Flag Inappropriate Reviews:**
   - Authors can click "Flag as Inappropriate"
   - They must provide a reason for flagging
   - Librarians are notified about flagged reviews
   - Flagged reviews show a visual indicator

4. **Delete Response:**
   - Authors can delete their own responses
   - Only the author who posted the response can delete it

### API Endpoints
- `GET /api/reviews/author/:authorUsername/books` - Get all reviews for author's books
- `POST /api/reviews/:bookId/:reviewId/response` - Add response to review
  - Body: `{authorUsername, responseText}`
- `POST /api/reviews/:bookId/:reviewId/flag` - Flag review as inappropriate
  - Body: `{reason}`
- `DELETE /api/reviews/:bookId/:reviewId/response/:responseId` - Delete response

### Features
✅ Authors can respond to reviews  
✅ Authors can flag inappropriate reviews  
✅ Reviewers get notifications when authors respond  
✅ Librarians are notified of flagged reviews  
✅ Responses and flags are permanently stored  

---

## Feature 3: Librarian Book Request Management

### Components & Locations
- **Frontend Component:**
  - [LibrarianBookRequestsScreen.js](src/components/Librarian/LibrarianBookRequestsScreen.js)
  - Integrated in [LibrarianPortal.js](src/components/Librarian/LibrarianPortal.js)

### How It Works
1. **View Requests:**
   - Librarians see a table of all book requests
   - Can filter by status: Pending, Approved, Rejected, Uploaded, or All
   - Each request shows: title, author, genre, requester, status, and submission date

2. **Review Requests:**
   - Click "View Details" to open detailed modal
   - See full request information and requester's reason

3. **Approve/Reject:**
   - For pending requests, librarians can approve or reject
   - Rejection requires a reason to be provided
   - Requesters are notified of the decision

4. **Upload Book:**
   - For approved requests, librarians can upload the book
   - They can provide/generate a book description
   - Book becomes available in the library

5. **Generate Summary:**
   - Click "Generate Summary (LLM)" to generate a book description
   - Uses the LLM endpoint to create a summary based on title, author, and genre
   - Summary can be edited before uploading

### API Endpoints
- `GET /api/book-requests` - Get book requests (with status filter)
  - Query params: `status`, `requestedBy`
- `POST /api/book-requests/:id/review` - Approve or reject request
  - Body: `{isApproved, librarianUsername, rejectionReason?}`
- `POST /api/book-requests/:id/upload` - Upload book to library
  - Body: `{librarianUsername, description?}`
- `POST /api/generate-summary` - Generate book summary using LLM
  - Body: `{title, author, genre, reason}`

### Features
✅ View all book requests with status filtering  
✅ Approve or reject requests  
✅ Generate book summaries using LLM  
✅ Upload approved books to library  
✅ Notify requesters of approval/rejection  
✅ Track request status and history  

### Request Statuses
- **pending** - Awaiting librarian review
- **approved** - Approved, ready to upload
- **rejected** - Rejected with reason
- **uploaded** - Successfully added to library

---

## Data Flow Diagram

### Review Workflow
```
Student/Staff submits review
    ↓
Review stored in bookReviews.json
    ↓
Display on Available Books screen
    ↓
Author sees review in AuthorReviewsScreen
    ↓
Author can respond or flag
    ↓
Reviewer notified of response
    ↓
Librarians notified if review is flagged
```

### Book Request Workflow
```
Student/Staff submits request
    ↓
Request stored in bookRequests.json
    ↓
Librarian sees in BookRequestsScreen
    ↓
Librarian approves/rejects
    ↓
Requester notified
    ↓
If approved: Librarian uploads book
    ↓
Book added to library
    ↓
Requester notified of upload
```

---

## File Structure

### New/Modified Files
```
src/components/
├── Author/
│   ├── AuthorReviewsScreen.js (NEW)
│   └── AuthorPortal.js (MODIFIED - added AuthorReviewsScreen)
├── Librarian/
│   ├── LibrarianBookRequestsScreen.js (NEW)
│   └── LibrarianPortal.js (MODIFIED - added LibrarianBookRequestsScreen)
└── Student_Staff/
    ├── ReviewForm.js (EXISTING)
    └── ReviewsDisplay.js (EXISTING)

server/
├── index.js (MODIFIED - added review response endpoints and LLM summary)
├── bookReviews.json (NEW - stores review data)
└── bookRequests.json (NEW - stores request data)
```

---

## API Endpoints Summary

### Review Endpoints
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/reviews` | Submit a review |
| GET | `/api/reviews/:bookId` | Get reviews for a book |
| GET | `/api/book/:bookId/rating` | Get average rating |
| GET | `/api/reviews/author/:authorUsername/books` | Get reviews for author's books |
| POST | `/api/reviews/:bookId/:reviewId/response` | Add author response |
| POST | `/api/reviews/:bookId/:reviewId/flag` | Flag review |
| DELETE | `/api/reviews/:bookId/:reviewId/response/:responseId` | Delete response |

### Book Request Endpoints
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/book-requests` | Submit book request |
| GET | `/api/book-requests` | Get requests (with filters) |
| POST | `/api/book-requests/:id/review` | Approve/reject request |
| POST | `/api/book-requests/:id/upload` | Upload book |

### Summary Generation Endpoint
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/generate-summary` | Generate book summary using LLM |

---

## Testing Checklist

### Review System
- [ ] Student/Staff can submit review with rating
- [ ] Review appears on book's review display
- [ ] Average rating is calculated correctly
- [ ] User can edit their own review
- [ ] Review text limited to 500 characters
- [ ] Rating is required (1-5 stars)

### Author Review Response
- [ ] Author sees all reviews for their books
- [ ] Author can add response to review
- [ ] Reviewer notified when author responds
- [ ] Author can delete their response
- [ ] Author can flag inappropriate review
- [ ] Librarians notified of flagged reviews

### Book Requests
- [ ] Student/Staff can submit book request
- [ ] Librarian can view all requests
- [ ] Librarian can filter by status
- [ ] Librarian can approve/reject with reason
- [ ] Librarian can upload approved books
- [ ] Requester notified of approval/rejection
- [ ] LLM summary generation works
- [ ] Book appears in library after upload

---

## Configuration

### LLM Endpoint
The system includes a placeholder LLM integration at `/api/generate-summary`. To use a real LLM API:
1. Update the `generateBookSummary()` function in `server/index.js`
2. Add your API key to environment variables
3. Call your preferred LLM API (OpenAI, Claude, etc.)

### Notifications
- Author responses send notifications to reviewers
- Review flags send notifications to librarians
- Request approvals/rejections send notifications to requesters

---

## Future Enhancements

1. **LLM Integration:**
   - Integrate with OpenAI GPT-4 or Claude for better summaries
   - Add support for multiple LLM providers

2. **Web Crawlers:**
   - Add web scraping to find books online
   - Support for downloading book metadata

3. **Review Analytics:**
   - Show review trends over time
   - Sentiment analysis on reviews
   - Most helpful reviews system

4. **Advanced Filtering:**
   - Filter requests by date range
   - Search by partial title/author
   - Sort by submission date or priority

5. **Batch Operations:**
   - Approve multiple requests at once
   - Generate summaries in bulk
   - Export request data to CSV

---

## Known Limitations

1. LLM summary generation is a placeholder (generates basic summaries)
2. No actual web crawler integration (manual upload required)
3. No sentiment analysis on reviews
4. Reviews cannot be edited after submission (only deleted and resubmitted)
5. Response character limit is 500 (can be increased)

---

## Support

For issues or questions about these features:
1. Check the component code in `src/components/`
2. Review API endpoints in `server/index.js`
3. Check console for error messages
4. Verify data files exist in `server/` directory
