
const express = require("express");
const router = express.Router();
const db = require("../database");
const { requireCustomer, requireStudio } = require("../auth");


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
  const utcFrom = Date.UTC(
    from.getFullYear(), from.getMonth(), from.getDate()
  );
  const utcTo = Date.UTC(
    to.getFullYear(), to.getMonth(), to.getDate()
  );

  return Math.round((utcTo - utcFrom) / 86400000);
}

// Customer: view only their own bookings
router.get("/mine", requireCustomer, (req, res) => {
  try {
    const bookings = db.prepare(`
      SELECT id, booking_date, wall_size, address,
             total_price, status, created_at
      FROM mural_bookings
      WHERE customer_id = ?
      ORDER BY booking_date
    `).all(req.session.user.id);

    res.json({ bookings });
  } catch (error) {
    console.error("Load bookings error:", error);
    res.status(500).json({ error: "Could not load bookings." });
  }
});

// Studio: view all bookings
router.get("/all", requireStudio, (req, res) => {
  try {
    const bookings = db.prepare(`
      SELECT b.id, b.customer_id, u.email AS customer_email,
             b.booking_date, b.wall_size, b.address,
             b.total_price, b.status, b.created_at
      FROM mural_bookings b
      JOIN users u ON u.id = b.customer_id
      ORDER BY b.booking_date
    `).all();

    res.json({ bookings });
  } catch (error) {
    console.error("Load studio bookings error:", error);
    res.status(500).json({ error: "Could not load bookings." });
  }
});

// Customer: create a wall painting booking
router.post("/", requireCustomer, (req, res) => {
  const bookingDate = parseDate(req.body.booking_date);
  const wallSize = Number(req.body.wall_size);
  const address = typeof req.body.address === "string"
    ? req.body.address.trim()
    : "";

  if (!bookingDate) {
    return res.status(400).json({
      error: "Enter a valid booking date."
    });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const daysAhead = calendarDayDifference(today, bookingDate);

  if (daysAhead < 7 || daysAhead > 90) {
    return res.status(400).json({
      error: "Choose a date 7 to 90 days from today."
    });
  }

  if (!Number.isFinite(wallSize) || wallSize < 10 || wallSize > 500) {
    return res.status(400).json({
      error: "Wall size must be between 10 and 500 sq. ft."
    });
  }

  if (!address || address.length > 500) {
    return res.status(400).json({
      error: "Enter an address of up to 500 characters."
    });
  }

  try {
    const settings = db.prepare(`
      SELECT rate_per_sq_ft
      FROM mural_settings
      WHERE id = 1
    `).get();

    if (!settings) {
      return res.status(500).json({
        error: "Wall painting pricing is not configured."
      });
    }

    const totalPrice = wallSize * settings.rate_per_sq_ft;

    const result = db.prepare(`
      INSERT INTO mural_bookings
        (customer_id, booking_date, wall_size, address, total_price, status)
      VALUES (?, ?, ?, ?, ?, 'requested')
    `).run(
      req.session.user.id,
      req.body.booking_date,
      wallSize,
      address,
      totalPrice
    );

    res.status(201).json({
      message: "Booking request submitted successfully.",
      booking: {
        id: Number(result.lastInsertRowid),
        booking_date: req.body.booking_date,
        wall_size: wallSize,
        address,
        total_price: totalPrice,
        status: "requested"
      }
    });
  } catch (error) {
    if (
      error.code === "SQLITE_CONSTRAINT_UNIQUE" ||
      error.message.includes("one_active_mural_per_date")
    ) {
      return res.status(409).json({
        error: "That date already has an active booking. Please choose another date."
      });
    }

    console.error("Create booking error:", error);
    res.status(500).json({ error: "Could not create booking." });
  }
});

// Studio: confirm or decline a requested booking
router.patch("/:bookingId/status", requireStudio, (req, res) => {
  const { status } = req.body;

  if (!["confirmed", "declined"].includes(status)) {
    return res.status(400).json({
      error: "Status must be confirmed or declined."
    });
  }

  try {
    const result = db.prepare(`
      UPDATE mural_bookings
      SET status = ?
      WHERE id = ? AND status = 'requested'
    `).run(status, req.params.bookingId);

    if (result.changes === 0) {
      const booking = db.prepare(`
        SELECT id, status
        FROM mural_bookings
        WHERE id = ?
      `).get(req.params.bookingId);

      if (!booking) {
        return res.status(404).json({ error: "Booking not found." });
      }

      return res.status(409).json({
        error: "Only requested bookings can be confirmed or declined."
      });
    }

    res.json({ message: `Booking ${status}.`, status });
  } catch (error) {
    if (
      error.code === "SQLITE_CONSTRAINT_UNIQUE" ||
      error.message.includes("one_active_mural_per_date")
    ) {
      return res.status(409).json({
        error: "That date is no longer available."
      });
    }

    console.error("Update booking error:", error);
    res.status(500).json({ error: "Could not update booking." });
  }
});

// Customer: cancel their own booking at least 3 days before its date
router.delete("/:bookingId", requireCustomer, (req, res) => {
  try {
    const booking = db.prepare(`
      SELECT id, customer_id, booking_date, status
      FROM mural_bookings
      WHERE id = ? AND customer_id = ?
    `).get(req.params.bookingId, req.session.user.id);

    if (!booking) {
      return res.status(404).json({ error: "Booking not found." });
    }

    if (!["requested", "confirmed"].includes(booking.status)) {
      return res.status(409).json({
        error: "This booking cannot be cancelled."
      });
    }

    const date = parseDate(booking.booking_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const daysRemaining = calendarDayDifference(today, date);

    if (daysRemaining < 3) {
      return res.status(400).json({
        error: "Bookings can only be cancelled at least 3 days in advance."
      });
    }

    db.prepare(`
      UPDATE mural_bookings
      SET status = 'cancelled'
      WHERE id = ? AND customer_id = ?
    `).run(booking.id, req.session.user.id);

    res.json({ message: "Booking cancelled successfully." });
  } catch (error) {
    console.error("Cancel booking error:", error);
    res.status(500).json({ error: "Could not cancel booking." });
  }
});

/* STUDIO: VIEW ALL WALL PAINTING BOOKINGS */



/* STUDIO: CONFIRM OR DECLINE A BOOKING */


module.exports = router;
