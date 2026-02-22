import fs from 'fs';
import path from 'path';

/* ─── Types ─── */
export interface BlogPostMeta {
  slug: string;
  title: string;
  description: string;
  date: string;            // ISO date string
  updated?: string;
  author: string;
  category: string;
  tags: string[];
  image?: string;          // Hero image URL (optional)
  readingTime: number;     // minutes
  featured?: boolean;
  seoTitle?: string;       // Override <title> if different from title
  seoDescription?: string; // Override meta description
}

export interface BlogPost extends BlogPostMeta {
  content: string;         // Raw markdown body (no frontmatter)
}

/* ─── Frontmatter Parser ─── */
function parseFrontmatter(raw: string): { meta: Record<string, any>; content: string } {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { meta: {}, content: raw };

  const meta: Record<string, any> = {};
  const lines = match[1].split('\n');
  for (const line of lines) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    let value: any = line.slice(colonIdx + 1).trim();
    // Parse arrays like [tag1, tag2]
    if (value.startsWith('[') && value.endsWith(']')) {
      value = value.slice(1, -1).split(',').map((s: string) => s.trim().replace(/^["']|["']$/g, ''));
    }
    // Parse booleans
    if (value === 'true') value = true;
    if (value === 'false') value = false;
    // Parse numbers
    if (!isNaN(Number(value)) && value !== '') value = Number(value);
    // Strip quotes
    if (typeof value === 'string') value = value.replace(/^["']|["']$/g, '');
    meta[key] = value;
  }

  return { meta, content: match[2].trim() };
}

/* ─── Calculate reading time ─── */
function calcReadingTime(text: string): number {
  const words = text.split(/\s+/).length;
  return Math.max(1, Math.round(words / 230));
}

/* ─── Get blog directory ─── */
function getBlogDir(): string {
  return path.join(process.cwd(), '..', '..', 'content', 'blog');
}

/* ─── Get all blog posts (sorted by date, newest first) ─── */
export function getAllBlogPosts(): BlogPost[] {
  const dir = getBlogDir();
  if (!fs.existsSync(dir)) return [];

  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.md'));
  const posts: BlogPost[] = [];

  for (const file of files) {
    const raw = fs.readFileSync(path.join(dir, file), 'utf8');
    const { meta, content } = parseFrontmatter(raw);
    const slug = file.replace(/\.md$/, '');

    posts.push({
      slug,
      title: meta.title || slug,
      description: meta.description || '',
      date: meta.date || '2026-01-01',
      updated: meta.updated,
      author: meta.author || 'Apelier',
      category: meta.category || 'General',
      tags: Array.isArray(meta.tags) ? meta.tags : [],
      image: meta.image,
      readingTime: meta.readingTime || calcReadingTime(content),
      featured: meta.featured || false,
      seoTitle: meta.seoTitle,
      seoDescription: meta.seoDescription,
      content,
    });
  }

  // Sort by date descending
  posts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return posts;
}

/* ─── Get a single post by slug ─── */
export function getBlogPost(slug: string): BlogPost | null {
  const filePath = path.join(getBlogDir(), `${slug}.md`);
  if (!fs.existsSync(filePath)) return null;

  const raw = fs.readFileSync(filePath, 'utf8');
  const { meta, content } = parseFrontmatter(raw);

  return {
    slug,
    title: meta.title || slug,
    description: meta.description || '',
    date: meta.date || '2026-01-01',
    updated: meta.updated,
    author: meta.author || 'Apelier',
    category: meta.category || 'General',
    tags: Array.isArray(meta.tags) ? meta.tags : [],
    image: meta.image,
    readingTime: meta.readingTime || calcReadingTime(content),
    featured: meta.featured || false,
    seoTitle: meta.seoTitle,
    seoDescription: meta.seoDescription,
    content,
  };
}

/* ─── Get all slugs (for static generation) ─── */
export function getAllBlogSlugs(): string[] {
  const dir = getBlogDir();
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => f.replace(/\.md$/, ''));
}

/* ─── Get posts by category ─── */
export function getBlogPostsByCategory(category: string): BlogPost[] {
  return getAllBlogPosts().filter((p) => p.category.toLowerCase() === category.toLowerCase());
}

/* ─── Get featured posts ─── */
export function getFeaturedPosts(): BlogPost[] {
  return getAllBlogPosts().filter((p) => p.featured);
}
