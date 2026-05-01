import React, { useState, useEffect } from 'react';

function AuthorReviewsScreen({ currentUser }) {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expandedReviews, setExpandedReviews] = useState(new Set());
  const [responseText, setResponseText] = useState({});
  const [submittingResponse, setSubmittingResponse] = useState({});
  const [flagReasonText, setFlagReasonText] = useState({});
  const [showFlagModal, setShowFlagModal] = useState(null);

  useEffect(() => {
    fetchReviews();
  }, [currentUser]);

  const fetchReviews = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch(
        `http://localhost:4000/api/reviews/author/${currentUser.username}/books`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch reviews.');
      }

      const data = await response.json();
      setReviews(data.reviews || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleReviewExpanded = (reviewId) => {
    const newExpanded = new Set(expandedReviews);
    if (newExpanded.has(reviewId)) {
      newExpanded.delete(reviewId);
    } else {
      newExpanded.add(reviewId);
    }
    setExpandedReviews(newExpanded);
  };

  const handleAddResponse = async (bookId, reviewId) => {
    const response = responseText[reviewId] || '';
    if (!response.trim()) {
      alert('Please enter a response.');
      return;
    }

    setSubmittingResponse({ ...submittingResponse, [reviewId]: true });

    try {
      const res = await fetch(
        `http://localhost:4000/api/reviews/${bookId}/${reviewId}/response`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            authorUsername: currentUser.username,
            responseText: response,
          }),
        }
      );

      if (!res.ok) {
        throw new Error('Failed to submit response.');
      }

      setResponseText({ ...responseText, [reviewId]: '' });
      fetchReviews();
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setSubmittingResponse({ ...submittingResponse, [reviewId]: false });
    }
  };

  const handleFlagReview = async (bookId, reviewId) => {
    const reason = flagReasonText[reviewId] || '';
    if (!reason.trim()) {
      alert('Please provide a reason.');
      return;
    }

    try {
      const res = await fetch(
        `http://localhost:4000/api/reviews/${bookId}/${reviewId}/flag`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason }),
        }
      );

      if (!res.ok) {
        throw new Error('Failed to flag review.');
      }

      setFlagReasonText({ ...flagReasonText, [reviewId]: '' });
      setShowFlagModal(null);
      fetchReviews();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  const handleDeleteResponse = async (bookId, reviewId, responseId) => {
    if (!window.confirm('Delete this response?')) return;

    try {
      const res = await fetch(
        `http://localhost:4000/api/reviews/${bookId}/${reviewId}/response/${responseId}`,
        { method: 'DELETE' }
      );

      if (!res.ok) {
        throw new Error('Failed to delete response.');
      }

      fetchReviews();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  return (
    <div className="author-reviews-screen">
      <h3>Reader Reviews & Feedback</h3>

      {loading && <p className="loading">Loading reviews...</p>}
      {error && <p className="error">Error: {error}</p>}

      {!loading && reviews.length === 0 && (
        <p className="no-reviews">No reviews yet for your books.</p>
      )}

      {!loading && reviews.length > 0 && (
        <div className="reviews-container">
          <p className="reviews-summary">Total reviews: {reviews.length}</p>

          {reviews.map((review) => (
            <div
              key={review.id}
              className={`review-card ${review.flagged ? 'flagged' : ''}`}
            >
              <div className="review-header">
                <div className="review-meta">
                  <span className="book-title">{review.bookTitle}</span>
                  <span className="reviewer-info">
                    by {review.username} on{' '}
                    {new Date(review.submittedAt).toLocaleDateString()}
                  </span>
                </div>

                <div className="review-rating">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <span key={star} className={review.rating >= star ? 'star-filled' : 'star-empty'}>
                      ★
                    </span>
                  ))}
                  <span className="rating-text">{review.rating}/5</span>
                </div>
              </div>

              {review.flagged && (
                <div className="flagged-badge">
                  🚩 Flagged as inappropriate: {review.flagReason}
                </div>
              )}

              <div className="review-text">{review.reviewText}</div>

              {Array.isArray(review.responses) && review.responses.length > 0 && (
                <div className="responses-section">
                  <h5>Your Response(s):</h5>
                  {review.responses.map((resp) => (
                    <div key={resp.id} className="response-item">
                      <div className="response-header">
                        <span className="response-author">You responded on {new Date(resp.respondedAt).toLocaleDateString()}</span>
                        <button
                          className="btn-delete-response"
                          onClick={() => handleDeleteResponse(review.bookId, review.id, resp.id)}
                        >
                          Delete
                        </button>
                      </div>
                      <p className="response-text">{resp.responseText}</p>
                    </div>
                  ))}
                </div>
              )}

              {expandedReviews.has(review.id) && (
                <div className="response-form">
                  <textarea
                    value={responseText[review.id] || ''}
                    onChange={(e) =>
                      setResponseText({ ...responseText, [review.id]: e.target.value })
                    }
                    placeholder="Write your response..."
                    maxLength={500}
                    rows={3}
                  />
                  <div className="response-actions">
                    <button
                      className="btn-submit-response"
                      onClick={() => handleAddResponse(review.bookId, review.id)}
                      disabled={submittingResponse[review.id]}
                    >
                      {submittingResponse[review.id] ? 'Submitting...' : 'Submit Response'}
                    </button>
                    <button
                      className="btn-flag-review"
                      onClick={() => setShowFlagModal(review.id)}
                    >
                      Flag as Inappropriate
                    </button>
                  </div>
                </div>
              )}

              {showFlagModal === review.id && (
                <div className="flag-modal">
                  <div className="flag-modal-content">
                    <h5>Flag Review as Inappropriate</h5>
                    <textarea
                      value={flagReasonText[review.id] || ''}
                      onChange={(e) =>
                        setFlagReasonText({ ...flagReasonText, [review.id]: e.target.value })
                      }
                      placeholder="Explain why this review is inappropriate..."
                      maxLength={500}
                      rows={3}
                    />
                    <div className="flag-actions">
                      <button
                        className="btn-confirm-flag"
                        onClick={() => handleFlagReview(review.bookId, review.id)}
                      >
                        Flag Review
                      </button>
                      <button
                        className="btn-cancel-flag"
                        onClick={() => setShowFlagModal(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <button
                className="btn-toggle-response"
                onClick={() => toggleReviewExpanded(review.id)}
              >
                {expandedReviews.has(review.id) ? 'Hide Response Form' : 'Add Response'}
              </button>
            </div>
          ))}
        </div>
      )}

      <style>{`
        .author-reviews-screen {
          padding: 20px;
          max-width: 900px;
          margin: 0 auto;
        }

        .author-reviews-screen h3 {
          margin-bottom: 20px;
          color: #333;
        }

        .reviews-summary {
          color: #666;
          margin-bottom: 15px;
        }

        .reviews-container {
          display: flex;
          flex-direction: column;
          gap: 15px;
        }

        .review-card {
          border: 1px solid #ddd;
          border-radius: 8px;
          padding: 15px;
          background-color: #fff;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        .review-card.flagged {
          border-color: #ff6b6b;
          background-color: #ffe6e6;
        }

        .review-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 10px;
        }

        .review-meta {
          flex: 1;
        }

        .book-title {
          font-weight: bold;
          color: #333;
          display: block;
          margin-bottom: 5px;
        }

        .reviewer-info {
          font-size: 12px;
          color: #666;
        }

        .review-rating {
          display: flex;
          align-items: center;
          gap: 5px;
        }

        .star-filled {
          color: #ffc107;
        }

        .star-empty {
          color: #ddd;
        }

        .rating-text {
          font-size: 12px;
          color: #666;
          margin-left: 5px;
        }

        .flagged-badge {
          background-color: #ff6b6b;
          color: white;
          padding: 8px 12px;
          border-radius: 4px;
          font-size: 12px;
          margin-bottom: 10px;
        }

        .review-text {
          color: #555;
          margin: 10px 0;
          line-height: 1.5;
        }

        .responses-section {
          background-color: #f0f0f0;
          padding: 10px;
          border-radius: 4px;
          margin: 10px 0;
        }

        .responses-section h5 {
          margin-top: 0;
          color: #333;
        }

        .response-item {
          background-color: #fff;
          padding: 10px;
          border-left: 3px solid #4CAF50;
          margin-bottom: 8px;
        }

        .response-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 12px;
          margin-bottom: 5px;
        }

        .response-author {
          color: #666;
        }

        .btn-delete-response {
          background-color: #f44336;
          color: white;
          border: none;
          padding: 3px 8px;
          border-radius: 3px;
          cursor: pointer;
          font-size: 11px;
        }

        .btn-delete-response:hover {
          background-color: #da190b;
        }

        .response-text {
          color: #555;
          margin: 5px 0 0 0;
          font-size: 14px;
        }

        .response-form {
          background-color: #f9f9f9;
          padding: 15px;
          border-radius: 4px;
          margin-top: 10px;
        }

        .response-form textarea {
          width: 100%;
          padding: 10px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-family: Arial, sans-serif;
          resize: vertical;
          margin-bottom: 10px;
        }

        .response-actions {
          display: flex;
          gap: 10px;
        }

        .btn-submit-response {
          background-color: #4CAF50;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
        }

        .btn-submit-response:hover {
          background-color: #45a049;
        }

        .btn-submit-response:disabled {
          background-color: #ccc;
          cursor: not-allowed;
        }

        .btn-flag-review {
          background-color: #ff9800;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
        }

        .btn-flag-review:hover {
          background-color: #e68900;
        }

        .flag-modal {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: rgba(0, 0, 0, 0.5);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 1000;
        }

        .flag-modal-content {
          background-color: white;
          padding: 20px;
          border-radius: 8px;
          max-width: 400px;
          width: 90%;
        }

        .flag-modal-content h5 {
          margin-top: 0;
        }

        .flag-modal-content textarea {
          width: 100%;
          padding: 10px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-family: Arial, sans-serif;
          margin-bottom: 10px;
        }

        .flag-actions {
          display: flex;
          gap: 10px;
        }

        .btn-confirm-flag {
          background-color: #ff6b6b;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
          flex: 1;
        }

        .btn-confirm-flag:hover {
          background-color: #ff5252;
        }

        .btn-cancel-flag {
          background-color: #ddd;
          color: #333;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
          flex: 1;
        }

        .btn-cancel-flag:hover {
          background-color: #ccc;
        }

        .btn-toggle-response {
          background-color: #2196F3;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
          margin-top: 10px;
        }

        .btn-toggle-response:hover {
          background-color: #0b7dda;
        }

        .loading,
        .no-reviews,
        .error {
          text-align: center;
          padding: 20px;
          font-size: 16px;
        }

        .error {
          color: #f44336;
        }

        .loading {
          color: #666;
        }

        .no-reviews {
          color: #999;
        }
      `}</style>
    </div>
  );
}

export default AuthorReviewsScreen;
