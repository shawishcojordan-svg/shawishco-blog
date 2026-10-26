import { promises as fs } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const queueDir = path.join(root, '.publisher', 'queue');
const statePath = path.join(root, '.publisher', 'published.json');
const guidesIndexPath = path.join(root, 'guides', 'index.html');
const sitemapPath = path.join(root, 'sitemap.xml');

const escapeHtml = (value) => String(value)
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#39;');
const jsonForHtml = (value) => JSON.stringify(value).replaceAll('<', '\\u003c');
const absoluteLink = (value) => {
  const href = String(value);
  if (href.startsWith('/guides/')) return `https://blog.shawishco.com${href}`;
  if (href.startsWith('/')) return `https://shawishco.com${href}`;
  return href;
};
const todayInAmman = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Amman', year: 'numeric', month: '2-digit', day: '2-digit'
}).format(new Date());

const renderArticle = (draft, date) => {
  const canonical = `https://blog.shawishco.com/guides/${draft.slug}/`;
  const sections = draft.sections.map((section, index) => `
<article><span>${String(index + 1).padStart(2, '0')}</span><div>
<h2>${escapeHtml(section.heading)}</h2><p>${escapeHtml(section.body)}</p>
</div></article>`).join('');
  const related = draft.related.map((item) => `
<article><h2>${escapeHtml(item.title)}</h2><p>${escapeHtml(item.text)}</p>
<a class="service-details-link" href="${escapeHtml(absoluteLink(item.href))}">${escapeHtml(item.label)}</a></article>`).join('');
  const schema = {
    '@context': 'https://schema.org', '@type': 'Article', headline: draft.title,
    description: draft.description, datePublished: date, dateModified: date,
    mainEntityOfPage: canonical, inLanguage: 'ar',
    author: { '@type': 'Organization', name: 'SHAWISHCO', url: 'https://shawishco.com/' },
    publisher: { '@type': 'Organization', name: 'SHAWISHCO', url: 'https://shawishco.com/',
      logo: { '@type': 'ImageObject', url: 'https://shawishco.com/assets/SHAWISHCO_LOGO.webp' } }
  };
  return `<!doctype html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#07111f"><title>${escapeHtml(draft.title)} | شاويشكو</title>
<meta name="description" content="${escapeHtml(draft.description)}"><meta name="robots" content="index,follow">
<link rel="canonical" href="${canonical}"><meta property="og:type" content="article">
<meta property="og:site_name" content="SHAWISHCO | شاويشكو"><meta property="og:title" content="${escapeHtml(draft.title)}">
<meta property="og:description" content="${escapeHtml(draft.description)}"><meta property="og:url" content="${canonical}">
<meta property="og:image" content="https://shawishco.com/assets/SHAWISHCO_LOGO.webp"><meta name="twitter:card" content="summary">
<link rel="icon" href="https://shawishco.com/favicon.ico"><link rel="stylesheet" href="https://shawishco.com/assets/theme.css?v=20261016-1822">
<link rel="stylesheet" href="https://shawishco.com/assets/seo-0978015b10f9.css?v=20261026-global-r1">
<style>.guide-nav{max-width:1220px;margin:18px auto;padding:0 28px;display:flex;gap:16px;flex-wrap:wrap}.guide-nav a{color:inherit;text-underline-offset:5px}.article-date{color:var(--muted);margin-top:14px}@media(max-width:700px){.guide-nav{padding-left:20px;padding-right:20px}}</style>
<script type="application/ld+json">${jsonForHtml(schema)}</script></head><body class="concept-14">
<nav class="guide-nav" aria-label="التنقل"><a href="https://shawishco.com/">الرئيسية</a><a href="https://shawishco.com/services/">الاشتراكات</a><a href="https://blog.shawishco.com/guides/">كل الأدلة</a><a href="https://shawishco.com/compare-subscriptions/">المقارنة</a><a href="https://shawishco.com/contact/">تواصل معنا</a></nav>
<main id="main"><section class="page-hero"><p class="eyebrow">${escapeHtml(draft.eyebrow)}</p>
<h1>${escapeHtml(draft.title)}</h1><p>${escapeHtml(draft.intro)}</p><p class="article-date">نُشر بتاريخ ${date}</p></section>
<section class="steps">${sections}</section><section class="supporting"><div class="support-grid">${related}</div></section>
</main></body></html>`;
};

const state = JSON.parse(await fs.readFile(statePath, 'utf8'));
const files = (await fs.readdir(queueDir)).filter((name) => name.endsWith('.json')).sort();
const nextFile = files.find((name) => !state.published.includes(name));
if (!nextFile) {
  console.log('No queued guide remains.');
  process.exit(0);
}
const draft = JSON.parse(await fs.readFile(path.join(queueDir, nextFile), 'utf8'));
if (!draft.slug || !draft.title || !Array.isArray(draft.sections) || !Array.isArray(draft.related)) throw new Error(`Invalid draft: ${nextFile}`);
const date = todayInAmman();
const articleDir = path.join(root, 'guides', draft.slug);
await fs.mkdir(articleDir, { recursive: true });
await fs.writeFile(path.join(articleDir, 'index.html'), renderArticle(draft, date), 'utf8');

let guideIndex = await fs.readFile(guidesIndexPath, 'utf8');
  const href = `https://blog.shawishco.com/guides/${draft.slug}/`;
if (!guideIndex.includes(`href="${href}"`)) {
  const card = `<article>\n<h2><a href="${href}">${escapeHtml(draft.title)}</a></h2>\n<p>${escapeHtml(draft.cardText)}</p>\n</article>\n`;
  guideIndex = guideIndex.replace('<section class="guide-list">\n', `<section class="guide-list">\n${card}`);
  await fs.writeFile(guidesIndexPath, guideIndex, 'utf8');
}

let sitemap = await fs.readFile(sitemapPath, 'utf8');
const loc = `https://blog.shawishco.com/guides/${draft.slug}/`;
if (!sitemap.includes(`<loc>${loc}</loc>`)) {
  sitemap = sitemap.replace('</urlset>', `  <url><loc>${loc}</loc><lastmod>${date}</lastmod></url>\n</urlset>`);
  await fs.writeFile(sitemapPath, sitemap, 'utf8');
}
state.published.push(nextFile);
state.history.push({ file: nextFile, slug: draft.slug, publishedAt: date });
await fs.writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
console.log(`Published ${nextFile}: ${loc}`);
