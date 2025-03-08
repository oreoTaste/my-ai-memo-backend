import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { DownloadFileDto, InsertFileDto, InsertFileResultDto, SearchFilesDto } from './dto/file.dto';
import { join } from 'path';
import * as path from 'path';
import { renameSync } from 'fs';
import { UploadFile } from './entity/file.entity';
import * as fs from 'node:fs/promises';
import { Response } from 'express';
import { GoogleDriveService } from './google-drive.service';

@Injectable()
export class FileService {

    constructor(
        @InjectRepository(UploadFile) private fileRepository: Repository<UploadFile>,
        private googleDriverService: GoogleDriveService
    ){}

    public getRealFileName(savedFileName: string) {
        let match = savedFileName.match(/[^_]+_[^_]+_(.*)/);
        return match ? match[1] : savedFileName;
    }

    public getRealFileNameWithPrefix(savedFileName: string) {
        let match = savedFileName.match(/^uploads\/(.*)$/);
        return match ? match[1] : savedFileName;
    }

    private getSaveFileName(insertId: string|number, seq: string|number, fileName: string) {
        return `uploads/${insertId}_${seq}_${fileName}`;
    }
    
    /**
     * @param searchFilesDto - 검색조건
     * @param fileNameType - 파일명 추출조건\
     * 0 : 업로드/다운로드 파일명 (default)\
     * 1 : db상의 파일명
     * @returns 
     */
    async searchFileNames(searchFilesDto: SearchFilesDto, fileNameType: number): Promise<{ fileName: string, fileId: string }[]> {
        try {
            let searchMap = {};
            if(searchFilesDto.seq) {
                searchMap['seq'] = searchFilesDto.seq;
            }
            if(searchFilesDto.fileFrom) {
                searchMap['fileFrom'] = searchFilesDto.fileFrom;
            }
            if(searchFilesDto.fileName) {
                searchMap['fileName'] = searchFilesDto.fileName;
            }

            let uploadFileNames: { fileName: string, fileId: string }[] = [];
            let uploadedFiles = await this.fileRepository.find({where: searchMap, select: ['fileName', 'fileId']});

            if(fileNameType !== null && fileNameType === 1) { // db상의 파일명
                for(let uploadedFile of uploadedFiles) {
                    uploadFileNames.push({fileName: uploadedFile.fileName, fileId: uploadedFile.fileId})
                }
            } else {
                for(let uploadedFile of uploadedFiles) {
                    uploadFileNames.push({fileName: this.getRealFileName(uploadedFile.fileName), fileId: uploadedFile.fileId})
                }
            }
            return uploadFileNames;
        } catch(error) {
            return null;
        }
    }
    
    async getSavedFileName(insertId: string | number, downloadFilesDto: DownloadFileDto): Promise<UploadFile> {
        try {
            // fileName이 필요없을 것으로 판단됨
            // downloadFilesDto.fileName = this.getSaveFileName(insertId, downloadFilesDto.seq, downloadFilesDto.fileName);
            return await this.fileRepository.findOne({where: downloadFilesDto});
        } catch(error) {
            return null;
        }
    }
    
    async downloadFile(savedFileName: string, res: Response) {
        // 파일 경로를 안전하게 생성 (fileName은 이미 uploads/로 시작하므로 split할 필요 없음)
        const filePath = path.resolve(__dirname, "../../", savedFileName); // __dirname은 현재 디렉토리 경로를 반환
        console.log(filePath + " : " + savedFileName);
    
        try {
            // 파일이 존재하는지 비동기적으로 확인
            const exists = await fs.access(filePath).then(() => true).catch(() => false);
            if (!exists) {
                throw new Error('File not found');
            }
    
            // 파일 상태를 비동기적으로 가져오기
            const stat = await fs.stat(filePath);
    
            // 파일이 디렉토리인지 확인
            if (stat.isDirectory()) {
                throw new Error('The provided path is a directory, not a file.');
            }
    
            // 파일이 존재하면 다운로드 (res.download은 비동기적으로 처리 가능)
            return new Promise((resolve, reject) => {
                res.download(filePath, this.getRealFileName(savedFileName), (err) => {
                    if (err) {
                        console.error(err);
                        reject(new Error('Error downloading file'));
                    } else {
                        resolve(undefined); // 성공 시 resolve
                    }
                });
            });
        } catch (error) {
            console.error(error);
            throw error; // 에러를 상위로 전달
        }
    }

