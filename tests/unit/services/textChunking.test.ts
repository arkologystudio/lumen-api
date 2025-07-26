import {
  chunkText,
  createPostChunks,
  createBatchPostChunks,
  getChunkingStats,
  ChunkingOptions,
  TextChunk,
} from '../../../src/services/textChunking';

describe('Text Chunking Service', () => {
  describe('chunkText', () => {
    it('should return single chunk for short text', () => {
      const text = 'This is a short text.';
      const chunks = chunkText(text);

      expect(chunks).toHaveLength(1);
      expect(chunks[0]).toEqual({
        content: text,
        startPosition: 0,
        endPosition: text.length,
      });
    });

    it('should split text into multiple chunks for long text', () => {
      const text = 'A'.repeat(2000);
      const chunks = chunkText(text, { maxChunkSize: 500 });

      expect(chunks.length).toBeGreaterThan(1);
      chunks.forEach((chunk) => {
        expect(chunk.content.length).toBeLessThanOrEqual(500);
        expect(chunk.startPosition).toBeLessThan(chunk.endPosition);
      });
    });

    it('should handle paragraph boundaries', () => {
      const text = `First paragraph content here.

Second paragraph content here.

Third paragraph content here.`;
      
      const chunks = chunkText(text, { 
        maxChunkSize: 50,
        preferParagraphs: true 
      });

      expect(chunks.length).toBeGreaterThan(1);
      // Check that chunks respect paragraph boundaries when possible
      chunks.forEach((chunk) => {
        expect(chunk.content.trim()).toBeTruthy();
      });
    });

    it('should handle sentence boundaries', () => {
      const text = 'First sentence. Second sentence! Third sentence? Fourth sentence.';
      const chunks = chunkText(text, { 
        maxChunkSize: 30,
        ensureCompleteSentences: true 
      });

      expect(chunks.length).toBeGreaterThan(1);
      // Most chunks should end with sentence punctuation
      const completeChunks = chunks.filter(chunk => 
        chunk.content.trim().match(/[.!?]\s*$/)
      );
      expect(completeChunks.length).toBeGreaterThanOrEqual(1);
    });

    it('should respect minimum chunk size', () => {
      const text = 'A'.repeat(1000);
      const chunks = chunkText(text, { 
        maxChunkSize: 200,
        minChunkSize: 50 
      });

      chunks.forEach((chunk) => {
        expect(chunk.content.length).toBeGreaterThanOrEqual(50);
      });
    });

    it('should create overlapping chunks', () => {
      const text = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.repeat(10);
      const chunks = chunkText(text, { 
        maxChunkSize: 100,
        overlapSize: 20 
      });

      if (chunks.length > 1) {
        for (let i = 1; i < chunks.length; i++) {
          const prevChunk = chunks[i - 1];
          const currentChunk = chunks[i];
          
          // Check that there's some overlap
          expect(currentChunk.startPosition).toBeLessThan(prevChunk.endPosition);
        }
      }
    });

    it('should handle edge cases with special characters', () => {
      const text = 'Mr. Smith went to Dr. Johnson\'s office. It cost $50.99. What a deal!';
      const chunks = chunkText(text, { maxChunkSize: 30 });

      expect(chunks.length).toBeGreaterThanOrEqual(1);
      chunks.forEach((chunk) => {
        expect(chunk.content.trim()).toBeTruthy();
      });
    });

    it('should use custom chunking options', () => {
      const text = 'A'.repeat(1000);
      const customOptions: Partial<ChunkingOptions> = {
        maxChunkSize: 300,
        overlapSize: 50,
        minChunkSize: 100,
        preferParagraphs: false,
        ensureCompleteSentences: false,
      };

      const chunks = chunkText(text, customOptions);

      chunks.forEach((chunk) => {
        expect(chunk.content.length).toBeLessThanOrEqual(300);
        expect(chunk.content.length).toBeGreaterThanOrEqual(100);
      });
    });
  });

  describe('createPostChunks', () => {
    const mockPost = {
      id: 1,
      title: 'Test Post',
      cleanTitle: 'Clean Test Post',
      url: 'https://example.com/test-post',
      extractedText: 'This is the extracted text content of the post. It contains multiple sentences.',
      site_id: 'site-123',
      site_name: 'Test Site',
      site_url: 'https://example.com',
    };

    it('should create chunks with correct metadata', () => {
      const chunks = createPostChunks(mockPost);

      expect(chunks.length).toBeGreaterThanOrEqual(1);
      
      chunks.forEach((chunk, index) => {
        expect(chunk.id).toBe(`${mockPost.site_id}-${mockPost.id}-chunk-${index}`);
        expect(chunk.postId).toBe(mockPost.id);
        expect(chunk.postTitle).toBe(mockPost.cleanTitle);
        expect(chunk.postUrl).toBe(mockPost.url);
        expect(chunk.siteId).toBe(mockPost.site_id);
        expect(chunk.siteName).toBe(mockPost.site_name);
        expect(chunk.siteUrl).toBe(mockPost.site_url);
        expect(chunk.chunkIndex).toBe(index);
        expect(chunk.content).toBeTruthy();
        expect(chunk.startPosition).toBeGreaterThanOrEqual(0);
        expect(chunk.endPosition).toBeGreaterThan(chunk.startPosition);
      });
    });

    it('should handle post without optional site metadata', () => {
      const postWithoutSiteInfo = {
        ...mockPost,
        site_name: undefined,
        site_url: undefined,
      };

      const chunks = createPostChunks(postWithoutSiteInfo);

      expect(chunks.length).toBeGreaterThanOrEqual(1);
      expect(chunks[0].siteName).toBeUndefined();
      expect(chunks[0].siteUrl).toBeUndefined();
    });
  });

  describe('createBatchPostChunks', () => {
    const mockPosts = [
      {
        id: 1,
        title: 'Post 1',
        cleanTitle: 'Clean Post 1',
        url: 'https://example.com/post-1',
        extractedText: 'Content for post 1.',
        site_id: 'site-123',
      },
      {
        id: 2,
        title: 'Post 2',
        cleanTitle: 'Clean Post 2',
        url: 'https://example.com/post-2',
        extractedText: 'Content for post 2.',
        site_id: 'site-123',
      },
    ];

    it('should create chunks for multiple posts', () => {
      const chunks = createBatchPostChunks(mockPosts);

      expect(chunks.length).toBeGreaterThanOrEqual(2);
      
      // Should have chunks from both posts
      const post1Chunks = chunks.filter(chunk => chunk.postId === 1);
      const post2Chunks = chunks.filter(chunk => chunk.postId === 2);
      
      expect(post1Chunks.length).toBeGreaterThanOrEqual(1);
      expect(post2Chunks.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle empty posts array', () => {
      const chunks = createBatchPostChunks([]);
      expect(chunks).toEqual([]);
    });
  });

  describe('getChunkingStats', () => {
    const mockChunks: TextChunk[] = [
      {
        id: 'site-1-1-chunk-0',
        postId: 1,
        postTitle: 'Post 1',
        postUrl: 'https://example.com/1',
        siteId: 'site-1',
        chunkIndex: 0,
        content: 'Content for chunk 1. This is a complete sentence.',
        startPosition: 0,
        endPosition: 50,
      },
      {
        id: 'site-1-1-chunk-1',
        postId: 1,
        postTitle: 'Post 1',
        postUrl: 'https://example.com/1',
        siteId: 'site-1',
        chunkIndex: 1,
        content: 'Content for chunk 2',
        startPosition: 30,
        endPosition: 55,
      },
      {
        id: 'site-1-2-chunk-0',
        postId: 2,
        postTitle: 'Post 2',
        postUrl: 'https://example.com/2',
        siteId: 'site-1',
        chunkIndex: 0,
        content: 'Content for chunk 3! Another complete sentence.',
        startPosition: 0,
        endPosition: 48,
      },
    ];

    it('should calculate correct statistics', () => {
      const stats = getChunkingStats(mockChunks);

      expect(stats.totalChunks).toBe(3);
      expect(stats.totalPosts).toBe(2);
      expect(stats.averageChunkSize).toBeGreaterThan(20);
      expect(stats.chunksPerPost).toEqual({ 1: 2, 2: 1 });
      expect(stats.sentenceCompleteness).toBeGreaterThanOrEqual(0);
      expect(stats.sentenceCompleteness).toBeLessThanOrEqual(100);
    });

    it('should handle empty chunks array', () => {
      const stats = getChunkingStats([]);

      expect(stats.totalChunks).toBe(0);
      expect(stats.totalPosts).toBe(0);
      expect(stats.averageChunkSize).toBe(0);
      expect(stats.chunksPerPost).toEqual({});
      expect(stats.sentenceCompleteness).toBe(0);
    });
  });
});