import { Injectable, OnModuleInit } from '@nestjs/common';
import { User } from './user/entity/user.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class AppService /*implements OnModuleInit */{

  // constructor(
  //   @InjectRepository(User)
  //   private userRepository: Repository<User>,
  // ) {}

  // async onModuleInit() {
  //   try {
  //     // DB 연결 테스트
  //     const connection = await this.userRepository.query('SELECT 1 FROM DUAL');
  //     console.log('DB 연결 확인:', connection);
  //   } catch (error) {
  //     console.error('DB 연결 실패:', error);
  //   }
  // }
}