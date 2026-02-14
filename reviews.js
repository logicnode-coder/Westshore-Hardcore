const firebaseConfig = {
  apiKey: "AIzaSyCytIJQObxJvYYe1Ifaz5LyoWPMYFxPnlE",
  authDomain: "westshore-hardcore.firebaseapp.com",
  projectId: "westshore-hardcore",
  storageBucket: "westshore-hardcore.firebasestorage.app",
  messagingSenderId: "169351009814",
  appId: "1:169351009814:web:c8f11b3d09174a1295c737",
  measurementId: "G-RVGNFP3XGP",
};

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  query,
  orderBy,
  serverTimestamp,
  where,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUser = null;
let currentUserData = null;
let isAdmin = false;

onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    await loadUserData();
    document.getElementById("loginPrompt").classList.add("hidden");
    document.getElementById("reviewFormContainer").classList.remove("hidden");
  } else {
    currentUser = null;
    currentUserData = null;
    isAdmin = false;
    document.getElementById("loginPrompt").classList.remove("hidden");
    document.getElementById("reviewFormContainer").classList.add("hidden");
  }
  loadReviews();
});

async function loadUserData() {
  const usersRef = collection(db, "users");
  const q = query(usersRef, where("email", "==", currentUser.email));
  const snapshot = await getDocs(q);

  if (!snapshot.empty) {
    currentUserData = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
    isAdmin = currentUserData.role === "admin";
  }
}

window.submitReview = async (e) => {
  e.preventDefault();

  if (!currentUser || !currentUserData) {
    showMessage("Please login to leave a review", "error");
    return;
  }

  const btn = document.getElementById("submitBtnText");
  btn.innerHTML = '<span class="loading"></span>';

  try {
    const rating = document.querySelector('input[name="rating"]:checked').value;
    const reviewText = document.getElementById("reviewText").value;

    await addDoc(collection(db, "reviews"), {
      userId: currentUser.uid,
      userName: currentUserData.name,
      rating: parseInt(rating),
      text: reviewText,
      createdAt: serverTimestamp(),
    });

    showMessage("Review submitted successfully!", "success");
    document.getElementById("reviewForm").reset();
    loadReviews();
  } catch (error) {
    console.error("Error submitting review:", error);
    showMessage("Error submitting review: " + error.message, "error");
  } finally {
    btn.textContent = "Submit Review";
  }
};

async function loadReviews() {
  const reviewsList = document.getElementById("reviewsList");
  reviewsList.innerHTML =
    '<div class="loading-spinner">Loading reviews...</div>';

  try {
    const reviewsRef = collection(db, "reviews");
    const q = query(reviewsRef, orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);

    const reviews = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    if (reviews.length === 0) {
      reviewsList.innerHTML = `
        <div class="empty-state">
          <h3>No reviews yet</h3>
          <p>Be the first to leave a review!</p>
        </div>
      `;
      updateAverageRating(0, 0);
      return;
    }

    const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
    const avgRating = totalRating / reviews.length;
    updateAverageRating(avgRating, reviews.length);

    reviewsList.innerHTML = reviews
      .map((review) => createReviewCard(review))
      .join("");
  } catch (error) {
    console.error("Error loading reviews:", error);
    reviewsList.innerHTML = `
      <div class="empty-state">
        <h3>Error loading reviews</h3>
        <p>${error.message}</p>
      </div>
    `;
  }
}

function createReviewCard(review) {
  const stars = "★".repeat(review.rating) + "☆".repeat(5 - review.rating);
  const date = review.createdAt
    ? new Date(review.createdAt.toDate()).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "Just now";

  return `
    <div class="review-card">
      <div class="review-header">
        <div class="review-author">
          <div class="author-name">${review.userName}</div>
          <div class="review-date">${date}</div>
        </div>
        <div class="review-rating">
          <div class="review-stars">${stars}</div>
        </div>
      </div>
      <div class="review-text">${escapeHtml(review.text)}</div>
      ${
        isAdmin
          ? `
        <div class="review-actions">
          <button class="btn-delete" onclick="deleteReview('${review.id}')">
            Delete
          </button>
        </div>
      `
          : ""
      }
    </div>
  `;
}

function updateAverageRating(avgRating, totalReviews) {
  const avgRatingEl = document.getElementById("averageRating");
  const fullStars = Math.floor(avgRating);
  const hasHalfStar = avgRating % 1 >= 0.5;
  const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);

  let starsHtml = "★".repeat(fullStars);
  if (hasHalfStar) starsHtml += "⯨";
  starsHtml += "☆".repeat(emptyStars);

  avgRatingEl.querySelector(".stars").textContent = starsHtml;
  avgRatingEl.querySelector(".rating-text").textContent =
    totalReviews > 0
      ? `${avgRating.toFixed(1)} out of 5 (${totalReviews} ${
          totalReviews === 1 ? "review" : "reviews"
        })`
      : "No reviews yet";
}

window.deleteReview = async (reviewId) => {
  if (!isAdmin) {
    showMessage("Only admins can delete reviews", "error");
    return;
  }

  if (confirm("Are you sure you want to delete this review?")) {
    try {
      await deleteDoc(doc(db, "reviews", reviewId));
      showMessage("Review deleted successfully", "success");
      loadReviews();
    } catch (error) {
      console.error("Error deleting review:", error);
      showMessage("Error deleting review: " + error.message, "error");
    }
  }
};

function showMessage(message, type) {
  const container =
    document.querySelector(".review-form-container") ||
    document.querySelector(".container");
  const messageEl = document.createElement("div");
  messageEl.className = `message message-${type}`;
  messageEl.textContent = message;
  container.insertBefore(messageEl, container.firstChild);

  setTimeout(() => {
    messageEl.remove();
  }, 5000);
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

window.addEventListener("scroll", () => {
  const navbar = document.getElementById("navbar");
  if (window.scrollY > 50) {
    navbar.classList.add("scrolled");
  } else {
    navbar.classList.remove("scrolled");
  }
});
