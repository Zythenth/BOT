export interface GifRatioBucket {
  minApproved: number;
  maxApproved?: number;
  databaseRatio: number;
  giphyRatio: number;
}

export const GIF_RATIO_BUCKETS = [
  {
    minApproved: 0,
    maxApproved: 19,
    databaseRatio: 0.65,
    giphyRatio: 0.35
  },
  {
    minApproved: 20,
    maxApproved: 49,
    databaseRatio: 0.7,
    giphyRatio: 0.3
  },
  {
    minApproved: 50,
    maxApproved: 99,
    databaseRatio: 0.75,
    giphyRatio: 0.25
  },
  {
    minApproved: 100,
    maxApproved: 199,
    databaseRatio: 0.8,
    giphyRatio: 0.2
  },
  {
    minApproved: 200,
    databaseRatio: 0.85,
    giphyRatio: 0.15
  }
] as const satisfies readonly GifRatioBucket[];
