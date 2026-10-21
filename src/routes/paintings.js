
const express = require("express");
const router = express.Router();
const db = require("../database");

// Get all paintings for the gallery
router.get("/", (req, res) => {
  try {
    const paintings = db.prepare(`
      SELECT id, title, artist, description, price, image_url, status
      FROM paintings
      ORDER BY id
    `).all();

    res.json({ paintings });
  } catch (error) {
    console.error("Error fetching paintings:", error);
    res.status(500).json({ error: "Could not load paintings." });
  }
});

module.exports = router;
