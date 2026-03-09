// src/models/Author.js
// Author class extends User, includes bio
import User from './User';

class Author extends User {
  constructor(username, fullName, password, bio) {
    super(username, fullName, password, 'author');
    this.bio = bio;
  }
}

export default Author;
