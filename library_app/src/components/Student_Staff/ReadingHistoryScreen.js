import React, { useEffect, useMemo, useState } from 'react';

function formatDate(dateValue) {
  if (!dateValue) return '-';
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString();
}

function formatDuration(minutes) {
  const safeMinutes = Number(minutes) || 0;
  if (safeMinutes <= 0) return '-';

  const days = Math.floor(safeMinutes / (24 * 60));
  const hours = Math.floor((safeMinutes % (24 * 60)) / 60);
  const mins = safeMinutes % 60;

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (mins > 0 || parts.length === 0) parts.push(`${mins}m`);
  return parts.join(' ');
}

function toDateInputValue(dateValue) {
  if (!dateValue) return '';
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().split('T')[0];
}

const HISTORY_RANGE_OPTIONS = [
  { value: 'all', label: 'All Time' },
  { value: 'week', label: 'Past Week' },
  { value: 'month', label: 'Past Month' },
  { value: '3months', label: 'Past 3 Months' },
  { value: '6months', label: 'Past 6 Months' },
  { value: '1year+', label: '1 Year+' },
];

function getRangeCutoff(rangeKey) {
  const now = new Date();

  switch (rangeKey) {
    case 'week':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case 'month':
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    case '3months':
      return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    case '6months':
      return new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
    case '1year+':
      return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    default:
      return null;
  }
}

function ReadingHistoryScreen({ currentUser }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [author, setAuthor] = useState('');
  const [genre, setGenre] = useState('');
  const [range, setRange] = useState('all');

  useEffect(() => {
    if (!currentUser?.username) {
      setHistory([]);
      setLoading(false);
      return undefined;
    }

    let isCancelled = false;

    const fetchHistory = async () => {
      try {
        const res = await fetch(
          `http://localhost:4000/api/reading-history/${encodeURIComponent(currentUser.username)}`
        );
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Failed to fetch reading history.');
        }

        if (!isCancelled) {
          setHistory(Array.isArray(data.history) ? data.history : []);
          setError('');
        }
      } catch (fetchError) {
        if (!isCancelled) {
          setError(fetchError.message || 'Failed to fetch reading history.');
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    fetchHistory();
    const pollTimer = setInterval(fetchHistory, 15000);

    return () => {
      isCancelled = true;
      clearInterval(pollTimer);
    };
  }, [currentUser?.username]);

  const genres = useMemo(() => {
    const values = history
      .map((entry) => entry.genre)
      .filter((value) => typeof value === 'string' && value.trim());
    return Array.from(new Set(values)).sort();
  }, [history]);

  const filteredHistory = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    const normalizedAuthor = author.trim().toLowerCase();
    const cutoff = getRangeCutoff(range);

    return history.filter((entry) => {
      const borrowDateValue = entry.borrowDate ? new Date(entry.borrowDate) : null;
      const borrowDateTime = borrowDateValue && !Number.isNaN(borrowDateValue.getTime())
        ? borrowDateValue.getTime()
        : null;

      if (normalizedSearch) {
        const title = String(entry.bookTitle || '').toLowerCase();
        if (!title.includes(normalizedSearch)) {
          return false;
        }
      }

      if (normalizedAuthor) {
        const authorName = String(entry.author || '').toLowerCase();
        if (!authorName.includes(normalizedAuthor)) {
          return false;
        }
      }

      if (genre && entry.genre !== genre) {
        return false;
      }

      if (cutoff && borrowDateTime !== null) {
        const cutoffTime = cutoff.getTime();
        const isRecent = borrowDateTime >= cutoffTime;

        if (range === '1year+') {
          if (isRecent) {
            return false;
          }
        } else if (!isRecent) {
          return false;
        }
      }

      return true;
    });
  }, [history, search, author, genre, range]);

  if (loading) {
    return <div>Loading reading history...</div>;
  }

  return (
    <div className="reading-history-screen">
      <h2>My Reading History</h2>

      <div className="history-filters">
        <input
          type="text"
          placeholder="Search by title"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <input
          type="text"
          placeholder="Filter by author"
          value={author}
          onChange={(event) => setAuthor(event.target.value)}
        />
        <select value={genre} onChange={(event) => setGenre(event.target.value)}>
          <option value="">All Genres</option>
          {genres.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
        <select value={range} onChange={(event) => setRange(event.target.value)}>
          {HISTORY_RANGE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="error">{error}</p>}

      {filteredHistory.length === 0 ? (
        <p>No reading history matches your filters yet.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Book Title</th>
              <th>Author</th>
              <th>Genre</th>
              <th>Borrow Date</th>
              <th>Return Date</th>
              <th>Reading Duration</th>
              <th>Reading Progress</th>
            </tr>
          </thead>
          <tbody>
            {filteredHistory.map((entry) => {
              const bookmarkPage = Number(entry?.progress?.bookmarkPage) || 1;
              const highlightsCount = Number(entry?.progress?.highlightsCount) || 0;
              const lastReadAt = entry?.progress?.lastReadAt;

              return (
                <tr key={entry.id || `${entry.bookId}-${entry.borrowDate}`}>
                  <td>{entry.bookTitle || '-'}</td>
                  <td>{entry.author || '-'}</td>
                  <td>{entry.genre || '-'}</td>
                  <td>{formatDate(entry.borrowDate)}</td>
                  <td>{entry.returnDate ? formatDate(entry.returnDate) : 'Still borrowed'}</td>
                  <td>{formatDuration(entry.readingDurationMinutes)}</td>
                  <td>
                    <div>Bookmark: Page {bookmarkPage}</div>
                    <div>Highlights: {highlightsCount}</div>
                    <div>Last read: {formatDate(lastReadAt)}</div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default ReadingHistoryScreen;
