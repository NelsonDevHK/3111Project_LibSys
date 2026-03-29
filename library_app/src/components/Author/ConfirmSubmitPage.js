import React from 'react';

const ConfirmSubmitPage = ({ form, onBack, onConfirm }) => {
  return (
    <div className="portal">
      <h2>Confirm Book Submission</h2>
      <div className="preview-content">
        <p><strong>Title:</strong> {form.title || 'Not provided'}</p>
        <p><strong>Genres:</strong> {form.genre.length > 0 ? form.genre.join(', ') : 'Not provided'}</p>
        <p><strong>Description:</strong> {form.description || 'N/A'}</p>
        {form.cover ? (
          <div className="cover-preview">
            <strong className="cover-label">Cover Image:</strong>
            <img
              src={URL.createObjectURL(form.cover)}
              alt="Cover Preview"
              style={{ maxWidth: '200px', maxHeight: '300px' }}
            />
          </div>
        ) : (
          <p><strong>Cover:</strong> None</p>
        )}
      </div>

      <div className="dialog-buttons">
        <button className="button cancel-button" onClick={onBack}>Back to Edit</button>
        <button className="button confirm-button" onClick={onConfirm}>Confirm Submit</button>
      </div>
    </div>
  );
};

export default ConfirmSubmitPage;