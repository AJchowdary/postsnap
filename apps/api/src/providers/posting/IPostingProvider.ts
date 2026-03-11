export interface PostPayload {
  caption: string;
  imageBase64?: string | null;
  imageUrl?: string | null;
  platform: 'instagram' | 'facebook';
  accountHandle: string;
}

export interface PostResult {
  success: boolean;
  externalId?: string;
  error?: string;
}

export interface IPostingProvider {
  publishPost(payload: PostPayload): Promise<PostResult>;
}
