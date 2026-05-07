import React, { useEffect, useMemo, useState } from 'react';

function LibrarianDownloadedBooksStatsScreen() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch('http://localhost:4000/api/librarian/downloaded-books/stats');
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Failed to fetch downloaded book stats.');
        }
        setStats(data);
        setError('');
      } catch (fetchError) {
        setError(fetchError.message || 'Failed to fetch downloaded book stats.');
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
    const pollTimer = setInterval(fetchStats, 20000);
    return () => clearInterval(pollTimer);
  }, []);

  const topBooks = useMemo(() => {
    if (!Array.isArray(stats?.books)) {
      return [];
    }

    return [...stats.books]
      .sort((left, right) => (Number(right.borrowCount) || 0) - (Number(left.borrowCount) || 0))
      .slice(0, 8);
  }, [stats?.books]);

  return (
    <section className="librarian-downloaded-book-stats">
      <h3>Downloaded Book Statistics</h3>

      {loading && <p className="stats-loading">Loading downloaded book stats...</p>}
      {error && <p className="stats-error">Error: {error}</p>}

      {!loading && !error && stats && (
        <>
          <div className="stats-grid">
            <div className="stats-card">
              <span className="stats-label">Downloaded Books</span>
              <strong>{stats.totalDownloadedBooks || 0}</strong>
            </div>
            <div className="stats-card">
              <span className="stats-label">Total Borrows</span>
              <strong>{stats.totalBorrows || 0}</strong>
            </div>
            <div className="stats-card">
              <span className="stats-label">Avg Borrows/Book</span>
              <strong>{stats.averageBorrowsPerBook || 0}</strong>
            </div>
            <div className="stats-card">
              <span className="stats-label">Top Genre</span>
              <strong>{stats.genreBreakdown?.[0]?.label || 'N/A'}</strong>
            </div>
          </div>

          <div className="stats-row-grid">
            <div className="stats-panel">
              <h4>Most Borrowed Downloaded Books</h4>
              {topBooks.length === 0 ? (
                <p className="stats-empty">No downloaded books yet.</p>
              ) : (
                <ul className="stats-list">
                  {topBooks.map((book) => (
                    <li key={book.id}>
                      <span>{book.title}</span>
                      <span>{book.borrowCount} borrows</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="stats-panel">
              <h4>Genre Breakdown</h4>
              {Array.isArray(stats.genreBreakdown) && stats.genreBreakdown.length > 0 ? (
                <ul className="stats-list">
                  {stats.genreBreakdown.map((entry) => (
                    <li key={entry.label}>
                      <span>{entry.label}</span>
                      <span>{entry.count}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="stats-empty">No genre data yet.</p>
              )}
            </div>
          </div>
        </>
      )}

      <style>{`
        .librarian-downloaded-book-stats {
          padding: 20px;
          max-width: 1200px;
          margin: 0 auto;
        }

        .librarian-downloaded-book-stats h3 {
          margin-bottom: 16px;
          color: #ffb86c;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
          margin-bottom: 14px;
        }

        .stats-card {
          border: 1px solid #44475a;
          border-radius: 10px;
          background: linear-gradient(180deg, #2b2d38 0%, #23232e 100%);
          padding: 12px;
        }

        .stats-label {
          display: block;
          color: #b8b9c2;
          font-size: 12px;
          margin-bottom: 6px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .stats-card strong {
          color: #f8f8f2;
          font-size: 18px;
        }

        .stats-row-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }

        .stats-panel {
          border: 1px solid #44475a;
          border-radius: 8px;
          background: #23232e;
          padding: 12px;
        }

        .stats-panel h4 {
          color: #8be9fd;
          margin: 0 0 10px;
          font-size: 15px;
        }

        .stats-list {
          list-style: none;
          margin: 0;
          padding: 0;
        }

        .stats-list li {
          display: flex;
          justify-content: space-between;
          gap: 8px;
          border-bottom: 1px solid #44475a;
          padding: 8px 0;
          color: #e6e6e6;
          font-size: 14px;
        }

        .stats-list li:last-child {
          border-bottom: none;
        }

        .stats-loading,
        .stats-error,
        .stats-empty {
          color: #b8b9c2;
        }

        .stats-error {
          color: #ff6188;
        }

        @media (max-width: 900px) {
          .stats-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .stats-row-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </section>
  );
}

export default LibrarianDownloadedBooksStatsScreen;
