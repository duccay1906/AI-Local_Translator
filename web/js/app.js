/**
 * AI Local Translator - Interactive Portal Logic
 * Version Sync, Tabs, Accordions, Copy Helpers, and Navigation
 */

document.addEventListener('DOMContentLoaded', () => {
  initI18n();
  initVersionSync();
  initNavigation();
  initTabs();
  initAccordions();
  initCopyHelpers();
  initMobileMenu();
});

let currentLang = localStorage.getItem('ai_translator_web_lang') || 'vi';

/**
 * Internationalization (i18n) Engine
 * Seamless bilingual switching between Vietnamese and English
 */
function initI18n() {
  setLanguage(currentLang);

  const toggleBtn = document.getElementById('lang-toggle-btn');
  const langMenu = document.getElementById('lang-menu');

  if (toggleBtn && langMenu) {
    toggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      langMenu.classList.toggle('open');
    });

    document.addEventListener('click', () => {
      langMenu.classList.remove('open');
    });

    langMenu.querySelectorAll('.lang-option').forEach((opt) => {
      opt.addEventListener('click', () => {
        const selected = opt.getAttribute('data-lang');
        if (selected) {
          setLanguage(selected);
          langMenu.classList.remove('open');
        }
      });
    });
  }
}

function setLanguage(lang) {
  if (typeof translations === 'undefined' || !translations[lang]) return;
  currentLang = lang;
  localStorage.setItem('ai_translator_web_lang', lang);
  document.documentElement.lang = lang;

  const dict = translations[lang];

  // Update plain text
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    if (dict[key] !== undefined) {
      el.textContent = dict[key];
    }
  });

  // Update HTML content
  document.querySelectorAll('[data-i18n-html]').forEach((el) => {
    const key = el.getAttribute('data-i18n-html');
    if (dict[key] !== undefined) {
      el.innerHTML = dict[key];
    }
  });

  // Update Current Lang Text in Header
  const currentLangText = document.getElementById('current-lang-text');
  if (currentLangText) {
    currentLangText.textContent = lang.toUpperCase();
  }

  // Update active state in dropdown
  document.querySelectorAll('.lang-option').forEach((opt) => {
    opt.classList.toggle('active', opt.getAttribute('data-lang') === lang);
  });
}

/**
 * Automatically fetch updates/version.json to keep version badges,
 * download buttons, release date, and changelogs up-to-date in real time.
 */
async function initVersionSync() {
  try {
    const res = await fetch('/updates/version.json', { cache: 'no-cache' });
    if (!res.ok) return;
    const data = await res.json();
    if (!data.version) return;

    // Update Version Badges
    document.querySelectorAll('.current-version-tag').forEach((el) => {
      el.textContent = `v${data.version}`;
    });

    // Update Release Date
    if (data.releaseDate) {
      document.querySelectorAll('.release-date-tag').forEach((el) => {
        el.textContent = data.releaseDate;
      });
    }

    // Update Download Links
    const setupBtn = document.getElementById('btn-download-setup');
    if (setupBtn && data.installerUrl) {
      setupBtn.href = `/updates/${encodeURIComponent(data.installerUrl)}`;
    }

    const portableBtn = document.getElementById('btn-download-portable');
    if (portableBtn && data.portableUrl) {
      portableBtn.href = `/updates/${encodeURIComponent(data.portableUrl)}`;
    }

    // Update Release Notes
    const changelogLatest = document.getElementById('changelog-latest-content');
    if (changelogLatest && data.releaseNotes) {
      changelogLatest.innerHTML = data.releaseNotes
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, '<br/>');
    }
  } catch (err) {
    console.warn('Could not sync version.json:', err);
  }
}

/**
 * Sticky Header & Active Nav Link Observer
 */
function initNavigation() {
  const header = document.querySelector('.site-header');
  window.addEventListener('scroll', () => {
    if (window.scrollY > 40) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  });

  const sections = document.querySelectorAll('section[id]');
  const navLinks = document.querySelectorAll('.nav-link');

  window.addEventListener('scroll', () => {
    let current = '';
    sections.forEach((section) => {
      const sectionTop = section.offsetTop - 120;
      if (window.scrollY >= sectionTop) {
        current = section.getAttribute('id');
      }
    });

    navLinks.forEach((link) => {
      link.classList.remove('active');
      if (link.getAttribute('href') === `#${current}`) {
        link.classList.add('active');
      }
    });
  });
}

/**
 * Installation Guide Tabs Switcher
 */
function initTabs() {
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  tabButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-tab');

      tabButtons.forEach((b) => b.classList.remove('active'));
      tabContents.forEach((c) => c.classList.remove('active'));

      btn.classList.add('active');
      const targetContent = document.getElementById(targetId);
      if (targetContent) {
        targetContent.classList.add('active');
      }
    });
  });
}

/**
 * Accordion Collapsible (Changelog & FAQs)
 */
function initAccordions() {
  const accordions = document.querySelectorAll('.accordion-header');
  accordions.forEach((header) => {
    header.addEventListener('click', () => {
      const item = header.parentElement;
      const isOpen = item.classList.contains('open');

      // Optional: close other items in the same accordion group
      const parent = item.parentElement;
      if (parent) {
        parent.querySelectorAll('.accordion-item').forEach((sibling) => {
          if (sibling !== item) sibling.classList.remove('open');
        });
      }

      item.classList.toggle('open', !isOpen);
    });
  });
}

/**
 * One-click Copy to Clipboard with Toast Notification
 */
function initCopyHelpers() {
  document.querySelectorAll('[data-copy]').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      const textToCopy = btn.getAttribute('data-copy');
      if (!textToCopy) return;

      try {
        await navigator.clipboard.writeText(textToCopy);
        showToast('Đã sao chép vào bộ nhớ tạm: ' + textToCopy);
        const originalText = btn.innerHTML;
        btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg> Đã chép!`;
        setTimeout(() => {
          btn.innerHTML = originalText;
        }, 2000);
      } catch (err) {
        console.error('Copy failed:', err);
      }
    });
  });
}

function showToast(msg) {
  let toast = document.getElementById('site-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'site-toast';
    toast.className = 'toast-notice';
    document.body.appendChild(toast);
  }
  toast.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg> <span>${msg}</span>`;
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, 2800);
}

/**
 * Mobile Navigation Menu Toggle
 */
function initMobileMenu() {
  const toggleBtn = document.querySelector('.mobile-toggle');
  const navMenu = document.querySelector('.nav-menu');

  if (toggleBtn && navMenu) {
    toggleBtn.addEventListener('click', () => {
      navMenu.classList.toggle('open');
    });

    navMenu.querySelectorAll('.nav-link').forEach((link) => {
      link.addEventListener('click', () => {
        navMenu.classList.remove('open');
      });
    });
  }
}
