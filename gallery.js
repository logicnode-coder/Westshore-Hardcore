// Firebase Configuration
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

// Global state
let currentUser = null;
let currentUserData = null;
let isAdmin = false;
let currentLightboxImageId = null;

// Auth State Observer
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    await loadUserData();

    if (isAdmin) {
      document.getElementById("uploadSection").classList.remove("hidden");
    }
  } else {
    currentUser = null;
    currentUserData = null;
    isAdmin = false;
    document.getElementById("uploadSection").classList.add("hidden");
  }
  loadGallery();
});

// Load User Data
async function loadUserData() {
  const usersRef = collection(db, "users");
  const q = query(usersRef, where("email", "==", currentUser.email));
  const snapshot = await getDocs(q);

  if (!snapshot.empty) {
    currentUserData = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
    isAdmin = currentUserData.role === "admin";
  }
}

// Preview Image
window.previewImage = (event) => {
  const file = event.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const preview = document.getElementById("imagePreview");
      preview.src = e.target.result;
      preview.classList.remove("hidden");
      document.querySelector(".upload-prompt").style.display = "none";
    };
    reader.readAsDataURL(file);
  }
};

// Upload Image
window.uploadImage = async (e) => {
  e.preventDefault();

  if (!isAdmin) {
    showMessage("Only admins can upload images", "error");
    return;
  }

  const btn = document.getElementById("uploadBtnText");
  const fileInput = document.getElementById("imageInput");
  const file = fileInput.files[0];

  if (!file) {
    showMessage("Please select an image", "error");
    return;
  }

  // Validate file size (1MB limit for base64 storage)
  if (file.size > 1 * 1024 * 1024) {
    showMessage("Image must be less than 1MB", "error");
    return;
  }

  btn.innerHTML = '<span class="loading"></span>';

  try {
    // Convert image to base64
    const base64Image = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(e);
      reader.readAsDataURL(file);
    });

    // Save to Firestore with base64 data
    const description = document.getElementById("imageDescription").value;
    await addDoc(collection(db, "gallery"), {
      imageData: base64Image,
      description: description || "",
      uploadedBy: currentUser.uid,
      uploaderName: currentUserData.name,
      createdAt: serverTimestamp(),
    });

    showMessage("Image uploaded successfully!", "success");
    document.getElementById("uploadForm").reset();
    document.getElementById("imagePreview").classList.add("hidden");
    document.querySelector(".upload-prompt").style.display = "block";
    loadGallery();
  } catch (error) {
    console.error("Error uploading image:", error);
    showMessage("Error uploading image: " + error.message, "error");
  } finally {
    btn.textContent = "Upload Image";
  }
};

// Load Gallery
async function loadGallery() {
  const galleryGrid = document.getElementById("galleryGrid");
  galleryGrid.innerHTML =
    '<div class="loading-spinner">Loading gallery...</div>';

  try {
    const galleryRef = collection(db, "gallery");
    const q = query(galleryRef, orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);

    const images = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    if (images.length === 0) {
      galleryGrid.innerHTML = `
        <div class="empty-state">
          <h3>No images yet</h3>
          <p>${isAdmin ? "Upload some images to get started!" : "Check back soon for photos!"}</p>
        </div>
      `;
      return;
    }

    galleryGrid.innerHTML = images
      .map((image) => createGalleryItem(image))
      .join("");
  } catch (error) {
    console.error("Error loading gallery:", error);
    galleryGrid.innerHTML = `
      <div class="empty-state">
        <h3>Error loading gallery</h3>
        <p>${error.message}</p>
      </div>
    `;
  }
}

// Create Gallery Item HTML
function createGalleryItem(image) {
  const date = image.createdAt
    ? new Date(image.createdAt.toDate()).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "Just now";

  return `
    <div class="gallery-item" onclick="openLightbox('${image.id}', '${escapeQuotes(
      image.imageData,
    )}', '${escapeQuotes(image.description)}')">
      <img src="${image.imageData}" alt="${image.description || "Gallery image"}" loading="lazy" />
      ${
        image.description || date
          ? `
        <div class="gallery-overlay">
          ${image.description ? `<div class="gallery-description">${escapeHtml(image.description)}</div>` : ""}
          <div class="gallery-date">${date}</div>
        </div>
      `
          : ""
      }
      ${
        isAdmin
          ? `
        <div class="gallery-actions">
          <button class="btn-delete-gallery" onclick="deleteImage(event, '${image.id}')">
            Delete
          </button>
        </div>
      `
          : ""
      }
    </div>
  `;
}

