export interface BlockAttributes {
  [key: string]: unknown;
  id: string;
}

export interface GutenbergBlock {
  blockName: string | null;
  attrs: BlockAttributes;
  innerBlocks: GutenbergBlock[];
  innerHTML: string;
  innerContent: (string | null)[];
}

export interface Block {
  id: number;
  title: string;
  content: string;
  status: string;
  parent: number | null;
  order: number;
  type: string;
  metadata: Record<string, unknown>;
}

export interface CurriculumModule {
  id: number;
  permalink: string;
  blocks: GutenbergBlock[];
  title: string;
}

// WordPress REST API response types
export interface WPPostResponse {
  id: number;
  permalink: string;
  content: string;
  blocks: GutenbergBlock[];
  title: string;
}
