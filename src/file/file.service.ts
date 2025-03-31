import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CombinedUploadFile, DownloadFileDto, InsertFileDto, SearchFilesDto } from './dto/file.dto';
import { join } from 'path';
import * as path from 'path';
import { renameSync } from 'fs';
import { UploadFile } from './entity/file.entity';
import * as fs from 'node:fs/promises';
import { Response } from 'express';
import { GoogleDriveService } from './google-drive.service';
import { existsSync, mkdirSync, rm } from 'node:fs';


@Injectable()
export class FileService {

    constructor(
        @InjectRepository(UploadFile) private fileRepository: Repository<UploadFile>,
        private readonly googleDriverService: GoogleDriveService,
        // private readonly batchController: BatchController
    ){}
    
    /**
     * @param searchFilesDto - 검색조건
     * @param fileNameType - 파일명 추출조건\
     * 0 : 업로드/다운로드 파일명 (default)\
     * 1 : db상의 파일명
     * 2 : 업로드/다운로드 파일명에서 uploads를 삭제한 파일명
     * @returns 
     */
    /* analyze */
    async searchFiles(searchFilesDto: SearchFilesDto): Promise<UploadFile[]> {
        let uploadFiles = [] as UploadFile[];
        try {
            let searchMap = {};
            if(searchFilesDto.seq) {
                searchMap['seq'] = searchFilesDto.seq;
            }
            if(searchFilesDto.fileName) {
                searchMap['fileName'] = searchFilesDto.fileName;
            }

            uploadFiles = await this.fileRepository.find({where: searchMap, select: ['fileName', 'googleDriveFileId'], comment: "FileService.searchFiles"});
            return uploadFiles;
        } catch(error) {
            return null;
        }
    }
    
