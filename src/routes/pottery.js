const express = require("express");
const router = express.Router();
const db = require("../database");
const { requireCustomer, requireStudio } = require("../auth");

// Validate YYYY-MM-DD dates without accepting impossible dates
function parseDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  date.setHours(0, 0, 0, 0);
  return date;
}

function calendarDayDifference(from, to) {
  const utcFrom = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const utcTo = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());

  return Math.round((utcTo - utcFrom) / 86400000);
}

// Get available pottery items and glazes
router.get("/options", requireCustomer, (req, res) => {
  try {
    const items = db.prepare(
      "SELECT id, name FROM pottery_items ORDER BY name"
    ).all();

    const glazes = db.prepare(
      "SELECT id, name FROM glazes ORDER BY name"
    ).all();

    res.json({ items, glazes });
  } catch (error) {
    console.error("Load pottery options error:", error);
    res.status(500).json({ error: "Could not load pottery options." });
  }
});

// View only the logged-in customer's requests
router.get("/mine", requireCustomer, (req, res) => {
  try {
    const requests = db.prepare(`
      SELECT pr.id, pr.item_id, pr.glaze_id, pr.quantity,
             pr.needed_by, pr.status, pr.created_at,
             pi.name AS item_name, g.name AS glaze_name
      FROM pottery_requests pr
      JOIN pottery_items pi ON pi.id = pr.item_id
      JOIN glazes g ON g.id = pr.glaze_id
      WHERE pr.customer_id = ?
      ORDER BY pr.needed_by ASC
    `).all(req.session.user.id);

    res.json({ requests });
  } catch (error) {
    console.error("Load pottery requests error:", error);
    res.status(500).json({ error: "Could not load pottery requests." });
  }
});

/* STUDIO: View all pottery requests */
router.get("/all", requireStudio, (req, res) => {
  try {
    const requests = db.prepare(`
      SELECT pr.id, pr.item_id, pr.glaze_id, pr.quantity,
             pr.needed_by, pr.status, pr.created_at,
             pi.name AS item_name,
             g.name AS glaze_name,
             u.email AS customer_email
      FROM pottery_requests pr
      JOIN pottery_items pi ON pi.id = pr.item_id
      JOIN glazes g ON g.id = pr.glaze_id
      JOIN users u ON u.id = pr.customer_id
      ORDER BY pr.created_at DESC
    `).all();

    res.json({ requests });
  } catch (error) {
    console.error("Load studio pottery requests error:", error);
    res.status(500).json({ error: "Could not load pottery requests." });
  }
});

/* STUDIO: Accept or decline a pottery request */
router.patch("/:id/status", requireStudio, (req, res) => {
  const { status } = req.body;

  if (!["accepted", "declined"].includes(status)) {
    return res.status(400).json({
      error: "Status must be accepted or declined."
    });
  }

  try {
    const result = db.prepare(`
      UPDATE pottery_requests
      SET status = ?
      WHERE id = ? AND status = 'requested'
    `).run(status, req.params.id);

    if (result.changes === 0) {
      return res.status(404).json({
        error: "Pending pottery request not found."
      });
    }

    res.json({ message: `Pottery request ${status}.` });
  } catch (error) {
    console.error("Update studio pottery request error:", error);
    res.status(500).json({ error: "Could not update pottery request." });
  }
});


// Create a pottery request
router.post("/", requireCustomer, (req, res) => {
  const { item_id, glaze_id, needed_by } = req.body;
  const quantity = Number(req.body.quantity);

  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 12) {
    return res.status(400).json({
      error: "Quantity must be between 1 and 12."
    });
  }

  const date = parseDate(needed_by);
  if (!date) {
    return res.status(400).json({ error: "Enter a valid required-by date." });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (calendarDayDifference(today, date) < 14) {
    return res.status(400).json({
      error: "Choose a required-by date at least 14 days from today."
    });
  }

  try {
    const item = db.prepare(
      "SELECT id FROM pottery_items WHERE id = ?"
    ).get(item_id);

    const glaze = db.prepare(
      "SELECT id FROM glazes WHERE id = ?"
    ).get(glaze_id);

    if (!item || !glaze) {
      return res.status(400).json({
        error: "Select a valid pottery item and glaze."
      });
    }

    const result = db.prepare(`
      INSERT INTO pottery_requests
        (customer_id, item_id, glaze_id, quantity, needed_by)
      VALUES (?, ?, ?, ?, ?)
    `).run(req.session.user.id, item_id, glaze_id, quantity, needed_by);

    res.status(201).json({
      message: "Pottery request submitted successfully.",
      id: Number(result.lastInsertRowid)
    });
  } catch (error) {
    console.error("Create pottery request error:", error);
    res.status(500).json({ error: "Could not submit pottery request." });
  }
});

// Edit a request only while its status is requested
router.patch("/:id", requireCustomer, (req, res) => {
  const { item_id, glaze_id, needed_by } = req.body;
  const quantity = Number(req.body.quantity);

  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 12) {
    return res.status(400).json({
      error: "Quantity must be between 1 and 12."
    });
  }

  const date = parseDate(needed_by);
  if (!date) {
    return res.status(400).json({ error: "Enter a valid required-by date." });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (calendarDayDifference(today, date) < 14) {
    return res.status(400).json({
      error: "Choose a required-by date at least 14 days from today."
    });
  }

  try {
    const result = db.prepare(`
      UPDATE pottery_requests
      SET item_id = ?, glaze_id = ?, quantity = ?, needed_by = ?
      WHERE id = ? AND customer_id = ? AND status = 'requested'
        AND EXISTS (SELECT 1 FROM pottery_items WHERE id = ?)
        AND EXISTS (SELECT 1 FROM glazes WHERE id = ?)
    `).run(
      item_id, glaze_id, quantity, needed_by,
      req.params.id, req.session.user.id, item_id, glaze_id
    );

    if (result.changes === 0) {
      const request = db.prepare(`
        SELECT id, status FROM pottery_requests
        WHERE id = ? AND customer_id = ?
      `).get(req.params.id, req.session.user.id);

      if (!request) {
        return res.status(404).json({ error: "Pottery request not found." });
      }

      if (request.status !== "requested") {
        return res.status(409).json({
          error: "Only requested pottery orders can be edited."
        });
      }

      return res.status(400).json({
        error: "Select a valid pottery item and glaze."
      });
    }

    res.json({ message: "Pottery request updated successfully." });
  } catch (error) {
    console.error("Edit pottery request error:", error);
    res.status(500).json({ error: "Could not update pottery request." });
  }
});

// Cancel a request only while its status is requested
router.delete("/:id", requireCustomer, (req, res) => {
  try {
    const result = db.prepare(`
      UPDATE pottery_requests
      SET status = 'cancelled'
      WHERE id = ? AND customer_id = ? AND status = 'requested'
    `).run(req.params.id, req.session.user.id);

    if (result.changes === 0) {
      const request = db.prepare(`
        SELECT id, status FROM pottery_requests
        WHERE id = ? AND customer_id = ?
      `).get(req.params.id, req.session.user.id);

      if (!request) {
        return res.status(404).json({ error: "Pottery request not found." });
      }

      return res.status(409).json({
        error: "Only requested pottery orders can be cancelled."
      });
    }

    res.json({ message: "Pottery request cancelled successfully." });
  } catch (error) {
    console.error("Cancel pottery request error:", error);
    res.status(500).json({ error: "Could not cancel pottery request." });
  }
});

module.exports = router;