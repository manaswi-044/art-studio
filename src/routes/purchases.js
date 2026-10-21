
const express = require("express");
const router = express.Router();
const db = require("../database");
const { requireCustomer } = require("../auth");

// View the logged-in customer's purchases
router.get("/mine", requireCustomer, (req, res) => {
  try {
    const purchases = db.prepare(`
      SELECT
        pu.id AS purchase_id,
        pu.painting_id,
        pu.purchased_at,
        p.title,
        p.artist,
        p.price,
        p.image_url
      FROM purchases pu
      JOIN paintings p ON p.id = pu.painting_id
      WHERE pu.customer_id = ?
      ORDER BY pu.purchased_at DESC
    `).all(req.session.user.id);

    res.json({ purchases });
  } catch (error) {
    console.error("Fetch purchases error:", error);
    res.status(500).json({ error: "Could not load purchases." });
  }
});

// Purchase a painting
router.post("/:paintingId", requireCustomer, (req, res) => {
  try {
    const purchase = db.transaction(() => {
      const painting = db.prepare(`
        SELECT id, status
        FROM paintings
        WHERE id = ?
      `).get(req.params.paintingId);

      if (!painting) {
        return { error: "Painting not found.", status: 404 };
      }

      if (painting.status !== "available") {
        return {
          error: "Sorry, this painting has already been sold.",
          status: 409
        };
      }

      // Only one request can successfully change available to sold.
      const result = db.prepare(`
        UPDATE paintings
        SET status = 'sold'
        WHERE id = ? AND status = 'available'
      `).run(painting.id);

      if (result.changes !== 1) {
        return {
          error: "This painting is no longer available.",
          status: 409
        };
      }

      const inserted = db.prepare(`
        INSERT INTO purchases (painting_id, customer_id)
        VALUES (?, ?)
      `).run(painting.id, req.session.user.id);

      return {
        purchaseId: Number(inserted.lastInsertRowid)
      };
    })();

    if (purchase.error) {
      return res.status(purchase.status).json({
        error: purchase.error
      });
    }

    res.status(201).json({
      message: "Painting purchased successfully!",
      purchaseId: purchase.purchaseId
    });
  } catch (error) {
    console.error("Purchase error:", error);
    res.status(500).json({
      error: "Could not complete the purchase."
    });
  }
});

// Cancel one of the logged-in customer's purchases
router.delete("/:purchaseId", requireCustomer, (req, res) => {
  try {
    const result = db.transaction(() => {
      const purchase = db.prepare(`
        SELECT id, painting_id
        FROM purchases
        WHERE id = ? AND customer_id = ?
      `).get(req.params.purchaseId, req.session.user.id);

      if (!purchase) {
        return {
          error: "Purchase not found.",
          status: 404
        };
      }

      db.prepare(`
        DELETE FROM purchases
        WHERE id = ? AND customer_id = ?
      `).run(purchase.id, req.session.user.id);

      db.prepare(`
        UPDATE paintings
        SET status = 'available'
        WHERE id = ?
      `).run(purchase.painting_id);

      return { success: true };
    })();

    if (result.error) {
      return res.status(result.status).json({
        error: result.error
      });
    }

    res.json({
      message: "Purchase cancelled. The painting is available again."
    });
  } catch (error) {
    console.error("Cancellation error:", error);
    res.status(500).json({
      error: "Could not cancel the purchase."
    });
  }
});

module.exports = router;
