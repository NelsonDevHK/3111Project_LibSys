import React from 'react';

const ConfirmSubmitDialog = ({ form, onCancel, onConfirm, show }) => {
  if (!show) return null;

  return (
    <div className="dialog-overlay">
      <div className="dialog-box">
        <h3>Book Preview</h3>
        <div className="preview-content">
          <p><strong>Title:</strong> {form.title || 'Not provided'}</p>
          {/* <p><strong>Author:</strong> {form.authorUsername || 'Not provided'}</p> */}
          <p><strong>Genres:</strong> {form.genre.length > 0 ? form.genre.join(', ') : 'Not provided'}</p>
          <p><strong>Description:</strong> {form.description || 'N/A'}</p>
          {/* {form.cover && (
            <div>
              <strong>Cover Image:</strong>
              <img src={URL.createObjectURL(form.cover)} alt="Cover Preview" style={{ maxWidth: '200px', maxHeight: '300px' }} />
            </div>
          )} */}
        </div>
        <div className="dialog-buttons">
          <button className="button cancel-button" onClick={onCancel}>Cancel</button>
          <button className="button confirm-button" onClick={onConfirm}>Confirm Submit</button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmSubmitDialog;
