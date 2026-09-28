const paths = {
  home: '<path d="M3.5 10.5 12 3.8l8.5 6.7v8.7a1.8 1.8 0 0 1-1.8 1.8H5.3a1.8 1.8 0 0 1-1.8-1.8Z"/><path d="M9 21v-6h6v6"/>',
  wallet: '<path d="M4 6.5h14.5A1.5 1.5 0 0 1 20 8v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6.8A2.8 2.8 0 0 1 5.8 4H17"/><path d="M15 11h6v5h-6a2.5 2.5 0 0 1 0-5Z"/>',
  list: '<path d="M8 6h12M8 12h12M8 18h12"/><path d="M4 6h.01M4 12h.01M4 18h.01"/>',
  chart: '<path d="M4 19V9M10 19V5M16 19v-7M22 19V3"/>',
  receipt: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2Z"/><path d="M9 8h6M9 12h6"/>',
  target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M17.7 6.3 21 3M17 3h4v4"/>',
  'credit-card': '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h3"/>',
  sparkles: '<path d="m12 3 1.2 3.3L16.5 7.5l-3.3 1.2L12 12l-1.2-3.3-3.3-1.2 3.3-1.2Z"/><path d="m18 13 .9 2.1L21 16l-2.1.9L18 19l-.9-2.1L15 16l2.1-.9Z"/><path d="m6 14 .8 2.2L9 17l-2.2.8L6 20l-.8-2.2L3 17l2.2-.8Z"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V21h-4v-.1A1.7 1.7 0 0 0 9 19.3a1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1A1.7 1.7 0 0 0 4.6 15 1.7 1.7 0 0 0 3 14H3v-4h.1A1.7 1.7 0 0 0 4.7 9 1.7 1.7 0 0 0 4.4 7L4.3 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6 1.7 1.7 0 0 0 10 3h4a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9A1.7 1.7 0 0 0 21 10h.1v4H21a1.7 1.7 0 0 0-1.6 1Z"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  eye: '<path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.5"/>',
  'eye-off': '<path d="M3 3l18 18"/><path d="M10.6 6.2A10.8 10.8 0 0 1 12 6c6 0 9.5 6 9.5 6a15.6 15.6 0 0 1-3.1 3.8M6.1 6.1C3.8 7.8 2.5 12 2.5 12s3.5 6 9.5 6a9.9 9.9 0 0 0 4-.8"/><path d="M9.9 9.9A3 3 0 0 0 14.1 14.1"/>',
  'sun-moon': '<circle cx="9" cy="9" r="4"/><path d="M9 2v1M9 15v1M2 9h1M15 9h1M4 4l.7.7M13.3 13.3l.7.7M14 4l-.7.7M4.7 13.3 4 14"/><path d="M15.5 18.5A5.5 5.5 0 0 0 21 13a6.5 6.5 0 0 1-8.5 8.5 5.5 5.5 0 0 0 3-3Z"/>',
  'chevron-down': '<path d="m7 10 5 5 5-5"/>',
  'chevron-right': '<path d="m9 6 6 6-6 6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  'arrow-up-right': '<path d="M7 17 17 7M9 7h8v8"/>',
  'arrow-down-left': '<path d="M17 7 7 17M15 17H7V9"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  'piggy-bank': '<path d="M5 11a7 7 0 0 1 13.2-2H21v4h-2a7 7 0 0 1-1.5 3.5L18 20h-3l-.5-2H9.5L9 20H6l.5-3A7 7 0 0 1 5 11Z"/><path d="M9 8V5.5c2-.7 4-.7 6 0V8M16 11h.01"/>',
  banknote: '<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M7 9h.01M17 15h.01"/>',
  'heart-pulse': '<path d="M20.8 5.7a5 5 0 0 0-7.1 0L12 7.4l-1.7-1.7a5 5 0 0 0-7.1 7.1L12 21l8.8-8.2a5 5 0 0 0 0-7.1Z"/><path d="M3.5 12h4l1.5-3 2.5 6 1.5-3h7.5"/>',
  wifi: '<path d="M5 10a11 11 0 0 1 14 0M8 13a6.5 6.5 0 0 1 8 0M11 16a2.3 2.3 0 0 1 2 0M12 19h.01"/>',
  basket: '<path d="M4 9h16l-1.5 10h-13Z"/><path d="m8 9 4-5 4 5M8 13v2M12 13v2M16 13v2"/>',
  train: '<rect x="6" y="3" width="12" height="15" rx="3"/><path d="M9 18 7 21M15 18l2 3M8.5 8h7M9 14h.01M15 14h.01"/>',
  utensils: '<path d="M7 3v8M4 3v5a3 3 0 0 0 6 0V3M7 11v10M16 3v18M16 3c3 2 4 5 4 8h-4"/>',
  smartphone: '<rect x="6" y="2" width="12" height="20" rx="2"/><path d="M10 5h4M11 18h2"/>',
  repeat: '<path d="m17 2 4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3"/>',
  shield: '<path d="M12 3 5 6v5c0 4.7 2.8 8.2 7 10 4.2-1.8 7-5.3 7-10V6Z"/><path d="m9 12 2 2 4-4"/>',
  'layout-grid': '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
};

export function icon(name, { size = 24, className = '' } = {}) {
  const body = paths[name] || paths.info;
  return `<svg class="${className}" viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true">${body}</svg>`;
}

export function hydrateStaticIcons(root = document) {
  root.querySelectorAll('[data-icon]').forEach((el) => {
    el.innerHTML = icon(el.dataset.icon);
  });
}
