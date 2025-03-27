import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { OAuth2Client } from 'google-auth-library';
import { drive_v3, google } from 'googleapis';
import * as fs from 'fs/promises';
import * as path from 'path';
import { authenticate } from '@google-cloud/local-auth';
import * as mime from 'mime-types';
import { InjectRepository } from '@nestjs/typeorm';
import { Code } from 'src/code/entity/code.entity';
import { Repository } from 'typeorm';
import { Response } from 'express';
import { Stream } from 'stream';
import { UploadFile } from './entity/file.entity';
import { FileService } from './file.service';
import { Readable } from 'typeorm/platform/PlatformTools';
import { CombinedUploadFile } from './dto/file.dto';

@Injectable()
export class GoogleDriveService {
  private readonly SCOPES = [
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/drive.appdata',
    'https://www.googleapis.com/auth/drive.file',
  ];

  private readonly TOKEN_PATH = path.resolve(__dirname, '../../', 'token.json');
  private readonly CREDENTIALS_PATH = path.resolve(
    __dirname,
    '../../',
    'credentials.json',
  );
  constructor(
    @InjectRepository(Code) private codeRepository: Repository<Code>,
    @Inject(forwardRef(() => FileService)) private fileService: FileService,
    // private readonly fileService: FileService,
  ) {}

  /**
   * Reads previously authorized credentials from the save file.
   * @returns {Promise<OAuth2Client | null>}
   */
  private async loadSavedCredentialsIfExist(): Promise<OAuth2Client | null> {
    try {
      const content = await fs.readFile(this.TOKEN_PATH, 'utf8');
      const credentials = JSON.parse(content);
      return google.auth.fromJSON(credentials) as OAuth2Client;
    } catch (err) {
      Logger.error(err);
      return null;
    }
  }

  /**
   * Serializes credentials to a file compatible with GoogleAuth.fromJSON.
   * @param {OAuth2Client} client
   * @returns {Promise<void>}
   */
  private async saveCredentials(client: OAuth2Client): Promise<void> {
    const content = await fs.readFile(this.CREDENTIALS_PATH, 'utf8');
    const keys = JSON.parse(content);
    const key = keys.installed || keys.web;
    const payload = JSON.stringify({
      type: 'authorized_user',
      client_id: key.client_id,
      client_secret: key.client_secret,
      refresh_token: client.credentials.refresh_token,
    });
    await fs.writeFile(this.TOKEN_PATH, payload, 'utf8');
  }

  /**
   * Load or request authorization to call APIs.
   * @returns {Promise<OAuth2Client>}
   */
  private async authorize(): Promise<OAuth2Client> {
    try {
      let client = await this.loadSavedCredentialsIfExist();
      if (client) {
        return client;
      }

      client = await authenticate({
        scopes: this.SCOPES,
        keyfilePath: this.CREDENTIALS_PATH,
      });

      if (client.credentials) {
        await this.saveCredentials(client);
      }
      return client;

    } catch (e) {
      Logger.error(e);
    }
  }

  /**
   * Gets or creates the 'duckdns' folder ID in the root directory.
   * @param {any} drive The Google Drive API client.
   * @returns {Promise<string>} The folder ID.
   */
  /* insertMemo */
  /* deleteMemo */
  private async getOrCreateDuckDnsFolder(
    drive: any,
    insertId: number,
  ): Promise<string> {
    try {
      const folderId = (
        await this.codeRepository.findOneBy({
          codeGroup: 'CC004',
          code: 'GOOGLE_DRIVE_FOLDER_ID',
          useYn: 'Y',
        })
      ).remark;
      if (folderId) {
        await drive.files.get({ fileId: folderId, fields: 'id' });
        Logger.log(`Using cached Folder ID: ${folderId}`);
        return folderId;
      }
    } catch (err) {
      Logger.log('No valid cached folder ID found.');
    }

    const res = await drive.files.list({
      pageSize: 1,
      q: "'root' in parents and name = 'duckdns' and mimeType = 'application/vnd.google-apps.folder'",
      fields: 'files(id, name)',
    });

    let folderId: string;
    if (res.data.files?.length > 0) {
      folderId = res.data.files[0].id;
      Logger.log(`Found existing Folder ID: ${folderId}`);
    } else {
      const folderMetadata = {
        name: 'duckdns',
        mimeType: 'application/vnd.google-apps.folder',
        parents: ['root'],
      };
      const createRes = await drive.files.create({
        requestBody: folderMetadata,
        fields: 'id',
      });
      folderId = createRes.data.id;
      Logger.log(`Created new Folder ID: ${folderId}`);
    }

    try {
      let newCode = {
        codeGroup: 'CC004',
        code: 'GOOGLE_DRIVE_FOLDER_ID',
        useYn: 'Y',
        insertId,
        updateId: insertId,
        remark: folderId,
      } as Code;
      await this.codeRepository.save(newCode);
    } catch (e) {
      Logger.log(`failed to save Folder ID: ${folderId}`);
    }
    return folderId;
  }


