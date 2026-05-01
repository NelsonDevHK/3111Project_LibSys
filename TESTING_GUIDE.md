# Testing Guide - New Features

## Getting Started

### Prerequisites
- Node.js v14 or higher
- npm packages installed: `npm install` (from library_app directory)
- Recharts library installed: `npm install recharts`
- Server running on `http://localhost:4000`

### Starting the Application

**Terminal 1 - Start Backend Server**:
```bash
cd server
npm install (if not already done)
node index.js
# Server will start on port 4000
```

**Terminal 2 - Start Frontend**:
```bash
npm start
# React app will open on http://localhost:3000
```

---

## Feature Testing Checklist

### 1. Reading History Screen (Students & Staff)

#### Test Location
- Login as: Student or Staff user
- Navigate to: Student/Staff Portal
- Find section: "My Reading History"

#### Test Cases

**Test 1.1: Display Reading History**
- [ ] Book list displays correctly
- [ ] Shows columns: Title, Author, Genre, Borrow Date, Return Date, Duration, Progress
- [ ] Reading duration formatted correctly (e.g., "5d 3h 20m")
- [ ] Progress shows: Bookmark page, Highlights count, Last read date

**Test 1.2: Search Functionality**
- [ ] Type in "Search by title" field
- [ ] Results filter in real-time
- [ ] Works for partial titles
- [ ] Case-insensitive search

**Test 1.3: Author Filter**
- [ ] Type author name in "Filter by author" field
- [ ] Results update dynamically
- [ ] Works with partial names

**Test 1.4: Genre Filter**
- [ ] Click "All Genres" dropdown
- [ ] Select different genres
- [ ] Table filters to show only selected genre
- [ ] Returns to all when deselected

**Test 1.5: Date Range Filter**
- [ ] Click date range dropdown
- [ ] Try each option:
  - [ ] All Time (shows all books)
  - [ ] Past Week (only recent)
  - [ ] Past Month
  - [ ] Past 3 Months
  - [ ] Past 6 Months
  - [ ] 1 Year+ (older books only)

**Test 1.6: Auto-Refresh**
- [ ] Borrow a new book
- [ ] Wait 15 seconds
- [ ] New book automatically appears in history
- [ ] No page refresh needed

---

### 2. Author Statistics Screen

#### Test Location
- Login as: Author user
- Navigate to: Author Portal
- Find section: "Published Books Statistics" (appears before "Published Books" section)

#### Test Cases

**Test 2.1: Overview Metrics Display**
- [ ] Card shows "Total Books Published" with count
- [ ] Card shows "Total Reads" with correct sum
- [ ] Card shows "Average Rating" (or N/A if no reviews)
- [ ] Card shows "Total Reviews" with count
- [ ] Cards are styled and visible

**Test 2.2: Book Reads Bar Chart**
- [ ] Chart displays books on X-axis
- [ ] Shows read counts on Y-axis
- [ ] Bars visible with colors
- [ ] Hover shows tooltip with exact values
- [ ] Responsive on different screen sizes

**Test 2.3: Average Ratings Bar Chart**
- [ ] Shows book titles on X-axis
- [ ] Y-axis shows 0-5 rating scale
- [ ] Bars colored consistently
- [ ] Hover shows exact ratings
- [ ] Works even if some books have no ratings

**Test 2.4: Books by Genre Pie Chart**
- [ ] Displays pie slices for each genre
- [ ] Colors differ for each slice
- [ ] Labels show "Genre (count)"
- [ ] Only shows if books exist
- [ ] Pie chart is centered and sized appropriately

**Test 2.5: Detailed Table**
- [ ] Shows columns: Title, Genre, Reads, Avg Rating, Reviews
- [ ] Data matches charts above
- [ ] Works with many books
- [ ] Readable text formatting

**Test 2.6: Empty State**
- [ ] If no books published, shows "No published books yet" message
- [ ] No charts displayed
- [ ] No errors in console

---

