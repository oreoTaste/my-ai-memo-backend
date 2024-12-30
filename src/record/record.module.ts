import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Record } from './entity/record.entity';
import { RecordService } from './record.service';
import { RecordController } from './record.controller';
import { Code } from 'typeorm';
import { CodeModule } from 'src/code/code.module';

@Module({
  imports: [
      TypeOrmModule.forFeature([Record]),
      CodeModule
  ],
  providers: [RecordService],
  controllers: [RecordController]
})
export class RecordModule {}
