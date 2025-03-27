import { Controller, Get, HttpException, HttpStatus, Logger, Query, Res } from '@nestjs/common';
import { FileService } from './file.service';
import { AuthUser } from 'src/common/decorator/custom-decorator';
import { AuthUserDto } from 'src/user/dto/user.dto';
import { DownloadFileDto } from './dto/file.dto';
import { Response } from 'express';
import { GoogleDriveService } from './google-drive.service';
import { UploadFile } from './entity/file.entity';

@Controller('file')
export class FileController {
    constructor(private readonly fileService: FileService,
                private readonly googleDriveService: GoogleDriveService
            ){}

    @Get('download')
    async downloadFile(
        @AuthUser() authUser: AuthUserDto,
        @Query() downloadFileDto: DownloadFileDto,
        @Res({ passthrough: true }) res: Response, // passthrough 옵션 추가
    ): Promise<void> {
        if (!authUser) {
            throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
        }

        let uploadFile: UploadFile = null;
        let existGoogleDriveYn = true; // 구글드라이브 존재여부
        try {
            uploadFile = await this.fileService.getFileInfo(authUser.id, downloadFileDto);
            if (!uploadFile) {
                throw new HttpException('[downloadFile] File not found', HttpStatus.NOT_FOUND);
            }

            Logger.debug(`[downloadFile] fileName: ${uploadFile?.fileName}, fileId: ${uploadFile?.googleDriveFileId}`);

            if(!uploadFile.googleDriveFileId) { // 체크1. db내 파일id가 있는지 확인
                existGoogleDriveYn = false;
            }
            if(existGoogleDriveYn) { // 체크2. 구글 드라이브에 파일id가 있는지 확인
                existGoogleDriveYn = await this.googleDriveService.fileExists(uploadFile, authUser.id);
            }
            
            if(existGoogleDriveYn) {
                await this.googleDriveService.downloadFile(uploadFile.googleDriveFileId, res, authUser.id);
            } else {
                // throw new Error("구글드라이브에 파일이 없음")
                await this.fileService.downloadFile(uploadFile.seq , uploadFile.fileName, res);
            }

            // 스트림 완료를 기다리기 위해 Promise 반환 (GoogleDriveService에서 제공)
            return new Promise((resolve, reject) => {
                res.on('finish', () => {
                    Logger.debug(`[downloadFile] Succeed to download file (fileName: ${uploadFile?.fileName}, fileId: ${uploadFile?.googleDriveFileId})`);
                    resolve();
                });
                res.on('error', (err) => {
                    Logger.error(`[downloadFile] Failed to stream file (fileName: ${uploadFile?.fileName}, fileId: ${uploadFile?.googleDriveFileId}): ${err.message}`);
                    reject(err);
                });
            });
        } catch (e) {
            Logger.error(`[downloadFile] Failed to download file (fileName: ${uploadFile?.fileName}, fileId: ${uploadFile?.googleDriveFileId}): ${e.message}`);
            throw new HttpException(e.message || 'Failed to download file',
                                    e.status || HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }


}