  /**
   * Inserts files into Google Drive, replacing any existing files with the same names.
   * @param {string | string[]} fileNames The name(s) of the file(s) to upload.
   * @returns {Promise<void>}
   */
  /* insertMemo */
  public async uploadFiles(uploadedFiles: CombinedUploadFile[]): Promise<CombinedUploadFile[]> {
    const authClient = await this.authorize();
    const drive = google.drive({ version: 'v3', auth: authClient });

    // 폴더 확인
    let folderId = await this.getOrCreateDuckDnsFolder(drive, uploadedFiles[0].insertId);
    let parentFolderId = null as string;
    for (let uploadedFile of uploadedFiles) {
      try {
        const fullFilePath = path.resolve(__dirname, "../../uploads/", `${uploadedFile.seq}/${uploadedFile.filename}`); // __dirname은 현재 디렉토리 경로를 반환
        console.log('filePath : ' + fullFilePath);

        // 1. 로컬 파일 존재유무 확인
        const fileExists = await fs
          .access(fullFilePath)
          .then(() => true)
          .catch(() => false);
        if (!fileExists) {
          Logger.error(
            `File ${uploadedFile.filename} does not exist locally. Skipping.`,
          );
          return null;
        }

        // 2. seq 기반 하위 폴더 생성
        if(!parentFolderId) {
          parentFolderId = await this.getSubFolder(drive, folderId, uploadedFile.seq);
        }
        
        // 3. 기존 파일 확인 및 삭제
        const existingFiles = await this.getExistingFiles(drive, parentFolderId, uploadedFile.filename);
        if (existingFiles.length > 0) {
          await Promise.all(
            existingFiles.map((file) =>
              drive.files.delete({ fileId: file.id || '' }).then(() =>
                Logger.debug(`Deleted existing file: ${file.name} (${file.id})`),
              ),
            ),
          );
        } else {
          Logger.debug(`No existing file named "${uploadedFile.filename}" found in folder.`);
        }

        // 3. 파일 업로드
        const fileMetadata = { name: uploadedFile.filename, parents: [parentFolderId] };
        const media = {
          mimeType: mime.lookup(uploadedFile.filename)
            ? mime.lookup(uploadedFile.filename).toString()
            : 'application/octet-stream',
          body: (await import('fs')).createReadStream(fullFilePath),
        };

        Logger.debug(`Starting upload of ${uploadedFile.fileName}`);
        const uploadRes = await drive.files.create({
          requestBody: fileMetadata,
          media,
        });
        Logger.debug(
          `Upload successful: ${uploadRes.data.name} (${uploadRes.data.id})`,
        );
        uploadedFile.googleDriveFileId = uploadRes.data.id;
      } catch (err) {
        Logger.error(`Upload failed for ${uploadedFile.filename}:`, err.message);
      }
    }
    return uploadedFiles;
  }

