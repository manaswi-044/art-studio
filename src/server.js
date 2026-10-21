
const express = require("express");
const path = require("path");
const session = require("express-session");
require("dotenv").config();

const {
  login,
  logout,
  getCurrentUser
} = require("./auth");

const paintingsRouter = require("./routes/paintings");
const purchasesRouter = require("./routes/purchases");
const bookingsRouter = require("./routes/bookings");
const potteryRouter = require("./routes/pottery");
const app = express();
const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === "production";
const sessionSecret = process.env.SESSION_SECRET ||
  (isProduction ? null : "local-development-secret-change-me");

if (!sessionSecret) {
  throw new Error("SESSION_SECRET must be set when NODE_ENV=production.");
}

if (isProduction) {
  app.set("trust proxy", 1);
}

app.use(express.json());

app.use(session({
  name: "connect.sid",
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction,
    maxAge: 1000 * 60 * 60 * 4
  }
}));

app.use(express.static(path.join(__dirname, "../public")));

app.get("/api/health", (req, res) => {
  res.json({ message: "Art Studio API is running!" });
});

app.post("/api/auth/login", login);
app.post("/api/auth/logout", logout);
app.get("/api/auth/me", getCurrentUser);
app.use("/api/purchases", purchasesRouter); 
app.use("/api/paintings", paintingsRouter);
app.post("/api/auth/register", require("./auth").register);
app.use("/api/bookings", bookingsRouter);
app.use("/api/pottery", potteryRouter);
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Art Studio server running at http://localhost:${PORT}`);
  });
}

module.exports = app;
