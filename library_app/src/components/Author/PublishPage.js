import React, { useState, useEffect } from 'react';
import ConfirmSubmitPage from './ConfirmSubmitPage';

const GENRES = ['Fiction', 'Non-Fiction', 'Science', 'History'];
const SUMMARY_STYLES = [
  { value: 'short', label: 'Short' },
  { value: 'medium', label: 'Medium' },
  { value: 'detailed', label: 'Detailed' },
];
const MAX_BOOK_FILE_SIZE_BYTES = 15 * 1024 * 1024;
const MAX_COVER_FILE_SIZE_BYTES = 5 * 1024 * 1024;

const PublishPage = ({ currentUser, onBookPublished }) => {
  const [form, setForm] = useState({
    title: '',
    authorUsername: currentUser?.username || '',
    genre: [],
    description: '',
    summaryStyle: 'medium',
    file: null,
    cover: null,
  });
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [showConfirmPage, setShowConfirmPage] = useState(false);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [summaryModalOpen, setSummaryModalOpen] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryDraft, setSummaryDraft] = useState('');
  const [summaryError, setSummaryError] = useState('');
  const [summaryFinalized, setSummaryFinalized] = useState(false);

  useEffect(() => {
    setForm(f => ({ ...f, authorUsername: currentUser?.username || '' }));
  }, [currentUser]);

  // Load saved draft on component mount
  useEffect(() => {
    const key = `publishDraft_${currentUser?.username}`;
    const savedDraft = localStorage.getItem(key);
    if (savedDraft) {
      try {
        const draft = JSON.parse(savedDraft);
        setForm(f => ({ ...f, ...draft }));
      } catch (error) {
        console.error('Error loading draft:', error);
      }
    }

    // mark that load attempt has occurred (even if there was no draft)
    setDraftLoaded(true);
  }, [currentUser?.username]);

  // Auto-save draft when component unmounts or before page unload
  // only after we've loaded any existing draft, otherwise the
  // empty initial state will overwrite it.
  useEffect(() => {
    if (!currentUser?.username) return;
    if (!draftLoaded) return; // skip until after initial load

    const saveDraft = () => {
      const draftToSave = { ...form };
      // Don't save file and cover as they can't be serialized
      delete draftToSave.file;
      delete draftToSave.cover;
      localStorage.setItem(`publishDraft_${currentUser.username}`, JSON.stringify(draftToSave));
    };

    const handleBeforeUnload = () => {
      saveDraft();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      saveDraft(); // Save when component unmounts
    };
  }, [form, currentUser?.username, draftLoaded]);

  const handleChange = (e) => {
    const { name, value, files, type, checked } = e.target;

    if (name === 'genre' && type === 'checkbox') {
      setForm(f => {
        const genres = new Set(f.genre);
        if (checked) {
          genres.add(value);
        } else {
          genres.delete(value);
        }
        return { ...f, genre: Array.from(genres) };
      });
      setSummaryFinalized(false);
      return;
    }

    setForm((current) => ({
      ...current,
      [name]: files ? files[0] : value,
    }));

    if (name === 'title' || name === 'summaryStyle' || name === 'file') {
      setSummaryFinalized(false);
    }
  };

  const canGenerateSummary = Boolean(form.title.trim() && form.genre.length > 0);

  const fetchSummaryDraft = async () => {
    const formData = new FormData();
    formData.append('title', form.title.trim());
    formData.append('author', currentUser?.fullName || currentUser?.username || form.authorUsername || '');
    formData.append('genre', form.genre.join(','));
    formData.append('summaryStyle', form.summaryStyle);
    formData.append('file', form.file);

    const response = await fetch('http://localhost:4000/api/generate-summary', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error('Failed to generate summary.');
    }

    const data = await response.json();
    return data.summary || '';
  };

  const handleOpenSummaryModal = async () => {
    setMessage('');
    setMessageType('');

    if (!canGenerateSummary) {
      setMessage('Enter a title, select at least one genre, and choose a PDF before generating a summary.');
      setMessageType('error');
      return;
    }

    if (!form.file) {
      setMessage('Choose a PDF file before generating a summary.');
      setMessageType('error');
      return;
    }

    setSummaryModalOpen(true);
    setSummaryLoading(true);
    setSummaryError('');

    try {
      const summary = await fetchSummaryDraft();
      setSummaryDraft(summary);
    } catch (error) {
      setSummaryError('Could not generate a summary right now. You can still type or edit one manually.');
      setSummaryDraft(form.description || '');
    } finally {
      setSummaryLoading(false);
    }
  };

  const handleRegenerateSummary = async () => {
    setSummaryLoading(true);
    setSummaryError('');

    try {
      const summary = await fetchSummaryDraft();
      setSummaryDraft(summary);
    } catch (error) {
      setSummaryError('Could not regenerate the summary right now.');
    } finally {
      setSummaryLoading(false);
    }
  };

  const handleFinalizeSummary = () => {
    const refinedSummary = summaryDraft.trim();

    if (!refinedSummary) {
      setSummaryError('Please add a summary before finalizing it.');
      return;
    }

    setForm((current) => ({
      ...current,
      description: refinedSummary,
    }));
    setSummaryFinalized(true);
    setSummaryModalOpen(false);
    setSummaryError('');
    setMessage('Summary finalized and added to your draft.');
    setMessageType('success');
  };

  const handleCloseSummaryModal = () => {
    setSummaryModalOpen(false);
    setSummaryError('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setMessage('');
    setMessageType('');
    if (
      !form.title ||
      !form.authorUsername ||
      form.genre.length === 0 ||      // require at least one
      !form.file                         // PDF is required
    ) {
      setMessage('All fields other than description and cover are required.');
      setMessageType('error');
      return;
    }

    // validation now at submit time only
    if (form.genre.includes('Fiction') && form.genre.includes('Non-Fiction')) {
      setMessage('You may not select both Fiction and Non‑Fiction at the same time.');
      setMessageType('error');
      return;
    }

    // file size/type validations
    if (form.file) {
      if (form.file.type !== 'application/pdf') {
        setMessage('Book file must be a PDF.');
        setMessageType('error');
        return;
      }

      if (form.file.size > MAX_BOOK_FILE_SIZE_BYTES) {
        setMessage('Book PDF must be smaller than 15 MB.');
        setMessageType('error');
        return;
      }
    }

    // cover validations if supplied
    if (form.cover) {
      const { type, size } = form.cover;
      if (!['image/jpeg', 'image/png'].includes(type)) {
        setMessage('Cover image must be JPG or PNG.');
        setMessageType('error');
        return;
      }
      if (size > MAX_COVER_FILE_SIZE_BYTES) {
        setMessage('Cover image must be smaller than 5 MB.');
        setMessageType('error');
        return;
      }
    }

    // Navigate to confirmation page instead of opening a dialog
    setShowConfirmPage(true);
  };

  const handleConfirmSubmit = async () => {
    const formData = new FormData();
    formData.append('title', form.title);
    formData.append('authorUsername', form.authorUsername);
    formData.append('authorFullName', currentUser?.fullName || '');
    formData.append('genre', form.genre.join(','));
    formData.append('description', form.description);
    formData.append('file', form.file);
    if (form.cover) formData.append('cover', form.cover);

    try {
      const response = await fetch('http://localhost:4000/api/publish', {
        method: 'POST',
        body: formData,
      });
      if (response.ok) {
        setMessage('Book submitted for approval!');
        setMessageType('success');
        setForm({
          title: '',
          authorUsername: currentUser?.username || '',
          genre: [],
          description: '',
          summaryStyle: 'medium',
          file: null,
          cover: null,
        });
        setShowConfirmPage(false);
        setSummaryDraft('');
        setSummaryFinalized(false);
        setSummaryModalOpen(false);
        setSummaryError('');
        // Clear saved draft after successful submission
        localStorage.removeItem(`publishDraft_${currentUser?.username}`);
        // Notify parent to refresh published books list
        if (onBookPublished) {
          onBookPublished();
        }
      } else {
        setMessage('Submission failed.');
        setMessageType('error');
      }
    } catch (error) {
      setMessage('Error submitting book.');
      setMessageType('error');
    }
  };

  if (showConfirmPage) {
    return (
      <ConfirmSubmitPage
        form={form}
        onBack={() => setShowConfirmPage(false)}
        onConfirm={handleConfirmSubmit}
      />
    );
  }

  return (
    <div className="portal">
      <h2>Publish a Book</h2>
      <p className="summary-helper-text">Generate a summary from the uploaded PDF, edit it, and finalize it before you submit the book.</p>
      <form onSubmit={handleSubmit}>
        <div className="form-row">
          <label htmlFor="title">Title</label>
          <input
            id="title"
            type="text"
            name="title"
            placeholder="Book Title"
            value={form.title}
            onChange={handleChange}
            className="input title-input"
          />
        </div>

        <div className="form-row">
          <label htmlFor="authorUsername">Author Username</label>
          <input
            id="authorUsername"
            type="text"
            name="authorUsername"
            placeholder="Author Username"
            value={form.authorUsername}
            onChange={handleChange}
            className="input"
            readOnly
          />
        </div>

        <div className="form-row">
          <label>Genres</label>
          <div className="genres">
            {GENRES.map(g => (
              <label key={g} className="genre-label">
                <input
                  type="checkbox"
                  name="genre"
                  value={g}
                  checked={form.genre.includes(g)}
                  onChange={handleChange}
                />{' '}
                {g}
              </label>
            ))}
          </div>
        </div>

        <div className="form-row">
          <label htmlFor="summaryStyle">Summary Style</label>
          <select
            id="summaryStyle"
            name="summaryStyle"
            value={form.summaryStyle}
            onChange={handleChange}
            className="input"
          >
            {SUMMARY_STYLES.map((style) => (
              <option key={style.value} value={style.value}>
                {style.label}
              </option>
            ))}
          </select>
        </div>

        <div className="form-row">
          <label htmlFor="description">Description</label>
          <textarea
            id="description"
            name="description"
            placeholder="Description"
            value={form.description}
            onChange={handleChange}
            className="input description-input"
            rows="5"
          />
          <div className="publish-summary-actions">
            <button
              type="button"
              className="button ai-generate-button"
              onClick={handleOpenSummaryModal}
              disabled={summaryLoading || !form.title.trim() || form.genre.length === 0 || !form.file}
            >
              {summaryLoading ? 'Generating...' : 'Generate Summary from PDF'}
            </button>
            {summaryFinalized && <span className="summary-finalized-badge">Summary finalized</span>}
          </div>
        </div>

        <div className="form-row">
          <label htmlFor="file">Book File </label>
          {form.file ? (
            <div className="file-selected-display">
              <div className="file-selected-name">{form.file.name}</div>
              <input
                id="file"
                type="file"
                name="file"
                accept=".pdf"
                onChange={handleChange}
                className="input file-input-hidden"
              />
              <button type="button" className="change-file-button" onClick={() => document.getElementById('file').click()}>
                Change File
              </button>
            </div>
          ) : (
            <div className="file-selected-display">
              <div className="file-selected-name file-placeholder">No file chosen</div>
              <input
                id="file"
                type="file"
                name="file"
                accept=".pdf"
                onChange={handleChange}
                className="input file-input-hidden"
              />
              <button type="button" className="change-file-button" onClick={() => document.getElementById('file').click()}>
                Choose File
              </button>
            </div>
          )}
        </div>

        <div className="form-row">
          <label htmlFor="cover">Cover Image</label>
          {form.cover ? (
            <div className="file-selected-display">
              <div className="file-selected-name">{form.cover.name}</div>
              <input
                id="cover"
                type="file"
                name="cover"
                accept="image/jpeg,image/png"
                onChange={handleChange}
                className="input file-input-hidden"
              />
              <button type="button" className="change-file-button" onClick={() => document.getElementById('cover').click()}>
                Change Image
              </button>
            </div>
          ) : (
            <div className="file-selected-display">
              <div className="file-selected-name file-placeholder">No file chosen</div>
              <input
                id="cover"
                type="file"
                name="cover"
                accept="image/jpeg,image/png"
                onChange={handleChange}
                className="input file-input-hidden"
              />
              <button type="button" className="change-file-button" onClick={() => document.getElementById('cover').click()}>
                Choose Image
              </button>
            </div>
          )}
        </div>

        <button type="submit" className="button">Submit for Approval</button>
      </form>
      {message && <p className={messageType === 'success' ? 'success' : 'error'}>{message}</p>}

      {summaryModalOpen && (
        <div className="modal-overlay">
          <div className="modal-box summary-modal-box">
            <h4>Generate and Refine Summary</h4>
            <p>
              Choose a style, generate a draft from the PDF text, and edit it before applying it to the description.
            </p>

            <div className="form-row summary-style-row">
              <label htmlFor="modalSummaryStyle">Summary Style</label>
              <select
                id="modalSummaryStyle"
                name="summaryStyle"
                value={form.summaryStyle}
                onChange={handleChange}
                className="input"
              >
                {SUMMARY_STYLES.map((style) => (
                  <option key={style.value} value={style.value}>
                    {style.label}
                  </option>
                ))}
              </select>
            </div>

            {summaryLoading && <p className="summary-loading">Generating a summary draft...</p>}
            {summaryError && <p className="error">{summaryError}</p>}

            <label htmlFor="summaryDraft">Summary Draft</label>
            <textarea
              id="summaryDraft"
              value={summaryDraft}
              onChange={(e) => setSummaryDraft(e.target.value)}
              className="input summary-editor"
              rows="8"
              placeholder="Generated summary will appear here. You can edit it before finalizing."
              disabled={summaryLoading}
            />

            <div className="dialog-buttons">
              <button
                type="button"
                className="button confirm-button"
                onClick={handleFinalizeSummary}
                disabled={summaryLoading}
              >
                Finalize Summary
              </button>
              <button
                type="button"
                className="button"
                onClick={handleRegenerateSummary}
                disabled={summaryLoading}
              >
                Regenerate
              </button>
              <button
                type="button"
                className="button cancel-button"
                onClick={handleCloseSummaryModal}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PublishPage;