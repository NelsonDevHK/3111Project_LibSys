import React, { useCallback, useEffect, useMemo, useState } from 'react';

const CATEGORY_LABELS = {
	bookApprovalUpdates: 'Book Approval Updates',
	bookRejectionUpdates: 'Book Rejection Updates',
	bookUpdates: 'Book Approval/Rejection Updates',
	newSubmissions: 'New Book Submissions',
	accountUpdates: 'User Account Updates',
	dueReminders: 'Book Due Reminders',
	bookDeletionNotices: 'Book Deletion Notices',
	other: 'Other Announcements',
};

function NotificationBoard({ currentUser }) {
	const [categories, setCategories] = useState({});
	const [unreadCount, setUnreadCount] = useState(0);
	const [filterCategory, setFilterCategory] = useState('all');
	const [showArchived, setShowArchived] = useState(false);
	const [search, setSearch] = useState('');
	const [feedbackMessage, setFeedbackMessage] = useState('');
	const [feedbackType, setFeedbackType] = useState('');
	const [filterDate, setFilterDate] = useState('');
	const [filterUrgency, setFilterUrgency] = useState('all');

	const fetchNotifications = useCallback(async () => {
		if (!currentUser?.username || !currentUser?.role) return;

		try {
			const res = await fetch(
				`http://localhost:4000/api/notifications/${encodeURIComponent(currentUser.username)}?role=${encodeURIComponent(currentUser.role)}`
			);
			const data = await res.json();

			if (!res.ok) {
				throw new Error(data.error || 'Failed to fetch notifications.');
			}

			setCategories(data.categories || {});
			setUnreadCount(data.unreadCount || 0);
			setFeedbackMessage('');
			setFeedbackType('');
		} catch (error) {
			setCategories({});
			setUnreadCount(0);
			setFeedbackMessage(error.message || 'Failed to fetch notifications.');
			setFeedbackType('error');
		}
	}, [currentUser?.username, currentUser?.role]);

	useEffect(() => {
		fetchNotifications();
	}, [fetchNotifications]);

	const visibleCategoryKeys = useMemo(() => {
		const keys = Object.keys(categories || {});
		if (filterCategory === 'all') return keys;
		return keys.filter((key) => key === filterCategory);
	}, [categories, filterCategory]);

	const normalizedSearch = search.trim().toLowerCase();

	const updateNotification = async (category, notificationId, action) => {
		try {
			const res = await fetch(
				`http://localhost:4000/api/notifications/${encodeURIComponent(currentUser.username)}/${encodeURIComponent(category)}/${encodeURIComponent(notificationId)}`,
				{
					method: 'PATCH',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ action }),
				}
			);
			const data = await res.json();
			if (!res.ok) {
				throw new Error(data.error || 'Failed to update notification.');
			}

			fetchNotifications();
		} catch (error) {
			setFeedbackMessage(error.message || 'Failed to update notification.');
			setFeedbackType('error');
		}
	};

	const deleteNotification = async (category, notificationId) => {
		try {
			const res = await fetch(
				`http://localhost:4000/api/notifications/${encodeURIComponent(currentUser.username)}/${encodeURIComponent(category)}/${encodeURIComponent(notificationId)}`,
				{ method: 'DELETE' }
			);
			const data = await res.json();
			if (!res.ok) {
				throw new Error(data.error || 'Failed to delete notification.');
			}

			fetchNotifications();
		} catch (error) {
			setFeedbackMessage(error.message || 'Failed to delete notification.');
			setFeedbackType('error');
		}
	};

	const renderMessage = (item) => {
		const baseMessage = item.message || '';
		if (!item.rejectionReason) return baseMessage;
		if (!item.showRejectionReasonToAuthor) return baseMessage;
		return `${baseMessage} Reason: ${item.rejectionReason}`;
	};

	const calculateUrgency = (timestamp) => {
		const now = new Date();
		const notificationDate = new Date(timestamp);
		const diffInDays = Math.floor((now - notificationDate) / (1000 * 60 * 60 * 24));

		if (diffInDays > 14) return 'high';
		if (diffInDays >= 7) return 'medium';
		return 'low';
	};

	const filteredNotifications = useMemo(() => {
		if (!categories || Object.keys(categories).length === 0) {
			return visibleCategoryKeys.flatMap((category) => categories[category] || []);
		}
		return visibleCategoryKeys.flatMap((category) => {
			const items = (categories[category] || []).filter((item) => {
				const matchesSearch = normalizedSearch
					? renderMessage(item).toLowerCase().includes(normalizedSearch)
					: true;
				const matchesDate = filterDate
					? new Date(item.timestamp).toLocaleDateString() === new Date(filterDate).toLocaleDateString()
					: true;
				const urgency = calculateUrgency(item.timestamp);
				const matchesUrgency =
					filterUrgency === 'all' || urgency === filterUrgency;
				return matchesSearch && matchesDate && matchesUrgency;
			});
			return items;
		});
	}, [categories, visibleCategoryKeys, normalizedSearch, filterDate, filterUrgency]);

	return (
		<section className="notification-board">
			<div className="notification-board-header">
				<h3>Notification Board</h3>
				<span className="notification-unread-pill">Unread: {unreadCount}</span>
			</div>

			<div className="notification-filters">
				<input
					type="text"
					value={search}
					onChange={(event) => setSearch(event.target.value)}
					placeholder="Search notifications"
				/>
				<select value={filterCategory} onChange={(event) => setFilterCategory(event.target.value)}>
					<option value="all">All Categories</option>
					{Object.keys(categories).map((category) => (
						<option key={category} value={category}>
							{CATEGORY_LABELS[category] || category}
						</option>
					))}
				</select>
				<input
					type="date"
					value={filterDate}
					onChange={(event) => setFilterDate(event.target.value)}
					placeholder="Filter by date"
				/>
				<select
					value={filterUrgency}
					onChange={(event) => setFilterUrgency(event.target.value)}
				>
					<option value="all">All Urgencies</option>
					<option value="low">Low</option>
					<option value="medium">Medium</option>
					<option value="high">High</option>
				</select>
				<label className="notification-archive-toggle">
					<input
						type="checkbox"
						checked={showArchived}
						onChange={(event) => setShowArchived(event.target.checked)}
					/>
					Show archived
				</label>
			</div>

			{filteredNotifications.map((item) => (
				<div key={item.id} className={`notification-item ${item.unread ? 'unread' : 'read'}`}>
					{/* Render notification details */}
					<p>{renderMessage(item)}</p>
					<p className="notification-time">{new Date(item.timestamp).toLocaleString()}</p>
					<div className="notification-actions">
						{item.unread && (
							<button type="button" onClick={() => updateNotification(item.category, item.id, 'read')}>
								Mark as Read
							</button>
						)}
						<button
							type="button"
							onClick={() => updateNotification(item.category, item.id, item.archived ? 'unarchive' : 'archive')}
						>
							{item.archived ? 'Unarchive' : 'Archive'}
						</button>
						<button type="button" onClick={() => deleteNotification(item.category, item.id)}>
							Delete
						</button>
					</div>
				</div>
			))}
		</section>
	);
}

export default NotificationBoard;
