import React, { useCallback, useEffect, useState } from 'react';
import ReviewForm from './ReviewForm';

function ReviewsDisplay({ book, username, userRole, allowReviewSubmission = true }) {
  const [reviews, setReviews] = useState([]);
  const [rating, setRating] = useState(0);
  const [totalReviews, setTotalReviews] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [sortMode, setSortMode] = useState('recent');

  const canReview = allowReviewSubmission && (userRole === 'student' || userRole === 'staff');

  const fetchReviews = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch(
        `http://localhost:4000/api/reviews/${book.id}`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch reviews.');
      }

      const data = await response.json();
      setReviews(data.reviews || []);
      setRating(data.rating || 0);
      setTotalReviews(data.totalReviews || 0);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [book.id]);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  const handleReviewSubmitted = (newReview) => {
    // Refresh reviews after submission
    fetchReviews();
  };

  const handleMarkHelpful = async (reviewId) => {
    try {
      const response = await fetch(`http://localhost:4000/api/reviews/${book.id}/${reviewId}/helpful`, {
        method: 'POST',
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to mark review as helpful.');
      }

      fetchReviews();
    } catch (err) {
      setError(err.message || 'Failed to mark review as helpful.');
    }
  };

  const sortedReviews = [...reviews].sort((left, right) => {
    if (sortMode === 'helpful') {
      const helpfulDiff = (Number(right.helpful) || 0) - (Number(left.helpful) || 0);
      if (helpfulDiff !== 0) return helpfulDiff;
      return new Date(right.submittedAt).getTime() - new Date(left.submittedAt).getTime();
    }

    return new Date(right.submittedAt).getTime() - new Date(left.submittedAt).getTime();
  });

  const hasUserReviewed = reviews.some((r) => r.username === username);

  return (
    <div className="reviews-display">
      <div className="reviews-header">
        <h4>Reviews & Ratings</h4>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          <select value={sortMode} onChange={(event) => setSortMode(event.target.value)}>
            <option value="recent">Most Recent</option>
            <option value="helpful">Most Helpful</option>
          </select>
          {canReview && (
            <button
              className="reviews-btn-add"
              onClick={() => setShowReviewForm(true)}
            >
              {hasUserReviewed ? 'Edit Your Review' : 'Add a Review'}
            </button>
          )}
        </div>
      </div>

      <div className="reviews-rating-summary">
        <div className="reviews-rating-value">
          <span className="reviews-rating-stars">
            {[1, 2, 3, 4, 5].map((star) => (
              <span key={star} className={rating >= star ? 'star-filled' : 'star-empty'}>
                ★
              </span>
            ))}
          </span>
          <span className="reviews-rating-number">
            {rating > 0 ? `${rating} out of 5` : 'No ratings yet'}
          </span>
        </div>
        <span className="reviews-count">
          {totalReviews} {totalReviews === 1 ? 'review' : 'reviews'}
        </span>
      </div>

      {loading && <p className="reviews-loading">Loading reviews...</p>}

      {error && <p className="reviews-error">{error}</p>}

      {sortedReviews.length === 0 && !loading ? (
        <p className="reviews-empty">No reviews yet. Be the first to review!</p>
      ) : (
        <div className="reviews-list">
          {sortedReviews.map((review) => (
            <div key={review.id} className="reviews-item">
              <div className="review-header">
                <div className="review-user-info">
                  <span className="review-username">{review.anonymous ? 'Anonymous reader' : review.username}</span>
                  <span className="review-date">
                    {new Date(review.submittedAt).toLocaleDateString()}
                  </span>
                </div>
                <div className="review-rating">
                  <span className="review-stars">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <span key={star} className={review.rating >= star ? 'star-filled' : 'star-empty'}>
                        ★
                      </span>
                    ))}
                  </span>
                  <span className="review-rating-text">{review.rating}/5</span>
                </div>
              </div>

              {review.reviewText && (
                <p className="review-text">{review.reviewText}</p>
              )}

              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ color: '#8f93a2', fontSize: '0.9rem' }}>
                  Helpful votes: {Number(review.helpful) || 0}
                </span>
                <button type="button" onClick={() => handleMarkHelpful(review.id)}>
                  Mark Helpful
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showReviewForm && (
        <ReviewForm
          book={book}
          username={username}
          onReviewSubmitted={handleReviewSubmitted}
          onClose={() => setShowReviewForm(false)}
        />
      )}
    </div>
  );
}

export default ReviewsDisplay;
