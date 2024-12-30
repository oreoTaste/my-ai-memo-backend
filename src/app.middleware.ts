import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class IpCheckMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    console.log("IpCheckMiddleware");
    const allowedIp = '192.168.56.1';
    let clientIp = req.ip; // 클라이언트의 IP 주소

    if (req.headers['x-forwarded-for']) {
      clientIp = req.headers['x-forwarded-for'].toString().split(',')[0].trim(); // 여러 개의 IP가 있을 수 있음
    }

    // IPv6 주소에 있는 ::ffff: 접두사 제거
    if (clientIp.startsWith('::ffff:')) {
      clientIp = clientIp.slice(7); // "::ffff:" 길이만큼 잘라낸다.
    }
    // console.log('req.ip:', req.ip);
    // console.log('X-Forwarded-For:', req.headers['x-forwarded-for']);    
    // console.log(`clientIp: ${clientIp}, ${allowedIp}`)
    // IP가 맞지 않으면 요청을 차단
    if (clientIp !== allowedIp) {
      return res.status(403).send('Access Forbidden');
    }

    // 조건이 맞으면 다음 미들웨어나 라우터로 넘기기
    next();
  }
}
