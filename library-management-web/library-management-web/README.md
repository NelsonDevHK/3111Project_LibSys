# Library Management Web

This project is a simple React-based web application for managing library resources (books, users, borrowing, etc.).

## Getting Started

### Prerequisites
- Node.js (v14 or above recommended)
- npm (comes with Node.js) or yarn

### Installation
1. Clone the repository or unzip the project folder.
2. Open a terminal in the project root directory.
3. Install dependencies:
   
   ```sh
   npm install
   # or
   yarn install
   ```

### Running the App (Development)
Start the development server with hot-reloading:

```sh
npm start
# or
yarn start
```

- The app will open in your browser at http://localhost:3000
- Any code changes will reload the app automatically.

### Notes
- All data is stored in-memory (JavaScript arrays). Data will reset on refresh or browser close.
- No backend or persistent storage is used at this stage.

### Project Structure
- `src/` - Source code (components, pages, styles)
- `public/` - Static files and HTML template
