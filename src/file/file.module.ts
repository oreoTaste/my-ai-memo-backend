import { Global, Module } from '@nestjs/common';
import { FileService } from './file.service';
import { UploadFile } from './entity/file.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FileController } from './file.controller';
import { Code } from 'src/code/entity/code.entity';

@Global()
@Module({
    imports: [
        TypeOrmModule.forFeature([UploadFile, Code]),
      ],
    providers: [FileService],
    controllers: [FileController],
    exports: [FileService]
  })
export class FileModule {}
