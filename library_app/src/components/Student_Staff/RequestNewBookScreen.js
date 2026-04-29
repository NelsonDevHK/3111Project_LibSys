import React, { useCallback, useEffect, useMemo, useState } from 'react';

function RequestNewBookScreen({ currentUser }) {
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [genre, setGenre] = useState('');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [myRequests, setMyRequests] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(false);

  const canRequest = useMemo(() => {
    const role = String(currentUser?.role || '').toLowerCase();
    return role === 'student' || role === 'staff';
  }, [currentUser?.role]);

  const resetForm = () => {
    setTitle('');
    setAuthor('');
    setGenre('');
    setReason('');
  };

  const fetchMyRequests = useCallback(async () => {
    if (!currentUser?.username) {
      return;
    }

    setLoadingRequests(true);
    try {
      const response = await fetch(
        `http://localhost:4000/api/book-requests?requestedBy=${encodeURIComponent(currentUser.username)}`
      );
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.error || 'Failed to load your requests.');
      }

      setMyRequests(Array.isArray(payload.bookRequests) ? payload.bookRequests : []);
    } catch (requestError) {
      setError(requestError.message || 'Failed to load your requests.');
    } finally {
      setLoadingRequests(false);
    }
  }, [currentUser?.username]);

  useEffect(() => {
    fetchMyRequests();
  }, [fetchMyRequests]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccessMessage('');

    if (!canRequest) {
      setError('Only students/staff can submit a new book request.');
      return;
    }

    if (!title.trim() || !author.trim() || !genre.trim() || !reason.trim()) {
      setError('Please complete Title, Author, Genre, and Reason for Request.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('http://localhost:4000/api/book-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          author: author.trim(),
          genre: genre.trim(),
          reason: reason.trim(),
          requestedBy: currentUser.username,
          requestedByRole: currentUser.role,
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to submit your book request.');
      }

      setSuccessMessage('Request submitted successfully. Librarians can now review it.');
      resetForm();
      fetchMyRequests();
    } catch (submitError) {
      setError(submitError.message || 'Failed to submit your book request.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="request-book-screen">
      <h2>Request a New Book</h2>
      <p>Tell the librarian what you want added to the library collection.</p>

      <form className="request-book-form" onSubmit={handleSubmit}>
        <label htmlFor="request-title">Title</label>
        <input
          id="request-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Book title"
        />

        <label htmlFor="request-author">Author</label>
        <input
          id="request-author"
          value={author}
          onChange={(event) => setAuthor(event.target.value)}
          placeholder="Author name"
        />

        <label htmlFor="request-genre">Genre</label>
        <input
          id="request-genre"
          value={genre}
          onChange={(event) => setGenre(event.target.value)}
          placeholder="e.g. Science, Fiction, History"
        />

        <label htmlFor="request-reason">Reason for Request</label>
        <textarea
          id="request-reason"
          rows={4}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Why should this book be added?"
        />

        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Submitting...' : 'Submit Book Request'}
        </button>
      </form>

      {successMessage ? <p className="success">{successMessage}</p> : null}
      {error ? <p className="error">{error}</p> : null}

      <div className="request-history-panel">
        <h3>My Request History</h3>
        {loadingRequests ? <p>Loading your requests...</p> : null}
        {!loadingRequests && myRequests.length === 0 ? (
          <p>No requests yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Author</th>
                <th>Genre</th>
                <th>Status</th>
                <th>Submitted</th>
              </tr>
            </thead>
            <tbody>
              {myRequests.map((requestItem) => (
                <tr key={requestItem.id}>
                  <td>{requestItem.title}</td>
                  <td>{requestItem.author}</td>
                  <td>{requestItem.genre}</td>
                  <td>{requestItem.status}</td>
                  <td>{new Date(requestItem.submittedAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

export default RequestNewBookScreen;
