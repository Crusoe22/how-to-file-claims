/* =========================================================
   How to File Claims — site-wide JavaScript
   Plain JS, no dependencies. Loaded with `defer` on every page.
   ========================================================= */

(function () {
  "use strict";

  /* ---------- Mobile navigation toggle ---------- */
  function initNavToggle() {
    const toggle = document.querySelector(".nav-toggle");
    const nav = document.getElementById("site-nav");
    if (!toggle || !nav) return;

    toggle.addEventListener("click", function () {
      const isOpen = nav.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", String(isOpen));
    });
  }

  /* ---------- Highlight the current page in the nav ---------- */
  function markCurrentPage() {
    const current = window.location.pathname.split("/").pop() || "index.html";
    document.querySelectorAll(".site-nav a").forEach(function (link) {
      if (link.getAttribute("href") === current) {
        link.setAttribute("aria-current", "page");
      }
    });
  }

  /* ---------- Footer year ---------- */
  function setFooterYear() {
    const el = document.getElementById("year");
    if (el) el.textContent = new Date().getFullYear();
  }

  /* ---------- Resource table filter (resources.html) ----------
     Buttons carry data-filter="all|health|auto|home|general".
     Table rows carry data-category="health auto" etc. */
  function initResourceFilter() {
    const bar = document.querySelector(".filter-bar");
    if (!bar) return;

    const buttons = bar.querySelectorAll("button[data-filter]");
    const rows = document.querySelectorAll("[data-category]");

    buttons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        const filter = btn.dataset.filter;

        buttons.forEach(function (b) {
          b.setAttribute("aria-pressed", String(b === btn));
        });

        rows.forEach(function (row) {
          const categories = row.dataset.category.split(" ");
          row.hidden = filter !== "all" && !categories.includes(filter);
        });
      });
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    initNavToggle();
    markCurrentPage();
    setFooterYear();
    initResourceFilter();
  });
})();
