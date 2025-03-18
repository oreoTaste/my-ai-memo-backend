import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { DownloadFileDto, InsertFileDto, SearchFilesDto } from './dto/file.dto';
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
        private readonly googleDriverService: GoogleDriveService,
        // private readonly batchController: BatchController
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
     * 2 : 업로드/다운로드 파일명에서 uploads를 삭제한 파일명
     * @returns 
     */
    async searchFiles(searchFilesDto: SearchFilesDto, fileNameType: number): Promise<UploadFile[]> {
        let uploadFiles = [] as UploadFile[];
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


            if(fileNameType !== null && fileNameType === 1) { // db상의 파일명
                uploadFiles = await this.fileRepository.find({where: searchMap, select: ['fileName', 'googleDriveFileId']});
            } else if(fileNameType !== null && fileNameType === 2) { //업로드/다운로드 파일명에서 uploads를 삭제한 파일명
                uploadFiles = await this.fileRepository.find({where: searchMap, select: ['fileName', 'googleDriveFileId']});
                uploadFiles.forEach(el => {
                    el.fileName = this.getRealFileNameWithPrefix(el.fileName)
                });

            } else { // 업로드/다운로드 파일명 (default)
                uploadFiles = await this.fileRepository.find({where: searchMap, select: ['fileName', 'googleDriveFileId']});
                uploadFiles.forEach(el => {
                    el.fileName = this.getRealFileName(el.fileName)
                });
            }
            return uploadFiles;
        } catch(error) {
            return null;
        }
    }
    
    /** @description Updates fileId in the file table based on provided file data */
    async updateFiles(updateFiles: UploadFile[]): Promise<void> {
        try {
            // 트랜잭션 시작 (여러 파일 업데이트를 원자적으로 처리하기 위해)
            await this.fileRepository.manager.transaction(async (transactionalEntityManager) => {
                // updateFiles 배열을 순회하면서 각 파일을 업데이트
                for (const file of updateFiles) {
                    // 복합 기본 키(fileFrom, seq, fileName)를 기준으로 기존 파일 찾기
                    const existingFile = await transactionalEntityManager.findOne(UploadFile, {
                        where: {
                            fileFrom: file.fileFrom,
                            seq: file.seq,
                            fileName: file.fileName
                        }
                    });
    
                    if (existingFile) {
                        // fileId만 업데이트
                        await transactionalEntityManager.update(
                            UploadFile,
                            {
                                fileFrom: file.fileFrom,
                                seq: file.seq,
                                fileName: file.fileName
                            },
                            {
                                googleDriveFileId: file.googleDriveFileId
                            }
                        );
                    } else {
                        throw new Error(`File not found: ${file.fileName}`);
                    }
                }
            });
        } catch (error) {
            throw new Error(`Failed to update files: ${error.message}`);
        }
    }

    /**
     * @param searchFilesDto - 검색조건
     * @param fileNameType - 파일명 추출조건\
     * 0 : 업로드/다운로드 파일명 (default)\
     * 1 : db상의 파일명
     * @returns 
     */
    async searchFileNames(searchFilesDto: SearchFilesDto, fileNameType: number): Promise<{ fileName: string, googleDriveFileId: string }[]> {
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

            let uploadFileNames: { fileName: string, googleDriveFileId: string }[] = [];
            let uploadedFiles = await this.fileRepository.find({where: searchMap, select: ['fileName', 'googleDriveFileId']});

            if(fileNameType !== null && fileNameType === 1) { // db상의 파일명
                for(let uploadedFile of uploadedFiles) {
                    uploadFileNames.push({fileName: uploadedFile.fileName, googleDriveFileId: uploadedFile.googleDriveFileId})
                }
            } else {
                for(let uploadedFile of uploadedFiles) {
                    uploadFileNames.push({fileName: this.getRealFileName(uploadedFile.fileName), googleDriveFileId: uploadedFile.googleDriveFileId})
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

    public async saveFile(loginId: number, file: InsertFileDto):Promise<UploadFile> {
        let newFile = new UploadFile();
        newFile.fileName = file.fileName;
        newFile.fileFrom = file.fileFrom;
        newFile.insertId = newFile.updateId = loginId;
        newFile.seq = file.seq;
        newFile.googleDriveFileId = file.googleDriveFileId;
        return await this.fileRepository.save(newFile);
    }

    async insertFiles(insertId: number, uploadFiles: Array<Express.Multer.File>, fileFrom: string, memoSeq: number) : Promise<UploadFile[]>{
        let insertFiles = [] as UploadFile[]
        try {
            for(let uploadFile of uploadFiles) {
                // 원하는 저장 경로 (예: ./uploads 디렉터리로 이동)
                let fullFileName = this.getSaveFileName(insertId, memoSeq, uploadFile.filename);
                const targetPath = join(fullFileName);
    
                // 파일 이동 (임시 디렉터리 -> 실제 저장 디렉터리)
                renameSync(uploadFile.path, targetPath);

                let savedFile = await this.saveFile(insertId, {fileFrom, fileName: targetPath, googleDriveFileId: null, seq: memoSeq});
                insertFiles.push(savedFile);

            }
            
            if(uploadFiles.length) {
                // 구글 드라이브에 저장 (비동기)
                this.uploadToGoogleDrive(insertFiles).catch((e) => {
                    console.error(`비동기 구글 드라이브 업로드 실패: ${e}`);
                });
            }

            return insertFiles;
        } catch(e) {
            return insertFiles;
        }
    }
    async uploadToGoogleDrive(files: UploadFile[]) {
        try {
            // 구글 드라이브에 저장
            let googleFiles = await this.googleDriverService.uploadFiles(files);
            // 파일 삭제 (비동기적으로 처리)
            // await fs.unlink(targetPath); // Promise 기반 unlink
            // Logger.debug(`${targetPath} is deleted`);

            await this.updateFiles(googleFiles);

        } catch (e) {
            console.error(`구글 드라이브 저장 중 오류 ${e}`);
        }
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
            let files = await this.fileRepository.find({ where: searchMap, select: ['googleDriveFileId', 'fileName', 'seq']});
            
            if(!files.length) {
                return false;
            }

            try {
                // 구글 드라이브에서 삭제
                let googleDriveFileIds = files.map(el => el.googleDriveFileId).filter(el => el);
                await this.googleDriverService.deleteFilesWithFileId(googleDriveFileIds, insertId);
                Logger.debug(`succeed to delete files remotely (filesIds:${googleDriveFileIds.join(',')})`);
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
            await this.fileRepository.delete({ seq: memoSeq });
            Logger.debug(`succeed to delete files in db (fileName:${files.map(el => el.fileName).join(',')})`);
            return true;
        } catch (err) {
            Logger.error('[deleteFiles] Error in deleteFiles:', err);
            return false;
        }
    }
}