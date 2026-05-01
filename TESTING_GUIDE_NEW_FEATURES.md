# Quick Testing Guide

## Features Overview
This guide provides step-by-step instructions to test the three new features implemented in the library management system.

---

## Setup
1. Make sure both the frontend and backend are running:
   ```bash
   # Terminal 1: Backend
   cd library_app/server
   node index.js
   # Expected: "Server is running on http://localhost:4000"

   # Terminal 2: Frontend
   cd library_app
   npm start
   # Expected: App opens on port 3001 (or next available port)
   ```

2. The application is ready to test when you see the login screen.

---

## Test Case 1: Student/Staff Review System

### Objective
Verify that students/staff can submit reviews and ratings, and that ratings display on the available books screen.

### Steps
1. **Login as Student/Staff:**
   - Select "Student" or "Staff" role
   - Use any student/staff account (create one if needed)
   - Username: `student1`, Password: `password123` (or register new)

2. **Submit a Review:**
   - Navigate to "Available Books"
   - Find a book in the table
   - Click the "Reviews" button in the book's row
   - Modal opens showing existing reviews

3. **Add Rating and Review:**
   - In the modal, click "Add a Review" button
   - Click on stars (1-5) to select rating
   - Type review text in the textarea (max 500 chars)
   - Click "Submit Review"
   - Verify success message appears

4. **View Review:**
   - Review should appear in the reviews list below
   - Shows your username, date, rating, and text
   - Average rating updates at top of modal

5. **Edit Review:**
   - Click "Edit Your Review" button
   - Change rating or text
   - Submit to update

### Expected Results
✅ Review submitted successfully  
✅ Average rating calculated (e.g., "3.5 out of 5")  
✅ Review appears in list immediately  
✅ Can edit review  
✅ Character count updates in real-time

---

## Test Case 2: Author Response to Reviews

### Objective
Verify that authors can view reviews, respond to them, and flag inappropriate reviews.

### Steps
1. **Setup Data (if needed):**
   - Make sure there are reviews submitted by students/staff
   - These will appear in author's review screen

2. **Login as Author:**
   - Select "Author" role
   - Use author account: `author1`, Password: `password123` (or register)

3. **Navigate to Reviews Screen:**
   - In Author Portal, scroll to "Reader Reviews & Feedback" section
   - Should see list of all reviews for author's published books

4. **Add Response:**
   - Find a review you want to respond to
   - Click "Add Response" button
   - Type response in textarea (max 500 chars)
   - Click "Submit Response"
   - Response appears under "Your Response(s)" section

5. **Verify Notification:**
   - Switch to student/staff account (open another browser tab)
   - Check notifications
   - Should see: "The author responded to your review"

6. **Delete Response:**
   - Go back to author account
   - Click "Delete" button on your response
   - Response removed after confirmation

7. **Flag Review:**
   - Click "Add Response" for another review
   - In the response form, click "Flag as Inappropriate"
   - Modal opens asking for reason
   - Enter reason (e.g., "Offensive language")
   - Click "Flag Review"

8. **Verify Flag:**
   - Review now shows red flag icon
   - Displays: "🚩 Flagged as inappropriate: [reason]"

### Expected Results
✅ Reviews display grouped by book title  
✅ Can add response to review  
✅ Reviewer gets notification  
✅ Can delete response  
✅ Can flag inappropriate review  
✅ Flagged reviews show visual indicator

---

## Test Case 3: Librarian Book Request Management

### Objective
Verify that librarians can manage book requests, approve/reject them, and upload books.

### Steps
1. **Login as Librarian:**
   - Select "Librarian" role
   - Use: `librarian1`, Password: `password123` (or register)

2. **Create Book Request (as Student first):**
   - Open different browser or use incognito window
   - Login as student
   - Navigate to "Request New Book" (if available in Student portal)
   - Fill form:
     - Title: "The Great Gatsby"
     - Author: "F. Scott Fitzgerald"
     - Genre: "Fiction"
     - Reason: "Classic novel about the American Dream"
   - Click "Submit Request"
   - Verify success message

