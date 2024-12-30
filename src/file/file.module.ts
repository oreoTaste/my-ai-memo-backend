import { Global, Module } from '@nestjs/common';
import { FileService } from './file.service';
import { UploadFile } from './entity/file.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FileController } from './file.controller';

@Global()
@Module({
    imports: [
        TypeOrmModule.forFeature([UploadFile]),
      ],
    providers: [FileService],
    controllers: [FileController],
    exports: [FileService]
  })
export class FileModule {}
