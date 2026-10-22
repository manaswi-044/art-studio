const accountSection = document.getElementById("account-section");
const accountButton = document.getElementById("account-button");
const accountMessage = document.getElementById("account-message");
const currentUser = document.getElementById("current-user");
const logoutButton = document.getElementById("logout-button");
const welcomeScreen = document.getElementById("welcome-screen");
const loginForm = document.getElementById("login-form");
const registerForm = document.getElementById("register-form");
const closeAuth = document.getElementById("close-auth");
let authPanelRequested = false;
const pageName = window.location.pathname.split("/").pop() || "index.html";
const isWelcomePage = pageName === "index.html" || pageName === "";
const customerPages = new Set(["home.html", "wall-painting.html", "pottery.html", "account.html"]);

function showAuthPanel(form) {
  authPanelRequested = true;
  if (!welcomeScreen || !accountSection || !loginForm || !registerForm) return;
  document.body.classList.add("auth-open");
  welcomeScreen.hidden = true;
  accountSection.hidden = false;
  loginForm.hidden = form !== loginForm;
  registerForm.hidden = form !== registerForm;
  form.scrollIntoView({
    behavior: "auto",
    block: "center"
  });
}

function closeAuthPanel() {
  if (!welcomeScreen || !accountSection) return;
  document.body.classList.remove("auth-open");
  accountSection.hidden = true;
  welcomeScreen.hidden = false;
  authPanelRequested = false;
}

async function loadPaintings() {
  const gallery = document.getElementById("gallery-grid");
  const status = document.getElementById("gallery-status");

  status.textContent = "Loading paintings...";
  try {
    const response = await fetch("/api/paintings");

    if (!response.ok) {
      throw new Error("Could not load paintings");
    }

    const data = await response.json();
    const paintings = data.paintings || [];

    if (paintings.length === 0) {
      status.textContent = "No paintings found.";
      return;
    }

    gallery.innerHTML = paintings.map(painting => {
      const imagePath = "/" + String(painting.image_url || "")
        .replace(/^\/+/, "");

      return `
        <article class="painting-card">
          <img
            class="painting-image"
            src="${imagePath}"
            alt="${painting.title}"
          >
          <div class="painting-details">
            <p class="artist-name">${painting.artist}</p>
            <h3>${painting.title}</h3>
            <p class="painting-price">₹${painting.price}</p>
            <p class="painting-status">
              ${painting.status === "available" ? "Available" : "Sold"}
            </p>
            ${
              painting.status === "available"
  ? `<button class="buy-button" data-buy-id="${painting.id}">
       Buy Painting
     </button>`
  : '<button class="buy-button" disabled>Sold Out</button>'
            }
          </div>
        </article>
      `;
    }).join("");

    status.textContent = `${paintings.length} paintings in the collection`;
    setupHorizontalGallery(paintings.length);
    setupRevealAnimations();

  } catch (error) {
    console.error(error);
    status.textContent =
      "Unable to load paintings. Please refresh the page.";
  }
}

function setupHorizontalGallery(paintingCount) {
  const scrollArea = document.getElementById("hglScrollArea");
  const stage = document.getElementById("hglStage");
  const gallery = document.getElementById("gallery-grid");
  const index = document.getElementById("hglIndex");
  const total = document.getElementById("hglTotal");

  if (!scrollArea || !stage || !gallery || !index || !total) return;

  total.textContent = paintingCount;
  if (!paintingCount) {
    scrollArea.style.minHeight = "0";
    return;
  }

  let travel = 0;
  let ticking = false;

  function updateMeasurements() {
    travel = Math.max(0, gallery.scrollWidth - stage.clientWidth);
    scrollArea.style.height = `${window.innerHeight + travel}px`;
    updatePosition();
  }

  function updatePosition() {
    const start = scrollArea.getBoundingClientRect().top + window.scrollY;
    const range = Math.max(1, scrollArea.offsetHeight - window.innerHeight);
    const progress = Math.max(0, Math.min(1, (window.scrollY - start) / range));
    gallery.style.transform = `translate3d(${-travel * progress}px, 0, 0)`;
    index.textContent = Math.min(
      paintingCount,
      Math.round(progress * (paintingCount - 1)) + 1
    );
    ticking = false;
  }

  function onScroll() {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(updatePosition);
  }

  if (scrollArea.dataset.galleryReady !== "true") {
    scrollArea.dataset.galleryReady = "true";
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", updateMeasurements);
  }

  window.requestAnimationFrame(updateMeasurements);
}

