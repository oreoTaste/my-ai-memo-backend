import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Code, CodeGroup } from './entity/code.entity';
import { CodeService } from './code.service';
import { CodeController } from './code.controller';
import { User } from 'src/user/entity/user.entity';

@Module({
  imports: [
      TypeOrmModule.forFeature([Code, CodeGroup, User]),
    ],
  exports: [TypeOrmModule],
  providers: [CodeService],
  controllers: [CodeController]
})
export class CodeModule {}
