#!/usr/bin/env node

/**
 * ========== TESTING/DEVELOPMENT SCRIPT ==========
 * Script to generate dummy PDF books for testing Task 1.5 (Borrowed Book Screen)
 * 
 * Usage: node generate-dummy-books.js
 * This will create 8 sample PDFs and update books.json
 * 
 * Run this ONLY during development/testing!
 * ===============================================
 */

const fs = require('fs');
const path = require('path');
const { PDFDocument, rgb, degrees } = require('pdf-lib');
const sharp = require('sharp');

const BOOKS_JSON_PATH = path.join(__dirname, 'books.json');
const ASSETS_DIR = path.join(__dirname, 'bookAssets');

// Dummy book data for testing
const DUMMY_BOOKS = [
  {
    title: 'The Web Developer\'s Handbook',
    authorUsername: 'webmaster',
    authorFullName: 'Sarah Johnson',
    genre: 'Technology',
    description: 'A comprehensive guide to modern web development techniques and best practices.',
  },
  {
    title: 'Introduction to Data Science',
    authorUsername: 'datascientist',
    authorFullName: 'Dr. Chen Liu',
    genre: 'Science',
    description: 'Learn the fundamentals of data analysis, visualization, and machine learning.',
  },
  {
    title: 'Cloud Architecture Essentials',
    authorUsername: 'cloudarch',
    authorFullName: 'Michael O\'Brien',
    genre: 'Technology',
    description: 'Master the principles of designing scalable cloud-based systems.',
  },
  {
    title: 'JavaScript Mastery',
    authorUsername: 'jsdev',
    authorFullName: 'Emma Davis',
    genre: 'Programming',
    description: 'Deep dive into JavaScript: async programming, closures, and modern patterns.',
  },
  {
    title: 'History of the Internet',
    authorUsername: 'historian',
    authorFullName: 'Professor Alex Smith',
    genre: 'History',
    description: 'Trace the evolution of the internet from its inception to the modern web.',
  },
  {
    title: 'Database Design Principles',
    authorUsername: 'dbexpert',
    authorFullName: 'Dr. Robert Kumar',
    genre: 'Technology',
    description: 'Learn modern database design, normalization, and optimization techniques.',
  },
  {
    title: 'Cybersecurity Fundamentals',
    authorUsername: 'secexpert',
    authorFullName: 'Lisa Anderson',
    genre: 'Security',
    description: 'Essential concepts for protecting systems and data from cyber threats.',
  },
  {
    title: 'Mobile App Development Guide',
    authorUsername: 'mobiledev',
    authorFullName: 'James Wilson',
    genre: 'Programming',
    description: 'Build cross-platform mobile applications using modern frameworks.',
  },
];

/**
 * Create a simple PDF with sample content
 */
async function createSamplePDF(title, author) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]); // Letter size
  const { width, height } = page.getSize();

  // Title
  page.drawText(title, {
    x: 50,
    y: height - 100,
    size: 24,
    color: rgb(0, 0, 0),
    maxWidth: width - 100,
  });

  // Author
  page.drawText(`By ${author}`, {
    x: 50,
    y: height - 150,
    size: 14,
    color: rgb(0.5, 0.5, 0.5),
  });

  // Sample content
  const sampleText = `
${title}

Chapter 1: Introduction

Lorem ipsum dolor sit amet, consectetur adipiscing elit. This is a sample chapter for testing purposes. 
The PDF reader should be able to display this content, allow bookmarks, and highlight text.

Sample paragraph 1:
The quick brown fox jumps over the lazy dog. This pangram contains every letter of the English alphabet. 
Perfect for testing text highlighting and selection features in the PDF viewer.

Sample paragraph 2:
Development and testing are crucial phases in software engineering. This dummy book has been generated 
for Task 1.5 (Borrowed Book Screen) testing to ensure all features work correctly.

Features to test:
- PDF viewing and rendering
- Text selection and highlighting
- Bookmark functionality for saving reading progress
- Page navigation
- Auto-return on expiration
- Self-return functionality

This document contains multiple pages to allow comprehensive testing of all PDF features.
`;

  page.drawText(sampleText, {
    x: 50,
    y: height - 200,
    size: 11,
    color: rgb(0, 0, 0),
    maxWidth: width - 100,
    lineHeight: 16,
  });

  // Footer
  page.drawText('Page 1 - Testing Document', {
    x: 50,
    y: 30,
    size: 10,
    color: rgb(0.7, 0.7, 0.7),
  });

  // Add a second page
  const page2 = pdfDoc.addPage([612, 792]);
  page2.drawText('Page 2: Additional Content', {
    x: 50,
    y: height - 100,
    size: 18,
    color: rgb(0, 0, 0),
  });

  page2.drawText(
    `More sample content for testing. This page demonstrates multi-page PDF support.\n\n` +
      `You should be able to navigate between pages, bookmark your progress, and highlight text across pages.\n\n` +
      `This is essential for testing the bookmark functionality and ensuring the reading progress is saved correctly.`,
    {
      x: 50,
      y: height - 200,
      size: 12,
      color: rgb(0, 0, 0),
      maxWidth: width - 100,
      lineHeight: 18,
    }
  );

  page2.drawText('Page 2 - Testing Document', {
    x: 50,
    y: 30,
    size: 10,
    color: rgb(0.7, 0.7, 0.7),
  });

  return pdfDoc;
}

