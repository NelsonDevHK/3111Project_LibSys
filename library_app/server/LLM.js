const fs = require('fs');
const path = require('path');
const { PDFParse } = require('pdf-parse');

const ENV_PATH = path.join(__dirname, '.env');

function loadLocalEnv() {
  if (!fs.existsSync(ENV_PATH)) {
    return;
  }

  const contents = fs.readFileSync(ENV_PATH, 'utf-8');
  contents.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      return;
    }

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) {
      return;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, '');

    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  });
}

loadLocalEnv();

const SUMMARY_STYLES = {
  short: {
    label: 'short',
    instruction: 'Write a concise 2-sentence summary that highlights the core premise only.',
    targetWords: '40-60',
  },
  medium: {
    label: 'medium',
    instruction: 'Write a balanced 3-4 sentence summary that covers the premise, tone, and appeal.',
    targetWords: '70-110',
  },
  detailed: {
    label: 'detailed',
    instruction: 'Write a richer 5-6 sentence summary with the premise, themes, and reader value.',
    targetWords: '120-170',
  },
};

const MAX_EXTRACTED_TEXT_CHARS = 12000;

function cleanText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeGenreValue(genre) {
  if (Array.isArray(genre)) {
    return genre.map(cleanText).filter(Boolean).join(', ');
  }

  return cleanText(genre);
}

function normalizeSummaryStyle(summaryStyle) {
  const normalized = String(summaryStyle || '').toLowerCase().trim();
  return SUMMARY_STYLES[normalized] ? normalized : 'medium';
}

function trimTextForPrompt(text, limit = MAX_EXTRACTED_TEXT_CHARS) {
  const normalized = cleanText(text);
  if (normalized.length <= limit) {
    return normalized;
  }

  return `${normalized.slice(0, limit)}...`;
}

function buildPrompt({ title, author, genre, summaryStyle, notes }) {
  const styleKey = normalizeSummaryStyle(summaryStyle);
  const style = SUMMARY_STYLES[styleKey];
  const normalizedTitle = cleanText(title);
  const normalizedAuthor = cleanText(author);
  const normalizedGenre = normalizeGenreValue(genre) || 'General fiction or non-fiction';
  const normalizedNotes = cleanText(notes);

  return [
    'You are writing a book summary for a library publishing form.',
    'Keep the summary concise, accurate, and relevant to the provided details only.',
    'Do not invent plot points, characters, or facts that were not supplied.',
    'Write in a clear, professional tone and return only the summary text.',
    `Style: ${style.label}.`,
    `Length target: ${style.targetWords} words.`,
    style.instruction,
    `Title: ${normalizedTitle || 'Untitled Book'}`,
    `Author: ${normalizedAuthor || 'Unknown Author'}`,
    `Genre: ${normalizedGenre}`,
    normalizedNotes ? `Extra notes: ${normalizedNotes}` : 'Extra notes: none provided.',
  ].join('\n');
}

function buildFallbackSummary({ title, author, genre, summaryStyle, notes }) {
  const styleKey = normalizeSummaryStyle(summaryStyle);
  const normalizedTitle = cleanText(title) || 'Untitled Book';
  const normalizedAuthor = cleanText(author) || 'Unknown Author';
  const normalizedGenre = normalizeGenreValue(genre) || 'general literature';
  const normalizedNotes = cleanText(notes);

  const styleLead = {
    short: 'This concise title',
    medium: 'This book',
    detailed: 'This detailed summary presents the book',
  }[styleKey];

  const styleTail = {
    short: 'It offers a focused reading experience for readers interested in the genre.',
    medium: 'It is presented as a thoughtful and relevant addition for readers drawn to the genre.',
    detailed: 'It is positioned as a well-rounded addition for readers who want a balanced and engaging reading experience.',
  }[styleKey];

  let summary = `${styleLead} "${normalizedTitle}" by ${normalizedAuthor} fits within ${normalizedGenre}. `;
  if (normalizedNotes) {
    summary += `${normalizedNotes} `;
  }
  summary += styleTail;
  return summary;
}

