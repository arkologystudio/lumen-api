import { EmbedRequest } from "../types/wordpress";

/**
 * Helper function to reconstruct chunked posts on the API side
 * @param requests Array of EmbedRequest objects that may include chunked posts
 * @returns Array of reconstructed EmbedRequest objects with full content
 */
export const reconstructChunkedPosts = (
  requests: EmbedRequest[]
): EmbedRequest[] => {
  const chunkedPosts = new Map<string, EmbedRequest[]>();
  const regularPosts: EmbedRequest[] = [];

  // Separate chunked and regular posts
  for (const request of requests) {
    if (request.is_chunked && request.chunk_id) {
      if (!chunkedPosts.has(request.chunk_id)) {
        chunkedPosts.set(request.chunk_id, []);
      }
      chunkedPosts.get(request.chunk_id)!.push(request);
    } else {
      regularPosts.push(request);
    }
  }

  // Reconstruct chunked posts
  for (const [, chunks] of chunkedPosts) {
    // Sort chunks by index
    chunks.sort((a, b) => (a.chunk_index || 0) - (b.chunk_index || 0));

    // Verify we have all chunks
    const expectedChunks = chunks[0]?.total_chunks || 0;
    if (chunks.length !== expectedChunks) {
      console.warn(
        `Missing chunks for post ${chunks[0]?.id}. Expected ${expectedChunks}, got ${chunks.length}`
      );
      continue;
    }

    // Reconstruct the full content
    const reconstructedPost: EmbedRequest = {
      ...chunks[0],
      content: chunks.map((chunk) => chunk.content).join(""),
      // Remove chunking metadata
      is_chunked: undefined,
      chunk_id: undefined,
      chunk_index: undefined,
      total_chunks: undefined,
    };

    regularPosts.push(reconstructedPost);
  }

  return regularPosts;
};

/**
 * Validates that all required chunks are present for chunked posts
 * @param requests Array of EmbedRequest objects
 * @returns Object with validation results and missing chunk information
 */
export const validateChunkedPosts = (
  requests: EmbedRequest[]
): {
  isValid: boolean;
  missingChunks: Array<{
    chunkId: string;
    postId: number;
    expected: number;
    received: number;
  }>;
} => {
  const chunkedPosts = new Map<string, EmbedRequest[]>();
  const missingChunks: Array<{
    chunkId: string;
    postId: number;
    expected: number;
    received: number;
  }> = [];

  // Group chunked posts
  for (const request of requests) {
    if (request.is_chunked && request.chunk_id) {
      if (!chunkedPosts.has(request.chunk_id)) {
        chunkedPosts.set(request.chunk_id, []);
      }
      chunkedPosts.get(request.chunk_id)!.push(request);
    }
  }

  // Validate each chunked post
  for (const [chunkId, chunks] of chunkedPosts) {
    const expectedChunks = chunks[0]?.total_chunks || 0;
    if (chunks.length !== expectedChunks) {
      missingChunks.push({
        chunkId,
        postId: chunks[0]?.id || 0,
        expected: expectedChunks,
        received: chunks.length,
      });
    }
  }

  return {
    isValid: missingChunks.length === 0,
    missingChunks,
  };
};
