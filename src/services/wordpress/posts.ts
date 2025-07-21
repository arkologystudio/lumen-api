import { JSDOM } from "jsdom";
import { htmlToText } from "html-to-text";

/**
 * Extracts clean text from a post title, handling HTML entities and tags
 *
 * @param title — the raw post title which may contain HTML entities or tags
 * @return clean plain text title
 */
export const extractPostTitle = (title: string): string => {
  if (!title || typeof title !== "string") {
    return "";
  }

  // Use htmlToText to handle HTML entities and any potential HTML tags
  const cleanTitle = htmlToText(title, {
    wordwrap: false,
    preserveNewlines: false,
    selectors: [
      { selector: "a", format: "inline" }, // preserve link text, remove URLs
    ],
  });

  // Trim and normalize whitespace
  return cleanTitle.trim().replace(/\s+/g, " ");
};

/**
 * Extracts clean, natural-language text from a blob of WordPress HTML.
 *
 * @param html — the raw `post.content` HTML string.
 * @return plain text with minimal noise.
 */
export const extractPostText = (html: string): string => {
  // 1️⃣ Parse the HTML into a DOM
  const dom = new JSDOM(html);
  const { document } = dom.window;

  // 2️⃣ Remove unwanted elements by selector
  const blocksToStrip = [
    "script",
    "style",
    "figure",
    "figcaption", // media
    "blockquote.wp-block-pullquote", // stylized quotes
    ".meta-container",
    ".footnotes", // metadata / footnotes
    "code",
    "pre", // code samples
    "header",
    "footer", // post headers/footers
    "img",
    "svg", // images / icons
    ".wp-block-footnotes", // WordPress footnotes
    ".wp-block-footnote", // Individual footnotes
    ".wp-block-issue-intro", // Issue intro blocks
    ".issue-image", // Issue images
    "iframe", // Embedded content
    ".wp-block-embed", // WordPress embeds
    ".wp-block-content-list", // Content lists
    "cite", // Citations
    ".footnote-ref", // Footnote references
  ];

  blocksToStrip.forEach((selector: string) => {
    document
      .querySelectorAll(selector)
      .forEach((element: Element) => element.remove());
  });

  // 3️⃣ Serialize back to HTML and convert to text
  //    html-to-text will collapse whitespace nicely, drop links (preserve link text),
  //    skip tables (or flatten them), etc.
  const cleanHTML = document.body.innerHTML;
  const text = htmlToText(cleanHTML, {
    wordwrap: false,
    preserveNewlines: true,
    selectors: [
      { selector: "a", format: "inline" }, // keep link text, drop URLs
      { selector: "ul", format: "skip" }, // skip unordered lists
      { selector: "ol", format: "skip" }, // skip ordered lists
      { selector: "table", format: "skip" }, // skip tables entirely
      { selector: "blockquote", format: "block" }, // preserve blockquotes as blocks
      { selector: "h1", format: "block" }, // preserve headings
      { selector: "h2", format: "block" },
      { selector: "h3", format: "block" },
      { selector: "h4", format: "block" },
      { selector: "h5", format: "block" },
      { selector: "h6", format: "block" },
      { selector: "p", format: "block" }, // preserve paragraphs
    ],
  });

  // 4️⃣ Post-cleanup: collapse multiple blank lines, trim edges
  return text
    .split("\n")
    .map((line: string) => line.trim())
    .filter((line: string) => line !== "") // drop empty lines
    .join("\n\n"); // double-break between paragraphs
};

/**
 * Extracts text from multiple posts and returns an array of processed content
 *
 * @param posts Array of post objects with content property
 * @returns Array of objects with original post data plus extracted text
 */
export const extractTextFromPosts = <
  T extends { content: string; title: string }
>(
  posts: T[]
): Array<T & { extractedText: string; cleanTitle: string }> => {
  return posts.map((post) => ({
    ...post,
    extractedText: extractPostText(post.content),
    cleanTitle: extractPostTitle(post.title),
  }));
};

/**
 * Extracts and combines text from all posts into a single string
 *
 * @param posts Array of post objects with content property
 * @param separator String to separate posts (default: triple newlines)
 * @returns Combined text from all posts
 */
export const extractCombinedText = <
  T extends { content: string; title?: string }
>(
  posts: T[],
  separator: string = "\n\n\n"
): string => {
  return posts
    .map((post) => {
      const extractedText = extractPostText(post.content);
      // Include title if available
      if (post.title) {
        const cleanTitle = extractPostTitle(post.title);
        return `${cleanTitle}\n\n${extractedText}`;
      }
      return extractedText;
    })
    .filter((text) => text.trim() !== "")
    .join(separator);
};

/**
 * Gets basic statistics about the extracted text
 *
 * @param text Extracted text string
 * @returns Object with word count, character count, and paragraph count
 */
export const getTextStats = (
  text: string
): {
  wordCount: number;
  characterCount: number;
  paragraphCount: number;
} => {
  const words = text.split(/\s+/).filter((word) => word.length > 0);
  const paragraphs = text
    .split("\n\n")
    .filter((para) => para.trim().length > 0);

  return {
    wordCount: words.length,
    characterCount: text.length,
    paragraphCount: paragraphs.length,
  };
};
