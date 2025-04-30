const Database = require("better-sqlite3");

// Initialize the database (creates `database.sqlite` if it doesn't exist)
const db = new Database("database.sqlite", { verbose: console.log });

// Create `users` table if it doesn't exist
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL
  )
`);

// Add this to your existing database initialization

db.exec(`
    CREATE TABLE IF NOT EXISTS saved_itineraries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      city TEXT NOT NULL,
      arrival_date TEXT NOT NULL,
      departure_date TEXT NOT NULL,
      preferences TEXT,
      itinerary_items TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

module.exports = db;
