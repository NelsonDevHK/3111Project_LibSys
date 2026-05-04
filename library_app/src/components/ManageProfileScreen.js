import React, { useEffect, useMemo, useState } from 'react';

const MAX_PROFILE_PICTURE_SIZE = 2 * 1024 * 1024;
const PROFILE_PICTURE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

function validatePassword(password) {
	const minLength = 8;
	const hasLetter = /[a-zA-Z]/.test(password);
	const hasNumber = /[0-9]/.test(password);
	return password.length >= minLength && hasLetter && hasNumber;
}

function getPasswordStrength(password) {
	if (!password) {
		return { label: 'No new password', score: 0, className: 'strength-none' };
	}

	let score = 0;
	if (password.length >= 8) score += 1;
	if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
	if (/[0-9]/.test(password)) score += 1;
	if (/[^A-Za-z0-9]/.test(password)) score += 1;

	if (score <= 1) return { label: 'Weak', score, className: 'strength-weak' };
	if (score <= 3) return { label: 'Medium', score, className: 'strength-medium' };
	return { label: 'Strong', score, className: 'strength-strong' };
}

function getProfilePicturePreview(profilePicture) {
	return typeof profilePicture === 'string' && profilePicture ? profilePicture : '';
}

function ManageProfileScreen({ currentUser, onProfileUpdated, onForceLogout }) {
	const [fullName, setFullName] = useState(currentUser?.fullName || '');
	const [employeeId, setEmployeeId] = useState(currentUser?.employeeId || '');
	const [bio, setBio] = useState(currentUser?.bio || '');
	const [profilePicture, setProfilePicture] = useState(currentUser?.profilePicture || '');
	const [currentPassword, setCurrentPassword] = useState('');
	const [newPassword, setNewPassword] = useState('');
	const [confirmPassword, setConfirmPassword] = useState('');
	const [feedbackMessage, setFeedbackMessage] = useState('');
	const [feedbackType, setFeedbackType] = useState('');
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [showPasswords, setShowPasswords] = useState(false);
	const [profilePictureError, setProfilePictureError] = useState('');

	const isLibrarian = currentUser?.role === 'librarian';
	const isAuthor = currentUser?.role === 'author';
	const strength = useMemo(() => getPasswordStrength(newPassword), [newPassword]);

	useEffect(() => {
		setFullName(currentUser?.fullName || '');
		setEmployeeId(currentUser?.employeeId || '');
		setBio(currentUser?.bio || '');
		setProfilePicture(currentUser?.profilePicture || '');
		setCurrentPassword('');
		setNewPassword('');
		setConfirmPassword('');
		setFeedbackMessage('');
		setFeedbackType('');
		setProfilePictureError('');
	}, [currentUser]);

	const hasChanges =
		fullName.trim() !== (currentUser?.fullName || '') ||
		(isLibrarian && employeeId.trim() !== (currentUser?.employeeId || '')) ||
		(isAuthor && bio.trim() !== (currentUser?.bio || '')) ||
		newPassword.length > 0 ||
		profilePicture !== (currentUser?.profilePicture || '');

	const clearFeedback = () => {
		setFeedbackMessage('');
		setFeedbackType('');
	};

	const handleProfilePictureChange = (event) => {
		const file = event.target.files?.[0];
		setProfilePictureError('');

		if (!file) {
			setProfilePicture(currentUser?.profilePicture || '');
			return;
		}

		if (!PROFILE_PICTURE_TYPES.includes(file.type)) {
			setProfilePicture(currentUser?.profilePicture || '');
			setProfilePictureError('Profile picture must be a JPG, PNG, WEBP, or GIF image.');
			return;
		}

		if (file.size > MAX_PROFILE_PICTURE_SIZE) {
			setProfilePicture(currentUser?.profilePicture || '');
			setProfilePictureError('Profile picture must be smaller than 2 MB.');
			return;
		}

		const reader = new FileReader();
		reader.onload = () => {
			setProfilePicture(typeof reader.result === 'string' ? reader.result : '');
		};
		reader.onerror = () => {
			setProfilePicture(currentUser?.profilePicture || '');
			setProfilePictureError('Unable to read the selected image.');
		};
		reader.readAsDataURL(file);
	};

	const handleSubmit = async (e) => {
		e.preventDefault();
		clearFeedback();

		if (!hasChanges) {
			setFeedbackMessage('No changes detected.');
			setFeedbackType('error');
			return;
		}

		if (!fullName.trim()) {
			setFeedbackMessage('Full Name cannot be empty.');
			setFeedbackType('error');
			return;
		}

		if (!currentPassword) {
			setFeedbackMessage('Please re-enter your current password to save changes.');
			setFeedbackType('error');
			return;
		}

		if (profilePictureError) {
			setFeedbackMessage(profilePictureError);
			setFeedbackType('error');
			return;
		}

		if (newPassword && !validatePassword(newPassword)) {
			setFeedbackMessage('New password must be at least 8 characters, include a letter and a number.');
			setFeedbackType('error');
			return;
		}

		if (newPassword && newPassword !== confirmPassword) {
			setFeedbackMessage('New password and confirmation do not match.');
			setFeedbackType('error');
			return;
		}

		setIsSubmitting(true);

		try {
			const payload = {
				username: currentUser.username,
				role: currentUser.role,
				currentPassword,
				fullName: fullName.trim(),
				password: newPassword,
			};

			if (isLibrarian) {
				payload.employeeId = employeeId.trim();
			}
			if (isAuthor) {
				payload.bio = bio.trim();
			}
			if (profilePicture !== (currentUser?.profilePicture || '')) {
				payload.profilePicture = profilePicture;
			}
			const res = await fetch('http://localhost:4000/api/profile/update', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload),
			});

			const data = await res.json();
			if (!res.ok) {
				setFeedbackMessage(data.error || 'Failed to update profile.');
				setFeedbackType('error');
				return;
			}

			onProfileUpdated(data.user);
			setCurrentPassword('');
			setNewPassword('');
			setConfirmPassword('');
			setFeedbackMessage('Profile updated successfully.');
			setFeedbackType('success');

			if (data.passwordChanged) {
				setTimeout(() => {
					onForceLogout('Password changed. Please log in again.');
				}, 700);
			}
		} catch {
			setFeedbackMessage('Server error while updating profile.');
			setFeedbackType('error');
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<div className="manage-profile-box">
			<h3>Manage Profile</h3>
			<form onSubmit={handleSubmit}>
				<label htmlFor="profileFullName">Full Name</label>
				<input
					id="profileFullName"
					type="text"
					value={fullName}
					onChange={(e) => {
						setFullName(e.target.value);
						clearFeedback();
					}}
					required
				/>

				{isLibrarian && (
					<>
						<label htmlFor="profileEmployeeId">Employee ID</label>
						<input
							id="profileEmployeeId"
							type="text"
							value={employeeId}
							onChange={(e) => {
								setEmployeeId(e.target.value);
								clearFeedback();
							}}
							placeholder="Employee ID"
						/>
					</>
				)}

				{isAuthor && (
					<>
						<label htmlFor="profileBio">Bio</label>
						<textarea
							id="profileBio"
							value={bio}
							onChange={(e) => {
								setBio(e.target.value);
								clearFeedback();
							}}
							rows={4}
							placeholder="Tell readers about yourself"
						/>
					</>
				)}

				<label htmlFor="profilePicture">Profile Picture (optional)</label>
				{getProfilePicturePreview(profilePicture) && (
					<img
						src={getProfilePicturePreview(profilePicture)}
						alt={`${currentUser?.fullName || currentUser?.username || 'Profile'} avatar`}
						style={{ width: '96px', height: '96px', objectFit: 'cover', borderRadius: '50%', marginBottom: '8px' }}
					/>
				)}
				<input
					id="profilePicture"
					type="file"
					accept="image/jpeg,image/png,image/webp,image/gif"
					onChange={handleProfilePictureChange}
				/>
				{profilePictureError && <p className="error">{profilePictureError}</p>}

				<div className="password-strength-row" style={{ justifyContent: 'space-between' }}>
					<span>Password fields</span>
					<button
						type="button"
						onClick={() => setShowPasswords((prev) => !prev)}
						style={{ padding: '6px 10px', fontSize: '0.9rem' }}
					>
						{showPasswords ? 'Hide Passwords' : 'Show Passwords'}
					</button>
				</div>

				<label htmlFor="profileCurrentPassword">Current Password (required to save changes)</label>
				<input
					id="profileCurrentPassword"
					type={showPasswords ? 'text' : 'password'}
					value={currentPassword}
					onChange={(e) => {
						setCurrentPassword(e.target.value);
						clearFeedback();
					}}
					placeholder="Enter current password"
				/>

				<label htmlFor="profileNewPassword">New Password (optional)</label>
				<input
					id="profileNewPassword"
					type={showPasswords ? 'text' : 'password'}
					value={newPassword}
					onChange={(e) => {
						const nextPassword = e.target.value;
						if (nextPassword !== newPassword) {
							setConfirmPassword('');
						}
						setNewPassword(nextPassword);
						clearFeedback();
					}}
					placeholder="Enter new password"
				/>

				<div className="password-strength-row">
					<span>Password strength:</span>
					<strong className={strength.className}>{strength.label}</strong>
				</div>

				<label htmlFor="profileConfirmPassword">Confirm New Password</label>
				<input
					id="profileConfirmPassword"
					type={showPasswords ? 'text' : 'password'}
					value={confirmPassword}
					onChange={(e) => {
						setConfirmPassword(e.target.value);
						clearFeedback();
					}}
					placeholder="Re-enter new password"
					disabled={!newPassword}
				/>

				<button type="submit" disabled={isSubmitting}>
					{isSubmitting ? 'Saving...' : 'Save Profile Changes'}
				</button>

				{feedbackMessage && <p className={feedbackType}>{feedbackMessage}</p>}
			</form>
		</div>
	);
}

export default ManageProfileScreen;
