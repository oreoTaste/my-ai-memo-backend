import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
// import * as cookieParser from 'cookie-parser';
import * as session from 'express-session';
import RedisStore from 'connect-redis';
import { Redis } from 'ioredis';
import * as express from 'express';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const PORT = 3000;

  const config = new DocumentBuilder()
  .addCookieAuth('connect.sid')
  .setTitle("Webtoon Recommend")
  .setDescription("Webtoon Recommend API description")
  .setVersion("1.0")
  .addTag("webtoon")
  .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("api", app, document);

  // validation 설정
  app.useGlobalPipes(new ValidationPipe());
  const redisClient = new Redis({
    host: process.env.REDIS_HOST,
    port: +process.env.REDIS_PORT,
  });

  app.use(
    session({
      secret: 'my-secret',
      resave: false,
      saveUninitialized: false,
      store: new RedisStore({
        // store: redisStore,
        client: redisClient,
      }),
      cookie: {
        httpOnly: true,
        secure: false,
        maxAge: 1000 * 60 * 60 * 24,  // 쿠키 유효 기간 (1일)
        // path: '/',
      }
    }),
    // 쿠키
    // cookieParser(),
  );

  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.set('trust proxy', true);

  app.enableCors({
    origin: ['http://192.168.56.1:5000', 'http://192.168.56.1:80'],  // 모든 출처에서의 요청을 허용
    methods: 'GET,POST,DELETE', // 허용할 HTTP 메소드
    allowedHeaders: 'Content-Type, Accept, Authorization', // 허용할 헤더
    credentials: true,  // 쿠키 포함 허용
  });

  app.use('/uploads', express.static(join(__dirname, '..', 'uploads')));

  // 서버기동
  await app.listen(PORT, () => {
    console.log(`Running API on port : ${PORT}`);
  });

}
bootstrap();