    /** @description Updates fileId in the file table based on provided file data */
    /* insertMemo */
    async updateGoogleDriveFileId(updateFiles: UploadFile[]): Promise<void> {
        try {
            // 트랜잭션 시작 (여러 파일 업데이트를 원자적으로 처리하기 위해)
            await this.fileRepository.manager.transaction(async (transactionalEntityManager) => {
                // updateFiles 배열을 순회하면서 각 파일을 업데이트
                for (const file of updateFiles) {
                    // 복합 기본 키(seq, fileName)를 기준으로 기존 파일 찾기
                    const existingFile = await transactionalEntityManager.findOne(UploadFile, {
                        where: {
                            seq: file.seq,
                            fileName: file.fileName
                        },
                        comment: "FileService.updateGoogleDriveFileId"
                    });
    
                    if (existingFile) {
                        // fileId만 업데이트
                        await transactionalEntityManager.update(
                            UploadFile,
                            {
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

    /* downloadFile */
    async getFileInfo(insertId: string | number, {fileName, seq, googleDriveFileId}: DownloadFileDto): Promise<UploadFile> {
        try {
            return await this.fileRepository.findOne({where: {fileName, seq, googleDriveFileId}, comment: "FileService.getFileInfo"});
        } catch(error) {
            return null;
        }
    }
    
    /* downloadFile */
    async downloadFile(seq: number, filename: string, res: Response) {
        // 파일 경로를 안전하게 생성 (fileName은 이미 uploads/로 시작하므로 split할 필요 없음)
        const fullFilePath = path.resolve(__dirname, "../../", `${String(seq)}/${filename}`); // __dirname은 현재 디렉토리 경로를 반환
        Logger.debug(fullFilePath);
    
        try {
            // 파일이 존재하는지 비동기적으로 확인
            if (!existsSync(fullFilePath)) {
                throw new Error('File not found');
            }
    
            // 파일 상태를 비동기적으로 가져오기
            const stat = await fs.stat(fullFilePath);
    
            // 파일이 디렉토리인지 확인
            if (stat.isDirectory()) {
                throw new Error('The provided path is a directory, not a file.');
            }
    
            // 파일이 존재하면 다운로드 (res.download은 비동기적으로 처리 가능)
            return new Promise((resolve, reject) => {
                res.download(fullFilePath, filename, (err) => {
                    if (err) {
                        Logger.error(`[downloadFile] Error downloading file ${err}`);
                        reject(new Error('Error downloading file'));
                    } else {
                        resolve(undefined); // 성공 시 resolve
                    }
                });
            });
        } catch (error) {
            Logger.error(`[downloadFile] 다운로드 오류 ${error}`);
            throw error; // 에러를 상위로 전달
        }
    }

    /* insertMemo */
    public async saveFile(loginId: number, file: InsertFileDto):Promise<UploadFile> {
        let newFile = new UploadFile();
        newFile.fileName = file.fileName;
        newFile.insertId = newFile.updateId = loginId;
        newFile.seq = file.seq;
        newFile.googleDriveFileId = file.googleDriveFileId;
        return await this.fileRepository.save(newFile);
    }

    /* insertMemo */
    async insertFiles(insertId: number, uploadFiles: Array<Express.Multer.File>, memoSeq: number) : Promise<UploadFile[]>{
        let insertFiles = [] as CombinedUploadFile[]
        try {
            for(let uploadFile of uploadFiles) {
                // 원하는 저장 경로 (예: ./uploads 디렉터리로 이동)
                let fileDir = `uploads/${String(memoSeq)}`;
                let fullfilePath = `${fileDir}/${uploadFile.filename}`;
                const targetPath = join(fullfilePath);
    
                // 파일 이동 (임시 디렉터리 -> 실제 저장 디렉터리)
                if (!existsSync(fileDir)) {
                    mkdirSync(fileDir);
                }
                
                renameSync(uploadFile.path, targetPath);
                uploadFile.path = targetPath;

                let savedFile = await this.saveFile(insertId, {
                    fileName: uploadFile.filename, googleDriveFileId: null, seq: memoSeq,
                    memo: undefined
                });
                insertFiles.push({...savedFile, fileName: uploadFile.filename, googleDriveFileId: null, seq: memoSeq, ...uploadFile});
                Logger.debug(insertFiles);

            }
            
            if(uploadFiles.length) {
                // 구글 드라이브에 저장 (비동기)
                insertFiles = await this.uploadToGoogleDrive(insertFiles);
            }

            return insertFiles;
        } catch(e) {
            return insertFiles;
        }
    }

    /* insertMemo */
    /* analyze */
    async uploadToGoogleDrive(files: CombinedUploadFile[]): Promise<CombinedUploadFile[]> {
        try {
            // 구글 드라이브에 저장
            let googleFiles = await this.googleDriverService.uploadFiles(files);

            // 파일 삭제 (비동기적으로 처리)
            [...new Set(googleFiles.flatMap(el => el.seq))].forEach((seq) => {
                const fileDir = path.resolve(__dirname, "../../uploads/", `${String(seq)}`); // seq 기반 폴더 경로
                try {
                    if (existsSync(fileDir)) {
                        rm(fileDir, { recursive: true, force: true }, (err: NodeJS.ErrnoException | null) => {
                            if (err) {
                              Logger.error(`[uploadToGoogleDrive] Failed to delete folder ${fileDir}: ${err.message}`);
                            } else {
                              Logger.debug(`[uploadToGoogleDrive] Folder ${fileDir} and its contents deleted locally`);
                            }
                        });
                    }
                } catch (err) {
                    Logger.error(`[uploadToGoogleDrive] Unexpected error while deleting folder ${fileDir}: ${err.message}`);
                }
            });


            await this.updateGoogleDriveFileId(googleFiles);
            return googleFiles;

        } catch (e) {
            Logger.error(`[uploadToGoogleDrive] 구글 드라이브 저장 중 오류 ${e}`);
            return files;
        }
    }

    /**
     * @param memoSeq 
     * @param insertId 
     * @returns 
     * @description: 파일목록 조회 후, 구글드라이브 및 로컬파일 삭제
     */
    /* deleteMemo */
    async deleteFiles(memoSeq: number, insertId: number): Promise<boolean> {
        let searchMap = {};
        if (memoSeq) {
            searchMap['seq'] = memoSeq;
        }
    
        try {
            // 파일 목록 조회
            let uploadedFiles = await this.fileRepository.find({ where: searchMap, select: ['googleDriveFileId', 'fileName', 'seq'], comment: "FileService.deleteFiles"});
            
            if(!uploadedFiles || !uploadedFiles.length) {
                return false;
            }

            try {
                // 구글 드라이브에서 삭제
                let googleDriveFileIds = uploadedFiles.map(el => el.googleDriveFileId).filter(el => el);
                await this.googleDriverService.deleteFilesWithFileId(googleDriveFileIds, insertId);
            } catch(e) {
                Logger.error(`[deleteFiles] failed to delete file remotely ${e}`);
            }

            // 파일 삭제 (비동기적으로 처리)
            for (let uploadedFile of uploadedFiles) {
                try {
                    const fileDir = path.resolve(__dirname, "../../uploads/", `${uploadedFile.seq}`); // seq 기반 폴더 경로
                    if (existsSync(fileDir)) {
                        rm(fileDir, { recursive: true, force: true }, (err: NodeJS.ErrnoException | null) => {
                            if (err) {
                                Logger.error(`[deleteFiles] Failed to delete locally folder ${fileDir}: ${err.message}`);
                            } else {
                                Logger.debug(`[deleteFiles] succeed to delete files locally (fileName:${uploadedFile.fileName})`);
                            }
                        });
                    }
                } catch (unlinkErr) {
                    Logger.error(`[deleteFiles] Failed to delete file locally (fileNames:${uploadedFile.fileName})`, unlinkErr);
                    // 에러를 무시하고 진행하거나, 필요하면 throw로 중단 가능
                    // throw unlinkErr; // 필요 시 에러를 던져서 전체 작업 중단
                }
            }
            
            // DB에서 파일 레코드 삭제
            await this.fileRepository.delete({ seq: memoSeq });
            Logger.debug(`[deleteFiles] succeed to delete files in db (fileName:${uploadedFiles.map(uploadedFile => uploadedFile.fileName).join(',')})`);
            return true;
        } catch (err) {
            Logger.error('[deleteFiles] Error in deleteFiles:', err);
            return false;
        }
    }
}