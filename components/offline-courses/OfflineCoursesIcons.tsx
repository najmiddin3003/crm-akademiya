// Oflayn kurslar sahifalari ishlatadigan, lekin Sidebar/Navbar global sprite'ida
// BO'LMAGAN ikonkalar. Har bir sahifaning eng tepasida bir marta mount qilinadi.
// (i-search, i-file-plus, i-edit, i-chevron-down, i-book, i-arrow-left global
// sprite'dan keladi — ularni bu yerda takrorlamaymiz.)
// Path'lar crm-akademiya/index-dev.html sprite'idan 1:1 ko'chirilgan.
export default function OfflineCoursesIcons() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
      <defs>
        <symbol id="i-plus" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></symbol>
        <symbol id="i-more-vertical" viewBox="0 0 24 24"><circle cx="12" cy="5" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="19" r="1.5" /></symbol>
        <symbol id="i-trash" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" /></symbol>
        <symbol id="i-list" viewBox="0 0 24 24"><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></symbol>
      </defs>
    </svg>
  );
}
