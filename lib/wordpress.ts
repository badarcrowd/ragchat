import { normalizeText } from "./rag";

export type WordPressPost = {
  id: number;
  title: { rendered: string };
  content: { rendered: string };
  excerpt: { rendered: string };
  link: string;
  type: string;
  slug: string;
};

export type WordPressPage = {
  id: number;
  title: { rendered: string };
  content: { rendered: string };
  link: string;
  slug: string;
};

/**
 * Detect if a URL is a WordPress site
 */
export async function isWordPressSite(baseUrl: string): Promise<boolean> {
  try {
    const url = new URL(baseUrl);
    const apiUrl = `${url.origin}/wp-json/wp/v2`;
    
    const response = await fetch(apiUrl, {
      method: 'HEAD',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; RAGBot/1.0)'
      }
    });
    
    return response.ok || response.status === 404; // 404 is ok, means WP is there but no posts
  } catch {
    return false;
  }
}

/**
 * Discover all available post types from WordPress
 */
export async function discoverPostTypes(baseUrl: string): Promise<string[]> {
  try {
    const apiUrl = `${baseUrl}/wp-json/wp/v2/types`;
    
    const response = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; RAGBot/1.0)',
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      console.log('[WordPress] Could not discover post types, using defaults');
      return ['page', 'post'];
    }

    const types: Record<string, {
      slug: string;
      name: string;
      rest_base?: string;
      viewable?: boolean;
    }> = await response.json();

    // Filter to only public/viewable types
    const postTypes = Object.entries(types)
      .filter(([_, type]) => type.viewable !== false)
      .map(([_, type]) => type.rest_base || type.slug)
      .filter(slug => slug !== 'attachment' && slug !== 'wp_block'); // Exclude media and reusable blocks

    console.log('[WordPress] Discovered post types:', postTypes);
    return postTypes;
  } catch (error) {
    console.error('[WordPress] Post type discovery error:', error);
    return ['pages', 'posts']; // Fallback to defaults
  }
}

/**
 * Fetch WordPress content by URL slug
 */
export async function fetchWordPressContentByUrl(url: string): Promise<{
  title: string;
  text: string;
  url: string;
} | null> {
  try {
    const parsed = new URL(url);
    const baseUrl = `${parsed.protocol}//${parsed.host}`;
    
    // Try to get the slug from the URL
    const pathParts = parsed.pathname.split('/').filter(Boolean);
    const slug = pathParts[pathParts.length - 1];
    
    if (!slug) {
      return null;
    }

    // Try pages first
    const pageData = await fetchWordPressPage(baseUrl, slug);
    if (pageData) {
      return pageData;
    }

    // Try posts
    const postData = await fetchWordPressPost(baseUrl, slug);
    if (postData) {
      return postData;
    }

    return null;
  } catch (error) {
    console.error('[WordPress Fetch Error]', error);
    return null;
  }
}

/**
 * Fetch a WordPress page by slug
 */
export async function fetchWordPressPage(
  baseUrl: string,
  slug: string
): Promise<{ title: string; text: string; url: string } | null> {
  try {
    const apiUrl = `${baseUrl}/wp-json/wp/v2/pages?slug=${encodeURIComponent(slug)}`;
    
    const response = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; RAGBot/1.0)',
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      return null;
    }

    const pages: WordPressPage[] = await response.json();
    
    if (!pages || pages.length === 0) {
      return null;
    }

    const page = pages[0];
    const title = stripHtml(page.title.rendered);
    const text = stripHtml(page.content.rendered);

    return {
      title: normalizeText(title),
      text: normalizeText(text),
      url: page.link
    };
  } catch (error) {
    console.error('[WordPress Page Fetch Error]', error);
    return null;
  }
}

/**
 * Fetch a WordPress post by slug
 */
export async function fetchWordPressPost(
  baseUrl: string,
  slug: string
): Promise<{ title: string; text: string; url: string } | null> {
  try {
    const apiUrl = `${baseUrl}/wp-json/wp/v2/posts?slug=${encodeURIComponent(slug)}`;
    
    const response = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; RAGBot/1.0)',
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      return null;
    }

    const posts: WordPressPost[] = await response.json();
    
    if (!posts || posts.length === 0) {
      return null;
    }

    const post = posts[0];
    const title = stripHtml(post.title.rendered);
    const text = stripHtml(post.content.rendered);

    return {
      title: normalizeText(title),
      text: normalizeText(text),
      url: post.link
    };
  } catch (error) {
    console.error('[WordPress Post Fetch Error]', error);
    return null;
  }
}

/**
 * Fetch all WordPress pages
 */
