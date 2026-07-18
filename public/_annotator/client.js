/* Feedback annotator — injected into proxied pages (runs inside the iframe). */
(function () {
  "use strict";

  // Only run in the topmost iframe we control (avoid running twice if re-injected).
  if (window.__feedbackAnnotator) return;
  window.__feedbackAnnotator = true;

  var script = document.currentScript;
  var TOKEN = script && script.getAttribute("data-token");
  var UPSTREAM_URL =
    (script && decodeURIComponent(script.getAttribute("data-upstream-url") || "")) ||
    location.href;

  function postToParent(type, payload) {
    try {
      window.parent.postMessage(
        Object.assign({ __annotator: true, type: type }, payload),
        location.origin
      );
    } catch (e) {}
  }

  function state() {
    return {
      token: TOKEN,
      pageUrl: UPSTREAM_URL,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      scrollX: window.scrollX,
      scrollY: window.scrollY,
    };
  }

  // ----- XPath computation (simple, robust for our purposes) -----
  function getXPathFor(el) {
    if (el.id) return '//*[@id="' + el.id + '"]';
    var parts = [];
    while (el && el.nodeType === 1) {
      var part = el.nodeName.toLowerCase();
      if (el.id) {
        parts.unshift('//*[@id="' + el.id + '"]');
        return parts.join("/");
      }
      var sib = el,
        nth = 1;
      while ((sib = sib.previousElementSibling)) {
        if (sib.nodeName === el.nodeName) nth++;
      }
      part += "[" + nth + "]";
      parts.unshift(part);
      el = el.parentElement;
    }
    return "/" + parts.join("/");
  }

  // ----- Element screenshot via html2canvas (loaded locally) -----
  function loadHtml2Canvas() {
    return new Promise(function (resolve, reject) {
      if (window.html2canvas) return resolve(window.html2canvas);
      var s = document.createElement("script");
      s.src = "/_annotator/html2canvas.min.js";
      s.onload = function () {
        if (window.html2canvas) resolve(window.html2canvas);
        else reject(new Error("html2canvas failed to initialize"));
      };
      s.onerror = function () {
        reject(new Error("html2canvas failed to load"));
      };
      document.head.appendChild(s);
    });
  }

  function captureElement(el) {
    return loadHtml2Canvas()
      .then(function (h2c) {
        return h2c(el, {
          backgroundColor: null,
          scale: 1,
          logging: false,
          useCORS: true,
          allowTaint: true,
        });
      })
      .then(function (canvas) {
        try {
          var dataUrl = canvas.toDataURL("image/jpeg", 0.7);
          // Truncate oversized data URLs to keep the DB row reasonable.
          if (dataUrl.length > 1_500_000) {
            // Downscale by re-drawing at lower scale.
            var c2 = document.createElement("canvas");
            var ratio = 0.5;
            c2.width = canvas.width * ratio;
            c2.height = canvas.height * ratio;
            var ctx = c2.getContext("2d");
            if (ctx) {
              ctx.drawImage(canvas, 0, 0, c2.width, c2.height);
              dataUrl = c2.toDataURL("image/jpeg", 0.6);
            }
          }
          return dataUrl;
        } catch (e) {
          return null;
        }
      })
      .catch(function () {
        return null;
      });
  }

  // ----- FAB (floating action button) -----
  var fab = document.createElement("button");
  fab.type = "button";
  fab.className = "__annotator-ui __annotator-fab";
  fab.textContent = "💬 Comment";
  var adding = false;
  fab.addEventListener("click", function () {
    adding = !adding;
    fab.setAttribute("data-active", String(adding));
    document.body.classList.toggle("__annotator-adding-mode", adding);
    fab.textContent = adding ? "✕ Cancel" : "💬 Comment";
  });
  function ensureFab() {
    if (!fab.parentElement) document.body.appendChild(fab);
  }

  // ----- Popover -----
  var popover = null;
  function closePopover() {
    if (popover) {
      popover.remove();
      popover = null;
    }
  }

  function openPopoverAt(x, y, target) {
    closePopover();
    var el = document.createElement("div");
    el.className = "__annotator-ui __annotator-popover";
    el.innerHTML =
      '<textarea placeholder="Describe the issue…"></textarea>' +
      '<div class="__annotator-capturing"></div>' +
      '<div class="__annotator-actions">' +
      '<button type="button" class="__annotator-cancel">Cancel</button>' +
      '<button type="button" class="__annotator-submit" disabled>Save</button>' +
      '</div>';
    document.body.appendChild(el);
    popover = el;

    // Position, clamp to viewport.
    el.style.left = Math.min(x, window.innerWidth - 300) + "px";
    el.style.top = Math.min(y, window.innerHeight - 220) + "px";

    var ta = el.querySelector("textarea");
    var submit = el.querySelector(".__annotator-submit");
    var cancel = el.querySelector(".__annotator-cancel");
    var capturing = el.querySelector(".__annotator-capturing");
    ta.focus();

    var submitted = false;
    cancel.addEventListener("click", closePopover);

    ta.addEventListener("input", function () {
      submit.disabled = ta.value.trim().length === 0;
    });

    function submitNow() {
      if (submitted) return;
      var text = ta.value.trim();
      if (!text) return;
      submitted = true;
      submit.disabled = true;
      ta.disabled = true;
      capturing.textContent = "Capturing screenshot…";

      var xpath = getXPathFor(target);
      captureElement(target).then(function (dataUrl) {
        capturing.textContent = "Saving…";
        var body = Object.assign({}, state(), {
          xpath: xpath,
          text: text,
          screenshotData: dataUrl,
        });
        fetch("/api/comments", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        })
          .then(function (r) {
            if (!r.ok) throw new Error("HTTP " + r.status);
            return r.json();
          })
          .then(function (comment) {
            postToParent("comment_added", { comment: comment });
            closePopover();
            // Exit adding mode after one comment (optional).
            adding = false;
            fab.setAttribute("data-active", "false");
            document.body.classList.remove("__annotator-adding-mode");
            fab.textContent = "💬 Comment";
          })
          .catch(function (err) {
            capturing.textContent = "Failed: " + err.message;
            submit.disabled = false;
            ta.disabled = false;
            submitted = false;
          });
      });
    }
    submit.addEventListener("click", submitNow);
    ta.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        submitNow();
      }
      if (e.key === "Escape") {
        e.preventDefault();
        closePopover();
      }
    });
  }

  // ----- Click handler -----
  document.addEventListener("click", function (e) {
    // Ignore clicks on our own UI.
    if (e.target === fab || (e.target && e.target.closest && e.target.closest(".__annotator-ui"))) {
      return;
    }
    if (!adding) return;
    e.preventDefault();
    e.stopPropagation();
    var target = e.target;
    if (!target || target.nodeType !== 1) return;
    openPopoverAt(e.clientX, e.clientY, target);
  }, true);

  // Intercept navigation so parent knows the new URL.
  // Full-page loads inside the iframe re-inject the annotator; we just
  // report the current upstream URL on load.
  document.addEventListener("submit", function () {
    // Forms will navigate the iframe; annotator reloads afterwards.
  }, true);

  // ----- Boot -----
  function boot() {
    ensureFab();
    postToParent("navigated", { url: UPSTREAM_URL });
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  // Re-assert on history changes (some SPAs do soft navigations without reload).
  window.addEventListener("popstate", function () {
    postToParent("navigated", { url: UPSTREAM_URL });
  });
})();
