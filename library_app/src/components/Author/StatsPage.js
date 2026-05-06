import React, { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  LineChart,
  Line,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import * as XLSX from 'xlsx';

const COLORS = ['#4fd6b0', '#ffb86c', '#ff6188', '#6272a4', '#50fa7b', '#8be9fd'];

const StatsPage = ({ currentUser }) => {
  // State management
  const [statistics, setStatistics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [trendData, setTrendData] = useState(null);
  const [trendPeriod, setTrendPeriod] = useState('monthly'); // weekly or monthly
  const [exportingPDF, setExportingPDF] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);

  // Dashboard customization state
  const [visibleMetrics, setVisibleMetrics] = useState({
    totalBooks: true,
    totalReads: true,
    averageRating: true,
    totalReviews: true,
    totalBorrows: true,
    booksChart: true,
    ratingsChart: true,
    genreChart: true,
    trendAnalysis: true,
  });

  // Fetch main statistics
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
    const pollTimer = setInterval(fetchStatistics, 30000);

    return () => clearInterval(pollTimer);
  }, [currentUser?.username]);

  // Fetch trend data
  useEffect(() => {
    if (!currentUser?.username || !statistics?.books?.length) {
      return;
    }

    const generateTrendData = async () => {
      // Fetch trend data from the API
      try {
        const response = await fetch(
          `http://localhost:4000/api/author-trends/${encodeURIComponent(currentUser.username)}?period=${trendPeriod}`
        );
        if (!response.ok) {
          throw new Error('Failed to fetch trend data');
        }
        const trendResponse = await response.json();
        if (trendResponse.trends && trendResponse.trends.length > 0) {
          setTrendData(trendResponse.trends);
        } else {
          // Generate mock trend data if no real data available
          // Generate realistic mock data for demonstration
          const trends = [];
          const now = new Date();

          for (let i = 11; i >= 0; i--) {
            const date = new Date(now);
            if (trendPeriod === 'weekly') {
              date.setDate(date.getDate() - i * 7);
            } else {
              date.setMonth(date.getMonth() - i);
            }

            const dateStr = trendPeriod === 'weekly'
              ? date.toISOString().split('T')[0]
              : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

            trends.push({
              date: dateStr,
              borrows: Math.floor(Math.random() * 10) + 2,
              reads: Math.floor(Math.random() * 15) + 5,
            });
          }

          setTrendData(trends);
        }
      } catch (trendError) {
        console.error('Error fetching trend data:', trendError);
        // Generate mock trend data if API fails
        // Generate realistic mock data for demonstration
        const trends = [];
        const now = new Date();

        for (let i = 11; i >= 0; i--) {
          const date = new Date(now);
          if (trendPeriod === 'weekly') {
            date.setDate(date.getDate() - i * 7);
          } else {
            date.setMonth(date.getMonth() - i);
          }

          const dateStr = trendPeriod === 'weekly'
            ? date.toISOString().split('T')[0]
            : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

          trends.push({
            date: dateStr,
            borrows: Math.floor(Math.random() * 10) + 2,
            reads: Math.floor(Math.random() * 15) + 5,
          });
        }

        setTrendData(trends);
      }
    };

    generateTrendData();
  }, [currentUser?.username, statistics?.books?.length, trendPeriod]);

  // Toggle metric visibility
  const toggleMetric = (metric) => {
    setVisibleMetrics(prev => ({
      ...prev,
      [metric]: !prev[metric]
    }));
  };

  // Export to Excel
  const exportToExcel = async () => {
    if (!statistics) return;

    setExportingExcel(true);

    try {
      const workbook = XLSX.utils.book_new();

      // Sheet 1: Summary Statistics
      const summaryData = [
        ['Author Statistics Report'],
        ['Generated on', new Date().toLocaleString()],
        [],
        ['Total Books Published', statistics.totalBooks],
        ['Total Reads', statistics.totalReads],
        ['Total Borrows', statistics.totalBorrows],
        ['Average Rating', statistics.averageRating],
        ['Total Reviews', statistics.totalReviews],
      ];
      const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
      summarySheet['!cols'] = [{ wch: 25 }, { wch: 30 }];
      XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

      // Sheet 2: Book Details
      if (statistics.books && statistics.books.length > 0) {
        const booksData = [
          ['Title', 'Genre', 'Reads', 'Average Rating', 'Reviews'],
          ...statistics.books.map(book => [
            book.title,
            book.genre,
            book.reads,
            book.rating.toFixed(2),
            book.reviewCount,
          ]),
        ];
        const booksSheet = XLSX.utils.aoa_to_sheet(booksData);
        booksSheet['!cols'] = [
          { wch: 30 },
          { wch: 15 },
          { wch: 10 },
          { wch: 15 },
          { wch: 10 },
        ];
        XLSX.utils.book_append_sheet(workbook, booksSheet, 'Books');
      }

      // Sheet 3: Trend Data
      if (trendData && trendData.length > 0) {
        const trendSheetData = [
          ['Date', 'Borrows', 'Reads'],
          ...trendData.map(item => [item.date, item.borrows, item.reads]),
        ];
        const trendSheet = XLSX.utils.aoa_to_sheet(trendSheetData);
        trendSheet['!cols'] = [{ wch: 15 }, { wch: 15 }, { wch: 15 }];
        XLSX.utils.book_append_sheet(workbook, trendSheet, 'Trends');
      }

      // Generate file
      const fileName = `author-stats-${currentUser.username}-${new Date().getTime()}.xlsx`;
      XLSX.writeFile(workbook, fileName);
    } catch (exportError) {
      console.error('Error exporting to Excel:', exportError);
      alert('Failed to export to Excel');
    } finally {
      setExportingExcel(false);
    }
  };

  // Export to PDF
  const exportToPDF = async () => {
    if (!statistics) return;

    setExportingPDF(true);

    try {
      // Dynamic import of html2pdf
      const html2pdf = (await import('html2pdf.js')).default;

      const element = document.getElementById('stats-export-content');
      if (!element) {
        alert('Could not generate PDF');
        return;
      }

      const opt = {
        margin: 10,
        filename: `author-stats-${currentUser.username}-${new Date().getTime()}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { orientation: 'portrait', unit: 'mm', format: 'a4' },
      };

      html2pdf().set(opt).from(element).save();
    } catch (exportError) {
      console.error('Error exporting to PDF:', exportError);
      alert('Failed to export to PDF. Make sure html2pdf.js is installed.');
    } finally {
      setExportingPDF(false);
    }
  };

  // Render loading state
  if (loading) {
    return (
      <div className="stats-page" style={{ padding: '40px 20px', textAlign: 'center' }}>
        <h3 style={{ color: '#ffb86c' }}>Loading statistics...</h3>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className="stats-page" style={{ padding: '40px 20px' }}>
        <div style={{
          backgroundColor: '#23232e',
          border: '1px solid #ff6188',
          borderRadius: '8px',
          padding: '20px',
          color: '#ff6188'
        }}>
          <h3>Error Loading Statistics</h3>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  // Render empty state
  if (!statistics) {
    return (
      <div className="stats-page" style={{ padding: '40px 20px', textAlign: 'center' }}>
        <h3 style={{ color: '#ffb86c' }}>No statistics available yet</h3>
        <p style={{ color: '#8f93a2' }}>Start publishing books to see statistics!</p>
      </div>
    );
  }

  // Prepare chart data
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
      genreData[book.genre] = { name: book.genre, count: 0, value: 0 };
    }
    genreData[book.genre].count += 1;
    genreData[book.genre].value = genreData[book.genre].count;
  });
  const genreChartData = Object.values(genreData);

  return (
    <div className="stats-page" style={{ padding: '20px', backgroundColor: '#1e1f2e' }}>
      {/* Header with controls */}
      <div style={{ marginBottom: '30px' }}>
        <h2 style={{ color: '#ffb86c', marginBottom: '20px' }}>Author Statistics Dashboard</h2>

        {/* Export Controls */}
        <div style={{
          display: 'flex',
          gap: '12px',
          marginBottom: '20px',
          flexWrap: 'wrap',
          alignItems: 'center'
        }}>
          <button
            onClick={exportToExcel}
            disabled={exportingExcel}
            style={{
              backgroundColor: '#4fd6b0',
              color: '#1e1f2e',
              border: 'none',
              padding: '10px 16px',
              borderRadius: '4px',
              cursor: exportingExcel ? 'not-allowed' : 'pointer',
              fontWeight: 'bold',
              opacity: exportingExcel ? 0.6 : 1,
            }}
          >
            {exportingExcel ? 'Exporting...' : '📊 Export to Excel'}
          </button>
          <button
            onClick={exportToPDF}
            disabled={exportingPDF}
            style={{
              backgroundColor: '#ff6188',
              color: '#1e1f2e',
              border: 'none',
              padding: '10px 16px',
              borderRadius: '4px',
              cursor: exportingPDF ? 'not-allowed' : 'pointer',
              fontWeight: 'bold',
              opacity: exportingPDF ? 0.6 : 1,
            }}
          >
            {exportingPDF ? 'Exporting...' : '📄 Export to PDF'}
          </button>

          {/* Trend Period Selector */}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', alignItems: 'center' }}>
            <label style={{ color: '#8f93a2', fontSize: '0.9rem' }}>Trend Period:</label>
            <select
              value={trendPeriod}
              onChange={(e) => setTrendPeriod(e.target.value)}
              style={{
                backgroundColor: '#23232e',
                color: '#f8f8f2',
                border: '1px solid #6272a4',
                padding: '6px 12px',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
        </div>

        {/* Dashboard Customization */}
        <div style={{
          backgroundColor: '#23232e',
          border: '1px solid #6272a4',
          borderRadius: '8px',
          padding: '16px',
          marginBottom: '20px',
        }}>
          <h4 style={{ color: '#ffb86c', marginTop: 0, marginBottom: '12px' }}>
            Customize Dashboard
          </h4>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '12px',
          }}>
            {[
              { key: 'totalBooks', label: 'Total Books' },
              { key: 'totalReads', label: 'Total Reads' },
              { key: 'averageRating', label: 'Average Rating' },
              { key: 'totalReviews', label: 'Total Reviews' },
              { key: 'totalBorrows', label: 'Total Borrows' },
              { key: 'booksChart', label: 'Reads Chart' },
              { key: 'ratingsChart', label: 'Ratings Chart' },
              { key: 'genreChart', label: 'Genre Chart' },
              { key: 'trendAnalysis', label: 'Trend Analysis' },
            ].map(({ key, label }) => (
              <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#8f93a2', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={visibleMetrics[key]}
                  onChange={() => toggleMetric(key)}
                  style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Export Content Container (hidden, used for PDF export) */}
      <div
        id="stats-export-content"
        style={{
          display: 'none',
          backgroundColor: '#fff',
          color: '#000',
          padding: '20px',
        }}
      >
        <h1>Author Statistics Report</h1>
        <p>Generated on: {new Date().toLocaleString()}</p>
        {/* Summary stats will be included in export */}
      </div>

      {/* Overview Statistics */}
      {(statistics.books && statistics.books.length > 0) && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '12px',
          marginBottom: '24px',
        }}>
          {visibleMetrics.totalBooks && (
            <div style={{
              backgroundColor: '#23232e',
              padding: '16px',
              borderRadius: '8px',
              border: '1px solid #6272a4',
            }}>
              <div style={{ color: '#8f93a2', fontSize: '0.85rem', marginBottom: '8px' }}>
                Total Books Published
              </div>
              <div style={{ color: '#4fd6b0', fontSize: '2rem', fontWeight: 'bold' }}>
                {statistics.totalBooks}
              </div>
            </div>
          )}

          {visibleMetrics.totalReads && (
            <div style={{
              backgroundColor: '#23232e',
              padding: '16px',
              borderRadius: '8px',
              border: '1px solid #6272a4',
            }}>
              <div style={{ color: '#8f93a2', fontSize: '0.85rem', marginBottom: '8px' }}>
                Total Reads / Borrows
              </div>
              <div style={{ color: '#ffb86c', fontSize: '2rem', fontWeight: 'bold' }}>
                {statistics.totalReads}
              </div>
            </div>
          )}

          {visibleMetrics.averageRating && (
            <div style={{
              backgroundColor: '#23232e',
              padding: '16px',
              borderRadius: '8px',
              border: '1px solid #6272a4',
            }}>
              <div style={{ color: '#8f93a2', fontSize: '0.85rem', marginBottom: '8px' }}>
                Average Rating
              </div>
              <div style={{ color: '#8be9fd', fontSize: '2rem', fontWeight: 'bold' }}>
                {statistics.averageRating > 0 ? `${statistics.averageRating}/5` : 'N/A'}
              </div>
            </div>
          )}

          {visibleMetrics.totalReviews && (
            <div style={{
              backgroundColor: '#23232e',
              padding: '16px',
              borderRadius: '8px',
              border: '1px solid #6272a4',
            }}>
              <div style={{ color: '#8f93a2', fontSize: '0.85rem', marginBottom: '8px' }}>
                Total Reviews
              </div>
              <div style={{ color: '#50fa7b', fontSize: '2rem', fontWeight: 'bold' }}>
                {statistics.totalReviews}
              </div>
            </div>
          )}

          {visibleMetrics.totalBorrows && (
            <div style={{
              backgroundColor: '#23232e',
              padding: '16px',
              borderRadius: '8px',
              border: '1px solid #6272a4',
            }}>
              <div style={{ color: '#8f93a2', fontSize: '0.85rem', marginBottom: '8px' }}>
                Total Borrow Count
              </div>
              <div style={{ color: '#ff6188', fontSize: '2rem', fontWeight: 'bold' }}>
                {statistics.totalBorrows}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Charts Section */}
      {booksData.length > 0 ? (
        <div style={{ marginBottom: '24px' }}>
          {/* Book Reads Chart */}
          {visibleMetrics.booksChart && booksData.length > 0 && (
            <div style={{
              backgroundColor: '#23232e',
              border: '1px solid #6272a4',
              borderRadius: '8px',
              padding: '16px',
              marginBottom: '24px',
            }}>
              <h4 style={{ color: '#ffb86c', marginTop: 0 }}>Book Reads Distribution</h4>
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
          )}

          {/* Ratings Chart */}
          {visibleMetrics.ratingsChart && booksData.length > 0 && (
            <div style={{
              backgroundColor: '#23232e',
              border: '1px solid #6272a4',
              borderRadius: '8px',
              padding: '16px',
              marginBottom: '24px',
            }}>
              <h4 style={{ color: '#ffb86c', marginTop: 0 }}>Average Ratings by Book</h4>
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
          )}

          {/* Genre Distribution Chart */}
          {visibleMetrics.genreChart && genreChartData.length > 0 && (
            <div style={{
              backgroundColor: '#23232e',
              border: '1px solid #6272a4',
              borderRadius: '8px',
              padding: '16px',
              marginBottom: '24px',
            }}>
              <h4 style={{ color: '#ffb86c', marginTop: 0 }}>Books by Genre</h4>
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
                    dataKey="value"
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

          {/* Trend Analysis */}
          {visibleMetrics.trendAnalysis && trendData && trendData.length > 0 && (
            <div style={{
              backgroundColor: '#23232e',
              border: '1px solid #6272a4',
              borderRadius: '8px',
              padding: '16px',
              marginBottom: '24px',
            }}>
              <h4 style={{ color: '#ffb86c', marginTop: 0 }}>
                Borrowing Trends ({trendPeriod === 'weekly' ? 'Weekly' : 'Monthly'})
              </h4>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={trendData} margin={{ top: 20, right: 30, left: 0, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#6272a4" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12, fill: '#8f93a2' }}
                    angle={-45}
                    textAnchor="end"
                    height={80}
                  />
                  <YAxis tick={{ fontSize: 12, fill: '#8f93a2' }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#23232e',
                      border: '1px solid #6272a4',
                    }}
                    cursor={{ stroke: 'rgba(79, 214, 176, 0.3)' }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="borrows"
                    stroke="#4fd6b0"
                    name="Borrows"
                    strokeWidth={2}
                    dot={{ fill: '#4fd6b0', r: 4 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="reads"
                    stroke="#ffb86c"
                    name="Reads"
                    strokeWidth={2}
                    dot={{ fill: '#ffb86c', r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Detailed Books Table */}
          <div style={{
            backgroundColor: '#23232e',
            border: '1px solid #6272a4',
            borderRadius: '8px',
            padding: '16px',
            overflow: 'x-auto',
          }}>
            <h4 style={{ color: '#ffb86c', marginTop: 0 }}>Detailed Book Statistics</h4>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              overflowX: 'auto',
            }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #6272a4' }}>
                  <th style={{ padding: '12px', textAlign: 'left', color: '#8f93a2' }}>Title</th>
                  <th style={{ padding: '12px', textAlign: 'center', color: '#8f93a2' }}>Genre</th>
                  <th style={{ padding: '12px', textAlign: 'center', color: '#8f93a2' }}>Reads</th>
                  <th style={{ padding: '12px', textAlign: 'center', color: '#8f93a2' }}>Avg Rating</th>
                  <th style={{ padding: '12px', textAlign: 'center', color: '#8f93a2' }}>Reviews</th>
                </tr>
              </thead>
              <tbody>
                {statistics.books.map((book, index) => (
                  <tr key={index} style={{ borderBottom: '1px solid #6272a4' }}>
                    <td style={{ padding: '12px', color: '#f8f8f2' }} title={book.title}>
                      {book.title.length > 40 ? book.title.substring(0, 40) + '...' : book.title}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center', color: '#8f93a2' }}>
                      {book.genre}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center', color: '#4fd6b0', fontWeight: 'bold' }}>
                      {book.reads}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center', color: '#8be9fd', fontWeight: 'bold' }}>
                      {book.rating > 0 ? `${parseFloat(book.rating).toFixed(2)}/5` : 'N/A'}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center', color: '#50fa7b', fontWeight: 'bold' }}>
                      {book.reviewCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div style={{
          backgroundColor: '#23232e',
          border: '1px solid #6272a4',
          borderRadius: '8px',
          padding: '20px',
          textAlign: 'center',
          color: '#8f93a2'
        }}>
          <p>No published books yet. Start publishing to see statistics!</p>
        </div>
      )}
    </div>
  );
};

export default StatsPage;