export async function fetchAllWordPressPages(
  baseUrl: string,
  perPage: number = 100
): Promise<Array<{ title: string; text: string; url: string }>> {
  try {
    const apiUrl = `${baseUrl}/wp-json/wp/v2/pages?per_page=${perPage}&_fields=id,title,content,link`;
    
    const response = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; RAGBot/1.0)',
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      return [];
    }

    const pages: WordPressPage[] = await response.json();
    
    return pages.map(page => ({
      title: normalizeText(stripHtml(page.title.rendered)),
      text: normalizeText(stripHtml(page.content.rendered)),
      url: page.link
    }));
  } catch (error) {
    console.error('[WordPress Pages Fetch Error]', error);
    return [];
  }
}

/**
 * Fetch all WordPress posts
 */
export async function fetchAllWordPressPosts(
  baseUrl: string,
  perPage: number = 100
): Promise<Array<{ title: string; text: string; url: string }>> {
  try {
    const apiUrl = `${baseUrl}/wp-json/wp/v2/posts?per_page=${perPage}&_fields=id,title,content,link`;
    
    const response = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; RAGBot/1.0)',
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      return [];
    }

    const posts: WordPressPost[] = await response.json();
    
    return posts.map(post => ({
      title: normalizeText(stripHtml(post.title.rendered)),
      text: normalizeText(stripHtml(post.content.rendered)),
      url: post.link
    }));
  } catch (error) {
    console.error('[WordPress Posts Fetch Error]', error);
    return [];
  }
}

/**
 * Fetch content from any custom post type
 */
export async function fetchCustomPostType(
  baseUrl: string,
  postType: string,
  perPage: number = 100
): Promise<Array<{ title: string; text: string; url: string }>> {
  try {
    const apiUrl = `${baseUrl}/wp-json/wp/v2/${postType}?per_page=${perPage}&_fields=id,title,content,link`;
    
    console.log(`[WordPress] Fetching custom post type: ${postType}`);
    
    const response = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; RAGBot/1.0)',
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      console.log(`[WordPress] Post type '${postType}' returned ${response.status}`);
      return [];
    }

    const items: any[] = await response.json();
    
    if (!Array.isArray(items)) {
      return [];
    }

    return items
      .map(item => {
        // Handle different content field structures
        const title = item.title?.rendered || item.name?.rendered || item.title || 'Untitled';
        const content = item.content?.rendered || item.description?.rendered || item.excerpt?.rendered || '';
        const url = item.link || '';

        return {
          title: normalizeText(stripHtml(title)),
          text: normalizeText(stripHtml(content)),
          url
        };
      })
      .filter(item => item.text.length > 50); // Filter out items with minimal content
  } catch (error) {
    console.error(`[WordPress] Custom post type '${postType}' fetch error:`, error);
    return [];
  }
}

/**
 * Strip HTML tags from text
 */
function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Crawl entire WordPress site (all pages and posts)
 * @param baseUrl - WordPress site URL
 * @param customPostTypes - Optional array of custom post type slugs to fetch (e.g., ['portfolio', 'team'])
 * @param autoDiscover - Whether to auto-discover all post types (default: true)
 */
export async function crawlWordPressSite(
  baseUrl: string,
  options: {
    customPostTypes?: string[];
    autoDiscover?: boolean;
    perPage?: number;
  } = {}
): Promise<Array<{ title: string; text: string; url: string; type: string }>> {
  const { customPostTypes = [], autoDiscover = true, perPage = 100 } = options;
  
  const allContent: Array<{ title: string; text: string; url: string; type: string }> = [];
  
  // Auto-discover post types if enabled
  let postTypesToFetch = ['pages', 'posts']; // Default fallback
  
  if (autoDiscover) {
    const discovered = await discoverPostTypes(baseUrl);
    postTypesToFetch = discovered.length > 0 ? discovered : postTypesToFetch;
    console.log('[WordPress Bulk] Auto-discovered post types:', postTypesToFetch);
  }
  
  // Add user-specified custom post types
  if (customPostTypes.length > 0) {
    const uniqueTypes = [...new Set([...postTypesToFetch, ...customPostTypes])];
    postTypesToFetch = uniqueTypes;
    console.log('[WordPress Bulk] Including custom post types:', customPostTypes);
  }

  // Fetch all post types
  for (const postType of postTypesToFetch) {
    try {
      console.log(`[WordPress Bulk] Fetching: ${postType}`);
      const items = await fetchCustomPostType(baseUrl, postType, perPage);
      
      allContent.push(
        ...items.map(item => ({
          ...item,
          type: postType
        }))
      );
      
      console.log(`[WordPress Bulk] Fetched ${items.length} items from ${postType}`);
    } catch (error) {
      console.error(`[WordPress Bulk] Failed to fetch ${postType}:`, error);
    }
  }
  
  const filtered = allContent.filter(item => item.text.length > 100);
  console.log(`[WordPress Bulk] Total items: ${allContent.length}, after filtering: ${filtered.length}`);
  
  return filtered;
}
