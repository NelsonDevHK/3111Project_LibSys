import React, { useCallback, useEffect, useState } from 'react';

const REPLY_TEMPLATES = [
  {
    label: 'Thank and acknowledge',
    text: 'Thank you for taking the time to share your feedback. I appreciate your perspective and will keep it in mind for future readers.',
  },
  {
    label: 'Invite more detail',
    text: 'Thank you for the review. If you are open to it, I would appreciate any more detail about what worked well or what could be improved.',
  },
  {
    label: 'Address concern',
    text: 'Thank you for the honest feedback. I am sorry the experience did not meet expectations, and I will review this feedback carefully.',
  },
  {
    label: 'Positive follow-up',
    text: 'I am glad the book connected with you. Thank you for the encouraging feedback and for reading it.',
  },
];

function formatSentimentLabel(sentiment) {
  const normalized = String(sentiment || 'unknown').toLowerCase();
  if (normalized === 'positive') return 'Positive';
  if (normalized === 'neutral') return 'Neutral';
  if (normalized === 'negative') return 'Negative';
  return 'Pending';
}

function AuthorReviewsScreen({ currentUser }) {
  const [reviews, setReviews] = useState([]);
  const [analytics, setAnalytics] = useState({
    totalReviews: 0,
    averageRating: 0,
    sentimentCounts: { positive: 0, neutral: 0, negative: 0 },
    sentimentPercentages: { positive: 0, neutral: 0, negative: 0 },
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expandedReviews, setExpandedReviews] = useState(new Set());
  const [responseText, setResponseText] = useState({});
  const [submittingResponse, setSubmittingResponse] = useState({});
  const [flagReasonText, setFlagReasonText] = useState({});
  const [showFlagModal, setShowFlagModal] = useState(null);

  const fetchReviews = useCallback(async () => {
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
      setAnalytics(
        data.analytics || {
          totalReviews: data.reviews?.length || 0,
          averageRating: 0,
          sentimentCounts: { positive: 0, neutral: 0, negative: 0 },
          sentimentPercentages: { positive: 0, neutral: 0, negative: 0 },
        }
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [currentUser?.username]);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

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

  const applyReplyTemplate = (reviewId, templateText) => {
    setResponseText({ ...responseText, [reviewId]: templateText });
    setExpandedReviews((current) => {
      const next = new Set(current);
      next.add(reviewId);
      return next;
    });
  };

  const sentimentClass = (sentiment) => {
    const normalized = String(sentiment || '').toLowerCase();
    if (normalized === 'positive') return 'sentiment-positive';
    if (normalized === 'neutral') return 'sentiment-neutral';
    if (normalized === 'negative') return 'sentiment-negative';
    return 'sentiment-pending';
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

          <div className="analytics-grid">
            <div className="analytics-card">
              <span className="analytics-label">Average rating</span>
              <strong>{analytics.averageRating ? `${analytics.averageRating}/5` : 'No ratings yet'}</strong>
            </div>
            <div className="analytics-card">
              <span className="analytics-label">Positive</span>
              <strong>{analytics.sentimentCounts?.positive || 0}</strong>
              <small>{analytics.sentimentPercentages?.positive || 0}%</small>
            </div>
            <div className="analytics-card">
              <span className="analytics-label">Neutral</span>
              <strong>{analytics.sentimentCounts?.neutral || 0}</strong>
              <small>{analytics.sentimentPercentages?.neutral || 0}%</small>
            </div>
            <div className="analytics-card">
              <span className="analytics-label">Negative</span>
              <strong>{analytics.sentimentCounts?.negative || 0}</strong>
              <small>{analytics.sentimentPercentages?.negative || 0}%</small>
            </div>
          </div>

          {reviews.map((review) => (
            <div
              key={review.id}
              className={`review-card ${review.flagged ? 'flagged' : ''}`}
            >
              <div className="review-header">
                <div className="review-meta">
                  <span className="book-title">{review.bookTitle}</span>
                  <span className="reviewer-info">
                    by {review.anonymous ? 'Anonymous reader' : review.username} on{' '}
                    {new Date(review.submittedAt).toLocaleDateString()}
                  </span>
                  <span className={`sentiment-pill ${sentimentClass(review.sentiment)}`}>
                    {formatSentimentLabel(review.sentiment)} sentiment
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
                  <div className="template-row">
                    {REPLY_TEMPLATES.map((template) => (
                      <button
                        key={template.label}
                        type="button"
                        className="template-pill"
                        onClick={() => applyReplyTemplate(review.id, template.text)}
                      >
                        {template.label}
                      </button>
                    ))}
                  </div>
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
          color: #ffb86c;
        }

        .reviews-summary {
          color: #8be9fd;
          margin-bottom: 15px;
        }

        .analytics-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
          margin-bottom: 18px;
        }

        .analytics-card {
          background: linear-gradient(180deg, #2d2f3a 0%, #23232e 100%);
          border: 1px solid #44475a;
          border-radius: 10px;
          padding: 12px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .analytics-label {
          font-size: 12px;
          color: #b8b9c2;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .analytics-card strong {
          font-size: 18px;
          color: #f8f8f2;
        }

        .analytics-card small {
          color: #8be9fd;
        }

        .reviews-container {
          display: flex;
          flex-direction: column;
          gap: 15px;
        }

        .review-card {
          border: 1px solid #44475a;
          border-radius: 8px;
          padding: 15px;
          background-color: #23232e;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
        }

        .review-card.flagged {
          border-color: #ff6188;
          background-color: #2f2227;
        }

        .review-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 10px;
        }

        .review-meta {
          flex: 1;
        }

        .review-meta .sentiment-pill {
          display: inline-flex;
          align-items: center;
          width: fit-content;
          margin-top: 6px;
        }

        .book-title {
          font-weight: bold;
          color: #e6e6e6;
          display: block;
          margin-bottom: 5px;
        }

        .reviewer-info {
          font-size: 12px;
          color: #b8b9c2;
        }

        .review-rating {
          display: flex;
          align-items: center;
          gap: 5px;
        }

        .star-filled {
          color: #ffb86c;
        }

        .star-empty {
          color: #44475a;
        }

        .rating-text {
          font-size: 12px;
          color: #b8b9c2;
          margin-left: 5px;
        }

        .sentiment-pill {
          display: inline-flex;
          align-items: center;
          width: fit-content;
          margin-top: 6px;
          padding: 4px 10px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 600;
          border: 1px solid transparent;
        }

        .sentiment-positive {
          background: rgba(80, 250, 123, 0.14);
          color: #7dffa0;
          border-color: rgba(80, 250, 123, 0.35);
        }

        .sentiment-neutral {
          background: rgba(139, 233, 253, 0.14);
          color: #8be9fd;
          border-color: rgba(139, 233, 253, 0.35);
        }

        .sentiment-negative {
          background: rgba(255, 97, 136, 0.14);
          color: #ff97b3;
          border-color: rgba(255, 97, 136, 0.35);
        }

        .sentiment-pending {
          background: rgba(98, 114, 164, 0.14);
          color: #cfd4ea;
          border-color: rgba(98, 114, 164, 0.35);
        }

        .flagged-badge {
          background-color: #ff6188;
          color: #fff;
          padding: 8px 12px;
          border-radius: 4px;
          font-size: 12px;
          margin-bottom: 10px;
        }

        .review-text {
          color: #e6e6e6;
          margin: 10px 0;
          line-height: 1.5;
        }

        .responses-section {
          background-color: #292a2d;
          border: 1px solid #44475a;
          padding: 10px;
          border-radius: 4px;
          margin: 10px 0;
        }

        .responses-section h5 {
          margin-top: 0;
          color: #ffb86c;
        }

        .response-item {
          background-color: #2e2f35;
          padding: 10px;
          border-left: 3px solid #50fa7b;
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
          color: #8be9fd;
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
          color: #e6e6e6;
          margin: 5px 0 0 0;
          font-size: 14px;
        }

        .response-form {
          background-color: #292a2d;
          border: 1px solid #44475a;
          padding: 15px;
          border-radius: 4px;
          margin-top: 10px;
        }

        .template-row {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 10px;
        }

        .template-pill {
          border: 1px solid #6272a4;
          background: rgba(98, 114, 164, 0.18);
          color: #e6e6e6;
          border-radius: 999px;
          padding: 6px 10px;
          font-size: 12px;
          cursor: pointer;
        }

        .template-pill:hover {
          background: rgba(98, 114, 164, 0.32);
        }

        .template-pill:focus-visible {
          outline: 2px solid #8be9fd;
          outline-offset: 2px;
        }

        .template-pill, .btn-submit-response, .btn-flag-review, .btn-confirm-flag, .btn-cancel-flag, .btn-toggle-response, .btn-delete-response {
          transition: transform 0.15s ease, background-color 0.15s ease, border-color 0.15s ease;
        }

        .template-pill:hover, .btn-submit-response:hover, .btn-flag-review:hover, .btn-confirm-flag:hover, .btn-cancel-flag:hover, .btn-toggle-response:hover, .btn-delete-response:hover {
          transform: translateY(-1px);
        }

        @media (max-width: 720px) {
          .analytics-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .review-header,
          .response-header,
          .response-actions,
          .flag-actions {
            flex-direction: column;
            align-items: stretch;
          }

          .btn-delete-response {
            align-self: flex-start;
          }
        }

        .response-form textarea {
          width: 100%;
          padding: 10px;
          border: 1px solid #44475a;
          border-radius: 4px;
          font-family: inherit;
          resize: vertical;
          margin-bottom: 10px;
        }

        .response-actions {
          display: flex;
          gap: 10px;
        }

        .btn-submit-response {
          background-color: #50fa7b;
          color: #23232e;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
        }

        .btn-submit-response:hover {
          background-color: #69ff94;
        }

        .btn-submit-response:disabled {
          background-color: #ccc;
          cursor: not-allowed;
        }

        .btn-flag-review {
          background-color: #ffb86c;
          color: #23232e;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
        }

        .btn-flag-review:hover {
          background-color: #ffca8a;
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
          background-color: #292a2d;
          color: #e6e6e6;
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
          border: 1px solid #44475a;
          border-radius: 4px;
          font-family: inherit;
          margin-bottom: 10px;
          background: #21222c;
          color: #e6e6e6;
        }

        .flag-actions {
          display: flex;
          gap: 10px;
        }

        .btn-confirm-flag {
          background-color: #ff6188;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
          flex: 1;
        }

        .btn-confirm-flag:hover {
          background-color: #ff7aa2;
        }

        .btn-cancel-flag {
          background-color: #44475a;
          color: #e6e6e6;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
          flex: 1;
        }

        .btn-cancel-flag:hover {
          background-color: #6272a4;
        }

        .btn-toggle-response {
          background-color: #6272a4;
          color: #e6e6e6;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
          margin-top: 10px;
        }

        .btn-toggle-response:hover {
          background-color: #7385b8;
        }

        .loading,
        .no-reviews,
        .error {
          text-align: center;
          padding: 20px;
          font-size: 16px;
        }

        .error {
          color: #ff6188;
        }

        .loading {
          color: #b8b9c2;
        }

        .no-reviews {
          color: #b8b9c2;
        }
      `}</style>
    </div>
  );
}

export default AuthorReviewsScreen;