3. **View Book Requests (as Librarian):**
   - Return to librarian account
   - Scroll to "Book Request Management" section
   - Should see your request in the table with status "pending"

4. **Filter Requests:**
   - Try different status filters: Pending, Approved, Rejected, etc.
   - Table updates accordingly

5. **View Request Details:**
   - Click "View Details" button for the pending request
   - Modal opens showing:
     - Title, Author, Genre
     - Requester info
     - Request reason
     - Status badge

6. **Approve Request:**
   - In modal, click "✓ Approve Request" button
   - Status changes to "approved"
   - Request moves to approved section when filtered

7. **Generate Summary:**
   - Find an approved request
   - Click "View Details"
   - Click "🤖 Generate Summary (LLM)" button
   - Description field auto-populates with generated summary
   - Can edit before uploading

8. **Upload Book:**
   - Click "📤 Upload Book to Library"
   - Verify success message
   - Request status changes to "uploaded"

9. **Test Rejection:**
   - Create another book request (as student)
   - View as librarian
   - Click "View Details"
   - In rejection section, enter reason: "Book already in collection"
   - Click "✕ Reject Request"
   - Requester gets notification of rejection

### Expected Results
✅ Book requests visible in management screen  
✅ Can filter by status  
✅ Can approve requests  
✅ Can reject with reason  
✅ Can generate summaries  
✅ Can upload books to library  
✅ Books appear in Available Books after upload  
✅ Requesters notified of decisions

---

## Test Case 4: Integration Test

### Objective
Verify that all three features work together correctly.

### Workflow
1. **Student submits book request:** "Advanced Python"
2. **Librarian approves:** Uploads to library with generated summary
3. **Student borrows the book:** Using the uploaded book
4. **Student submits review:** Rates it 5 stars, writes positive review
5. **Author (librarian uploaded as "library") can respond:** Since it's from library
6. **Different student sees review:** Average rating shows in Available Books

---

## Troubleshooting

### Reviews Not Saving
- Check browser console for errors
- Verify backend is running on port 4000
- Check `server/bookReviews.json` exists and is readable

### Author Reviews Screen Empty
- Make sure author has published books
- Check that students have submitted reviews for those books
- Verify bookReviews.json has data

### Book Requests Not Appearing
- Create a new request (make sure you're logged in as student/staff)
- Refresh librarian portal page
- Check `server/bookRequests.json` file

### Notifications Not Appearing
- Check browser notifications
- Make sure you're logged into different accounts for different browser tabs
- Refresh notification board
- Check `server/notifications.json`

---

## Database Files
Check these files to verify data is being stored:
- `server/bookReviews.json` - Contains all reviews
- `server/bookRequests.json` - Contains all book requests
- `server/notifications.json` - Contains user notifications

---

## Success Criteria

### Review System
- [ ] Reviews display with average rating
- [ ] Can submit 1-5 star rating
- [ ] Review text (0-500 chars) stored correctly
- [ ] Can edit own review
- [ ] Multiple reviews aggregate rating

### Author Response System
- [ ] Author sees all reviews for books
- [ ] Author can respond (notification sent)
- [ ] Author can flag review (librarian notified)
- [ ] Can delete own responses
- [ ] Flagged reviews show visual indicator

### Book Request System
- [ ] Students can submit requests
- [ ] Librarians can view and filter requests
- [ ] Can approve/reject with reason
- [ ] Can generate summaries
- [ ] Can upload books to library
- [ ] Books appear in Available Books after upload
- [ ] Requesters receive notifications

---

## Performance Considerations
- Reviews list loads quickly even with many reviews
- Book requests table handles 100+ requests smoothly
- LLM summary generation completes in <5 seconds
- Notifications appear in real-time

---

## Next Steps After Testing
1. Deploy to production
2. Add real LLM API integration (OpenAI/Claude)
3. Implement web crawler for book downloads
4. Add analytics dashboard
5. Create mobile app version
