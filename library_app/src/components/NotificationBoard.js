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

const CATEGORY_PRIORITY = {
	newSubmissions: 5,
	accountUpdates: 4,
	bookRejectionUpdates: 3,
	bookApprovalUpdates: 2,
	dueReminders: 2,
	bookDeletionNotices: 1,
	other: 0,
};

function getNotificationPriority(item) {
	if (!item) {
		return 0;
	}

	let score = CATEGORY_PRIORITY[item.category] || 0;
	if (item.unread) {
		score += 2;
	}
	if (item.archived) {
		score -= 5;
	}

	const message = String(item.message || '').toLowerCase();
	if (message.includes('urgent') || message.includes('special request') || message.includes('profile update')) {
		score += 3;
	}

	return score;
}

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
		if (filterCategory !== 'all') return keys.filter((key) => key === filterCategory);

		return keys.sort((left, right) => {
			const leftScore = Math.max(...((categories[left] || []).map(getNotificationPriority)), 0);
			const rightScore = Math.max(...((categories[right] || []).map(getNotificationPriority)), 0);
			return rightScore - leftScore;
		});
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

	const matchesFilters = useCallback(
		(item) => {
			const matchesSearch = normalizedSearch
				? renderMessage(item).toLowerCase().includes(normalizedSearch)
				: true;
			const matchesDate = filterDate
				? new Date(item.timestamp).toLocaleDateString() === new Date(filterDate).toLocaleDateString()
				: true;
			const urgency = calculateUrgency(item.timestamp);
			const matchesUrgency = filterUrgency === 'all' || urgency === filterUrgency;
			return matchesSearch && matchesDate && matchesUrgency;
		},
		[normalizedSearch, filterDate, filterUrgency]
	);

	const sortByPriority = useCallback((left, right) => {
		const priorityDiff = getNotificationPriority(right) - getNotificationPriority(left);
		if (priorityDiff !== 0) {
			return priorityDiff;
		}

		const leftTime = new Date(left.timestamp || 0).getTime();
		const rightTime = new Date(right.timestamp || 0).getTime();
		return rightTime - leftTime;
	}, []);

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
					placeholder="Search notifications by message"
				/>
				<select value={filterCategory} onChange={(event) => setFilterCategory(event.target.value)}>
					<option value="all">All Types</option>
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

			{visibleCategoryKeys.map((category) => {
				const items = (categories[category] || [])
					.filter(matchesFilters)
					.sort(sortByPriority);

				const activeItems = items.filter((item) => !item.archived);
				const archivedItems = items.filter((item) => item.archived);
				const shouldShowSection = activeItems.length > 0 || (showArchived && archivedItems.length > 0);

				if (!shouldShowSection) {
					return null;
				}

				return (
					<div key={category} className="notification-category-section">
						<h4>{CATEGORY_LABELS[category] || category}</h4>
						<div className="notification-list">
							{activeItems.length === 0 && <p className="notification-empty">No active notifications.</p>}
							{activeItems.map((item) => (
								<div
									key={item.id}
									className={`notification-item ${item.unread ? 'unread' : 'read'} ${getNotificationPriority(item) >= 4 ? 'priority-notification' : ''}`}
								>
									<div className="notification-item-copy">
										{getNotificationPriority(item) >= 4 && <span className="notification-priority-pill">Priority</span>}
										<p>{renderMessage(item)}</p>
										<p className="notification-time">{new Date(item.timestamp).toLocaleString()}</p>
									</div>
									<div className="notification-actions">
										{item.unread && (
											<button type="button" onClick={() => updateNotification(category, item.id, 'read')}>
												Mark as Read
											</button>
										)}
										<button type="button" onClick={() => updateNotification(category, item.id, 'archive')}>
											Archive
										</button>
										<button type="button" onClick={() => deleteNotification(category, item.id)}>
											Delete
										</button>
									</div>
								</div>
							))}
						</div>

						{showArchived && (
							<div className="notification-archived-section">
								<h5>Archived</h5>
								<div className="notification-list">
									{archivedItems.length === 0 && <p className="notification-empty">No archived notifications.</p>}
									{archivedItems.map((item) => (
										<div
											key={item.id}
											className={`notification-item ${item.unread ? 'unread' : 'read'} ${getNotificationPriority(item) >= 4 ? 'priority-notification' : ''}`}
										>
											<div className="notification-item-copy">
												{getNotificationPriority(item) >= 4 && <span className="notification-priority-pill">Priority</span>}
												<p>{renderMessage(item)}</p>
												<p className="notification-time">{new Date(item.timestamp).toLocaleString()}</p>
											</div>
											<div className="notification-actions">
												{item.unread && (
													<button type="button" onClick={() => updateNotification(category, item.id, 'read')}>
														Mark as Read
													</button>
												)}
												<button type="button" onClick={() => updateNotification(category, item.id, 'unarchive')}>
													Unarchive
												</button>
												<button type="button" onClick={() => deleteNotification(category, item.id)}>
													Delete
												</button>
											</div>
										</div>
									))}
								</div>
							</div>
						)}
					</div>
				);
			})}

			{visibleCategoryKeys.every((category) => {
				const items = (categories[category] || []).filter(matchesFilters);
				const activeItems = items.filter((item) => !item.archived);
				const archivedItems = items.filter((item) => item.archived);
				return !(activeItems.length > 0 || (showArchived && archivedItems.length > 0));
			}) && <p>No notifications available.</p>}

			{feedbackMessage && <p className={feedbackType === 'error' ? 'error' : 'info'}>{feedbackMessage}</p>}
		</section>
	);
}

export default NotificationBoard;
