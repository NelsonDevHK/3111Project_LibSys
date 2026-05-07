import React, { useState } from 'react';

function ReviewForm({ book, username, onReviewSubmitted, onClose }) {
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [anonymousReview, setAnonymousReview] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleStarClick = (star) => {
    setRating(star);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (rating === 0) {
      setError('Please select a rating.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('http://localhost:4000/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          bookId: book.id,
          rating,
          reviewText,
            anonymous: anonymousReview,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to submit review.');
      }

      const data = await response.json();
      setSuccess(true);
      setRating(0);
      setReviewText('');
      setAnonymousReview(false);

      if (onReviewSubmitted) {
        onReviewSubmitted(data.review);
      }

      setTimeout(() => {
        if (onClose) {
          onClose();
        }
      }, 1500);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="review-form-overlay">
      <div className="review-form-container">
        <div className="review-form-header">
          <h3>Review: {book.title}</h3>
          <button
            className="review-form-close"
            onClick={onClose}
            disabled={loading}
          >
            ✕
          </button>
        </div>

        {success ? (
          <div className="review-form-success">
            <p>✓ Review submitted successfully!</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="review-form">
            <div className="review-form-group">
              <label>Rating:</label>
              <div className="review-stars">
                {[1, 2, 3, 4, 5].map((star) => (
                  <span
                    key={star}
                    className={`review-star ${rating >= star ? 'active' : ''}`}
                    onClick={() => handleStarClick(star)}
                    role="button"
                    tabIndex={0}
                  >
                    ★
                  </span>
                ))}
              </div>
              {rating > 0 && (
                <span className="review-rating-text">{rating} out of 5 stars</span>
              )}
            </div>

            <div className="review-form-group">
              <label htmlFor="reviewText">Your Review (optional):</label>
              <textarea
                id="reviewText"
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
                placeholder="Share your thoughts about this book..."
                maxLength={500}
                rows={5}
                className="review-textarea"
              />
              <span className="review-char-count">
                {reviewText.length}/500
              </span>
            </div>

            <label className="review-anonymous-option" style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '12px' }}>
              <input
                type="checkbox"
                checked={anonymousReview}
                onChange={(e) => setAnonymousReview(e.target.checked)}
              />
              Post this review anonymously
            </label>

            {error && <div className="review-form-error">{error}</div>}

            <div className="review-form-actions">
              <button
                type="button"
                onClick={onClose}
                className="review-btn-cancel"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="review-btn-submit"
                disabled={loading || rating === 0}
              >
                {loading ? 'Submitting...' : 'Submit Review'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default ReviewForm;