  /* insertMemo */
  private async getSubFolder(drive: drive_v3.Drive, parentFolderId: string, seq?: number): Promise<string> {
    if (!seq) {
      return parentFolderId;
    }

    const folderName = String(seq);
    const query = `'${parentFolderId}' in parents and name = '${folderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;

    try {
      const existingFolders = await drive.files.list({
        q: query,
        fields: 'files(id)',
      });

      const existingFolder = existingFolders.data.files?.[0];
      if (existingFolder && existingFolder.id) {
        return existingFolder.id; // 이미 존재하는 폴더의 ID 반환
      }
    } catch (error) {
      console.error(`Error checking existing folder: ${error.message}`);
      // 오류 발생 시 새 폴더를 생성하도록 진행
    }

    // 기존 폴더가 없으면 새로 생성
    const folderMetadata = {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentFolderId],
    };

    const resp = await drive.files.create({ requestBody: folderMetadata });
    return resp.data.id!;
  }


  /* insertMemo */
  private async getExistingFiles(drive: drive_v3.Drive, folderId: string, fileName: string): Promise<drive_v3.Schema$File[]> {
    const res = await drive.files.list({
      pageSize: 10,
      q: `'${folderId}' in parents and name = '${fileName}'`,
      fields: 'files(id, name)',
    });
    return (res.data.files as drive_v3.Schema$File[]) || [];
  }

  /**
   * Inserts files into Google Drive, replacing any existing files with the same names.
   * @param {string | string[]} fileNames The name(s) of the file(s) to upload.
   * @returns {Promise<void>}
   */
  public async insertFiles(fileNames: { fullFileName: string; fileNameWithPrefiex: string }[], insertId: number)
    : Promise<{ fullFileName: string, fileNameWithPrefiex: string, fileId: string }[]> {
    const authClient = await this.authorize();
    const drive = google.drive({ version: 'v3', auth: authClient });

    // 폴더 확인
    const folderId = await this.getOrCreateDuckDnsFolder(drive, insertId);

    let uploadedFiles : { fullFileName: string, fileNameWithPrefiex: string, fileId: string }[] = [];

    for (let { fullFileName, fileNameWithPrefiex } of fileNames) {
      try {
        // 1. 로컬 파일 존재유무 확인
        const fileExists = await fs
          .access(fullFileName)
          .then(() => true)
          .catch(() => false);
        if (!fileExists) {
          Logger.error(
            `File ${fullFileName} does not exist locally. Skipping.`,
          );
          return null;
        }

        // 2. 구글 DRIVE 파일 존재유무 확인
        const res = await drive.files.list({
          pageSize: 10,
          q: `'${folderId}' in parents and name = '${fileNameWithPrefiex}'`,
          fields: 'files(id, name)',
        });

        const existingFiles = res.data.files as drive_v3.Schema$File[];
        if (existingFiles?.length > 0) {
          for (const file of existingFiles) {
            await drive.files.delete({ fileId: file.id || '' });
            Logger.log(`Deleted existing file: ${file.name} (${file.id})`);
          }
        } else {
          Logger.log(
            `No existing file named "${fileNameWithPrefiex}" found in folder.`,
          );
        }

        // 3. 파일 업로드
        const fileMetadata = { name: fileNameWithPrefiex, parents: [folderId] };
        const media = {
          mimeType: mime.lookup(fileNameWithPrefiex)
            ? mime.lookup(fileNameWithPrefiex).toString()
            : 'application/octet-stream',
          body: (await import('fs')).createReadStream(fullFileName),
        };

        Logger.debug(`Starting upload of ${fullFileName}`);
        const uploadRes = await drive.files.create({
          requestBody: fileMetadata,
          media,
        });
        Logger.debug(
          `Upload successful: ${uploadRes.data.name} (${uploadRes.data.id})`,
        );
        uploadedFiles.push({ fullFileName, fileNameWithPrefiex, fileId: uploadRes.data.id });
      } catch (err) {
        Logger.error(`Upload failed for ${fullFileName}:`, err.message);
      }
    }
    return uploadedFiles;
  }

  /**
   * Inserts files into Google Drive, replacing any existing files with the same names.
   * @param {string | string[]} fileNames The name(s) of the file(s) to upload.
   * @returns {Promise<void>}
   * @description: 폴더 내 파일 존재 유무 확인 후, 파일 삭제
   */
  /* deleteMemo */
  public async deleteFilesWithFileId(fileIds: string[], insertId: number): Promise<void> {
    const authClient = await this.authorize();
    const drive = google.drive({ version: 'v3', auth: authClient });

    try {
      // 1. 파일 존재유무 확인 + 파일 삭제
      // 1-1. 모든 fileId에 대해 병렬로 정보 조회
      const filePromises = fileIds
        .map((fileId) =>
          drive.files
            .get({
              fileId,
              fields: 'id, name, parents', // 부모 폴더 정보 포함
            })
            .catch((error) => {
              // 오류 발생 시 (예: 파일이 없거나 권한 문제) null 반환
              Logger.error(
                `[deleteFilesWithFileId] Error fetching fileId: ${fileId}`,
                error.message,
              );
              return null;
            }),
        );

      // 2-2. 모든 요청 완료 대기
      const fileResponses = await Promise.all(filePromises);

      // 2-3. 유효한 파일만 필터링하고 folderId 확인
      const matchedFiles = fileResponses
        .filter((file) => file !== null) // 오류로 null인 경우 제외
        .map((file) => ({
          id: file.data.id,
          name: file.data.name,
          parents: file.data.parents
        }));
        
      // 3. 구글 드라이브 파일 삭제 (사실상 파일들이 존재하는 폴더 삭제)
      let parentFolderIds = [...new Set(matchedFiles.flatMap(el => el.parents))];
            
      if (parentFolderIds.length > 0) {
        for(const parentFolderId of parentFolderIds) {
          await drive.files.delete({ fileId: parentFolderId || '' });
        }
        Logger.debug(`[deleteFilesWithFileId] succeed to delete files remotely: (${matchedFiles.map(el => el.name).join(',')})`);  
      } else {
        // 사실상 이때까지는 파일이 존재해야 함
        Logger.error(`[deleteFilesWithFileId] couldn't find any files remotely (${fileIds.join(',')})`);
      }
    } catch (err) {
      Logger.error(
        `[deleteFilesWithFileId] Error while deleting files remotely (${fileIds.join(',')}) : ${err}`,
      );
    }
  }
  /**
   * Inserts files into Google Drive, replacing any existing files with the same names.
   * @param {string | string[]} fileNames The name(s) of the file(s) to upload.
   * @returns {Promise<void>}
   */
  public async deleteFiles(
    fileNames: { fullFileName: string; fileNameWithPrefiex: string }[],
    insertId: number,
  ): Promise<void> {
    const authClient = await this.authorize();
    const drive = google.drive({ version: 'v3', auth: authClient });

    // 1. 폴더 확인
    const folderId = await this.getOrCreateDuckDnsFolder(drive, insertId);
    for (let { fullFileName, fileNameWithPrefiex } of fileNames) {
      try {
        const fileExists = await fs
          .access(fullFileName)
          .then(() => true)
          .catch(() => false);
        if (!fileExists) {
          Logger.error(
            `File ${fullFileName} does not exist locally. Skipping.`,
          );
          return null;
        }

        // 2. 파일 존재유무 확인 + 파일 삭제
        const res = await drive.files.list({
          pageSize: 10,
          q: `'${folderId}' in parents and name = '${fileNameWithPrefiex}'`,
          fields: 'files(id, name)',
        });

        const existingFiles = res.data.files as drive_v3.Schema$File[];
        if (existingFiles?.length > 0) {
          for (const file of existingFiles) {
            await drive.files.delete({ fileId: file.id || '' });
            Logger.log(`Deleted existing file: ${file.name} (${file.id})`);
          }
        } else {
          Logger.log(
            `No existing file named "${fileNameWithPrefiex}" found in folder.`,
          );
        }
      } catch (err) {
        Logger.error(`Upload failed for ${fileNameWithPrefiex}:`, err.message);
      }
    }
  }

  /**
   * Checks if a file exists in Google Drive by its fileId.
   * @param {string} fileId The ID of the file to check.
   * @returns {Promise<boolean>} True if the file exists, false otherwise.
   */
  public async fileExists({googleDriveFileId}: UploadFile, insertId: number): Promise<boolean> {
    const authClient = await this.authorize();
    const drive = google.drive({ version: 'v3', auth: authClient });

    try {
      // 파일 메타데이터를 가져와 존재 여부 확인
      const response = await drive.files.get({
          fileId: googleDriveFileId,
          fields: 'id, name, parents', // 최소한의 필드만 요청
      });

      // 응답에 id가 없으면
      // -> 파일이 없음
      if (!response.data.id) {
          Logger.error(`[fileExists] File with ID ${googleDriveFileId} exists in Google Drive`);
          return false;
      }

      return true;
    } catch (err) {
      // 404 Not Found면 파일이 없음
      if (err.code === 404) {
          Logger.error(`[fileExists] File with ID ${googleDriveFileId} not found in Google Drive`);
          return false;
      }

      // 기타 오류는 로깅 후 예외 전파
      Logger.error(`[fileExists] Failed to check file ${googleDriveFileId}: ${err.message}`);
      return false;
    }
  }

  /**
   * Downloads a file from Google Drive and streams it to the client.
   * @param {string} fileId The ID of the file to download from Google Drive.
   * @param {Response} res The Express response object to stream the file.
   * @param {number} insertId The ID used to fetch or create the duckdns folder.
   * @returns {Promise<void>}
   */
  public async downloadFile(
      fileId: string,
      res: Response,
      insertId: number,
  ): Promise<void> {
    const authClient = await this.authorize();
    const drive = google.drive({ version: 'v3', auth: authClient });

    try {
      const fileMeta = await drive.files.get({
          fileId: fileId,
          fields: 'id, name, mimeType, parents',
      });

      const fileName = fileMeta.data.name || 'downloaded_file';
      const mimeType = fileMeta.data.mimeType || 'application/octet-stream';
      const parents = fileMeta.data.parents || [];

      const fileStream = await drive.files.get(
          { fileId: fileId, alt: 'media' },
          { responseType: 'stream' },
      );

      // 5. Response 헤더 설정 (RFC 5987 인코딩)
      const encodedFileName = encodeURIComponent(fileName)
          .replace(/'/g, '%27')
          .replace(/"/g, '%22');
      res.setHeader(
          'Content-Disposition',
          `attachment; filename*=UTF-8''${encodedFileName}`,
      );
      res.setHeader('Content-Type', mimeType);

      const passThrough = new Stream.PassThrough();
      fileStream.data.pipe(passThrough).pipe(res);

      return new Promise((resolve, reject) => {
          passThrough
          .on('end', () => {
              Logger.debug(`Successfully downloaded file: ${fileName} (${fileId})`);
              resolve(undefined);
          })
          .on('error', (err) => {
              Logger.error(`Error streaming file ${fileId}: ${err.message}`);
              reject(new Error(`Error downloading file from Google Drive: ${err.message}`));
          });
      });
    } catch (err) {
      Logger.error(`[downloadFileFromGoogleDrive] Failed to download file ${fileId}: ${err.message}`);
      throw err;
    }
  }

  // Google Drive에서 파일 데이터를 가져오는 헬퍼 메서드
  public async getGoogleDriveFile(googleDriveFileId: string): Promise<{ data: Buffer; mimeType: string }> {
    const authClient = await this.authorize();
    const drive = google.drive({ version: 'v3', auth: authClient });
    try {
      const file = await drive.files.get(
        { fileId: googleDriveFileId, alt: 'media', fields: 'mimeType' },
        { responseType: 'stream' }
      );
      const mimeType = file.headers['content-type'];
      const chunks: Buffer[] = [];
      for await (const chunk of file.data as Readable) {
        chunks.push(Buffer.from(chunk));
      }
      return { data: Buffer.concat(chunks), mimeType };
    } catch (error) {
      Logger.error(`Failed to fetch Google Drive file ${googleDriveFileId}: ${error.message}`);
      throw new Error(`Unable to fetch Google Drive file: ${googleDriveFileId}`);
    }
  }
}