/**
 * PDF-like preview helpers (no extra deps).
 * Renders ATS plain text as a letter-size HTML page; print → Save as PDF.
 */

export function resumeHtmlDocument(opts: {
  plainText: string;
  title?: string;
  subtitle?: string;
  fontFamily?: string;
}): string {
  // Match sample resume: Trebuchet MS / Arial (never decorative fonts)
  const font =
    opts.fontFamily ||
    '"Trebuchet MS", Arial, Helvetica, sans-serif';
  const title = escapeHtml(opts.title || "Resume");
  const sub = opts.subtitle ? escapeHtml(opts.subtitle) : "";
  const body = escapeHtml(opts.plainText || "").replace(/\n/g, "<br/>");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <style>
    @page { size: letter; margin: 0.6in; }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      background: #e8e8e8;
      font-family: ${font};
      font-size: 11pt;
      line-height: 1.35;
      color: #111;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .toolbar {
      position: sticky;
      top: 0;
      z-index: 10;
      display: flex;
      gap: 8px;
      align-items: center;
      justify-content: space-between;
      padding: 10px 16px;
      background: #111;
      color: #fff;
      font-family: system-ui, sans-serif;
      font-size: 13px;
    }
    .toolbar button {
      background: #fff;
      color: #111;
      border: 0;
      border-radius: 999px;
      padding: 6px 14px;
      font-weight: 600;
      cursor: pointer;
    }
    .page {
      width: 8.5in;
      min-height: 11in;
      margin: 16px auto;
      padding: 0.65in 0.7in;
      background: #fff;
      box-shadow: 0 8px 30px rgba(0,0,0,0.15);
    }
    .meta {
      font-size: 10px;
      color: #666;
      margin-bottom: 12px;
      font-family: system-ui, sans-serif;
    }
    .content {
      white-space: pre-wrap;
      word-wrap: break-word;
    }
    @media print {
      html, body { background: #fff; }
      .toolbar { display: none !important; }
      .page {
        width: auto;
        min-height: auto;
        margin: 0;
        padding: 0;
        box-shadow: none;
      }
      .meta { display: none; }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <span>${title}${sub ? " · " + sub : ""}</span>
    <button onclick="window.print()">Print / Save as PDF</button>
  </div>
  <div class="page">
    ${sub ? `<div class="meta">${sub}</div>` : ""}
    <div class="content">${body}</div>
  </div>
</body>
</html>`;
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Open print-ready resume in a new tab (user can Save as PDF). */
export function openResumePdfPreview(opts: {
  plainText: string;
  title?: string;
  subtitle?: string;
  fontFamily?: string;
}) {
  const html = resumeHtmlDocument(opts);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const w = window.open(url, "_blank", "noopener,noreferrer");
  if (!w) {
    // popup blocked — navigate same tab fallback
    window.location.href = url;
  }
  // revoke later
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return url;
}

/** Blob URL for iframe embed (caller should revoke). */
export function resumePreviewBlobUrl(opts: {
  plainText: string;
  title?: string;
  subtitle?: string;
  fontFamily?: string;
}): string {
  const html = resumeHtmlDocument(opts);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  return URL.createObjectURL(blob);
}

function safeFileBase(name: string): string {
  return (name || "Resume")
    .replace(/\s+/g, "_")
    .replace(/[^\w.-]/g, "")
    .slice(0, 80) || "Resume";
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** Download plain-text ATS resume (.txt) */
export function downloadResumeTxt(opts: {
  plainText: string;
  fileName?: string;
}) {
  const base = safeFileBase(opts.fileName || "Resume");
  const blob = new Blob([opts.plainText || ""], {
    type: "text/plain;charset=utf-8",
  });
  triggerDownload(blob, `${base}.txt`);
}

/**
 * Download letter-formatted HTML (Trebuchet/Arial).
 * Open in browser → Print → Save as PDF for a real PDF file.
 */
export function downloadResumeHtml(opts: {
  plainText: string;
  title?: string;
  subtitle?: string;
  fontFamily?: string;
  fileName?: string;
}) {
  const base = safeFileBase(opts.fileName || opts.title || "Resume");
  const html = resumeHtmlDocument(opts);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  triggerDownload(blob, `${base}.html`);
}

/**
 * Open print dialog immediately so user can Save as PDF.
 * Browsers cannot write a real .pdf without extra libs; print is the reliable path.
 */
export function downloadResumePdfViaPrint(opts: {
  plainText: string;
  title?: string;
  subtitle?: string;
  fontFamily?: string;
}) {
  const html = resumeHtmlDocument(opts);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const w = window.open(url, "_blank", "noopener,noreferrer");
  if (w) {
    // Wait for document load then print
    const tryPrint = () => {
      try {
        w.focus();
        w.print();
      } catch {
        /* user can use toolbar button */
      }
    };
    // Some browsers need a short delay
    setTimeout(tryPrint, 400);
    setTimeout(() => URL.revokeObjectURL(url), 120_000);
  } else {
    // Popup blocked — download HTML instead
    downloadResumeHtml(opts);
  }
}