async function extractTextFromPdfBuffer(pdfBuffer) {
  if (typeof PDFParse !== 'function') {
    throw new Error('PDF text extraction is not available in the installed pdf-parse package.');
  }

  const buffer = Buffer.isBuffer(pdfBuffer) ? pdfBuffer : Buffer.from(pdfBuffer || []);
  const parser = new PDFParse({ data: buffer });
  const parsed = await parser.getText();
  await parser.destroy().catch(() => {});
  return cleanText(parsed?.text || '');
}

function buildPdfSummaryPrompt({ title, genre, summaryStyle, extractedText, author }) {
  const styleKey = normalizeSummaryStyle(summaryStyle);
  const style = SUMMARY_STYLES[styleKey];
  const normalizedTitle = cleanText(title);
  const normalizedGenre = normalizeGenreValue(genre) || 'General fiction or non-fiction';
  const normalizedAuthor = cleanText(author);
  const textExcerpt = trimTextForPrompt(extractedText);

  return [
    'You are summarizing a book based only on the provided PDF text.',
    'Use only details that appear in the text excerpt.',
    'Do not invent plot points, characters, or themes that are not supported by the text.',
    'Return only the summary text, without bullet points or a heading.',
    `Style: ${style.label}.`,
    `Length target: ${style.targetWords} words.`,
    style.instruction,
    `Title: ${normalizedTitle || 'Untitled Book'}`,
    `Author: ${normalizedAuthor || 'Unknown Author'}`,
    `Genre: ${normalizedGenre}`,
    'PDF text excerpt:',
    textExcerpt || 'No readable text could be extracted from the PDF.',
  ].join('\n');
}

async function generateBookSummaryFromPdf({ title, author, genre, summaryStyle, pdfBuffer } = {}) {
  const extractedText = await extractTextFromPdfBuffer(pdfBuffer);
  const provider = getProviderConfig();
  const prompt = buildPdfSummaryPrompt({ title, author, genre, summaryStyle, extractedText });

  if (provider === 'nvidia') {
    const apiKey = process.env.NVIDIA_API_KEY || process.env.NVIDIA_NIM_API_KEY || process.env.NVIDIA_API_TOKEN;
    if (apiKey) {
      try {
        return await callOpenAICompatibleEndpoint({
          endpoint: process.env.NVIDIA_API_URL || 'https://integrate.api.nvidia.com/v1/chat/completions',
          apiKey,
          model: process.env.NVIDIA_MODEL || 'meta/llama-3.1-70b-instruct',
          prompt,
        });
      } catch (error) {
        console.warn('PDF-backed NVIDIA summary generation failed, using fallback summary:', error.message);
      }
    }
  }

  if (provider === 'openai' && process.env.OPENAI_API_KEY) {
    try {
      return await callOpenAICompatibleEndpoint({
        endpoint: process.env.OPENAI_API_URL || 'https://api.openai.com/v1/chat/completions',
        apiKey: process.env.OPENAI_API_KEY,
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        prompt,
      });
    } catch (error) {
      console.warn('PDF-backed OpenAI summary generation failed, using fallback summary:', error.message);
    }
  }

  return buildFallbackSummary({
    title,
    author,
    genre,
    summaryStyle,
    notes: trimTextForPrompt(extractedText, 700),
  });
}

function getProviderConfig() {
  const provider = String(process.env.LLM_PROVIDER || '').trim().toLowerCase();
  if (provider) {
    return provider;
  }

  if (process.env.NVIDIA_API_KEY) {
    return 'nvidia';
  }

  if (process.env.OPENAI_API_KEY) {
    return 'openai';
  }

  return 'mock';
}

async function callOpenAICompatibleEndpoint({ endpoint, apiKey, model, prompt }) {
  if (typeof fetch !== 'function') {
    throw new Error('Fetch is not available in this Node runtime.');
  }

  let response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.6,
        max_tokens: 220,
        messages: [
          {
            role: 'system',
            content: 'You generate concise, relevant book summaries for a publishing workflow.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
    });
  } catch (error) {
    throw new Error(`LLM fetch failure: ${error.message}`);
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`LLM request failed (${response.status}): ${errorText || response.statusText}`.trim());
  }

  const data = await response.json();
  const summary = cleanText(data?.choices?.[0]?.message?.content || data?.choices?.[0]?.text || data?.output_text);

  if (!summary) {
    throw new Error('LLM response did not include summary text.');
  }

  return summary;
}

