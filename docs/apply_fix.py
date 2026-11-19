import os, sys
BASE = "https://yuku-friends.yukusocial-indonesia.workers.dev"
EDITS = {
 "src/layouts/MainLayout.tsx": [
  ("  // Halaman profil talent sudah punya tombol \"Ajukan Booking\" tetap di bawah layar, jadi menu bawah disembunyikan di sana.\n  const showBottomNav = currentPath !== '/talent/:id';",
   "  const HIDE_BOTTOM_NAV: string[] = ['/talent/:id', '/login', '/register', '/lupa-sandi', '/reset-sandi', '/ganti-sandi'];\n  const showBottomNav = !HIDE_BOTTOM_NAV.includes(currentPath);", 1),
  ("${showBottomNav ? 'pb-16 xl:pb-0' : ''}", "${showBottomNav ? 'pb-16 md:pb-0' : ''}", 1),
  ("      <SafetyPledgeBanner />", "      {currentPath !== '/' && <SafetyPledgeBanner />}", 1)],
 "src/layouts/MobileBottomNav.tsx": [
  ("import { Home, Search, Bookmark, Bell, User } from 'lucide-react';", "import { Home, Search, Bookmark, User } from 'lucide-react';", 1),
  ('className="xl:hidden fixed inset-x-0 bottom-0', 'className="md:hidden fixed inset-x-0 bottom-0', 1),
  ("  const openNotifications = () => {\n    if (!loggedIn) { onNavigate('/login'); return; }\n    window.scrollTo({ top: 0, behavior: 'smooth' });\n    window.dispatchEvent(new CustomEvent('yuku:open-notifications'));\n  };\n", "", 1),
  ("    window.scrollTo({ top: 0, behavior: 'smooth' });\n    window.dispatchEvent(new CustomEvent('yuku:open-menu'));", "    window.dispatchEvent(new CustomEvent('yuku:open-menu'));", 1),
  ("    { label: 'Notifikasi', route: null, icon: <Bell className={icon} />, onPress: openNotifications },\n", "", 1),
  ("      label: 'Pesanan',", "      label: role === 'admin' ? 'Admin' : role === 'talent' ? 'Dashboard' : 'Pesanan',", 1),
  ('<ul className="grid grid-cols-5">', '<ul className="grid grid-cols-4">', 1),
  ("gap-0.5 pt-2 pb-2.5 text-[11px] font-semibold", "gap-0.5 min-h-[56px] pt-2 pb-2.5 text-xs font-semibold", 1)],
 "src/layouts/Navbar.tsx": [
  ("max-h-[calc(100dvh-4.5rem)] overflow-y-auto", "max-h-[calc(100dvh-4.5rem-4rem)] md:max-h-[calc(100dvh-4.5rem)] overflow-y-auto", 1),
  ("text-left px-3 py-2.5 rounded-lg", "text-left px-3 py-3 rounded-lg", 7),
  ('className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"', 'className="p-2.5 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"', 1),
  ('className="px-2.5 py-2 text-xs font-semibold text-slate-700 hover:text-purple-900 rounded-lg transition-colors"', 'className="px-3 min-h-11 text-sm font-semibold text-slate-700 hover:text-purple-900 rounded-lg transition-colors"', 1),
  ('className="px-3 py-2 text-xs font-bold text-white bg-gradient-to-r from-purple-700 to-fuchsia-700 rounded-lg shadow-sm"', 'className="px-4 min-h-11 text-sm font-bold text-white bg-gradient-to-r from-purple-700 to-fuchsia-700 rounded-lg shadow-sm"', 1),
  ("w-full py-2.5 text-center text-sm font-bold", "w-full py-3 text-center text-sm font-bold", 3)],
 "src/layouts/Footer.tsx": [
  ("pt-16 pb-12 border-t border-purple-950", "pt-10 pb-8 md:pt-16 md:pb-12 border-t border-purple-950", 1),
  ("grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 pb-12 border-b", "grid grid-cols-2 lg:grid-cols-5 gap-x-6 gap-y-8 md:gap-10 pb-8 md:pb-12 border-b", 1),
  ('<div className="lg:col-span-2 space-y-4">', '<div className="col-span-2 space-y-4">', 1),
  ("          {/* Legal & Compliance Col */}\n          <div>", "          {/* Legal & Compliance Col */}\n          <div className=\"col-span-2 lg:col-span-1\">", 1),
  ("pt-8 flex flex-col md:flex-row", "pt-6 md:pt-8 flex flex-col md:flex-row", 1)],
 "src/components/home/HomeFaqSection.tsx": [
  ('<section className="py-20 bg-white', '<section className="py-10 md:py-20 bg-white', 1),
  ('<div className="text-center mb-12">', '<div className="text-center mb-8 md:mb-12">', 1),
  ("text-3xl font-extrabold text-[#1E0938] tracking-tight mb-3", "text-2xl md:text-3xl font-extrabold text-[#1E0938] tracking-tight mb-3", 1),
  ('className="border border-slate-200/90 rounded-xl overflow-hidden transition-colors"', "className={`border border-slate-200/90 rounded-xl overflow-hidden transition-colors ${idx >= 4 ? 'hidden md:block' : ''}`}", 1)],
 "src/components/home/SafetySection.tsx": [
  ('<div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mb-8 md:mb-12">', '<div className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-2 -mx-4 px-4 md:mx-0 md:px-0 md:pb-0 md:grid md:grid-cols-3 md:gap-6 mb-8 md:mb-12 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">', 1),
  ('<div className="p-6 rounded-2xl bg-purple-950/40 border border-purple-800/50 backdrop-blur-xs flex flex-col justify-between">', '<div className="snap-start shrink-0 w-[82vw] sm:w-[60vw] md:w-auto p-5 md:p-6 rounded-2xl bg-purple-950/40 border border-purple-800/50 backdrop-blur-xs flex flex-col justify-between">', 3)],
 "src/components/home/TalentCtaSection.tsx": [
  ('<div className="p-7 rounded-3xl bg-white/10 backdrop-blur-md border border-white/15 text-white">', '<div className="hidden lg:block p-7 rounded-3xl bg-white/10 backdrop-blur-md border border-white/15 text-white">', 1)],
 "src/pages/AdminPage.tsx": [
  ('<div className="flex items-center gap-2 border-b border-slate-200 pb-2 text-xs font-bold text-slate-600 overflow-x-auto">', '<div className="flex items-center gap-2 border-b border-slate-200 pb-2 text-xs font-bold text-slate-600 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [&>button]:shrink-0 [&>button]:whitespace-nowrap">', 1),
  ('<table className="w-full text-left text-xs">', '<table className="w-full text-left text-xs min-w-[720px]">', 2)],
 "index.html": [
  ('    <meta name="twitter:card" content="summary_large_image" />\n',
   '    <meta property="og:site_name" content="YUKU" />\n    <meta property="og:locale" content="id_ID" />\n    <meta property="og:url" content="%s/" />\n    <meta property="og:image" content="%s/og-image.png" />\n    <meta property="og:image:width" content="1200" />\n    <meta property="og:image:height" content="630" />\n    <meta name="twitter:card" content="summary_large_image" />\n    <meta name="twitter:title" content="YUKU — Real Friends. Real Moments." />\n    <meta name="twitter:image" content="%s/og-image.png" />\n' % (BASE, BASE, BASE), 1),
  ('    <link rel="icon" type="image/png" href="/yuku-app-icon-transparent.png" />\n',
   '    <link rel="icon" type="image/png" href="/yuku-app-icon-transparent.png" />\n    <link rel="apple-touch-icon" href="/apple-touch-icon.png" />\n    <link rel="manifest" href="/site.webmanifest" />\n', 1)],
}
# 1) baca & cek semua dulu (tidak ada file diubah kalau ada yang tidak cocok)
new = {}
bad = []
for path, edits in EDITS.items():
    if not os.path.exists(path):
        bad.append((path, "file tidak ditemukan")); continue
    s = open(path, encoding="utf-8").read()
    if all((s.count(r) >= 1) if r else (s.count(o) == 0) for o, r, n in edits):
        print("sudah terpasang:", path); continue
    for old, rep, n in edits:
        if s.count(old) != n:
            bad.append((path, "tidak cocok: " + old[:50].replace("\n", " "))); break
        s = s.replace(old, rep)
    else:
        new[path] = s
