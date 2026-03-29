import React, { useCallback, useEffect, useMemo, useState } from 'react';

const CATEGORY_LABELS = {
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
					.filter((item) => {
						if (!normalizedSearch) return true;
						return renderMessage(item).toLowerCase().includes(normalizedSearch);
					})
					.sort((a, b) => {
						const aTime = new Date(a.timestamp || 0).getTime();
						const bTime = new Date(b.timestamp || 0).getTime();
						return bTime - aTime;
					});

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
								<div key={item.id} className={`notification-item ${item.unread ? 'unread' : 'read'}`}>
									<div className="notification-item-copy">
										<p>{renderMessage(item)}</p>
										<p className="notification-time">{new Date(item.timestamp).toLocaleString()}</p>
									</div>
									<div className="notification-actions">
										{item.unread && (
											<button type="button" onClick={() => updateNotification(category, item.id, 'read')}>
												Mark as Read
											</button>
										)}
										<button
											type="button"
											onClick={() => updateNotification(category, item.id, item.archived ? 'unarchive' : 'archive')}
										>
											{item.archived ? 'Unarchive' : 'Archive'}
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
									{archivedItems.length === 0 && (
										<p className="notification-empty">no archived notifications</p>
									)}
									{archivedItems.map((item) => (
										<div key={item.id} className={`notification-item ${item.unread ? 'unread' : 'read'}`}>
											<div className="notification-item-copy">
												<p>{renderMessage(item)}</p>
												<p className="notification-time">{new Date(item.timestamp).toLocaleString()}</p>
											</div>
											<div className="notification-actions">
												{item.unread && (
													<button type="button" onClick={() => updateNotification(category, item.id, 'read')}>
														Mark as Read
													</button>
												)}
												<button
													type="button"
													onClick={() => updateNotification(category, item.id, item.archived ? 'unarchive' : 'archive')}
												>
													{item.archived ? 'Unarchive' : 'Archive'}
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
				const items = (categories[category] || [])
					.filter((item) => {
						if (!normalizedSearch) return true;
						return renderMessage(item).toLowerCase().includes(normalizedSearch);
					});
				const activeItems = items.filter((item) => !item.archived);
				const archivedItems = items.filter((item) => item.archived);
				return !(activeItems.length > 0 || (showArchived && archivedItems.length > 0));
			}) && <p>No notifications available.</p>}

			{feedbackMessage && <p className={feedbackType === 'error' ? 'error' : 'info'}>{feedbackMessage}</p>}
		</section>
	);
}

export default NotificationBoard;
