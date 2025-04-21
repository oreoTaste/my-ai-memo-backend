import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  constructor(private readonly configService: ConfigService
           , @Inject(CACHE_MANAGER) private cacheManager: Cache
          ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    Logger.log(`[LoggerMiddleware] ${req.protocol}://${req.hostname}:${this.configService.get<string>("PORT")}${req.url} (${req.method})`);
    Logger.log(`    body: ${JSON.stringify(req.body)}`);
    if(req.cookies?.nsessionId) {
      let userId = await this.cacheManager.get(req.cookies.nsessionId);
      req.cookies['userId'] = userId;
    }
    next();
  }
}