/**
 * Create a simple cover image using sharp
 */
async function createCoverImage(title, color = '#3498db') {
  const width = 400;
  const height = 600;

  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${width}" height="${height}" fill="${color}"/>
      <rect x="20" y="20" width="${width - 40}" height="${height - 40}" fill="none" stroke="white" stroke-width="3"/>
      <text x="${width / 2}" y="${height / 2 - 50}" font-size="32" font-weight="bold" fill="white" text-anchor="middle" font-family="Arial">
        ${title.substring(0, 20)}
      </text>
      <text x="${width / 2}" y="${height / 2 + 30}" font-size="16" fill="white" text-anchor="middle" font-family="Arial">
        Testing Book
      </text>
      <text x="${width / 2}" y="${height - 50}" font-size="14" fill="rgba(255,255,255,0.7)" text-anchor="middle" font-family="Arial">
        Created for Task 1.5
      </text>
    </svg>
  `;

  return Buffer.from(svg);
}

/**
 * Main function to generate all dummy books
 */
async function generateDummyBooks() {
  console.log('\n========== TESTING: Generating Dummy Books ==========\n');

  // Ensure bookAssets directory exists
  if (!fs.existsSync(ASSETS_DIR)) {
    fs.mkdirSync(ASSETS_DIR, { recursive: true });
    console.log(`✓ Created bookAssets directory\n`);
  }

  // Read existing books.json
  let booksData = { books: [] };
  if (fs.existsSync(BOOKS_JSON_PATH)) {
    const content = fs.readFileSync(BOOKS_JSON_PATH, 'utf8');
    booksData = JSON.parse(content);
    console.log(`✓ Loaded existing books.json (${booksData.books.length} books)\n`);
  }

  const colors = ['#3498db', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c', '#34495e', '#e67e22'];
  const publishDate = new Date().toISOString().split('T')[0];

  console.log('Generating PDFs and cover images:\n');

  for (let i = 0; i < DUMMY_BOOKS.length; i++) {
    const book = DUMMY_BOOKS[i];
    const timestamp = Date.now() + i; // Slight offset to avoid ID collisions
    const pdfFileName = `${timestamp}.pdf`;
    const coverFileName = `${timestamp}.png`;
    const pdfPath = path.join(ASSETS_DIR, pdfFileName);
    const coverPath = path.join(ASSETS_DIR, coverFileName);

    try {
      // Create PDF
      const pdfDoc = await createSamplePDF(book.title, book.authorFullName);
      const pdfBytes = await pdfDoc.save();
      fs.writeFileSync(pdfPath, pdfBytes);
      console.log(`  ✓ Created PDF: ${pdfFileName}`);

      // Create cover image
      const svgBuffer = await createCoverImage(book.title, colors[i]);
      await sharp(svgBuffer).png().toFile(coverPath);
      console.log(`  ✓ Created cover: ${coverFileName}`);

      // Add book entry
      const bookEntry = {
        id: timestamp,
        title: book.title,
        authorUsername: book.authorUsername,
        authorFullName: book.authorFullName,
        genre: book.genre,
        description: book.description,
        filePath: `bookAssets/${pdfFileName}`,
        coverPath: `bookAssets/${coverFileName}`,
        publishDate: publishDate,
        approved: true,
        status: 'available',
      };

      booksData.books.push(bookEntry);
      console.log(`  ✓ Added book entry: "${book.title}"\n`);
    } catch (error) {
      console.error(`  ✗ Error processing book "${book.title}":`, error.message);
    }
  }

  // Write updated books.json
  fs.writeFileSync(BOOKS_JSON_PATH, JSON.stringify(booksData, null, 2));
  console.log(`\n========== SUCCESS ==========`);
  console.log(`✓ Updated books.json with ${DUMMY_BOOKS.length} new test books`);
  console.log(`✓ Total books in library: ${booksData.books.length}`);
  console.log(`✓ All PDFs stored in: server/bookAssets/`);
  console.log(`✓ Ready for Task 1.5 testing!\n`);
}

// Run the script
generateDummyBooks().catch((error) => {
  console.error('\n========== ERROR ==========');
  console.error('Failed to generate dummy books:', error.message);
  console.error(error);
  process.exit(1);
});