if bad:
    print("DIBATALKAN, tidak ada file yang diubah. Masalah:")
    for b in bad: print(" -", b[0], "->", b[1])
    sys.exit(1)
for path, s in new.items():
    open(path, "w", encoding="utf-8").write(s); print("diubah:", path)
# 2) file baru
open("public/robots.txt", "w").write("User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /dashboard-talent\nDisallow: /riwayat-booking\nDisallow: /verifikasi-ktp\nDisallow: /ganti-sandi\nDisallow: /reset-sandi\n\nSitemap: %s/sitemap.xml\n" % BASE)
pages = [("/",1.0),("/talent",0.9),("/cara-kerja",0.7),("/tentang",0.6),("/faq",0.6),("/bantuan",0.5),("/daftar-talent",0.7),("/register",0.5),("/login",0.4),("/syarat-ketentuan",0.3),("/kebijakan-privasi",0.3)]
x = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
for p, pr in pages: x += '  <url><loc>%s%s</loc><priority>%s</priority></url>\n' % (BASE, p, pr)
open("public/sitemap.xml", "w").write(x + "</urlset>\n")
open("public/site.webmanifest", "w").write('{\n  "name": "YUKU — Real Friends. Real Moments.",\n  "short_name": "YUKU",\n  "description": "Marketplace teman aktivitas sosial dan mengobrol yang aman dan terpercaya di Indonesia.",\n  "start_url": "/",\n  "display": "standalone",\n  "background_color": "#FAF8FC",\n  "theme_color": "#FAF8FC",\n  "lang": "id",\n  "icons": [\n    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },\n    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }\n  ]\n}\n')
print("dibuat: robots.txt, sitemap.xml, site.webmanifest")
# 3) gambar (butuh Pillow)
try:
    from PIL import Image
    logo = Image.open("public/yuku-brand-logo.png").convert("RGB")
    c = Image.new("RGB", (1200, 630), (250, 248, 252)); w = 900; h = int(logo.height * w / logo.width)
    c.paste(logo.resize((w, h), Image.LANCZOS), ((1200 - w) // 2, (630 - h) // 2)); c.save("public/og-image.png", optimize=True)
    ic = Image.open("public/yuku-app-icon.png").convert("RGB")
    def sq(size, pad):
        cv = Image.new("RGB", (size, size), (255, 255, 255)); inner = int(size * (1 - 2 * pad)); s = min(inner / ic.width, inner / ic.height)
        r = ic.resize((int(ic.width * s), int(ic.height * s)), Image.LANCZOS); cv.paste(r, ((size - r.width) // 2, (size - r.height) // 2)); return cv
    sq(192, .12).save("public/icon-192.png", optimize=True); sq(512, .12).save("public/icon-512.png", optimize=True); sq(180, .08).save("public/apple-touch-icon.png", optimize=True)
    print("dibuat: og-image.png, icon-192.png, icon-512.png, apple-touch-icon.png")
except Exception as e:
    print("GAMBAR DILEWATI (%s). Jalankan: pip install pillow  lalu ulangi perintah." % e)
print("SELESAI")
