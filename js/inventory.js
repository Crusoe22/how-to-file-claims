/* =========================================================
   Home Inventory (inventory.html)
   - Photo intake: kept in memory only, cleared on refresh.
   - "Analyze": shrinks the photo in the browser, sends it to
     our server (POST /api/analyze), which asks Claude to identify
     the item and estimate its value. Requires `npm start`.
   ========================================================= */

(function () {
  "use strict";

  const MAX_FILE_MB = 15;
  const MAX_PHOTOS = 50;
  const ANALYZE_MAX_EDGE = 1568; // px; larger images cost more without helping accuracy
  const ANALYZE_QUALITY = 0.85;  // JPEG quality for the copy sent to the server
  const THUMB_SIZE = 240;        // px; square thumbnail used in the PDF export

  /**
   * @typedef {Object} Photo
   * @property {string} id
   * @property {File} file
   * @property {string} url                 object URL for the preview
   * @property {"idle"|"loading"|"done"|"error"} status
   * @property {Object|null} result          analysis from /api/analyze
   * @property {string|null} thumb           small JPEG data URL, set after analysis (for PDF)
   * @property {string} error
   */
  /** @type {Photo[]} */
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
      exportSection: document.getElementById("export-section"),
      exportSummary: document.getElementById("export-summary"),
      exportPending: document.getElementById("export-pending"),
      exportCsv: document.getElementById("export-csv"),
      exportPdf: document.getElementById("export-pdf"),
      preparedFor: document.getElementById("prepared-for"),
      policyNumber: document.getElementById("policy-number"),
    };
    if (!els.dropzone) return;

    els.exportCsv.addEventListener("click", function () {
      const items = analyzedItems();
      if (!items.length) return;
      window.InventoryExport.downloadCSV(items);
      setStatus("Downloaded a spreadsheet with " + items.length + " item" + (items.length === 1 ? "" : "s") + ".");
    });

    els.exportPdf.addEventListener("click", async function () {
      const items = analyzedItems();
      if (!items.length) return;
      els.exportPdf.disabled = true;
      els.exportPdf.textContent = "Creating PDF…";
      try {
        await window.InventoryExport.downloadPDF(items, {
          preparedFor: els.preparedFor.value.trim(),
          policyNumber: els.policyNumber.value.trim(),
        });
        setStatus("Downloaded a PDF with " + items.length + " item" + (items.length === 1 ? "" : "s") + ".");
      } catch (err) {
        console.error(err);
        setStatus(err.message || "Couldn't create the PDF. Please try again.", true);
      } finally {
        els.exportPdf.textContent = "Download PDF";
        renderExport();
      }
    });

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
      const removeBtn = e.target.closest("[data-remove]");
      if (removeBtn) return removePhoto(removeBtn.dataset.remove);

      const analyzeBtn = e.target.closest("[data-analyze]");
      if (analyzeBtn) analyzePhoto(analyzeBtn.dataset.analyze);
    });

    els.clearAll.addEventListener("click", function () {
      photos.splice(0).forEach(function (p) { URL.revokeObjectURL(p.url); });
      render();
      setStatus("All photos removed.");
    });
  }

  /* ---------- Adding and removing photos ---------- */
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
        photos.push({
          id: makeId(),
          file: file,
          url: URL.createObjectURL(file),
          status: "idle",
          result: null,
          thumb: null,
          error: "",
        });
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

  /* ---------- AI analysis ---------- */
  async function analyzePhoto(id) {
    const photo = findPhoto(id);
    if (!photo || photo.status === "loading") return;

    photo.status = "loading";
    photo.error = "";
    render();

    try {
      const image = await prepareImage(photo.file);
      const response = await fetch("api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mediaType: image.mediaType, data: image.data }),
      });
      const body = await response.json().catch(function () { return null; });

      if (!response.ok) {
        throw new Error(
          (body && body.error) ||
          (response.status === 404 || response.status === 405 || response.status === 501
            ? "The AI server isn't running. Start the site with `npm start` (see README)."
            : "Something went wrong. Please try again.")
        );
      }
      photo.result = body;
      photo.thumb = image.thumb;
      photo.status = "done";
    } catch (err) {
      photo.status = "error";
      photo.error = err instanceof TypeError
        ? "Couldn't reach the server. Check your connection and try again."
        : err.message;
    }

    // The photo may have been removed while we waited.
    if (findPhoto(id)) {
      render();
      setStatus(
        photo.status === "done"
          ? "Analyzed " + photo.file.name + "."
          : "Couldn't analyze " + photo.file.name + ".",
        photo.status !== "done"
      );
    }
  }

  /**
   * Shrink the photo and re-encode it as JPEG before upload.
   * Re-encoding through a canvas also strips metadata like GPS location.
   * @returns {Promise<{mediaType: string, data: string}>} base64 without the data: prefix
   */
  async function prepareImage(file) {
    let bitmap;
    try {
      bitmap = await createImageBitmap(file);
    } catch (e) {
      throw new Error("This browser can't read this photo format (often iPhone HEIC). Please upload a JPG or PNG instead.");
    }

    const scale = Math.min(1, ANALYZE_MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);

    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff"; // transparent PNGs become white, not black
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    if (bitmap.close) bitmap.close();

    const dataUrl = canvas.toDataURL("image/jpeg", ANALYZE_QUALITY);

    // Small square copy (center-cropped) kept in the browser for the PDF export.
    // It is never sent to the server.
    const side = Math.min(canvas.width, canvas.height);
    const thumb = document.createElement("canvas");
    thumb.width = thumb.height = Math.min(THUMB_SIZE, side);
    thumb.getContext("2d").drawImage(
      canvas,
      (canvas.width - side) / 2, (canvas.height - side) / 2, side, side,
      0, 0, thumb.width, thumb.height
    );

    return {
      mediaType: "image/jpeg",
      data: dataUrl.slice(dataUrl.indexOf(",") + 1),
      thumb: thumb.toDataURL("image/jpeg", 0.75),
    };
  }

  /* ---------- Rendering ---------- */
  function render() {
    els.grid.replaceChildren.apply(els.grid, photos.map(photoCard));
    els.count.textContent = photos.length;
    els.empty.hidden = photos.length > 0;
    els.clearAll.hidden = photos.length === 0;
    renderExport();
  }

  /* ---------- Export section ---------- */
  function analyzedItems() {
    return photos
      .filter(function (p) { return p.status === "done" && p.result; })
      .map(function (p) {
        return Object.assign({}, p.result, { fileName: p.file.name, thumb: p.thumb });
      });
  }

  function renderExport() {
    const X = window.InventoryExport;
    const items = analyzedItems();
    const notAnalyzed = photos.length - items.length;

    els.exportSection.hidden = photos.length === 0;
    els.exportCsv.disabled = items.length === 0;
    els.exportPdf.disabled = items.length === 0;

    if (notAnalyzed > 0) {
      els.exportPending.textContent = items.length === 0
        ? "Analyze at least one photo to create an export."
        : notAnalyzed + " photo" + (notAnalyzed === 1 ? " hasn't" : "s haven't") +
          " been analyzed yet and won't be included.";
      els.exportPending.hidden = false;
    } else {
      els.exportPending.hidden = true;
    }

    if (!items.length) {
      els.exportSummary.replaceChildren();
      return;
    }

    const rows = X.groupByCategory(items).map(function (g) {
      const tr = document.createElement("tr");
      tr.append(el("td", "", g.category), el("td", "num", String(g.items.length)), el("td", "num", X.rangeText(g.low, g.high)));
      return tr;
    });
    const all = X.totals(items);
    const totalRow = document.createElement("tr");
    totalRow.className = "total-row";
    totalRow.append(el("th", "", "Total"), el("td", "num", String(all.count)), el("td", "num", X.rangeText(all.low, all.high)));
    totalRow.firstChild.setAttribute("scope", "row");

    const table = document.createElement("table");
    const thead = document.createElement("thead");
    const headRow = document.createElement("tr");
    ["Category", "Items", "Estimated value"].forEach(function (h, i) {
      const th = el("th", i ? "num" : "", h);
      th.setAttribute("scope", "col");
      headRow.append(th);
    });
    thead.append(headRow);
    const tbody = document.createElement("tbody");
    tbody.append.apply(tbody, rows);
    const tfoot = document.createElement("tfoot");
    tfoot.append(totalRow);
    table.append(thead, tbody, tfoot);

    const wrap = el("div", "table-wrap");
    wrap.append(table);
    els.exportSummary.replaceChildren(wrap);
  }

  function photoCard(photo) {
    const li = el("li", "photo-card");
    li.setAttribute("aria-busy", String(photo.status === "loading"));

    const img = document.createElement("img");
    img.src = photo.url;
    img.alt = photo.result ? photo.result.item_name : "Photo: " + photo.file.name;
    img.loading = "lazy";
    // Most browsers other than Safari can't display HEIC (iPhone) photos.
    // Keep the file, but show a placeholder instead of a broken image.
    img.addEventListener("error", function () {
      img.replaceWith(el("div", "no-preview", "Preview not available in this browser"));
    });

    const info = el("div", "photo-info");
    info.append(
      el("p", "photo-name", photo.file.name), // textContent only, never innerHTML
      el("p", "photo-size", formatSize(photo.file.size))
    );

    if (photo.status === "done" && photo.result) {
      info.append(resultBlock(photo.result));
    } else if (photo.status === "error") {
      info.append(el("p", "analysis-error", photo.error));
    }

    const actions = el("div", "photo-actions");

    const analyze = el("button", "btn btn-small");
    analyze.type = "button";
    analyze.dataset.analyze = photo.id;
    analyze.disabled = photo.status === "loading";
    analyze.textContent =
      photo.status === "loading" ? "Analyzing…" :
      photo.status === "done" ? "Analyze again" :
      photo.status === "error" ? "Try again" : "Analyze with AI";
    analyze.setAttribute("aria-label", analyze.textContent + ": " + photo.file.name);

    const remove = el("button", "photo-remove", "Remove");
    remove.type = "button";
    remove.dataset.remove = photo.id;
    remove.setAttribute("aria-label", "Remove " + photo.file.name);

    actions.append(analyze, remove);
    info.append(actions);
    li.append(img, info);
    return li;
  }

  function resultBlock(r) {
    const box = el("div", "analysis");
    box.append(
      el("p", "analysis-category", r.category),
      el("p", "analysis-name", r.item_name),
      el("p", "analysis-value", formatRange(r.estimated_value_low, r.estimated_value_high)),
      el("p", "analysis-confidence confidence-" + r.confidence, "Confidence: " + r.confidence),
      el("p", "analysis-description", r.description)
    );
    if (r.notes) box.append(el("p", "analysis-notes", "Tip: " + r.notes));
    box.append(el("p", "analysis-disclaimer", "AI estimate, not an appraisal."));
    return box;
  }

  /* ---------- Helpers ---------- */
  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function findPhoto(id) {
    return photos.find(function (p) { return p.id === id; });
  }

  function isImage(file) {
    // Some browsers report HEIC (iPhone) photos with an empty type, so fall back to the extension.
    return file.type.startsWith("image/") || /\.(heic|heif)$/i.test(file.name);
  }

  function formatSize(bytes) {
    return bytes < 1024 * 1024
      ? Math.round(bytes / 1024) + " KB"
      : (bytes / (1024 * 1024)).toFixed(1) + " MB";
  }

  const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
  function formatRange(low, high) {
    if (!low && !high) return "Value: unknown";
    return low === high ? "Est. " + usd.format(low) : "Est. " + usd.format(low) + " – " + usd.format(high);
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