    private async saveFile(loginId: number, file: InsertFileDto) {
        let newFile = new UploadFile();
        newFile.fileName = file.fileName;
        newFile.fileFrom = file.fileFrom;
        newFile.insertId = newFile.updateId = loginId;
        newFile.seq = file.seq;
        newFile.fileId = file.fileId;
        await this.fileRepository.save(newFile);
    }

    async insertFiles(insertId: number, uploadFiles: Array<Express.Multer.File>, fileFrom: string, memoSeq: number) : Promise<InsertFileResultDto>{
        for(let uploadFile of uploadFiles) {
            let googleDriveFileName = null;

            // 원하는 저장 경로 (예: ./uploads 디렉터리로 이동)
            let fullFileName = this.getSaveFileName(insertId, memoSeq, uploadFile.filename);
            let realFileName = this.getRealFileNameWithPrefix(fullFileName);
            const targetPath = join(fullFileName);

            // 파일 이동 (임시 디렉터리 -> 실제 저장 디렉터리)
            renameSync(uploadFile.path, targetPath);

            let googleFileId = "";
            try {
                // 구글 드라이브에 저장
                googleFileId = (await this.googleDriverService.insertFiles([{fullFileName: targetPath, fileNameWithPrefiex: realFileName}], insertId))[0];
                // 파일 삭제 (비동기적으로 처리)
                // await fs.unlink(targetPath); // Promise 기반 unlink
                // Logger.debug(`${targetPath} is deleted`);

            } catch(e) {
                console.error(`구글드라이브 저장 중 오류 ${e}`);

            } finally{
                // 파일 정보 등록
                await this.saveFile(insertId, {fileFrom, fileName: targetPath, fileId: googleFileId, seq: memoSeq});
            }
        }
        return new InsertFileResultDto(uploadFiles.length);
    }

    /**
     * @param fileFrom 
     * @param memoSeq 
     * @param insertId 
     * @returns 
     * @description: 파일목록 조회 후, 구글드라이브 및 로컬파일 삭제
     */
    async deleteFiles(fileFrom: string, memoSeq: number, insertId: number): Promise<boolean> {
        let searchMap = {};
        if (fileFrom) {
            searchMap['fileFrom'] = fileFrom;
        }
        if (memoSeq) {
            searchMap['seq'] = memoSeq;
        }
    
        try {
            // 파일 목록 조회
            let files = await this.fileRepository.find({ where: searchMap, select: ['fileId', 'fileName', 'seq']});
    
            try {
                // 구글 드라이브에서 삭제
                let fileIds = files.map(el => el.fileId);
                await this.googleDriverService.deleteFilesWithFileId(fileIds, insertId);
                Logger.debug(`succeed to delete files remotely (filesIds:${fileIds.join(',')})`);
            } catch(e) {
                Logger.error(`[deleteFiles] failed to delete file remotely ${e}`);
            }

            // 파일 삭제 (비동기적으로 처리)
            for (let file of files) {
                try {
                    await fs.unlink(file.fileName); // Promise 기반 unlink
                    Logger.debug(`succeed to delete files locally (fileName:${file.fileName})`);
                } catch (unlinkErr) {
                    Logger.error(`[deleteFiles] Failed to delete file locally (fileNames:${file.fileName})`, unlinkErr);
                    // 에러를 무시하고 진행하거나, 필요하면 throw로 중단 가능
                    // throw unlinkErr; // 필요 시 에러를 던져서 전체 작업 중단
                }
            }
            
            // DB에서 파일 레코드 삭제
            let seqs = files.map(el => el.seq);
            await this.fileRepository.delete( {seq: In(seqs)});
            Logger.debug(`succeed to delete files in db (fileName:${files.map(el => el.fileName).join(',')})`);
            return true;
        } catch (err) {
            Logger.error('[deleteFiles] Error in deleteFiles:', err);
            return false;
        }
    }
}