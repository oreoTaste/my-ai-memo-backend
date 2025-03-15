import { Global, Module } from '@nestjs/common';
import { FileService } from './file.service';
import { UploadFile } from './entity/file.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FileController } from './file.controller';
import { Code } from 'src/code/entity/code.entity';
import { GoogleDriveService } from './google-drive.service';

@Global()
@Module({
    imports: [
        TypeOrmModule.forFeature([UploadFile, Code]),
      ],
    providers: [FileService, GoogleDriveService],
    controllers: [FileController],
    exports: [FileService, GoogleDriveService]
  })
export class FileModule {}