function setupRevealAnimations() {
  const revealItems = document.querySelectorAll(
    ".hero, .section-heading, .form-card, .request-history, .painting-card, .hgl-bottom"
  );

  if (!revealItems.length) return;

  if (!("IntersectionObserver" in window)) {
    revealItems.forEach((item) => {
      item.classList.add("reveal", "is-visible");
    });
    return;
  }

  const observer = new IntersectionObserver((entries, currentObserver) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-visible");
      currentObserver.unobserve(entry.target);
    });
  }, { threshold: 0.12 });

  revealItems.forEach((item) => {
    if (!item.classList.contains("painting-card")) {
      item.classList.add("reveal");
    }
    observer.observe(item);
  });
}

setupRevealAnimations();

if (document.getElementById("gallery-grid")) {
  loadPaintings();
}

const welcomeLogin = document.getElementById("welcome-login");
const welcomeRegister = document.getElementById("welcome-register");
if (welcomeLogin) welcomeLogin.addEventListener("click", () => showAuthPanel(loginForm));
if (welcomeRegister) welcomeRegister.addEventListener("click", () => showAuthPanel(registerForm));
if (closeAuth) closeAuth.addEventListener("click", closeAuthPanel);


async function refreshAccount() {
  try {
    const response = await fetch("/api/auth/me");
    if (!response.ok) {
      throw new Error("Could not check your account.");
    }

    const data = await response.json();
    const user = data.user;

    if (logoutButton) logoutButton.hidden = !user;
    if (currentUser) {
      currentUser.textContent = user ? `Logged in as ${user.email}` : "";
    }

    const studioLinks = document.querySelectorAll(".studio-link");
    studioLinks.forEach((link) => {
      link.hidden = !user || user.role !== "studio";
    });

    if (!user) {
      if (!isWelcomePage && (customerPages.has(pageName) || pageName === "studio.html")) {
        window.location.replace("index.html");
        return;
      }
      if (welcomeScreen && accountSection && !authPanelRequested) {
        welcomeScreen.hidden = false;
        accountSection.hidden = true;
      }
      return;
    }

    if (isWelcomePage) {
      window.location.replace(user.role === "studio" ? "studio.html" : "home.html");
      return;
    }

    if (pageName === "studio.html" && user.role !== "studio") {
      window.location.replace("home.html");
      return;
    }

    if (welcomeScreen) welcomeScreen.hidden = true;
    if (accountSection && !document.getElementById("account-section")?.closest(".auth-page")) {
      accountSection.hidden = true;
    }

    // Customer-only sections
    const isCustomer = user && user.role === "customer";

    const purchasesSection = document.getElementById("my-purchases");
    const bookingFormSection = document.getElementById("wall-booking");
    const bookingsSection = document.getElementById("my-bookings");
const potterySection = document.getElementById("pottery-section");
    const studioPotterySection = document.getElementById("studio-pottery-section");

    if (studioPotterySection) {
      studioPotterySection.hidden = !(user && user.role === "studio");
    }
    if (potterySection) potterySection.hidden = !isCustomer;

    if (purchasesSection) purchasesSection.hidden = !isCustomer;
    if (bookingFormSection) bookingFormSection.hidden = !isCustomer;
    if (bookingsSection) bookingsSection.hidden = !isCustomer;

    // Show the studio dashboard only to studio users
    const studioDashboard = document.getElementById("studio-dashboard");

    if (studioDashboard) {
      studioDashboard.hidden = !(user && user.role === "studio");
    }

    // Refresh data appropriate to the logged-in role
    if (isCustomer) {
      if (document.getElementById("purchases-grid")) await loadPurchases();
      if (document.getElementById("bookings-list")) await loadMyBookings();
      if (document.getElementById("pottery-item")) {
        await loadPotteryOptions();
        await loadMyPottery();
      }
    } else if (user && user.role === "studio") {
      await loadStudioBookings();
      if (studioPotterySection) studioPotterySection.hidden = false;
      await loadStudioPottery();
    }
  } catch (error) {
    console.error("Account check failed:", error);
    if (accountMessage) accountMessage.textContent = "Could not check your account.";
  }
}


