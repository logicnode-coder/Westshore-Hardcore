// Firebase Configuration
// TODO: Replace with your actual Firebase config from Firebase Console
const firebaseConfig = {
  apiKey: "AIzaSyCytIJQObxJvYYe1Ifaz5LyoWPMYFxPnlE",
  authDomain: "westshore-hardcore.firebaseapp.com",
  projectId: "westshore-hardcore",
  storageBucket: "westshore-hardcore.firebasestorage.app",
  messagingSenderId: "169351009814",
  appId: "1:169351009814:web:c8f11b3d09174a1295c737",
  measurementId: "G-RVGNFP3XGP",
};

// Initialize Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  orderBy,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Global state
let currentUser = null;
let currentUserData = null;

// Auth State Observer
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    await loadUserData();
    showDashboard();

    // Only show admin tab if user is actually an admin
    if (currentUserData && currentUserData.role === "admin") {
      document.getElementById("adminTab").classList.remove("hidden");
      loadAdminData();
    } else {
      document.getElementById("adminTab").classList.add("hidden");
    }
  } else {
    showAuth();
  }
});

// Load User Data
async function loadUserData() {
  const usersRef = collection(db, "users");
  const q = query(usersRef, where("email", "==", currentUser.email));
  const snapshot = await getDocs(q);

  if (!snapshot.empty) {
    currentUserData = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
    document.getElementById("userName").textContent = currentUserData.name;
    document.getElementById("dashboardUserName").textContent =
      currentUserData.name;
  }
}

// Handle Signup
window.handleSignup = async (e) => {
  e.preventDefault();
  const btn = document.getElementById("signupBtnText");
  btn.innerHTML = '<span class="loading"></span>';

  try {
    const email = document.getElementById("signupEmail").value;
    const password = document.getElementById("signupPassword").value;
    const name = document.getElementById("signupName").value;
    const phone = document.getElementById("signupPhone").value;

    const userCredential = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );

    await addDoc(collection(db, "users"), {
      uid: userCredential.user.uid,
      email: email,
      name: name,
      phone: phone,
      role: "user",
      createdAt: serverTimestamp(),
    });

    showMessage("authMessage", "Account created successfully!", "success");
  } catch (error) {
    showMessage("authMessage", error.message, "error");
    btn.textContent = "Create Account";
  }
};

// Handle Login
window.handleLogin = async (e) => {
  e.preventDefault();
  const btn = document.getElementById("loginBtnText");
  btn.innerHTML = '<span class="loading"></span>';

  try {
    const email = document.getElementById("loginEmail").value;
    const password = document.getElementById("loginPassword").value;

    await signInWithEmailAndPassword(auth, email, password);
  } catch (error) {
    showMessage("authMessage", "Invalid email or password", "error");
    btn.textContent = "Login";
  }
};

// Logout
window.logout = async () => {
  await signOut(auth);
};

// Handle Booking Submission
window.handleBooking = async (e) => {
  e.preventDefault();
  const btn = document.getElementById("bookingBtnText");
  btn.innerHTML = '<span class="loading"></span>';

  try {
    await addDoc(collection(db, "bookings"), {
      userId: currentUser.uid,
      userEmail: currentUser.email,
      userName: currentUserData.name,
      userPhone: currentUserData.phone,
      vehicleType: document.getElementById("vehicleType").value,
      date: document.getElementById("bookingDate").value,
      time: document.getElementById("bookingTime").value,
      notes: document.getElementById("bookingNotes").value,
      status: "pending",
      createdAt: serverTimestamp(),
    });

    showMessage(
      "dashboardMessage",
      "Booking submitted successfully! We'll contact you soon.",
      "success"
    );
    e.target.reset();
    btn.textContent = "Submit Booking";
  } catch (error) {
    showMessage("dashboardMessage", error.message, "error");
    btn.textContent = "Submit Booking";
  }
};

