import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BatchService } from './batch.service';
import { Todo } from 'src/todo/entity/todo.entity';
import { Code } from 'src/code/entity/code.entity';
import { BatchController } from './bach.controller';

@Module({
  imports: [
      TypeOrmModule.forFeature([Todo, Code]),
    ],
  exports: [TypeOrmModule],
  providers: [BatchService],
  controllers: [BatchController]
})
export class BatchModule {}
