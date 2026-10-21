
const Database = require("better-sqlite3");
const bcrypt = require("bcrypt");
const fs = require("fs");
const path = require("path");

// Database and seed file locations
const dataFolder = path.join(__dirname, "../data");
const databasePath = path.join(dataFolder, "art-studio.db");
const seedPath = path.join(dataFolder, "seed.json");

// Make sure the seed file exists
if (!fs.existsSync(seedPath)) {
  throw new Error(
    "seed.json was not found in the data folder. Please add it first."
  );
}

// Read the provided seed data
const seed = JSON.parse(fs.readFileSync(seedPath, "utf8"));

// Connect to SQLite
const db = new Database(databasePath);

db.pragma("foreign_keys = ON");

// Create database tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('customer', 'studio')),
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS paintings (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    artist TEXT NOT NULL,
    description TEXT NOT NULL,
    price INTEGER NOT NULL CHECK(price >= 0),
    image_url TEXT,
    status TEXT NOT NULL CHECK(status IN ('available', 'sold'))
  );

  CREATE TABLE IF NOT EXISTS purchases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    painting_id TEXT NOT NULL UNIQUE REFERENCES paintings(id),
    customer_id INTEGER NOT NULL REFERENCES users(id),
    purchased_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS pottery_items (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS glazes (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS mural_settings (
    id INTEGER PRIMARY KEY CHECK(id = 1),
    rate_per_sq_ft INTEGER NOT NULL CHECK(rate_per_sq_ft > 0)
  );

  CREATE TABLE IF NOT EXISTS mural_bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL REFERENCES users(id),
    booking_date TEXT NOT NULL,
    wall_size INTEGER NOT NULL CHECK(wall_size BETWEEN 10 AND 500),
    address TEXT NOT NULL,
    total_price INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'requested'
      CHECK(status IN ('requested', 'confirmed', 'declined', 'cancelled')),
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE UNIQUE INDEX IF NOT EXISTS one_active_mural_per_date
  ON mural_bookings(booking_date)
  WHERE status IN ('requested', 'confirmed');

  CREATE TABLE IF NOT EXISTS pottery_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL REFERENCES users(id),
    item_id TEXT NOT NULL REFERENCES pottery_items(id),
    glaze_id TEXT NOT NULL REFERENCES glazes(id),
    quantity INTEGER NOT NULL CHECK(quantity BETWEEN 1 AND 12),
    needed_by TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'requested'
      CHECK(status IN ('requested', 'accepted', 'declined', 'cancelled')),
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
`);

// Insert the provided seed data only when records don't exist yet
const insertSeedData = db.transaction(() => {
  const insertPainting = db.prepare(`
    INSERT OR IGNORE INTO paintings
    (id, title, artist, description, price, image_url, status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  for (const painting of seed.paintings) {
    insertPainting.run(
      painting.id,
      painting.title,
      painting.artist,
      painting.description,
      painting.price,
      painting.imageUrl || null,
      painting.status
    );
  }

  const insertItem = db.prepare(`
    INSERT OR IGNORE INTO pottery_items (id, name)
    VALUES (?, ?)
  `);

  for (const item of seed.potteryItems) {
    insertItem.run(item.id, item.name);
  }

  const insertGlaze = db.prepare(`
    INSERT OR IGNORE INTO glazes (id, name)
    VALUES (?, ?)
  `);

  for (const glaze of seed.glazes) {
    insertGlaze.run(glaze.id, glaze.name);
  }

  db.prepare(`
    INSERT OR IGNORE INTO mural_settings (id, rate_per_sq_ft)
    VALUES (1, ?)
  `).run(seed.mural.ratePerSqFt);

  // Store the studio password as a hash, not plain text.
  const passwordHash = bcrypt.hashSync(seed.studioAccount.password, 10);

  db.prepare(`
    INSERT OR IGNORE INTO users (email, password_hash, role)
    VALUES (?, ?, 'studio')
  `).run(seed.studioAccount.email, passwordHash);
});

insertSeedData();

console.log("Database initialized successfully!");

module.exports = db;
