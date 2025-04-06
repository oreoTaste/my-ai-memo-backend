import { MiddlewareConsumer, Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { LoggerMiddleware } from './log/logger.middleware';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './user/entity/user.entity';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule } from '@nestjs/config';
import { UserModule } from './user/user.module';
import { UserController } from './user/user.controller';
import { CacheModule } from '@nestjs/cache-manager';
import * as redisStore from 'cache-manager-ioredis';
import { MemoModule } from './memo/memo.module';
import { MemoController } from './memo/memo.controller';
import { Memo, SharedMemo } from './memo/entity/memo.entity';
import { Code } from './code/entity/code.entity';
import { CodeGroup } from './code/entity/code.entity';
import { CodeModule } from './code/code.module';
import { Record } from './record/entity/record.entity';
import { RecordModule } from './record/record.module';
import { CodeController } from './code/code.controller';
import { TodoController } from './todo/todo.controller';
import { TodoModule } from './todo/todo.module';
import { Todo } from './todo/entity/todo.entity';
import { CommonModule } from './common/common.module';
import { FileModule } from './file/file.module';
import { UploadFile } from './file/entity/file.entity';
import { FileController } from './file/file.controller';
import { QueryModule } from './query/query.modue';
import { QueryController } from './query/query.controller';
import { BatchModule } from './batch/batch.module';
import { RecordController } from './record/record.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: ['.env'],
      isGlobal: true,
    })
  , CacheModule.register({
    store: redisStore,
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
    ttl: 120 /* 2분 */,
    isGlobal: true,
  })
  , TypeOrmModule.forRoot({
    type: 'oracle',
    host: process.env.DB_HOST,
    port: +process.env.DB_PORT,
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: 'xe',
    entities: [User, Memo, Record, CodeGroup, Code, Todo, UploadFile, SharedMemo],
    synchronize: true,
    logging:'all',
    dropSchema: false
    })
  , ScheduleModule.forRoot()
  , UserModule
  , MemoModule
  , RecordModule
  , CodeModule
  , TodoModule
  , CommonModule
  , FileModule
  , QueryModule
  , BatchModule
  ],
  controllers: [AppController],
  providers: [AppService],
  exports: []
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(LoggerMiddleware/* , IpCheckMiddleware */)
      .forRoutes(AppController, UserController, MemoController, CodeController, TodoController, FileController, QueryController, RecordController);
  }  
}
