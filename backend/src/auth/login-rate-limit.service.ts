import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface Bucket {
  count: number;
  resetAt: number;
}

@Injectable()
export class LoginRateLimitService {
  private readonly buckets = new Map<string, Bucket>();
  private readonly maximumAttempts: number;
  private readonly windowMilliseconds: number;

  constructor(configService: ConfigService) {
    this.maximumAttempts = Number(
      configService.get<string>('LOGIN_RATE_LIMIT_MAX', '10'),
    );
    this.windowMilliseconds = Number(
      configService.get<string>('LOGIN_RATE_LIMIT_WINDOW_MS', '60000'),
    );
  }

  consume(key: string, now = Date.now()): number | null {
    const current = this.buckets.get(key);
    if (!current || current.resetAt <= now) {
      this.buckets.set(key, {
        count: 1,
        resetAt: now + this.windowMilliseconds,
      });
      this.prune(now);
      return null;
    }

    current.count += 1;
    if (current.count <= this.maximumAttempts) return null;
    return Math.max(1, Math.ceil((current.resetAt - now) / 1_000));
  }

  private prune(now: number): void {
    if (this.buckets.size < 10_000) return;
    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= now) this.buckets.delete(key);
    }
  }
}