if (registerForm) registerForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (accountMessage) accountMessage.textContent = "Creating account...";

  try {
    const email = document.getElementById("register-email").value;
    const password = document.getElementById("register-password").value;
    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();
    if (accountMessage) accountMessage.textContent = data.message || data.error;
    if (response.ok) {
      const loginResponse = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      if (!loginResponse.ok) {
        throw new Error("Account created, but automatic login failed.");
      }
      window.location.replace("home.html");
    }
  } catch (error) {
    if (accountMessage) accountMessage.textContent = error.message || "Could not connect to the server.";
  }
});

if (loginForm) loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (accountMessage) accountMessage.textContent = "Logging in...";

  try {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: document.getElementById("login-email").value,
        password: document.getElementById("login-password").value
      })
    });

    const data = await response.json();
    if (accountMessage) accountMessage.textContent = data.message || data.error;
    if (response.ok) {
      window.location.replace(data.user?.role === "studio" ? "studio.html" : "home.html");
    }
  } catch (error) {
    if (accountMessage) accountMessage.textContent = "Could not connect to the server.";
  }
});

async function logout() {
  try {
    const response = await fetch("/api/auth/logout", {
      method: "POST"
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not log out.");
    window.location.replace("index.html");
  } catch (error) {
    if (accountMessage) accountMessage.textContent = error.message;
  }
}

if (logoutButton) logoutButton.addEventListener("click", logout);
document.querySelectorAll(".logout-link").forEach((button) => {
  button.addEventListener("click", logout);
});

refreshAccount();

async function loadPurchases() {
  const message = document.getElementById("purchases-message");
  const grid = document.getElementById("purchases-grid");

  if (!message || !grid) return;
  message.textContent = "Loading purchases...";
  grid.innerHTML = "";

  try {
    const response = await fetch("/api/purchases/mine");
    const data = await response.json();

    if (!response.ok) {
      message.textContent = data.error || "Please log in to view purchases.";
      return;
    }

    if (!data.purchases || data.purchases.length === 0) {
      message.textContent = "You haven't purchased any paintings yet.";
      return;
    }

    message.textContent = `${data.purchases.length} purchase(s)`;

    grid.innerHTML = data.purchases.map(p => `
      <article class="painting-card">
        <img class="painting-image" src="/${p.image_url}" alt="${p.title}">
        <div class="painting-details">
          <p class="artist-name">${p.artist}</p>
          <h3>${p.title}</h3>
          <p class="painting-price">₹${p.price}</p>
          <button class="buy-button cancel-purchase"
            data-cancel-id="${p.purchase_id}">
            Cancel purchase
          </button>
        </div>
      </article>
    `).join("");
  } catch (error) {
    console.error(error);
    message.textContent = "Could not load purchases. Please try again.";
  }
}

// Handle clicks on Buy Painting buttons
const galleryGrid = document.getElementById("gallery-grid");
if (galleryGrid) galleryGrid.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-buy-id]");
  if (!button) return;

  if (button.disabled) return;

  const paintingId = button.dataset.buyId;

  if (!confirm("Do you want to purchase this painting?")) return;

  button.disabled = true;
  button.textContent = "Processing...";

  try {
    const response = await fetch(
      `/api/purchases/${encodeURIComponent(paintingId)}`,
      { method: "POST" }
    );

    const data = await response.json();
    alert(data.message || data.error);

    if (response.ok) {
      await loadPaintings();
      await loadPurchases();
    } else {
      await loadPaintings();
    }
  } catch (error) {
    console.error(error);
    alert("Could not complete the purchase. Please try again.");
    await loadPaintings();
  }
});

