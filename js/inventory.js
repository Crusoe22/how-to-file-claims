/* =========================================================
   Home Inventory — photo intake (inventory.html)
   Photos are kept in memory only and never leave the browser.
   Later phases will send photos to a backend for AI analysis;
   `photos` below is the list that step will read from.
   ========================================================= */

(function () {
  "use strict";

  const MAX_FILE_MB = 15;
  const MAX_PHOTOS = 50;

  /** @type {{ id: string, file: File, url: string }[]} */
  const photos = [];

  let els;

  function init() {
    els = {
      dropzone: document.getElementById("dropzone"),
      input: document.getElementById("photo-input"),
      grid: document.getElementById("photo-grid"),
      count: document.getElementById("photo-count"),
      empty: document.getElementById("empty-state"),
      status: document.getElementById("upload-status"),
      clearAll: document.getElementById("clear-all"),
      maxSize: document.getElementById("max-size"),
    };
    if (!els.dropzone) return;

    els.maxSize.textContent = MAX_FILE_MB;

    els.input.addEventListener("change", function () {
      addFiles(els.input.files);
      els.input.value = ""; // let the same file be chosen again after removal
    });

    ["dragenter", "dragover"].forEach(function (type) {
      els.dropzone.addEventListener(type, function (e) {
        e.preventDefault();
        els.dropzone.classList.add("is-dragging");
      });
    });
    ["dragleave", "drop"].forEach(function (type) {
      els.dropzone.addEventListener(type, function (e) {
        e.preventDefault();
        els.dropzone.classList.remove("is-dragging");
      });
    });
    els.dropzone.addEventListener("drop", function (e) {
      addFiles(e.dataTransfer.files);
    });

    els.grid.addEventListener("click", function (e) {
      const btn = e.target.closest("[data-remove]");
      if (btn) removePhoto(btn.dataset.remove);
    });

    els.clearAll.addEventListener("click", function () {
      photos.splice(0).forEach(function (p) { URL.revokeObjectURL(p.url); });
      render();
      setStatus("All photos removed.");
    });
  }

  function addFiles(fileList) {
    const skipped = [];
    let added = 0;

    Array.from(fileList).forEach(function (file) {
      if (!isImage(file)) {
        skipped.push(file.name + " (not an image)");
      } else if (file.size > MAX_FILE_MB * 1024 * 1024) {
        skipped.push(file.name + " (over " + MAX_FILE_MB + " MB)");
      } else if (photos.length >= MAX_PHOTOS) {
        skipped.push(file.name + " (limit of " + MAX_PHOTOS + " photos reached)");
      } else {
        photos.push({ id: makeId(), file: file, url: URL.createObjectURL(file) });
        added++;
      }
    });

    render();

    let msg = added ? "Added " + added + " photo" + (added === 1 ? "" : "s") + "." : "";
    if (skipped.length) msg += " Skipped: " + skipped.join(", ") + ".";
    setStatus(msg.trim(), skipped.length > 0);
  }

  function removePhoto(id) {
    const i = photos.findIndex(function (p) { return p.id === id; });
    if (i === -1) return;
    const [removed] = photos.splice(i, 1);
    URL.revokeObjectURL(removed.url);
    render();
    setStatus("Removed " + removed.file.name + ".");
  }

  function render() {
    els.grid.replaceChildren.apply(els.grid, photos.map(photoCard));
    els.count.textContent = photos.length;
    els.empty.hidden = photos.length > 0;
    els.clearAll.hidden = photos.length === 0;
  }

  function photoCard(photo) {
    const li = document.createElement("li");
    li.className = "photo-card";

    const img = document.createElement("img");
    img.src = photo.url;
    img.alt = "Photo: " + photo.file.name;
    img.loading = "lazy";
    // Most browsers other than Safari can't display HEIC (iPhone) photos.
    // Keep the file, but show a placeholder instead of a broken image.
    img.addEventListener("error", function () {
      const fallback = document.createElement("div");
      fallback.className = "no-preview";
      fallback.textContent = "Preview not available in this browser";
      img.replaceWith(fallback);
    });

    const info = document.createElement("div");
    info.className = "photo-info";

    const name = document.createElement("p");
    name.className = "photo-name";
    name.textContent = photo.file.name; // textContent, never innerHTML, for user-supplied names

    const size = document.createElement("p");
    size.className = "photo-size";
    size.textContent = formatSize(photo.file.size);

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "photo-remove";
    remove.dataset.remove = photo.id;
    remove.textContent = "Remove";
    remove.setAttribute("aria-label", "Remove " + photo.file.name);

    info.append(name, size, remove);
    li.append(img, info);
    return li;
  }

  /* ---------- Helpers ---------- */
  function isImage(file) {
    // Some browsers report HEIC (iPhone) photos with an empty type, so fall back to the extension.
    return file.type.startsWith("image/") || /\.(heic|heif)$/i.test(file.name);
  }

  function formatSize(bytes) {
    return bytes < 1024 * 1024
      ? Math.round(bytes / 1024) + " KB"
      : (bytes / (1024 * 1024)).toFixed(1) + " MB";
  }

  function makeId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function setStatus(msg, isWarning) {
    els.status.textContent = msg;
    els.status.classList.toggle("is-warning", Boolean(isWarning));
  }

  document.addEventListener("DOMContentLoaded", init);
})();