// Open Lightbox
window.openLightbox = (imageId, imageUrl, description) => {
  currentLightboxImageId = imageId;
  const lightbox = document.getElementById("lightbox");
  const lightboxImage = document.getElementById("lightboxImage");
  const lightboxCaption = document.getElementById("lightboxCaption");
  const deleteBtn = document.getElementById("deleteLightboxBtn");

  lightboxImage.src = imageUrl;
  lightboxCaption.textContent = description || "";
  lightbox.classList.remove("hidden");

  if (isAdmin) {
    deleteBtn.classList.remove("hidden");
  } else {
    deleteBtn.classList.add("hidden");
  }

  document.body.style.overflow = "hidden";
};

// Close Lightbox
window.closeLightbox = () => {
  const lightbox = document.getElementById("lightbox");
  lightbox.classList.add("hidden");
  currentLightboxImageId = null;
  document.body.style.overflow = "auto";
};

// Delete from Lightbox
window.deleteFromLightbox = async (event) => {
  event.stopPropagation();

  if (!currentLightboxImageId || !isAdmin) return;

  await deleteImageById(currentLightboxImageId);
  closeLightbox();
};

// Delete Image
window.deleteImage = async (event, imageId) => {
  event.stopPropagation();

  if (!isAdmin) {
    showMessage("Only admins can delete images", "error");
    return;
  }

  if (confirm("Are you sure you want to delete this image?")) {
    await deleteImageById(imageId);
  }
};

// Delete Image by ID
async function deleteImageById(imageId) {
  try {
    // Delete from Firestore only
    await deleteDoc(doc(db, "gallery", imageId));

    showMessage("Image deleted successfully", "success");
    loadGallery();
  } catch (error) {
    console.error("Error deleting image:", error);
    showMessage("Error deleting image: " + error.message, "error");
  }
}

// Show Message
function showMessage(message, type) {
  const container =
    document.querySelector(".upload-section") ||
    document.querySelector(".container");
  const messageEl = document.createElement("div");
  messageEl.className = `message message-${type}`;
  messageEl.textContent = message;
  container.insertBefore(messageEl, container.firstChild);

  setTimeout(() => {
    messageEl.remove();
  }, 5000);
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// Escape quotes for use in HTML attributes
function escapeQuotes(text) {
  return text.replace(/'/g, "\\'").replace(/"/g, "&quot;");
}

// Navbar scroll effect
window.addEventListener("scroll", () => {
  const navbar = document.getElementById("navbar");
  if (window.scrollY > 50) {
    navbar.classList.add("scrolled");
  } else {
    navbar.classList.remove("scrolled");
  }
});

// Drag and drop support
const uploadArea = document.getElementById("uploadArea");
if (uploadArea) {
  ["dragenter", "dragover", "dragleave", "drop"].forEach((eventName) => {
    uploadArea.addEventListener(eventName, preventDefaults, false);
  });

  function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  ["dragenter", "dragover"].forEach((eventName) => {
    uploadArea.addEventListener(eventName, () => {
      uploadArea.style.borderColor = "var(--primary)";
      uploadArea.style.background = "var(--dark-lighter)";
    });
  });

  ["dragleave", "drop"].forEach((eventName) => {
    uploadArea.addEventListener(eventName, () => {
      uploadArea.style.borderColor = "var(--border)";
      uploadArea.style.background = "var(--dark)";
    });
  });

  uploadArea.addEventListener("drop", (e) => {
    const dt = e.dataTransfer;
    const files = dt.files;

    if (files.length > 0) {
      const fileInput = document.getElementById("imageInput");
      fileInput.files = files;
      previewImage({ target: fileInput });
    }
  });
}
