import { Body, Controller, Get, HttpException, HttpStatus, Logger, Post, Query, Res } from '@nestjs/common';
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

        let uploadFile = null;
        let existGoogleDriveYn = true; // 구글드라이브 존재여부
        try {
            uploadFile = await this.fileService.getSavedFileName(authUser.id, downloadFileDto);
            if (!uploadFile) {
                throw new HttpException('File not found', HttpStatus.NOT_FOUND);
            }

            Logger.debug(`[downloadFile] fileName: ${uploadFile?.fileName}, fileId: ${uploadFile?.fileId}`);

            if(uploadFile.fileId) { // 체크1. db내 파일id가 있는지 확인
                existGoogleDriveYn = false;
            }
            if(existGoogleDriveYn) { // 체크2. 구글 드라이브에 파일id가 있는지 확인
                existGoogleDriveYn = await this.googleDriveService.fileExists(uploadFile.fileId, authUser.id);
            }
            
            if(existGoogleDriveYn) {
                await this.googleDriveService.downloadFile(uploadFile.fileId, res, authUser.id);
            } else {
                await this.fileService.downloadFile(uploadFile.fileName, res);
            }

            // 스트림 완료를 기다리기 위해 Promise 반환 (GoogleDriveService에서 제공)
            return new Promise((resolve, reject) => {
                res.on('finish', () => {
                    Logger.debug(`[downloadFile] Succeed to download file (fileName: ${uploadFile?.fileName}, fileId: ${uploadFile?.fileId})`);
                    resolve();
                });
                res.on('error', (err) => {
                    Logger.error(`[downloadFile] Failed to stream file (fileName: ${uploadFile?.fileName}, fileId: ${uploadFile?.fileId}): ${err.message}`);
                    reject(err);
                });
            });
        } catch (e) {
            Logger.error(`[downloadFile] Failed to download file (fileName: ${uploadFile?.fileName}, fileId: ${uploadFile?.fileId}): ${e.message}`);
            throw new HttpException(e.message || 'Failed to download file',
                                    e.status || HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @Get('view')
    async viewFile(
        @AuthUser() authUser: AuthUserDto,
        @Query() downloadFileDto: DownloadFileDto,
        @Res() res: Response
    ): Promise<void> {
        if (!authUser) {
            throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
        }

        let uploadFile : UploadFile;
        try {
            uploadFile = await this.fileService.getSavedFileName(authUser.id, downloadFileDto);
            if (!uploadFile) {
                throw new HttpException('File not found', HttpStatus.NOT_FOUND);
            }

            Logger.debug(`[viewFile] fileName: ${uploadFile.fileName}, fileId: ${uploadFile.fileId}`);

            let viewUrl: string;
            if (uploadFile.fileId && await this.googleDriveService.fileExists(uploadFile.fileId, authUser.id)) {
                viewUrl = await this.googleDriveService.getFileViewUrl(uploadFile.fileId, authUser.id);
            } else {
                throw new HttpException('File not found in Google Drive', HttpStatus.NOT_FOUND);
            }

            res.status(HttpStatus.OK).send(viewUrl);
        } catch (e) {
            Logger.error(`[viewFile] Failed to get view URL (fileName: ${uploadFile?.fileName}, fileId: ${uploadFile?.fileId}): ${e.message}`);
            throw new HttpException(
                e.message || 'Failed to get file view URL',
                e.status || HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

}