async function generateBookSummary({ title, author, genre, summaryStyle, notes } = {}) {
  const prompt = buildPrompt({ title, author, genre, summaryStyle, notes });
  const provider = getProviderConfig();

  try {
    if (provider === 'nvidia') {
      const apiKey = process.env.NVIDIA_API_KEY || process.env.NVIDIA_NIM_API_KEY || process.env.NVIDIA_API_TOKEN;
      if (!apiKey) {
        throw new Error('NVIDIA_API_KEY is not configured.');
      }

      return await callOpenAICompatibleEndpoint({
        endpoint: process.env.NVIDIA_API_URL || 'https://integrate.api.nvidia.com/v1/chat/completions',
        apiKey,
        model: process.env.NVIDIA_MODEL || 'meta/llama-3.1-70b-instruct',
        prompt,
      });
    }

    if (provider === 'openai') {
      if (!process.env.OPENAI_API_KEY) {
        throw new Error('OPENAI_API_KEY is not configured.');
      }

      return await callOpenAICompatibleEndpoint({
        endpoint: process.env.OPENAI_API_URL || 'https://api.openai.com/v1/chat/completions',
        apiKey: process.env.OPENAI_API_KEY,
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        prompt,
      });
    }
  } catch (error) {
    console.warn('LLM summary generation failed, using fallback summary:', error.message);
  }

  return buildFallbackSummary({ title, author, genre, summaryStyle, notes });
}

function buildReviewSentimentPrompt({ reviewText, rating, bookTitle, username }) {
  const normalizedText = cleanText(reviewText);
  const normalizedTitle = cleanText(bookTitle) || 'Unknown title';
  const normalizedUsername = cleanText(username) || 'Unknown reviewer';

  return [
    'Classify the sentiment of a book review as positive, neutral, or negative.',
    'Return only one of those three words in lowercase.',
    'Do not explain your answer.',
    `Book title: ${normalizedTitle}`,
    `Reviewer: ${normalizedUsername}`,
    `Rating: ${Number.isFinite(Number(rating)) ? Number(rating) : 'unknown'}`,
    `Review text: ${normalizedText || 'No written review provided.'}`,
  ].join('\n');
}

function normalizeReviewSentiment(sentiment) {
  const normalized = String(sentiment || '').toLowerCase().trim();
  if (normalized.includes('positive')) return 'positive';
  if (normalized.includes('neutral')) return 'neutral';
  if (normalized.includes('negative')) return 'negative';
  return null;
}

function fallbackReviewSentiment({ reviewText, rating }) {
  const numericRating = Number(rating);
  const normalizedText = cleanText(reviewText).toLowerCase();

  if (Number.isFinite(numericRating)) {
    if (numericRating >= 4) return 'positive';
    if (numericRating <= 2) return 'negative';
  }

  if (/\b(love|excellent|great|amazing|wonderful|fantastic|enjoyed)\b/.test(normalizedText)) {
    return 'positive';
  }
  if (/\b(bad|poor|terrible|awful|boring|hate|disappointing)\b/.test(normalizedText)) {
    return 'negative';
  }

  return 'neutral';
}

async function generateReviewSentiment({ reviewText, rating, bookTitle, username } = {}) {
  const prompt = buildReviewSentimentPrompt({ reviewText, rating, bookTitle, username });
  const provider = getProviderConfig();

  try {
    if (provider === 'nvidia') {
      const apiKey = process.env.NVIDIA_API_KEY || process.env.NVIDIA_NIM_API_KEY || process.env.NVIDIA_API_TOKEN;
      if (apiKey) {
        const sentiment = await callOpenAICompatibleEndpoint({
          endpoint: process.env.NVIDIA_API_URL || 'https://integrate.api.nvidia.com/v1/chat/completions',
          apiKey,
          model: process.env.NVIDIA_MODEL || 'meta/llama-3.1-70b-instruct',
          prompt,
        });
        return normalizeReviewSentiment(sentiment);
      }
    }

    if (provider === 'openai' && process.env.OPENAI_API_KEY) {
      const sentiment = await callOpenAICompatibleEndpoint({
        endpoint: process.env.OPENAI_API_URL || 'https://api.openai.com/v1/chat/completions',
        apiKey: process.env.OPENAI_API_KEY,
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        prompt,
      });
      return normalizeReviewSentiment(sentiment);
    }
  } catch (error) {
    console.error('LLM failure during review sentiment analysis. Falling back to heuristic sentiment:', error.message);
  }

  return fallbackReviewSentiment({ reviewText, rating });
}

