type RateLimitResult = {
  readonly allowed: boolean;
  readonly limit: number;
  readonly remaining: number;
  readonly resetAt: number;
  readonly retryAfterSeconds: number;
};

type RateLimitOptions = {
  readonly key: string;
  readonly limit: number;
  readonly windowMs: number;
  readonly now?: number;
};

type Bucket = {
  hits: number[];
};

const buckets = new Map<string, Bucket>();

function pruneBucket(bucket: Bucket, windowStart: number) {
  bucket.hits = bucket.hits.filter((timestamp) => timestamp > windowStart);
}

function cleanupExpiredBuckets(windowStart: number) {
  for (const [key, bucket] of buckets.entries()) {
    pruneBucket(bucket, windowStart);

    if (bucket.hits.length === 0) {
      buckets.delete(key);
    }
  }
}

export function takeRateLimit({
  key,
  limit,
  windowMs,
  now = Date.now()
}: RateLimitOptions): RateLimitResult {
  const windowStart = now - windowMs;
  const bucket = buckets.get(key) ?? { hits: [] };

  pruneBucket(bucket, windowStart);

  if (bucket.hits.length >= limit) {
    const oldestHit = bucket.hits[0] ?? now;
    const resetAt = oldestHit + windowMs;

    buckets.set(key, bucket);
    cleanupExpiredBuckets(windowStart);

    return {
      allowed: false,
      limit,
      remaining: 0,
      resetAt,
      retryAfterSeconds: Math.max(1, Math.ceil((resetAt - now) / 1000))
    };
  }

  bucket.hits.push(now);
  buckets.set(key, bucket);
  cleanupExpiredBuckets(windowStart);

  return {
    allowed: true,
    limit,
    remaining: Math.max(0, limit - bucket.hits.length),
    resetAt: now + windowMs,
    retryAfterSeconds: 0
  };
}

export function getClientRateLimitKey(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  const vercelForwardedFor = request.headers.get("x-vercel-forwarded-for");
  const userAgent = request.headers.get("user-agent") ?? "unknown";

  const ip =
    forwardedFor?.split(",")[0]?.trim() ||
    vercelForwardedFor?.split(",")[0]?.trim() ||
    realIp?.trim() ||
    "anonymous";

  return `${ip}:${userAgent.slice(0, 120)}`;
}
