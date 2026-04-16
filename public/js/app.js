/* ============================================================
   SVPM Alumni Platform — Frontend JS
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {

  /* ---- Auto-dismiss flash toasts ---- */
  const toasts = document.querySelectorAll('[id^="toast-"]');
  toasts.forEach(t => {
    setTimeout(() => {
      t.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
      t.style.opacity = '0';
      t.style.transform = 'translateX(20px)';
      setTimeout(() => t.remove(), 500);
    }, 4000);
  });

  /* ---- Mobile sidebar toggle ---- */
  const menuBtn = document.getElementById('mobile-menu-btn');
  const mobileMenu = document.getElementById('mobile-menu');
  if (menuBtn && mobileMenu) {
    menuBtn.addEventListener('click', () => mobileMenu.classList.toggle('hidden'));
    document.addEventListener('click', e => {
      if (!menuBtn.contains(e.target) && !mobileMenu.contains(e.target)) {
        mobileMenu.classList.add('hidden');
      }
    });
  }

  /* ---- Confirm delete buttons ---- */
  document.querySelectorAll('[data-confirm]').forEach(btn => {
    btn.addEventListener('click', e => {
      if (!confirm(btn.dataset.confirm)) e.preventDefault();
    });
  });

  /* ---- Password strength meter ---- */
  const pwdInput = document.getElementById('pwd');
  const strengthBar = document.getElementById('pwd-strength');
  if (pwdInput && strengthBar) {
    pwdInput.addEventListener('input', () => {
      const v = pwdInput.value;
      let score = 0;
      if (v.length >= 8) score++;
      if (/[A-Z]/.test(v)) score++;
      if (/[0-9]/.test(v)) score++;
      if (/[^A-Za-z0-9]/.test(v)) score++;
      const colors = ['bg-red-400', 'bg-orange-400', 'bg-yellow-400', 'bg-emerald-500'];
      const labels = ['Weak', 'Fair', 'Good', 'Strong'];
      strengthBar.style.width = `${score * 25}%`;
      strengthBar.className = `h-full rounded-full transition-all ${colors[score - 1] || 'bg-gray-200'}`;
      const label = document.getElementById('pwd-strength-label');
      if (label) label.textContent = labels[score - 1] || '';
    });
  }

  /* ---- Avatar preview ---- */
  const avatarInput = document.getElementById('avatar-input');
  const avatarPreview = document.getElementById('avatar-preview');
  if (avatarInput && avatarPreview) {
    avatarInput.addEventListener('change', () => {
      const file = avatarInput.files[0];
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) {
        alert('File size exceeds 5MB limit');
        avatarInput.value = '';
        return;
      }
      const reader = new FileReader();
      reader.onload = e => {
        avatarPreview.innerHTML = `<img src="${e.target.result}" class="w-full h-full object-cover rounded-2xl" />`;
      };
      reader.readAsDataURL(file);
    });
  }

  /* ---- Copy to clipboard ---- */
  document.querySelectorAll('[data-copy]').forEach(btn => {
    btn.addEventListener('click', () => {
      navigator.clipboard.writeText(btn.dataset.copy).then(() => {
        const orig = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-check mr-1"></i>Copied!';
        setTimeout(() => btn.innerHTML = orig, 2000);
      });
    });
  });

  /* ---- Animate numbers (stats) ---- */
  const animateValue = (el, start, end, duration) => {
    const range = end - start;
    const step = Math.ceil(range / (duration / 16));
    let current = start;
    const timer = setInterval(() => {
      current += step;
      if (current >= end) { current = end; clearInterval(timer); }
      el.textContent = current.toLocaleString('en-IN');
    }, 16);
  };

  document.querySelectorAll('[data-animate-count]').forEach(el => {
    const target = parseInt(el.dataset.animateCount, 10);
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          animateValue(el, 0, target, 800);
          observer.disconnect();
        }
      });
    });
    observer.observe(el);
  });

});

/* ---- Global fetch helper with CSRF-safe headers ---- */
window.apiFetch = async (url, options = {}) => {
  const defaults = {
    headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
    credentials: 'same-origin'
  };
  const merged = { ...defaults, ...options, headers: { ...defaults.headers, ...(options.headers || {}) } };
  const res = await fetch(url, merged);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

/* ---- Show/hide loading overlay ---- */
window.showLoading = (msg = 'Loading...') => {
  let overlay = document.getElementById('global-loading');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'global-loading';
    overlay.className = 'fixed inset-0 bg-black/40 flex items-center justify-center z-[9999] backdrop-blur-sm';
    overlay.innerHTML = `<div class="bg-white rounded-2xl px-8 py-6 flex items-center gap-4 shadow-2xl">
      <i class="fa-solid fa-spinner fa-spin text-2xl text-blue-600"></i>
      <span class="font-semibold text-gray-700">${msg}</span>
    </div>`;
    document.body.appendChild(overlay);
  }
};

window.hideLoading = () => {
  document.getElementById('global-loading')?.remove();
};
