import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import ReviewsDisplay from './ReviewsDisplay';

const CHART_COLORS = ['#ffb86c', '#8be9fd', '#50fa7b', '#ff79c6', '#bd93f9', '#f1fa8c'];

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
  const [showReviewsBook, setShowReviewsBook] = useState(null);
  const reportRef = useRef(null);

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

  const historyInsights = useMemo(() => {
    const genreCounts = {};
    const monthlyCounts = {};
    const totalDurationMinutes = history.reduce((sum, entry) => sum + (Number(entry.readingDurationMinutes) || 0), 0);

    history.forEach((entry) => {
      const entryGenre = String(entry.genre || 'Unknown').trim() || 'Unknown';
      genreCounts[entryGenre] = (genreCounts[entryGenre] || 0) + 1;

      const borrowDate = entry.borrowDate ? new Date(entry.borrowDate) : null;
      if (borrowDate && !Number.isNaN(borrowDate.getTime())) {
        const monthLabel = borrowDate.toLocaleString('default', { month: 'short', year: 'numeric' });
        monthlyCounts[monthLabel] = (monthlyCounts[monthLabel] || 0) + 1;
      }
    });

    const badges = [];
    if (history.length >= 1) badges.push({ label: 'First Steps', description: 'You have at least one reading history entry.' });
    if (history.length >= 10) badges.push({ label: 'Book Explorer', description: 'You have read 10 or more books.' });
    if (Object.keys(genreCounts).length >= 3) badges.push({ label: 'Genre Explorer', description: 'You have read across 3 or more genres.' });
    if (totalDurationMinutes >= 600) badges.push({ label: 'Reading Streak', description: 'You have accumulated 10+ hours of reading time.' });

    return {
      totalReads: history.length,
      totalDurationMinutes,
      averageDurationMinutes: history.length > 0 ? Number((totalDurationMinutes / history.length).toFixed(1)) : 0,
      genreChartData: Object.entries(genreCounts)
        .map(([name, value]) => ({ name, value }))
        .sort((left, right) => right.value - left.value),
      monthlyChartData: Object.entries(monthlyCounts)
        .map(([name, value]) => ({ name, value }))
        .sort((left, right) => new Date(left.name).getTime() - new Date(right.name).getTime()),
      badges,
    };
  }, [history]);

  const exportHistoryCsv = () => {
    const rows = [
      ['Book Title', 'Author', 'Genre', 'Borrow Date', 'Return Date', 'Reading Duration', 'Bookmark Page', 'Highlights Count'],
      ...filteredHistory.map((entry) => [
        entry.bookTitle || '',
        entry.author || '',
        entry.genre || '',
        entry.borrowDate || '',
        entry.returnDate || '',
        entry.readingDurationMinutes || 0,
        Number(entry?.progress?.bookmarkPage) || 1,
        Number(entry?.progress?.highlightsCount) || 0,
      ]),
    ];

    const csv = rows
      .map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `reading-history-${currentUser.username}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportHistoryPdf = async () => {
    if (!reportRef.current) return;

    let element;
    try {
      const html2pdfModule = await import('html2pdf.js');
      const html2pdf = html2pdfModule.default || html2pdfModule;

      const source = reportRef.current;
      element = source.cloneNode(true);
      element.style.position = 'fixed';
      element.style.left = '0';
      element.style.top = '0';
      element.style.opacity = '0';
      element.style.pointerEvents = 'none';
      element.style.zIndex = '-1';
      document.body.appendChild(element);

      const opt = {
        margin: [10, 10, 10, 10],
        filename: `reading-history-${currentUser.username}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false, allowTaint: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      };

      await html2pdf().set(opt).from(element).save();
    } catch (err) {
      console.error('PDF export failed:', err);
      alert('Failed to export PDF. Please try again.');
    } finally {
      if (element && element.parentNode) {
        element.parentNode.removeChild(element);
      }
    }
  };

  if (loading) {
    return <div>Loading reading history...</div>;
  }

  return (
    <div className="reading-history-screen">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
        <h2>My Reading History</h2>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button type="button" onClick={exportHistoryCsv}>Export CSV</button>
          <button type="button" onClick={exportHistoryPdf}>Export PDF</button>
        </div>
      </div>

      <div className="history-summary" style={{ display: 'grid', gap: '12px', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', marginBottom: '20px' }}>
        <div className="summary-card"><strong>{historyInsights.totalReads}</strong><span>Total reads</span></div>
        <div className="summary-card"><strong>{formatDuration(historyInsights.totalDurationMinutes)}</strong><span>Total reading time</span></div>
        <div className="summary-card"><strong>{historyInsights.averageDurationMinutes}m</strong><span>Average per book</span></div>
      </div>

      {historyInsights.badges.length > 0 && (
        <div style={{ marginBottom: '20px' }}>
          <h3 style={{ marginBottom: '8px' ,color:"white" }}>Achievements</h3>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {historyInsights.badges.map((badge) => (
              <div key={badge.label} style={{ background: '#23232e', border: '1px solid #6272a4', borderRadius: '12px', padding: '10px 12px', minWidth: '180px' }}>
                <strong style={{ display: 'block', color: '#ffb86c' }}>{badge.label}</strong>
                <small style={{ color: '#8f93a2' }}>{badge.description}</small>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gap: '18px', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', marginBottom: '20px' }}>
        <div className="summary-card" style={{ minHeight: '280px' }}>
          <h3>Most Read Genres</h3>
          {historyInsights.genreChartData.length === 0 ? (
            <p>No genre data yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={historyInsights.genreChartData} dataKey="value" nameKey="name" outerRadius={80} label>
                  {historyInsights.genreChartData.map((entry, index) => (
                    <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="summary-card" style={{ minHeight: '280px' }}>
          <h3>Reading Activity by Month</h3>
          {historyInsights.monthlyChartData.length === 0 ? (
            <p>No activity yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={historyInsights.monthlyChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-25} textAnchor="end" height={60} interval={0} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="value" fill="#ffb86c" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

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
        <table className="reading-history-table">
          <thead>
            <tr>
              <th>Book Title</th>
              <th>Author</th>
              <th>Genre</th>
              <th>Borrow Date</th>
              <th>Return Date</th>
              <th>Reading Duration</th>
              <th>Reading Progress</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredHistory.map((entry) => {
              const bookmarkPage = Number(entry?.progress?.bookmarkPage) || 1;
              const highlightsCount = Number(entry?.progress?.highlightsCount) || 0;
              const lastReadAt = entry?.progress?.lastReadAt;
              const reviewBook = {
                id: entry.bookId,
                title: entry.bookTitle,
                authorFullName: entry.author,
              };

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
                  <td>
                    <button type="button" onClick={() => setShowReviewsBook(reviewBook)}>
                      Review
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {showReviewsBook && (
        <div className="summary-modal">
          <div className="summary-content reviews-modal-content">
            <button
              type="button"
              className="modal-close-button"
              onClick={() => setShowReviewsBook(null)}
            >
              Close
            </button>
            <ReviewsDisplay
              book={showReviewsBook}
              username={currentUser.username}
              userRole={currentUser.role}
            />
          </div>
        </div>
      )}

      <div ref={reportRef} style={{ position: 'absolute', left: '-9999px', top: 0, width: '900px', background: '#ffffff', color: '#111111', padding: '24px' }}>
        <h1>Reading History Report</h1>
        <p>User: {currentUser?.fullName || currentUser?.username || 'Student'}</p>
        <p>Total Reads: {historyInsights.totalReads}</p>
        <p>Total Reading Time: {formatDuration(historyInsights.totalDurationMinutes)}</p>
        <p>Average Duration: {historyInsights.averageDurationMinutes} minutes</p>
        <h2>Filtered Entries</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th>Book Title</th>
              <th>Author</th>
              <th>Genre</th>
              <th>Borrow Date</th>
              <th>Return Date</th>
              <th>Reading Duration</th>
            </tr>
          </thead>
          <tbody>
            {filteredHistory.map((entry) => (
              <tr key={entry.id || `${entry.bookId}-${entry.borrowDate}`}>
                <td>{entry.bookTitle || '-'}</td>
                <td>{entry.author || '-'}</td>
                <td>{entry.genre || '-'}</td>
                <td>{formatDate(entry.borrowDate)}</td>
                <td>{entry.returnDate ? formatDate(entry.returnDate) : 'Still borrowed'}</td>
                <td>{formatDuration(entry.readingDurationMinutes)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default ReadingHistoryScreen;