// Load Admin Data
async function loadAdminData() {
  try {
    const bookingsRef = collection(db, "bookings");
    const q = query(bookingsRef, orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);

    const bookings = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    document.getElementById("totalBookings").textContent = bookings.length;
    document.getElementById("pendingBookings").textContent = bookings.filter(
      (b) => b.status === "pending"
    ).length;
    document.getElementById("completedBookings").textContent = bookings.filter(
      (b) => b.status === "completed"
    ).length;

    const container = document.getElementById("adminBookingsList");
    if (bookings.length === 0) {
      container.innerHTML =
        '<div class="empty-state"><h3>No bookings yet</h3><p>Bookings will appear here once customers start booking</p></div>';
    } else {
      container.innerHTML = bookings
        .map((booking) => createBookingCard(booking.id, booking, true))
        .join("");
    }

    await loadUsers();
  } catch (error) {
    console.error("Error loading admin data:", error);
    showMessage(
      "dashboardMessage",
      "Error loading bookings: " + error.message,
      "error"
    );
  }
}

// Load Users
async function loadUsers() {
  const usersRef = collection(db, "users");
  const snapshot = await getDocs(usersRef);

  const container = document.getElementById("usersList");
  container.innerHTML = snapshot.docs
    .map((doc) => {
      const user = doc.data();
      return `
            <div class="user-card">
                <div class="user-info-card">
                    <div class="user-email">${user.email}</div>
                    <div class="user-role">Role: ${user.role} | Name: ${
        user.name
      }</div>
                </div>
                <div style="display: flex; gap: 0.5rem;">
                    ${
                      user.role !== "admin"
                        ? `
                        <button class="btn btn-warning" onclick="makeAdmin('${doc.id}')">
                            Make Admin
                        </button>
                    `
                        : '<span style="color: var(--success); font-weight: 600; margin-right: 0.5rem;">Admin</span>'
                    }
                    ${
                      user.uid !== currentUser.uid
                        ? `
                        <button class="btn btn-danger" onclick="deleteUser('${doc.id}', '${user.uid}')">
                            Delete User
                        </button>
                    `
                        : ""
                    }
                </div>
            </div>
        `;
    })
    .join("");
}

// Make User Admin
window.makeAdmin = async (userId) => {
  if (confirm("Make this user an admin?")) {
    await updateDoc(doc(db, "users", userId), { role: "admin" });
    showMessage("dashboardMessage", "User promoted to admin!", "success");
    loadUsers();
  }
};

// Delete User
window.deleteUser = async (userId, userUid) => {
  if (
    confirm(
      "Are you sure you want to delete this user? This will also delete all their bookings."
    )
  ) {
    try {
      // Delete user document from Firestore
      await deleteDoc(doc(db, "users", userId));

      // Delete all bookings for this user
      const bookingsRef = collection(db, "bookings");
      const q = query(bookingsRef, where("userId", "==", userUid));
      const snapshot = await getDocs(q);

      const deletePromises = snapshot.docs.map((doc) => deleteDoc(doc.ref));
      await Promise.all(deletePromises);

      showMessage(
        "dashboardMessage",
        "User and their bookings deleted successfully!",
        "success"
      );
      loadUsers();
      loadAdminData();
    } catch (error) {
      showMessage(
        "dashboardMessage",
        "Error deleting user: " + error.message,
        "error"
      );
    }
  }
};

// Update Booking Status
window.updateBookingStatus = async (bookingId, status) => {
  await updateDoc(doc(db, "bookings", bookingId), { status: status });
  showMessage("dashboardMessage", `Booking ${status}!`, "success");
  if (currentUserData?.role === "admin") {
    loadAdminData();
  }
};

// Delete Booking
window.deleteBooking = async (bookingId) => {
  if (confirm("Are you sure you want to delete this booking?")) {
    await deleteDoc(doc(db, "bookings", bookingId));
    showMessage("dashboardMessage", "Booking deleted!", "success");
    if (currentUserData?.role === "admin") {
      loadAdminData();
    }
  }
};