// Handle purchase cancellations
const purchasesGrid = document.getElementById("purchases-grid");
if (purchasesGrid) purchasesGrid.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-cancel-id]");
  if (!button) return;

  if (!confirm("Cancel this purchase? The painting will become available again.")) {
    return;
  }

  button.disabled = true;
  button.textContent = "Cancelling...";

  try {
    const response = await fetch(
      `/api/purchases/${encodeURIComponent(button.dataset.cancelId)}`,
      { method: "DELETE" }
    );

    const data = await response.json();
    alert(data.message || data.error);

    if (response.ok) {
      await loadPaintings();
      await loadPurchases();
    } else {
      button.disabled = false;
      button.textContent = "Cancel purchase";
    }
  } catch (error) {
    console.error(error);
    alert("Could not cancel the purchase. Please try again.");
    button.disabled = false;
    button.textContent = "Cancel purchase";
  }
});

const refreshPurchases = document.getElementById("refresh-purchases");
if (refreshPurchases) refreshPurchases.addEventListener("click", loadPurchases);


/* WALL PAINTING BOOKING FORM */

const bookingForm = document.getElementById("booking-form");

if (bookingForm) {
  const dateInput = document.getElementById("booking-date");
  const sizeInput = document.getElementById("wall-size");
  const totalDisplay = document.getElementById("booking-total");
  const messageDisplay = document.getElementById("booking-message");
  const submitButton = document.getElementById("booking-submit");

  const ratePerSqFt = 150;

  // Set the allowed booking date range: 7 to 90 days ahead
  function setBookingDateLimits() {
    const today = new Date();

    function formatDate(date) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    }

    const earliest = new Date(today);
    earliest.setDate(earliest.getDate() + 7);

    const latest = new Date(today);
    latest.setDate(latest.getDate() + 90);

    dateInput.min = formatDate(earliest);
    dateInput.max = formatDate(latest);
  }

  setBookingDateLimits();

  // Calculate the estimated price automatically
  function updateBookingPrice() {
    const size = Number(sizeInput.value);

    if (Number.isInteger(size) && size >= 10 && size <= 500) {
      totalDisplay.textContent =
        "₹" + (size * ratePerSqFt).toLocaleString("en-IN");
    } else {
      totalDisplay.textContent = "₹0";
    }
  }

  sizeInput.addEventListener("input", updateBookingPrice);

  // Submit the booking to the server
  bookingForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    messageDisplay.textContent = "";
    submitButton.disabled = true;
    submitButton.textContent = "Submitting...";

    try {
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          booking_date: dateInput.value,
          wall_size: Number(sizeInput.value),
          address: document.getElementById("wall-address").value.trim()
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Could not submit your booking.");
      }

      messageDisplay.textContent =
        "✓ " + result.message + " Your booking is awaiting studio approval.";

      messageDisplay.style.color = "green";
      bookingForm.reset();
      setBookingDateLimits();
      updateBookingPrice();

      if (typeof loadMyBookings === "function") {
        await loadMyBookings();
      }
    } catch (error) {
      messageDisplay.textContent = error.message;
      messageDisplay.style.color = "#b42318";
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = "Request Booking";
    }
  });
}

/* MY WALL PAINTING BOOKINGS */

