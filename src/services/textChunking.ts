/**
 * Text chunking service for creating searchable chunks from extracted post content
 */

export interface TextChunk {
  id: string;
  postId: number;
  postTitle: string;
  postUrl: string;
  siteId: string;
  siteName?: string;
  siteUrl?: string;
  chunkIndex: number;
  content: string;
  startPosition: number;
  endPosition: number;
}

export interface ChunkingOptions {
  maxChunkSize: number;
  overlapSize: number;
  minChunkSize: number;
  preferParagraphs: boolean;
  ensureCompleteSentences: boolean;
}

const DEFAULT_CHUNKING_OPTIONS: ChunkingOptions = {
  maxChunkSize: 1000, // characters
  overlapSize: 200, // characters overlap between chunks
  minChunkSize: 100, // minimum chunk size to avoid tiny fragments
  preferParagraphs: true, // Try to break at paragraph boundaries first
  ensureCompleteSentences: false, // Disable to prevent text loss - boundary detection handles this
};

/**
 * Enhanced sentence detection that handles common edge cases
 */
const findSentenceBoundaries = (text: string): number[] => {
  const boundaries: number[] = [];

  // More sophisticated sentence ending pattern
  // Handles: Mr. Dr. etc., decimals, ellipsis, quotes, etc.
  const sentencePattern =
    /(?<!\b(?:Mr|Mrs|Ms|Dr|Prof|Sr|Jr|vs|etc|Inc|Ltd|Corp|Co)\.)(?<!\d)([.!?]+)(?:\s+|$|(?=["']?\s*[A-Z]))/g;

  let match;
  while ((match = sentencePattern.exec(text)) !== null) {
    boundaries.push(match.index + match[1].length);
  }

  return boundaries;
};

/**
 * Find paragraph boundaries (double newlines or more)
 */
const findParagraphBoundaries = (text: string): number[] => {
  const boundaries: number[] = [];
  const paragraphPattern = /\n\s*\n/g;

  let match;
  while ((match = paragraphPattern.exec(text)) !== null) {
    boundaries.push(match.index + match[0].length);
  }

  return boundaries;
};

/**
 * Find the best break point near a target position
 */
const findBestBreakPoint = (
  text: string,
  targetPosition: number,
  options: ChunkingOptions,
  startPosition: number = 0
): number => {
  const searchWindow = 300; // Larger search window for better breaks
  const searchStart = Math.max(targetPosition - searchWindow, startPosition);
  const searchEnd = Math.min(targetPosition + searchWindow, text.length);

  // Get all possible break points in order of preference
  const paragraphBoundaries = options.preferParagraphs
    ? findParagraphBoundaries(text.substring(searchStart, searchEnd))
        .map((pos) => pos + searchStart)
        .filter((pos) => pos >= startPosition && pos <= searchEnd)
    : [];

  const sentenceBoundaries = findSentenceBoundaries(
    text.substring(searchStart, searchEnd)
  )
    .map((pos) => pos + searchStart)
    .filter((pos) => pos >= startPosition && pos <= searchEnd);

  // Prefer paragraph breaks closest to target
  if (paragraphBoundaries.length > 0) {
    const bestParagraphBreak = paragraphBoundaries.reduce((best, current) =>
      Math.abs(current - targetPosition) < Math.abs(best - targetPosition)
        ? current
        : best
    );

    // Use paragraph break if it's reasonably close
    if (Math.abs(bestParagraphBreak - targetPosition) <= searchWindow / 2) {
      return bestParagraphBreak;
    }
  }

  // Fall back to sentence breaks
  if (sentenceBoundaries.length > 0) {
    return sentenceBoundaries.reduce((best, current) =>
      Math.abs(current - targetPosition) < Math.abs(best - targetPosition)
        ? current
        : best
    );
  }

  // Last resort: use target position
  return targetPosition;
};

/**
 * Ensure chunk ends with complete sentences (but preserve all text)
 */
const cleanChunkBoundaries = (
  text: string,
  start: number,
  end: number
): { start: number; end: number } => {
  // Don't modify the start position to avoid text loss
  // Only ensure the end position is at a sentence boundary

  const chunkText = text.substring(start, end);
  const sentenceBoundaries = findSentenceBoundaries(chunkText);

  if (sentenceBoundaries.length > 0) {
    const lastCompleteSentence =
      start + sentenceBoundaries[sentenceBoundaries.length - 1];
    return {
      start: start,
      end: lastCompleteSentence,
    };
  }

  // If no sentence boundaries found, keep original boundaries
  return { start, end };
};

/**
 * Splits text into overlapping chunks with optimized sentence boundaries
 * @param text The text to chunk
 * @param options Chunking configuration
 * @returns Array of text chunks with metadata
 */
export const chunkText = (
  text: string,
  options: Partial<ChunkingOptions> = {}
): Array<{ content: string; startPosition: number; endPosition: number }> => {
  const config = { ...DEFAULT_CHUNKING_OPTIONS, ...options };
  const chunks: Array<{
    content: string;
    startPosition: number;
    endPosition: number;
  }> = [];

  if (text.length <= config.maxChunkSize) {
    return [
      {
        content: text.trim(),
        startPosition: 0,
        endPosition: text.length,
      },
    ];
  }

  let currentPosition = 0;

  while (currentPosition < text.length) {
    // Calculate target end position
    let targetEnd = Math.min(
      currentPosition + config.maxChunkSize,
      text.length
    );

    // Find optimal break point
    const actualEnd = findBestBreakPoint(
      text,
      targetEnd,
      config,
      currentPosition
    );

    // Clean boundaries if ensuring complete sentences
    let chunkStart = currentPosition;
    let chunkEnd = actualEnd;

    if (config.ensureCompleteSentences && chunks.length > 0) {
      const cleaned = cleanChunkBoundaries(text, chunkStart, chunkEnd);
      chunkStart = cleaned.start;
      chunkEnd = cleaned.end;
    }

    // Extract chunk content
    const chunkContent = text.substring(chunkStart, chunkEnd).trim();

    // Only add chunk if it meets minimum size and has content
    if (chunkContent.length >= config.minChunkSize && chunkContent.length > 0) {
      chunks.push({
        content: chunkContent,
        startPosition: chunkStart,
        endPosition: chunkEnd,
      });
    }

    // Calculate next position with overlap
    if (chunkEnd >= text.length) {
      break;
    }

    // Smart overlap: try to start next chunk at a sentence boundary
    const overlapStart = Math.max(
      chunkEnd - config.overlapSize,
      chunkStart + 1
    );
    const sentenceBoundariesInOverlap = findSentenceBoundaries(
      text.substring(overlapStart, chunkEnd)
    ).map((pos) => pos + overlapStart);

    currentPosition =
      sentenceBoundariesInOverlap.length > 0
        ? sentenceBoundariesInOverlap[sentenceBoundariesInOverlap.length - 1]
        : overlapStart;

    // Ensure we make progress
    if (currentPosition <= chunkStart) {
      currentPosition = chunkEnd;
    }
  }

  return chunks;
};

/**
 * Creates text chunks from a post with metadata
 * @param post Post object with extracted text
 * @param options Chunking configuration
 * @returns Array of TextChunk objects
 */
export const createPostChunks = <
  T extends {
    id: number;
    title: string;
    cleanTitle: string;
    url: string;
    extractedText: string;
    site_id: string;
    site_name?: string;
    site_url?: string;
  }
>(
  post: T,
  options: Partial<ChunkingOptions> = {}
): TextChunk[] => {
  const textChunks = chunkText(post.extractedText, options);

  return textChunks.map((chunk, index) => ({
    id: `${post.site_id}-${post.id}-chunk-${index}`,
    postId: post.id,
    postTitle: post.cleanTitle,
    postUrl: post.url,
    siteId: post.site_id,
    siteName: post.site_name,
    siteUrl: post.site_url,
    chunkIndex: index,
    content: chunk.content,
    startPosition: chunk.startPosition,
    endPosition: chunk.endPosition,
  }));
};

/**
 * Creates chunks from multiple posts
 * @param posts Array of posts with extracted text
 * @param options Chunking configuration
 * @returns Array of all text chunks
 */
export const createBatchPostChunks = <
  T extends {
    id: number;
    title: string;
    cleanTitle: string;
    url: string;
    extractedText: string;
    site_id: string;
    site_name?: string;
    site_url?: string;
  }
>(
  posts: T[],
  options: Partial<ChunkingOptions> = {}
): TextChunk[] => {
  return posts.flatMap((post) => createPostChunks(post, options));
};

/**
 * Gets statistics about chunking results
 * @param chunks Array of text chunks
 * @returns Chunking statistics
 */
export const getChunkingStats = (
  chunks: TextChunk[]
): {
  totalChunks: number;
  averageChunkSize: number;
  totalPosts: number;
  chunksPerPost: { [postId: number]: number };
  sentenceCompleteness: number; // Percentage of chunks with complete sentences
} => {
  const totalChunks = chunks.length;
  const totalCharacters = chunks.reduce(
    (sum, chunk) => sum + chunk.content.length,
    0
  );
  const averageChunkSize =
    totalChunks > 0 ? Math.round(totalCharacters / totalChunks) : 0;

  const postIds = new Set(chunks.map((chunk) => chunk.postId));
  const totalPosts = postIds.size;

  const chunksPerPost: { [postId: number]: number } = {};
  chunks.forEach((chunk) => {
    chunksPerPost[chunk.postId] = (chunksPerPost[chunk.postId] || 0) + 1;
  });

  // Calculate sentence completeness
  const chunksWithCompleteSentences = chunks.filter((chunk) => {
    const sentenceBoundaries = findSentenceBoundaries(chunk.content);
    return (
      sentenceBoundaries.length > 0 && chunk.content.trim().match(/[.!?]\s*$/)
    ); // Ends with sentence punctuation
  }).length;

  const sentenceCompleteness =
    totalChunks > 0
      ? Math.round((chunksWithCompleteSentences / totalChunks) * 100)
      : 0;

  return {
    totalChunks,
    averageChunkSize,
    totalPosts,
    chunksPerPost,
    sentenceCompleteness,
  };
};
