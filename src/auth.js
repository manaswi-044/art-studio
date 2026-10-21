
const bcrypt = require("bcrypt");
const db = require("./database");

function requireLogin(req, res, next) {
  if (!req.session?.user) {
    return res.status(401).json({ error: "Please log in first." });
  }
  next();
}

function requireStudio(req, res, next) {
  if (!req.session?.user) {
    return res.status(401).json({ error: "Please log in first." });
  }
  if (req.session.user.role !== "studio") {
    return res.status(403).json({ error: "Studio access only." });
  }
  next();
}

function requireCustomer(req, res, next) {
  if (!req.session?.user) {
    return res.status(401).json({ error: "Please log in first." });
  }
  if (req.session.user.role !== "customer") {
    return res.status(403).json({ error: "Customer access only." });
  }
  next();
}

async function register(req, res) {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    if (!email || !password) {
      return res.status(400).json({
        error: "Email and password are required."
      });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: "Enter a valid email." });
    }

    if (password.length < 8) {
      return res.status(400).json({
        error: "Password must be at least 8 characters."
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = db.prepare(`
      INSERT INTO users (email, password_hash, role)
      VALUES (?, ?, 'customer')
    `).run(email, passwordHash);

    res.status(201).json({
      message: "Account created successfully.",
      user: {
        id: result.lastInsertRowid,
        email,
        role: "customer"
      }
    });
  } catch (error) {
    if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
      return res.status(409).json({
        error: "An account with this email already exists."
      });
    }

    console.error("Registration error:", error);
    res.status(500).json({ error: "Could not create account." });
  }
}

async function login(req, res) {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    if (!email || !password) {
      return res.status(400).json({
        error: "Email and password are required."
      });
    }

    const user = db.prepare(`
      SELECT id, email, password_hash, role
      FROM users
      WHERE email = ?
    `).get(email);

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({
        error: "Invalid email or password."
      });
    }

    req.session.regenerate((error) => {
      if (error) {
        console.error(error);
        return res.status(500).json({ error: "Could not create session." });
      }

      req.session.user = {
        id: user.id,
        email: user.email,
        role: user.role
      };

      res.json({
        message: "Login successful.",
        user: req.session.user
      });
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Login failed." });
  }
}

function logout(req, res) {
  if (!req.session) {
    return res.json({ message: "Logged out." });
  }

  req.session.destroy((error) => {
    if (error) {
      return res.status(500).json({ error: "Could not log out." });
    }
    res.clearCookie("connect.sid");
    res.json({ message: "Logged out successfully." });
  });
}

function getCurrentUser(req, res) {
  res.json({ user: req.session?.user || null });
}

module.exports = {
  requireLogin,
  requireStudio,
  requireCustomer,
  register,
  login,
  logout,
  getCurrentUser
};