### 3. Librarian Manage Published Books

#### Test Location
- Login as: Librarian user
- Navigate to: Librarian Portal
- Find section: "Manage All Published Books" (appears after "New Book Submissions")

#### Test Cases

**Test 3.1: Display Books**
- [ ] Shows table with all published books in system
- [ ] Columns: Title, Author, Genre, Status, Actions
- [ ] Books from multiple authors visible
- [ ] Status shows "approved", "pending", or "rejected"

**Test 3.2: Search Functionality**
- [ ] Search by title works
- [ ] Search by author works
- [ ] Search by genre works
- [ ] Real-time filtering
- [ ] Case-insensitive

**Test 3.3: Add New Book - Form Display**
- [ ] Click "+ Add New Book" button
- [ ] Form appears with fields:
  - [ ] Book Title (required)
  - [ ] Author Name (required)
  - [ ] Genre (dropdown)
  - [ ] Description (text area)
  - [ ] Book PDF File (required)
  - [ ] Book Cover Image (optional)
- [ ] Cancel button works and closes form

**Test 3.4: Add New Book - File Upload**
- [ ] Click file input for PDF
- [ ] Select valid PDF file
- [ ] Filename displays below input
- [ ] Click cover input (optional)
- [ ] Select JPEG or PNG
- [ ] Cover filename displays

**Test 3.5: Add New Book - Validation**
- [ ] Try submit without title → Error message
- [ ] Try submit without author → Error message
- [ ] Try submit without genre → Error message
- [ ] Try submit without PDF → Error message
- [ ] Try upload file > 25 MB → Error message
- [ ] Try upload cover > 5 MB → Error message

**Test 3.6: Add New Book - Success**
- [ ] Fill all required fields
- [ ] Upload valid PDF
- [ ] (Optional) Upload valid cover
- [ ] Click "Add Book"
- [ ] Success message appears
- [ ] Form clears
- [ ] New book appears in table

**Test 3.7: Edit Book**
- [ ] Click "Edit" button on a book
- [ ] Modal dialog appears
- [ ] Shows current: Title, Genre, Description
- [ ] Modify title
- [ ] Change genre from dropdown
- [ ] Update description
- [ ] Click "Save Changes"
- [ ] Success message
- [ ] Table updates immediately
- [ ] Changes reflect across portals

**Test 3.8: Delete Book - Confirmation**
- [ ] Click "Delete" button
- [ ] Confirmation dialog appears
- [ ] Shows book title
- [ ] Warning: "This action cannot be undone"
- [ ] Cancel button closes dialog without deleting
- [ ] Confirm button deletes

**Test 3.9: Delete Book - Success**
- [ ] Click Delete → Confirm
- [ ] Success message appears
- [ ] Book removed from table
- [ ] If book was borrowed, user gets notification
- [ ] Librarians get notification of deletion

**Test 3.10: Error Handling**
- [ ] Try invalid file type (not PDF) → Error
- [ ] Disconnect internet → Show error gracefully
- [ ] Invalid form data → Show specific error
- [ ] Server error → Display error message

---

## Integration Testing

### Cross-Portal Updates

**Test: Reading History Updates When Book Borrowed**
1. [ ] Login as Student
2. [ ] Go to Book Borrow Section
3. [ ] Borrow a book
4. [ ] Open Reading History
5. [ ] New book appears in history
6. [ ] Borrow date is current
7. [ ] Return date is 10 days from now (default)

**Test: Author Statistics Update When Book Borrowed**
1. [ ] Login as Author
2. [ ] Note "Total Reads" count
3. [ ] Open new browser/incognito
4. [ ] Login as Student
5. [ ] Borrow author's book
6. [ ] Return to Author portal
7. [ ] Refresh page or wait 15 seconds
8. [ ] "Total Reads" increased by 1

