import { Global, Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { existsSync, mkdirSync } from 'fs';
import { AIAnalyzerService } from './ai-analyzer.service';
import { Code } from 'src/code/entity/code.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UploadFile } from 'src/file/entity/file.entity';

@Global()
@Module({
  imports: [
      MulterModule.register({
        storage: diskStorage({
          destination: (req, file, callback) => {
            const uploadPath = './uploads';
            if (!existsSync(uploadPath)) {
              mkdirSync(uploadPath);
            }
            callback(null, uploadPath);
          },
          filename: (req, file, callback) => {
            const decodedName = Buffer.from(file.originalname, 'latin1').toString('utf8');
            console.log(decodedName);
            callback(null, `${decodedName}`);
          }
        }),
        limits: {
          fileSize: 1024 * 1024 * 1024,  // 1GB로 파일 크기 제한 설정
        }
      }),
      TypeOrmModule.forFeature([Code, UploadFile]),
    ],
  providers: [AIAnalyzerService],
  controllers: [],
  exports: [MulterModule, AIAnalyzerService]
})
export class CommonModule {}
