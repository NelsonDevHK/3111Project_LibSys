import React, { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

const COLORS = ['#4fd6b0', '#ffb86c', '#ff6188', '#6272a4', '#50fa7b', '#8be9fd'];

const AuthorStatisticsScreen = ({ currentUser }) => {
  const [statistics, setStatistics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!currentUser?.username) {
      setLoading(false);
      return;
    }

    const fetchStatistics = async () => {
      try {
        const response = await fetch(
          `http://localhost:4000/api/author-statistics/${encodeURIComponent(currentUser.username)}`
        );
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Failed to fetch statistics.');
        }
        setStatistics(data);
        setError('');
      } catch (fetchError) {
        setError(fetchError.message || 'Failed to fetch statistics.');
      } finally {
        setLoading(false);
      }
    };

    fetchStatistics();
    const pollTimer = setInterval(fetchStatistics, 15000);

    return () => clearInterval(pollTimer);
  }, [currentUser?.username]);

  if (loading) {
    return <div className="author-statistics-screen">Loading statistics...</div>;
  }

  if (error) {
    return (
      <div className="author-statistics-screen">
        <h3 style={{ color: '#ff6188' }}>Error</h3>
        <p>{error}</p>
      </div>
    );
  }

  if (!statistics) {
    return (
      <div className="author-statistics-screen">
        <h3>No statistics available yet.</h3>
      </div>
    );
  }

  // Prepare data for charts
  const booksData = (statistics.books || []).map(book => ({
    name: book.title.length > 15 ? book.title.substring(0, 15) + '...' : book.title,
    fullName: book.title,
    reads: book.reads,
    rating: parseFloat(book.rating) || 0,
    reviews: book.reviewCount,
  }));

  const genreData = {};
  (statistics.books || []).forEach(book => {
    if (!genreData[book.genre]) {
      genreData[book.genre] = { name: book.genre, count: 0 };
    }
    genreData[book.genre].count += 1;
  });
  const genreChartData = Object.values(genreData);

  return (
    <div className="author-statistics-screen">
      <h3 style={{ color: '#ffb86c', marginBottom: '16px' }}>Published Books Statistics</h3>

      {/* Overview Statistics */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '12px',
        marginBottom: '24px',
      }}>
        <div style={{
          backgroundColor: '#23232e',
          padding: '12px',
          borderRadius: '4px',
          border: '1px solid #6272a4',
        }}>
          <div style={{ color: '#8f93a2', fontSize: '0.85rem' }}>Total Books Published</div>
          <div style={{ color: '#4fd6b0', fontSize: '1.5rem', fontWeight: 'bold' }}>
            {statistics.totalBooks}
          </div>
        </div>
        <div style={{
          backgroundColor: '#23232e',
          padding: '12px',
          borderRadius: '4px',
          border: '1px solid #6272a4',
        }}>
          <div style={{ color: '#8f93a2', fontSize: '0.85rem' }}>Total Reads</div>
          <div style={{ color: '#ffb86c', fontSize: '1.5rem', fontWeight: 'bold' }}>
            {statistics.totalReads}
          </div>
        </div>
        <div style={{
          backgroundColor: '#23232e',
          padding: '12px',
          borderRadius: '4px',
          border: '1px solid #6272a4',
        }}>
          <div style={{ color: '#8f93a2', fontSize: '0.85rem' }}>Average Rating</div>
          <div style={{ color: '#8be9fd', fontSize: '1.5rem', fontWeight: 'bold' }}>
            {statistics.averageRating > 0 ? `${statistics.averageRating}/5` : 'N/A'}
          </div>
        </div>
        <div style={{
          backgroundColor: '#23232e',
          padding: '12px',
          borderRadius: '4px',
          border: '1px solid #6272a4',
        }}>
          <div style={{ color: '#8f93a2', fontSize: '0.85rem' }}>Total Reviews</div>
          <div style={{ color: '#50fa7b', fontSize: '1.5rem', fontWeight: 'bold' }}>
            {statistics.totalReviews}
          </div>
        </div>
      </div>

      {/* Charts Section */}
      {booksData.length > 0 ? (
        <>
          <div style={{ marginBottom: '24px' }}>
            <h4 style={{ color: '#ffb86c', marginBottom: '12px' }}>Book Reads Distribution</h4>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={booksData} margin={{ top: 20, right: 30, left: 0, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#6272a4" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 12, fill: '#8f93a2' }}
                  angle={-45}
                  textAnchor="end"
                  height={100}
                />
                <YAxis tick={{ fontSize: 12, fill: '#8f93a2' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#23232e',
                    border: '1px solid #6272a4',
                  }}
                  cursor={{ fill: 'rgba(79, 214, 176, 0.1)' }}
                />
                <Bar dataKey="reads" fill="#4fd6b0" name="Reads" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div style={{ marginBottom: '24px' }}>
            <h4 style={{ color: '#ffb86c', marginBottom: '12px' }}>Average Ratings by Book</h4>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={booksData} margin={{ top: 20, right: 30, left: 0, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#6272a4" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 12, fill: '#8f93a2' }}
                  angle={-45}
                  textAnchor="end"
                  height={100}
                />
                <YAxis
                  domain={[0, 5]}
                  tick={{ fontSize: 12, fill: '#8f93a2' }}
                  label={{ value: 'Rating (out of 5)', angle: -90, position: 'insideLeft' }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#23232e',
                    border: '1px solid #6272a4',
                  }}
                  cursor={{ fill: 'rgba(139, 233, 253, 0.1)' }}
                />
                <Bar dataKey="rating" fill="#8be9fd" name="Rating" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {genreChartData.length > 0 && (
            <div style={{ marginBottom: '24px' }}>
              <h4 style={{ color: '#ffb86c', marginBottom: '12px' }}>Books by Genre</h4>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={genreChartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, count }) => `${name} (${count})`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="count"
                  >
                    {genreChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#23232e',
                      border: '1px solid #6272a4',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Books Table */}
          <div>
            <h4 style={{ color: '#ffb86c', marginBottom: '12px' }}>Book Details</h4>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #6272a4' }}>
                  <th style={{ padding: '8px', textAlign: 'left', color: '#8f93a2' }}>Title</th>
                  <th style={{ padding: '8px', textAlign: 'left', color: '#8f93a2' }}>Genre</th>
                  <th style={{ padding: '8px', textAlign: 'center', color: '#8f93a2' }}>Reads</th>
                  <th style={{ padding: '8px', textAlign: 'center', color: '#8f93a2' }}>Avg Rating</th>
                  <th style={{ padding: '8px', textAlign: 'center', color: '#8f93a2' }}>Reviews</th>
                </tr>
              </thead>
              <tbody>
                {booksData.map((book, index) => (
                  <tr key={index} style={{ borderBottom: '1px solid #6272a4' }}>
                    <td style={{ padding: '8px', color: '#f8f8f2' }} title={book.fullName}>
                      {book.fullName}
                    </td>
                    <td style={{ padding: '8px', color: '#f8f8f2' }}>{book.name}</td>
                    <td style={{ padding: '8px', textAlign: 'center', color: '#4fd6b0' }}>
                      {book.reads}
                    </td>
                    <td style={{ padding: '8px', textAlign: 'center', color: '#8be9fd' }}>
                      {book.rating > 0 ? `${book.rating.toFixed(1)}/5` : 'N/A'}
                    </td>
                    <td style={{ padding: '8px', textAlign: 'center', color: '#50fa7b' }}>
                      {book.reviews}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <p style={{ color: '#8f93a2' }}>No published books yet. Start publishing to see statistics!</p>
      )}
    </div>
  );
};

export default AuthorStatisticsScreen;
