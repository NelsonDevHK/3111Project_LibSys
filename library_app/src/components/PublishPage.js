import React, { useState, useEffect  } from 'react';
import ConfirmSubmitDialog from './ConfirmSubmitDialog';

const GENRES = ['Fiction', 'Non-Fiction', 'Science', 'History'];

const PublishPage = ({ currentUser }) => {
  const [form, setForm] = useState({
    title: '',
    authorUsername: currentUser?.username || '',
    genre: [],
    description: '',
    file: null,
    cover: null,
  });
  const [message, setMessage] = useState('');
  const [showDialog, setShowDialog] = useState(false);
  const [draftLoaded, setDraftLoaded] = useState(false);

  useEffect(() => {
    setForm(f => ({ ...f, authorUsername: currentUser?.username || '' }));
  }, [currentUser]);

  // Load saved draft on component mount
  useEffect(() => {
    const key = `publishDraft_${currentUser?.username}`;
    const savedDraft = localStorage.getItem(key);
    console.log('Loading draft for user:', currentUser?.username);
    console.log('Saved draft from localStorage:', savedDraft);
    if (savedDraft) {
      try {
        const draft = JSON.parse(savedDraft);
        console.log('Parsed draft:', draft);
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
      console.log('Draft saved:', draftToSave);
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
      return;
    }

    setForm({
      ...form,
      [name]: files ? files[0] : value,
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (
      !form.title ||
      !form.authorUsername ||
      form.genre.length === 0 ||      // require at least one
      !form.file                         // PDF is required
    ) {
      setMessage('All fields other than description and cover are required.');
      return;
    }

    // validation now at submit time only
    if (form.genre.includes('Fiction') && form.genre.includes('Non-Fiction')) {
      setMessage('You may not select both Fiction and Non‑Fiction at the same time.');
      return;
    }

    // cover validations if supplied
    if (form.cover) {
      const { type, size } = form.cover;
      if (!['image/jpeg', 'image/png'].includes(type)) {
        setMessage('Cover image must be JPG or PNG.');
        return;
      }
      if (size > 10 * 1024 * 1024) { // 10 MB limit
        setMessage('Cover image must be smaller than 10 MB.');
        return;
      }
    }

    // Show preview dialog instead of submitting
    setShowDialog(true);
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
        setForm({
          title: '',
          authorUsername: currentUser?.username || '',
          genre: [],
          description: '',
          file: null,
          cover: null,
        });
        setShowDialog(false);
        // Clear saved draft after successful submission
        localStorage.removeItem(`publishDraft_${currentUser?.username}`);
      } else {
        setMessage('Submission failed.');
      }
    } catch (error) {
      setMessage('Error submitting book.');
    }
  };

  return (
    <div className="portal">
      <h2>Publish a Book</h2>
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
        </div>

        <div className="form-row">
          <label htmlFor="file">Book File </label>
          <input
            id="file"
            type="file"
            name="file"
            accept=".pdf"
            onChange={handleChange}
            className="input"
          />
        </div>

        <div className="form-row">
          <label htmlFor="cover">Cover Image</label>
          <input
            id="cover"
            type="file"
            name="cover"
            accept="image/jpeg,image/png"
            onChange={handleChange}
            className="input"
          />
        </div>

        <button type="submit" className="button">Submit for Approval</button>
      </form>
      <ConfirmSubmitDialog
        form={form}
        onCancel={() => setShowDialog(false)}
        onConfirm={handleConfirmSubmit}
        show={showDialog}
      />
      {message && <p>{message}</p>}
    </div>
  );
};

export default PublishPage;