async function loadMyBookings() {
  const list = document.getElementById("bookings-list");
  const message = document.getElementById("bookings-message");

  if (!list || !message) return;

  list.innerHTML = "<p>Loading your bookings...</p>";
  message.textContent = "";

  try {
    const response = await fetch("/api/bookings/mine");
    const result = await response.json();

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        list.innerHTML = "<p>Please log in with a customer account to view your bookings.</p>";
        return;
      }

      throw new Error(result.error || "Could not load bookings.");
    }

    if (!result.bookings || result.bookings.length === 0) {
      list.innerHTML = "<p>You haven't made any wall painting bookings yet.</p>";
      return;
    }

    list.innerHTML = result.bookings.map((booking) => {
      const canCancel =
        ["requested", "confirmed"].includes(booking.status) &&
        daysUntilBooking(booking.booking_date) >= 3;

      return `
        <article class="booking-card">
          <h3>Wall Painting Booking</h3>
          <p><strong>Date:</strong> ${escapeBookingText(booking.booking_date)}</p>
          <p><strong>Wall size:</strong> ${booking.wall_size} sq. ft.</p>
          <p><strong>Address:</strong> ${escapeBookingText(booking.address)}</p>
          <p><strong>Total:</strong> ₹${Number(booking.total_price).toLocaleString("en-IN")}</p>
          <p><strong>Status:</strong> ${escapeBookingText(booking.status)}</p>
          ${
            canCancel
              ? `<button type="button" class="cancel-booking-button" data-booking-id="${booking.id}">Cancel Booking</button>`
              : ""
          }
        </article>
      `;
    }).join("");
  } catch (error) {
    list.innerHTML = "";
    message.textContent = error.message;
  }
}

function daysUntilBooking(dateString) {
  const [year, month, day] = dateString.split("-").map(Number);
  const bookingDay = Date.UTC(year, month - 1, day);

  const today = new Date();
  const todayUTC = Date.UTC(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );

  return Math.round((bookingDay - todayUTC) / (1000 * 60 * 60 * 24));
}