function buildAlternativeSuggestionsPrompt({ requestedTitle, requestedAuthor, requestedGenre, availableBooks = [] }) {
  const bookList = (availableBooks || [])
    .map((book) => `"${book.title}" by ${book.author || 'Unknown'} (Genre: ${book.genre || 'General'})`)
    .slice(0, 50)
    .join('\n');

  return [
    'You are a helpful library assistant. A user requested a book that is not currently available online.',
    'Suggest 3-5 similar books from the library collection that match the requested book\'s style, genre, or theme.',
    'Return ONLY a numbered list with the exact titles and authors from the provided collection below.',
    'If no similar books are found in the collection, return: "No similar titles available."',
    '',
    `Requested Book: "${requestedTitle}" by ${requestedAuthor || 'Unknown'} (Genre: ${requestedGenre || 'General'})`,
    '',
    'Available Books in Library:',
    bookList || 'No books in library collection.',
  ].join('\n');
}

async function suggestAlternativesUsingLLM({ requestedTitle, requestedAuthor, requestedGenre, availableBooks = [] } = {}) {
  if (!Array.isArray(availableBooks) || availableBooks.length === 0) {
    return [];
  }

  const prompt = buildAlternativeSuggestionsPrompt({
    requestedTitle,
    requestedAuthor,
    requestedGenre,
    availableBooks,
  });
  const provider = getProviderConfig();

  try {
    if (provider === 'nvidia') {
      const apiKey = process.env.NVIDIA_API_KEY || process.env.NVIDIA_NIM_API_KEY || process.env.NVIDIA_API_TOKEN;
      if (apiKey) {
        const response = await callOpenAICompatibleEndpoint({
          endpoint: process.env.NVIDIA_API_URL || 'https://integrate.api.nvidia.com/v1/chat/completions',
          apiKey,
          model: process.env.NVIDIA_MODEL || 'meta/llama-3.1-70b-instruct',
          prompt,
        });
        
        // Parse the response to extract book titles
        const suggestions = [];
        const lines = String(response || '').split('\n');
        for (const line of lines) {
          const match = line.match(/^\d+\.\s*"?([^"]+)"?\s*by\s*(.+)$/);
          if (match) {
            suggestions.push({
              title: match[1].trim(),
              author: match[2].trim().replace(/\(.*?\)/g, '').trim(),
            });
          }
        }
        return suggestions;
      }
    }

    if (provider === 'openai' && process.env.OPENAI_API_KEY) {
      const response = await callOpenAICompatibleEndpoint({
        endpoint: process.env.OPENAI_API_URL || 'https://api.openai.com/v1/chat/completions',
        apiKey: process.env.OPENAI_API_KEY,
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        prompt,
      });

      // Parse the response to extract book titles
      const suggestions = [];
      const lines = String(response || '').split('\n');
      for (const line of lines) {
        const match = line.match(/^\d+\.\s*"?([^"]+)"?\s*by\s*(.+)$/);
        if (match) {
          suggestions.push({
            title: match[1].trim(),
            author: match[2].trim().replace(/\(.*?\)/g, '').trim(),
          });
        }
      }
      return suggestions;
    }
  } catch (error) {
    console.error('LLM failure during alternative suggestions. Returning empty list:', error.message);
    return [];
  }

  return [];
}

module.exports = {
  buildFallbackSummary,
  extractTextFromPdfBuffer,
  generateBookSummary,
  generateBookSummaryFromPdf,
  generateReviewSentiment,
  suggestAlternativesUsingLLM,
};