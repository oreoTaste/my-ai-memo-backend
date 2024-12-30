import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DownloadFileDto, InsertFileDto, InsertFileResultDto, SearchFilesDto } from './dto/file.dto';
import { join } from 'path';
import * as path from 'path';
import { renameSync } from 'fs';
import { UploadFile } from './entity/file.entity';
import * as fs from 'fs';
import { Response } from 'express';

@Injectable()
export class FileService {
    constructor(
        @InjectRepository(UploadFile)
        private fileRepository: Repository<UploadFile>
    ){}

    public getRealFileName(savedFileName: string) {
        let match = savedFileName.match(/[^_]+_[^_]+_(.*)/);
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
    async searchFileNames(searchFilesDto: SearchFilesDto, fileNameType: number): Promise<{ fileName: string }[]> {
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

            let uploadFileNames: { fileName: string }[] = [];
            let uploadedFiles = await this.fileRepository.find({where: searchMap});

            if(fileNameType !== null && fileNameType === 1) { // db상의 파일명
                for(let uploadedFile of uploadedFiles) {
                    uploadFileNames.push({fileName: uploadedFile.fileName})
                }
            } else {
                for(let uploadedFile of uploadedFiles) {
                    uploadFileNames.push({fileName: this.getRealFileName(uploadedFile.fileName)})
                }
            }
            return uploadFileNames;
        } catch(error) {
            return null;
        }
    }
    
    async getSavedFileName(insertId: string | number, downloadFilesDto: DownloadFileDto): Promise<string> {
        try {
            downloadFilesDto.fileName = this.getSaveFileName(insertId, downloadFilesDto.seq, downloadFilesDto.fileName);
            let rslt = await this.fileRepository.findOne({where: downloadFilesDto})
            return rslt.fileName;
        } catch(error) {
            return null;
        }
    }
    
    downloadFile(savedFileName: string, res: Response) {
        // 파일 경로를 안전하게 생성 (fileName은 이미 uploads/로 시작하므로 split할 필요 없음)
        const filePath = path?.resolve(__dirname, "../../", savedFileName); // __dirname은 현재 디렉토리 경로를 반환
        console.log(filePath + " : " + savedFileName);

        // 파일이 존재하는지 확인
        if (fs.existsSync(filePath)) {
            const stat = fs.statSync(filePath);
    
            // 파일이 디렉토리인지 확인
            if (stat.isDirectory()) {
                throw new Error('The provided path is a directory, not a file.');
            }
    
            // 파일이 존재하면 다운로드
            return res.download(filePath, this.getRealFileName(savedFileName), (err) => {
                if (err) {
                    console.log(err);
                    throw new Error('Error downloading file');
                }
            });
        } else {
            throw new Error('File not found');
        }
    }

    private async saveFile(loginId: number, file: InsertFileDto) {
        let newFile = new UploadFile();
        newFile.fileName = file.fileName;
        newFile.fileFrom = file.fileFrom;
        newFile.insertId = newFile.updateId = loginId;
        newFile.seq = file.seq;
        await this.fileRepository.save(newFile);
    }

    async insertFiles(insertId: number, uploadFiles: Array<Express.Multer.File>, fileFrom: string, memoSeq: number) : Promise<InsertFileResultDto>{
        for(let uploadFile of uploadFiles) {
            // 원하는 저장 경로 (예: ./uploads 디렉터리로 이동)
            const targetPath = join(this.getSaveFileName(insertId, memoSeq, uploadFile.filename));

            // 파일 이동 (임시 디렉터리 -> 실제 저장 디렉터리)
            renameSync(uploadFile.path, targetPath);

            // 파일 정보 등록
            await this.saveFile(insertId, {fileFrom, fileName: targetPath, seq: memoSeq});
        }
        return new InsertFileResultDto(uploadFiles.length);
    }
    async deleteFiles(fileFrom: string, memoSeq: number) : Promise<boolean>{
        let searchMap = {};
        if(fileFrom) {
            searchMap['fileFrom'] = fileFrom;
        }
        if(memoSeq) {
            searchMap['seq'] = memoSeq;
        }

        try {
            let files = await this.fileRepository.find({where: searchMap});
            for(let file of files) {
                fs.unlink(file.fileName, (err) => {
                    Logger.debug(`${file.fileName} is deleted`);
                })
            }
            let rslt = await this.fileRepository.remove(files);
            return true;
        } catch(err) {
            return false;
        }
    }
}