function escapeBookingText(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

// Handle cancellation clicks
const bookingsList = document.getElementById("bookings-list");

if (bookingsList) {
  bookingsList.addEventListener("click", async (event) => {
    const button = event.target.closest(".cancel-booking-button");
    if (!button) return;

    const bookingId = button.dataset.bookingId;

    if (!confirm("Are you sure you want to cancel this booking?")) {
      return;
    }

    button.disabled = true;

    try {
      const response = await fetch(`/api/bookings/${bookingId}`, {
        method: "DELETE"
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Could not cancel booking.");
      }

      document.getElementById("bookings-message").textContent =
        result.message;

      await loadMyBookings();
    } catch (error) {
      document.getElementById("bookings-message").textContent =
        error.message;
      button.disabled = false;
    }
  });
}

// Load bookings when the page opens
document.addEventListener("DOMContentLoaded", loadMyBookings);

/* STUDIO DASHBOARD */

async function loadStudioBookings() {
  const dashboard = document.getElementById("studio-dashboard");
  const list = document.getElementById("studio-bookings-list");
  const message = document.getElementById("studio-bookings-message");

  if (!dashboard || !list || !message) return;

  try {
    const meResponse = await fetch("/api/auth/me");
    const meData = await meResponse.json();

    if (!meResponse.ok || !meData.user || meData.user.role !== "studio") {
      dashboard.hidden = true;
      return;
    }

    dashboard.hidden = false;
    list.innerHTML = "<p>Loading bookings...</p>";

    const response = await fetch("/api/bookings/all");
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Could not load studio bookings.");
    }

    if (!data.bookings || data.bookings.length === 0) {
      list.innerHTML = "<p>No wall painting bookings yet.</p>";
      return;
    }

    list.innerHTML = data.bookings.map((booking) => `
      <article class="booking-card">
        <h3>Booking #${booking.id}</h3>
        <p><strong>Customer:</strong> ${escapeBookingText(booking.customer_email)}</p>
        <p><strong>Date:</strong> ${escapeBookingText(booking.booking_date)}</p>
        <p><strong>Wall size:</strong> ${booking.wall_size} sq. ft.</p>
        <p><strong>Address:</strong> ${escapeBookingText(booking.address)}</p>
        <p><strong>Total:</strong> ₹${Number(booking.total_price).toLocaleString("en-IN")}</p>
        <p><strong>Status:</strong> ${escapeBookingText(booking.status)}</p>
        ${
          booking.status === "requested"
            ? `<button class="studio-booking-action" data-id="${booking.id}" data-status="confirmed">Confirm</button>
               <button class="studio-booking-action decline-action" data-id="${booking.id}" data-status="declined">Decline</button>`
            : ""
        }
      </article>
    `).join("");
  } catch (error) {
    list.innerHTML = "";
    message.textContent = error.message;
  }
}

const studioBookingsList = document.getElementById("studio-bookings-list");

if (studioBookingsList) {
  studioBookingsList.addEventListener("click", async (event) => {
    const button = event.target.closest(".studio-booking-action");
    if (!button) return;

    const bookingId = button.dataset.id;
    const status = button.dataset.status;

    if (!confirm(`Are you sure you want to ${status} this booking?`)) {
      return;
    }

    button.disabled = true;

    try {
      const response = await fetch(`/api/bookings/${bookingId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not update booking.");
      }

      document.getElementById("studio-bookings-message").textContent =
        data.message;

      await loadStudioBookings();
    } catch (error) {
      document.getElementById("studio-bookings-message").textContent =
        error.message;
      button.disabled = false;
    }
  });
}

document.addEventListener("DOMContentLoaded", loadStudioBookings);

async function loadPotteryOptions() {
  const itemSelect = document.getElementById("pottery-item");
  const glazeSelect = document.getElementById("pottery-glaze");
  const message = document.getElementById("pottery-message");

  try {
    const response = await fetch("/api/pottery/options");
    const data = await response.json();

    if (!response.ok) throw new Error(data.error || "Could not load pottery options.");

    itemSelect.replaceChildren(new Option("Select an item", ""));
    glazeSelect.replaceChildren(new Option("Select a glaze", ""));

    data.items.forEach(item => {
      itemSelect.add(new Option(item.name, item.id));
    });

    data.glazes.forEach(glaze => {
      glazeSelect.add(new Option(glaze.name, glaze.id));
    });

    const minDate = new Date();
    minDate.setDate(minDate.getDate() + 14);
    document.getElementById("pottery-date").min =
      `${minDate.getFullYear()}-${String(minDate.getMonth() + 1).padStart(2, "0")}-${String(minDate.getDate()).padStart(2, "0")}`;
  } catch (error) {
    message.textContent = error.message;
  }
}

async function loadMyPottery() {
  const list = document.getElementById("my-pottery-list");
  const message = document.getElementById("my-pottery-message");

  list.replaceChildren();
  message.textContent = "Loading your pottery requests...";

  try {
    const response = await fetch("/api/pottery/mine");
    const data = await response.json();

    if (!response.ok) throw new Error(data.error || "Could not load requests.");

    const requests = data.requests;

if (!requests || !requests.length) {
      message.textContent = "You haven't submitted any pottery requests yet.";
      return;
    }

    message.textContent = "";

   requests.forEach(request => {
      const card = document.createElement("div");
      card.className = "pottery-card";

      const details = document.createElement("p");
      details.textContent =
        `${request.item_name} | ${request.glaze_name} | Quantity: ${request.quantity} | Needed by: ${request.needed_by} | Status: ${request.status}`;
      card.appendChild(details);

      if (request.status === "requested") {
        const editButton = document.createElement("button");
        editButton.textContent = "Edit";
        editButton.type = "button";
        editButton.addEventListener("click", async () => {
          const quantity = prompt("Enter new quantity (1–12):", request.quantity);
          if (quantity === null) return;

          const neededBy = prompt("Enter new required date (YYYY-MM-DD):", request.needed_by);
          if (neededBy === null) return;

          const updated = await fetch(`/api/pottery/${request.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
  item_id: request.item_id,
  glaze_id: request.glaze_id,
  quantity: Number(quantity),
  needed_by: neededBy
})
          });

          const result = await updated.json();
          if (!updated.ok) {
            alert(result.error || "Could not update request.");
            return;
          }

          await loadMyPottery();
        });

        const cancelButton = document.createElement("button");
        cancelButton.textContent = "Cancel Request";
        cancelButton.type = "button";
        cancelButton.addEventListener("click", async () => {
          if (!confirm("Cancel this pottery request?")) return;

          const cancelled = await fetch(`/api/pottery/${request.id}`, {
            method: "DELETE"
          });

          const result = await cancelled.json();
          if (!cancelled.ok) {
            alert(result.error || "Could not cancel request.");
            return;
          }

          await loadMyPottery();
        });

        card.append(editButton, cancelButton);
      }

      list.appendChild(card);
    });
  } catch (error) {
    message.textContent = error.message;
  }
}