**Test: Librarian Changes Affect All Users**
1. [ ] Login as Librarian
2. [ ] Edit a book title
3. [ ] Open new browser/incognito
4. [ ] Login as Student
5. [ ] Go to Borrow Books section
6. [ ] New title is visible
7. [ ] Return to Librarian portal
8. [ ] Delete a book
9. [ ] Student cannot borrow deleted book

---

## Performance Testing

### Load Testing

**Test: Large Reading History**
- [ ] Create user with 100+ reading history entries
- [ ] Page loads in < 3 seconds
- [ ] Filtering works smoothly
- [ ] No lag when typing search

**Test: Many Published Books**
- [ ] System with 200+ published books
- [ ] Library portal loads all books
- [ ] Search works without significant delay
- [ ] Table scrolls smoothly

### Memory Usage
- [ ] Open browser DevTools → Performance
- [ ] No memory leaks after extended use
- [ ] Switching between screens doesn't accumulate memory

---

## Data Validation Testing

### Reading History Data Integrity
```
Expected:
- Reading duration calculated correctly (return date - borrow date)
- Progress data saved and retrieved
- History persists across browser sessions
- Multiple users see only their own history
```

### Author Statistics Accuracy
```
Expected:
- Total reads = sum of all borrow counts
- Average rating = sum(ratings) / count(ratings)
- Total reviews = count of all reviews
- Books list matches published books for author
```

### Librarian Book Management Consistency
```
Expected:
- Changes appear in books.json, publishedBooks.json
- Book IDs remain consistent across files
- Author field correctly set to "librarian" for manually added books
- File paths correctly saved and accessible
```

---

## Browser Compatibility Testing

Test on each browser:
- [ ] Chrome/Chromium
- [ ] Firefox
- [ ] Safari
- [ ] Edge

For each browser:
- [ ] Charts render correctly
- [ ] File uploads work
- [ ] Modals display properly
- [ ] Forms are usable
- [ ] Tables are readable

---

## Accessibility Testing

- [ ] Keyboard navigation works (Tab, Enter)
- [ ] Color contrast acceptable (WCAG AA standard)
- [ ] Form labels associated with inputs
- [ ] Error messages clear and descriptive
- [ ] Modal can be closed with Escape key
- [ ] Screen reader compatible (use NVDA or JAWS)

---

## Regression Testing

After each update, verify:
- [ ] All existing books still appear in history
- [ ] Previous author statistics data still accessible
- [ ] Librarian can still edit old and new books
- [ ] No data loss in any file
- [ ] Previous functionality still works

---

## Bug Reporting Template

If bugs are found, use this template:

```
**Feature**: [Reading History / Author Statistics / Librarian Management]
**Browser**: [Chrome / Firefox / etc] v[version]
**OS**: [Windows / Mac / Linux]
**Steps to Reproduce**:
1. [Step 1]
2. [Step 2]
3. ...

**Expected Result**: [What should happen]
**Actual Result**: [What actually happened]
**Screenshots**: [If applicable]
**Console Errors**: [Any error messages from DevTools]
```

---

## Quick Test Scenarios

### Scenario 1: Complete User Journey (Student)
1. Login as student
2. Borrow 3 different books
3. Check Reading History
4. Use each filter type
5. Verify duration calculations
6. Return books
7. Verify history updates

### Scenario 2: Author Analytics
1. Login as author
2. View statistics screen
3. Check all metrics
4. Interact with charts
5. Verify table data accuracy

### Scenario 3: Librarian Management
1. Login as librarian
2. View all published books
3. Add new book (with cover)
4. Edit existing book
5. Delete a book
6. Verify changes in other portals

---

## Success Criteria

All features are working correctly when:
- ✅ All test cases pass
- ✅ No console errors or warnings (except ESLint warnings)
- ✅ Data remains consistent across all files
- ✅ Auto-refresh works without issues
- ✅ Charts render and are interactive
- ✅ File uploads work with validation
- ✅ All filters and searches work correctly
- ✅ Notifications are sent appropriately
- ✅ Error handling is graceful
- ✅ Performance is acceptable (< 3s load time)

