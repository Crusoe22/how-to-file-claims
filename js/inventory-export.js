/* =========================================================
   Home Inventory: CSV / PDF export (inventory.html)
   Everything runs in the browser; nothing is uploaded.
   Exposes window.InventoryExport, used by inventory.js.

   An "item" here is:
   { category, item_name, description, estimated_value_low,
     estimated_value_high, confidence, notes, fileName, thumb }
   where `thumb` is a small JPEG data URL (or null).
   ========================================================= */

(function () {
  "use strict";

  // Same order as CATEGORIES in server.js. Keep the two lists in sync.
  const CATEGORY_ORDER = [
    "Jewelry & Watches",
    "Electronics",
    "Art & Collectibles",
    "Furniture",
    "Appliances",
    "Designer Clothing & Accessories",
    "Musical Instruments",
    "Sporting Goods & Tools",
    "Other",
  ];

  const DISCLAIMER =
    "Values are AI-generated estimates based on photos, not professional appraisals. " +
    "Your insurer may require receipts or appraisals for high-value items.";

  // jsPDF is large (~400 KB), so it's only loaded the first time someone exports a PDF.
  const PDF_SCRIPTS = ["js/vendor/jspdf.umd.min.js", "js/vendor/jspdf.plugin.autotable.min.js"];

  /* ---------- Grouping & totals ---------- */

  /** Sort items by category order, then name. Returns [{ category, items, low, high }]. */
  function groupByCategory(items) {
    const groups = new Map();
    items.forEach(function (item) {
      const cat = CATEGORY_ORDER.includes(item.category) ? item.category : "Other";
      if (!groups.has(cat)) groups.set(cat, []);
      groups.get(cat).push(item);
    });

    return CATEGORY_ORDER.filter(function (cat) { return groups.has(cat); }).map(function (cat) {
      const list = groups.get(cat).slice().sort(function (a, b) {
        return a.item_name.localeCompare(b.item_name);
      });
      return { category: cat, items: list, low: sum(list, "estimated_value_low"), high: sum(list, "estimated_value_high") };
    });
  }

  function totals(items) {
    return { count: items.length, low: sum(items, "estimated_value_low"), high: sum(items, "estimated_value_high") };
  }

  function sum(list, key) {
    return list.reduce(function (acc, item) { return acc + (Number(item[key]) || 0); }, 0);
  }

  /* ---------- CSV ---------- */

  function toCSV(items) {
    const header = [
      "Category", "Item", "Description", "Estimated Value Low (USD)",
      "Estimated Value High (USD)", "Confidence", "Notes", "Photo File",
    ];
    const rows = [header];
    groupByCategory(items).forEach(function (group) {
      group.items.forEach(function (item) {
        rows.push([
          group.category, item.item_name, item.description,
          item.estimated_value_low, item.estimated_value_high,
          item.confidence, item.notes, item.fileName,
        ]);
      });
    });
    return rows.map(function (row) { return row.map(csvCell).join(","); }).join("\r\n");
  }

  function csvCell(value) {
    if (typeof value === "number") return String(value);
    let s = value == null ? "" : String(value);
    // Stop spreadsheet apps from running text that starts like a formula.
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  function downloadCSV(items) {
    // The BOM makes Excel read the file as UTF-8 so symbols display correctly.
    const blob = new Blob(["﻿" + toCSV(items)], { type: "text/csv;charset=utf-8" });
    triggerDownload(blob, fileName("csv"));
  }

  /* ---------- PDF ---------- */

  /**
   * @param {Object[]} items
   * @param {{ preparedFor?: string, policyNumber?: string }} meta
   */
  async function downloadPDF(items, meta) {
    await loadScripts(PDF_SCRIPTS);
    const doc = buildPDF(items, meta || {}, window.jspdf.jsPDF);
    doc.save(fileName("pdf"));
  }

  function buildPDF(items, meta, JsPDF) {
    const doc = new JsPDF({ unit: "pt", format: "letter" });
    const margin = 48;
    const pageWidth = doc.internal.pageSize.getWidth();
    const groups = groupByCategory(items);
    const all = totals(items);
    const autoTable = getAutoTable(doc);

    // Title block
    let y = margin + 8;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(28, 39, 51);
    doc.text("Home Inventory", margin, y);

    y += 22;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10.5);
    doc.setTextColor(85, 99, 111);
    const details = [];
    if (meta.preparedFor) details.push("Prepared for: " + meta.preparedFor);
    if (meta.policyNumber) details.push("Policy number: " + meta.policyNumber);
    details.push("Date: " + new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }));
    details.push("Items: " + all.count + "   |   Total estimated value: " + rangeText(all.low, all.high));
    details.forEach(function (line) {
      doc.text(line, margin, y);
      y += 15;
    });

    // Summary by category
    y += 6;
    autoTable({
      startY: y,
      margin: { left: margin, right: margin, bottom: margin + 24 },
      head: [["Category", "Items", "Estimated value"]],
      body: groups.map(function (g) { return [g.category, String(g.items.length), rangeText(g.low, g.high)]; }),
      foot: [["Total", String(all.count), rangeText(all.low, all.high)]],
      theme: "grid",
      headStyles: { fillColor: [11, 94, 168] },
      footStyles: { fillColor: [238, 243, 247], textColor: [28, 39, 51] },
      styles: { fontSize: 10 },
      columnStyles: { 1: { halign: "center", cellWidth: 60 }, 2: { halign: "right", cellWidth: 150 } },
    });

    // One table per category
    const PHOTO = 64;
    groups.forEach(function (group) {
      let startY = doc.lastAutoTable.finalY + 30;
      // Keep the heading with at least its table header + first item (photo row).
      const needed = 8 + 24 + (PHOTO + 10) + 10;
      if (startY + needed > doc.internal.pageSize.getHeight() - (margin + 24)) {
        doc.addPage();
        startY = margin + 8;
      }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.setTextColor(15, 138, 122);
      doc.text(group.category + "  (" + group.items.length + ")", margin, startY);

      autoTable({
        startY: startY + 8,
        margin: { left: margin, right: margin, bottom: margin + 24 },
        head: [["Photo", "Item", "Details", "Est. value"]],
        body: group.items.map(function (item) {
          const details = [item.description];
          if (item.notes) details.push("Note: " + item.notes);
          details.push("Confidence: " + item.confidence + "   |   File: " + item.fileName);
          return ["", item.item_name, details.join("\n\n"), rangeText(item.estimated_value_low, item.estimated_value_high)];
        }),
        theme: "grid",
        rowPageBreak: "avoid", // never split an item (and its photo) across two pages
        headStyles: { fillColor: [11, 94, 168] },
        styles: { fontSize: 9, valign: "top", cellPadding: 5 },
        columnStyles: {
          0: { cellWidth: PHOTO + 10, minCellHeight: PHOTO + 10 },
          1: { cellWidth: 110, fontStyle: "bold" },
          3: { cellWidth: 85, halign: "right" },
        },
        didDrawCell: function (data) {
          if (data.section !== "body" || data.column.index !== 0) return;
          const item = group.items[data.row.index];
          if (!item || !item.thumb) return;
          try {
            doc.addImage(item.thumb, "JPEG", data.cell.x + 5, data.cell.y + 5, PHOTO, PHOTO);
          } catch (e) {
            // A bad thumbnail shouldn't stop the whole export.
          }
        },
      });
    });

    // Footer on every page: disclaimer + page numbers
    const pageCount = doc.getNumberOfPages();
    const pageHeight = doc.internal.pageSize.getHeight();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(120, 130, 140);
      doc.text(doc.splitTextToSize(DISCLAIMER, pageWidth - margin * 2 - 70), margin, pageHeight - margin + 6);
      doc.text("Page " + i + " of " + pageCount, pageWidth - margin, pageHeight - margin + 6, { align: "right" });
    }

    return doc;
  }

  /** Works with the AutoTable plugin whether it attaches to jsPDF or exposes a global function. */
  function getAutoTable(doc) {
    if (typeof doc.autoTable === "function") return function (opts) { return doc.autoTable(opts); };
    const g = window.jspdf_autotable || {};
    const fn = g.autoTable || g.default;
    if (typeof fn === "function") return function (opts) { return fn(doc, opts); };
    throw new Error("PDF table plugin failed to load.");
  }

  /* ---------- Helpers ---------- */

  const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

  function rangeText(low, high) {
    if (!low && !high) return "Unknown";
    return low === high ? usd.format(low) : usd.format(low) + " - " + usd.format(high);
  }

  function fileName(ext) {
    const d = new Date();
    const pad = function (n) { return String(n).padStart(2, "0"); };
    return "home-inventory-" + d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) + "." + ext;
  }

  function triggerDownload(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  const loaded = {};
  function loadScripts(srcs) {
    return srcs.reduce(function (chain, src) {
      return chain.then(function () {
        if (!loaded[src]) {
          loaded[src] = new Promise(function (resolve, reject) {
            const s = document.createElement("script");
            s.src = src;
            s.onload = resolve;
            s.onerror = function () {
              delete loaded[src];
              reject(new Error("Couldn't load the PDF tool. Check your connection and try again."));
            };
            document.head.appendChild(s);
          });
        }
        return loaded[src];
      });
    }, Promise.resolve());
  }

  window.InventoryExport = {
    CATEGORY_ORDER: CATEGORY_ORDER,
    groupByCategory: groupByCategory,
    totals: totals,
    rangeText: rangeText,
    toCSV: toCSV,
    downloadCSV: downloadCSV,
    downloadPDF: downloadPDF,
    buildPDF: buildPDF, // exposed for testing
  };
})();