const potteryForm = document.getElementById("pottery-form");
if (potteryForm) potteryForm.addEventListener("submit", async event => {
  event.preventDefault();

  const message = document.getElementById("pottery-message");
  const submitButton = document.getElementById("pottery-submit");
  message.textContent = "Submitting request...";
  submitButton.disabled = true;

  try {
    const response = await fetch("/api/pottery", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
  item_id: document.getElementById("pottery-item").value,
  glaze_id: document.getElementById("pottery-glaze").value,
  quantity: Number(document.getElementById("pottery-quantity").value),
  needed_by: document.getElementById("pottery-date").value
})
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not submit request.");

    message.textContent = "Pottery request submitted successfully!";
    event.target.reset();
    document.getElementById("pottery-quantity").value = 1;

    await loadMyPottery();
  } catch (error) {
    message.textContent = error.message;
  } finally {
    submitButton.disabled = false;
  }
});


async function loadStudioPottery() {
  const list = document.getElementById("studio-pottery-list");
  const message = document.getElementById("studio-pottery-message");

  list.replaceChildren();
  message.textContent = "Loading pottery requests...";

  try {
    const response = await fetch("/api/pottery/all");
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Could not load pottery requests.");
    }

    const requests = data.requests || [];

    if (requests.length === 0) {
      message.textContent = "No pottery requests yet.";
      return;
    }

    message.textContent = "";

    requests.forEach(request => {
      const card = document.createElement("div");
      card.className = "pottery-card";

      const details = document.createElement("p");
      details.textContent =
        `${request.item_name} | ${request.glaze_name} | Quantity: ${request.quantity} | Needed by: ${request.needed_by} | Customer: ${request.customer_email} | Status: ${request.status}`;

      card.appendChild(details);

      if (request.status === "requested") {
        ["accepted", "declined"].forEach(status => {
          const button = document.createElement("button");
          button.type = "button";
          button.textContent =
            status === "accepted" ? "Accept" : "Decline";

          button.addEventListener("click", async () => {
            const result = await fetch(`/api/pottery/${request.id}/status`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ status })
            });

            const resultData = await result.json();

            if (!result.ok) {
              alert(resultData.error || "Could not update request.");
              return;
            }

            await loadStudioPottery();
          });

          card.appendChild(button);
        });
      }

      list.appendChild(card);
    });
  } catch (error) {
    message.textContent = error.message;
  }
}
if (accountButton) accountButton.addEventListener("click", () => {
  // If logged in, show or hide the account details.
  if (!logoutButton.hidden) {
    accountSection.hidden = !accountSection.hidden;
    return;
  }

  // If logged out, open both authentication forms.
  authPanelRequested = true;

  if (welcomeScreen) welcomeScreen.hidden = true;
  if (accountSection) accountSection.hidden = false;

  if (loginForm) loginForm.hidden = false;
  if (registerForm) registerForm.hidden = false;

  if (accountSection) accountSection.scrollIntoView({
    behavior: "smooth",
    block: "center"
  });
});