// Create Booking Card HTML
function createBookingCard(id, booking, isAdmin) {
  const date = new Date(booking.date).toLocaleDateString();
  return `
        <div class="booking-card">
            <div class="booking-header">
                <h3>${booking.userName}</h3>
                <span class="status-badge status-${booking.status}">${
    booking.status
  }</span>
            </div>
            <div class="booking-details">
                <div class="detail-item">
                    <span class="detail-label">Vehicle</span>
                    <span class="detail-value">${booking.vehicleType}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Date</span>
                    <span class="detail-value">${date}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Time</span>
                    <span class="detail-value">${booking.time}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Phone</span>
                    <span class="detail-value">${booking.userPhone}</span>
                </div>
                ${
                  isAdmin
                    ? `
                <div class="detail-item">
                    <span class="detail-label">Email</span>
                    <span class="detail-value">${booking.userEmail}</span>
                </div>
                `
                    : ""
                }
            </div>
            ${
              booking.notes
                ? `
                <div class="detail-item" style="margin-top: 1rem;">
                    <span class="detail-label">Notes</span>
                    <span class="detail-value">${booking.notes}</span>
                </div>
            `
                : ""
            }
            <div class="booking-actions">
                ${
                  isAdmin && booking.status === "pending"
                    ? `
                    <button class="btn btn-success" onclick="updateBookingStatus('${id}', 'confirmed')">
                        Confirm
                    </button>
                `
                    : ""
                }
                ${
                  isAdmin && booking.status === "confirmed"
                    ? `
                    <button class="btn btn-success" onclick="updateBookingStatus('${id}', 'completed')">
                        Mark Complete
                    </button>
                `
                    : ""
                }
                ${
                  isAdmin
                    ? `
                    <button class="btn btn-warning" onclick="updateBookingStatus('${id}', 'cancelled')">
                        Cancel
                    </button>
                `
                    : ""
                }
                ${
                  isAdmin
                    ? `
                <button class="btn btn-danger" onclick="deleteBooking('${id}')">
                    Delete
                </button>
                `
                    : ""
                }
            </div>
        </div>
    `;
}

// Show Auth Screen
function showAuth() {
  document.getElementById("authContainer").classList.remove("hidden");
  document.getElementById("dashboardContainer").classList.add("hidden");
  document.getElementById("userInfo").classList.add("hidden");
}

// Show Dashboard
function showDashboard() {
  document.getElementById("authContainer").classList.add("hidden");
  document.getElementById("dashboardContainer").classList.remove("hidden");
  document.getElementById("userInfo").classList.remove("hidden");
}

// Switch Auth Tabs
window.showAuthTab = (tab) => {
  const tabs = document.querySelectorAll(".auth-tab");
  tabs.forEach((t) => t.classList.remove("active"));
  event.target.classList.add("active");

  if (tab === "login") {
    document.getElementById("loginForm").classList.remove("hidden");
    document.getElementById("signupForm").classList.add("hidden");
  } else {
    document.getElementById("loginForm").classList.add("hidden");
    document.getElementById("signupForm").classList.remove("hidden");
  }
};

// Switch Dashboard Tabs
window.showDashboardTab = (tab) => {
  const tabs = document.querySelectorAll(".dashboard-tab");
  tabs.forEach((t) => t.classList.remove("active"));
  event.target.classList.add("active");

  document.querySelectorAll(".tab-content").forEach((content) => {
    content.classList.remove("active");
  });

  if (tab === "book") {
    document.getElementById("bookTab").classList.add("active");
  } else if (tab === "admin") {
    document.getElementById("adminTab-content").classList.add("active");
    loadAdminData();
  }
};

// Show Message
function showMessage(containerId, message, type) {
  const container = document.getElementById(containerId);
  container.innerHTML = `<div class="message message-${type}">${message}</div>`;
  setTimeout(() => {
    container.innerHTML = "";
  }, 5000);
}

// Initialize minimum date when page loads
window.addEventListener("DOMContentLoaded", () => {
  const dateInput = document.getElementById("bookingDate");
  if (dateInput) {
    dateInput.min = new Date().toISOString().split("T")[0];
  }
});
