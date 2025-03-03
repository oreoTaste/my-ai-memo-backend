import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TaskService } from './task.service';
import { Todo } from 'src/todo/entity/todo.entity';
import { Code } from 'src/code/entity/code.entity';

@Module({
  imports: [
      TypeOrmModule.forFeature([Todo, Code]),
    ],
  exports: [TypeOrmModule],
  providers: [TaskService],
  controllers: []
})
export class BatchModule {}
