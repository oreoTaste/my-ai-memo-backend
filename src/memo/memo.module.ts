import { Module } from '@nestjs/common';
import { MemoService } from './memo.service';
import { MemoController } from './memo.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Memo, SharedMemo } from './entity/memo.entity';
import { CommonModule } from 'src/common/common.module';
import { FileModule } from 'src/file/file.module';

@Module({
  imports: [
      TypeOrmModule.forFeature([Memo, SharedMemo]),
      CommonModule,
      FileModule
    ],
  providers: [MemoService],
  controllers: [MemoController]
})
export class MemoModule {}
