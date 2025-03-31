import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { OAuth2Client } from 'google-auth-library';
import { drive_v3, google } from 'googleapis';
import { authenticate } from '@google-cloud/local-auth';
import { Response } from 'express';
import * as fs from 'fs/promises';
import * as mime from 'mime-types';
import * as path from 'path';
import { Readable } from 'typeorm/platform/PlatformTools';
import { Repository } from 'typeorm';
import { Stream } from 'stream';
import { Code } from 'src/code/entity/code.entity';
import { FileService } from './file.service';
import { UploadFile } from './entity/file.entity';
import { CombinedUploadFile } from './dto/file.dto';

@Injectable()
export class GoogleDriveService {
  private readonly SCOPES = [
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/drive.appdata',
    'https://www.googleapis.com/auth/drive.file',
  ];
  private readonly TOKEN_PATH = path.resolve(__dirname, '../../', 'token.json');
  private readonly CREDENTIALS_PATH = path.resolve(__dirname, '../../', 'credentials.json');

  constructor(
    @InjectRepository(Code)
    private codeRepository: Repository<Code>,
    @Inject(forwardRef(() => FileService))
    private fileService: FileService,
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
      if (client) return client;

      client = await authenticate({
        scopes: this.SCOPES,
        keyfilePath: this.CREDENTIALS_PATH,
      });

      if (client.credentials) await this.saveCredentials(client);
      return client;
    } catch (e) {
      Logger.error(e);
      throw e;
    }
  }

  /**
   * Gets or creates the 'duckdns' folder ID in the root directory.
   * @param {drive_v3.Drive} drive The Google Drive API client.
   * @param {number} insertId The ID used to save folder metadata.
   * @returns {Promise<string>} The folder ID.
   */
  private async getOrCreateDuckDnsFolder(drive: drive_v3.Drive, insertId: number): Promise<string> {
    try {
      const folderId = (
        await this.codeRepository.findOneBy({
          codeGroup: 'CC004',
          code: 'GOOGLE_DRIVE_FOLDER_ID',
          useYn: 'Y',
        })
      )?.remark;
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
    if (res.data.files?.length) {
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
      const newCode = {
        codeGroup: 'CC004',
        code: 'GOOGLE_DRIVE_FOLDER_ID',
        useYn: 'Y',
        insertId,
        updateId: insertId,
        remark: folderId,
      } as Code;
      await this.codeRepository.save(newCode);
    } catch (e) {
      Logger.log(`Failed to save Folder ID: ${folderId}`);
    }
    return folderId;
  }

  /**
   * Uploads files to Google Drive, replacing existing files with the same names.
   * @param {CombinedUploadFile[]} uploadedFiles Files to upload.
   * @returns {Promise<CombinedUploadFile[]>} Uploaded files with Google Drive IDs.
   */
  public async uploadFiles(uploadedFiles: CombinedUploadFile[]): Promise<CombinedUploadFile[]> {
    const authClient = await this.authorize();
    const drive = google.drive({ version: 'v3', auth: authClient });
    const folderId = await this.getOrCreateDuckDnsFolder(drive, uploadedFiles[0].insertId);
    let parentFolderId: string | null = null;

    for (const uploadedFile of uploadedFiles) {
      try {
        const fullFilePath = path.resolve(__dirname, '../../uploads/', `${String(uploadedFile.seq)}/${uploadedFile.filename}`);
        Logger.debug('filePath : ' + fullFilePath);

        const fileExists = await fs.access(fullFilePath).then(() => true).catch(() => false);
        if (!fileExists) {
          Logger.error(`[uploadFiles] File ${uploadedFile.filename} does not exist locally. Skipping.`);
          return null;
        }

        if (!parentFolderId) {
          parentFolderId = await this.getSubFolder(drive, folderId, uploadedFile.seq);
        }

        const existingFiles = await this.getExistingFiles(drive, parentFolderId, uploadedFile.filename);
        if (existingFiles.length) {
          await Promise.all(
            existingFiles.map((file) =>
              drive.files.delete({ fileId: file.id || '' }).then(() =>
                Logger.debug(`[uploadFiles] Deleted existing file: ${file.name} (${file.id})`),
              ),
            ),
          );
        } else {
          Logger.debug(`[uploadFiles] No existing file named "${uploadedFile.filename}" found in folder.`);
        }

        const fileMetadata = { name: uploadedFile.filename, parents: [parentFolderId] };
        const media = {
          mimeType: mime.lookup(uploadedFile.filename) || 'application/octet-stream',
          body: (await import('fs')).createReadStream(fullFilePath),
        };

        Logger.debug(`[uploadFiles] Starting upload of ${uploadedFile.filename}`);
        const uploadRes = await drive.files.create({ requestBody: fileMetadata, media });
        Logger.debug(`Upload successful: ${uploadRes.data.name} (${uploadRes.data.id})`);
        uploadedFile.googleDriveFileId = uploadRes.data.id;
      } catch (err) {
        Logger.error(`[uploadFiles] Upload failed for ${uploadedFile.filename}: ${err.message}`);
      }
    }
    return uploadedFiles;
  }

  /**
   * Gets or creates a subfolder based on seq in Google Drive.
   * @param {drive_v3.Drive} drive The Google Drive API client.
   * @param {string} parentFolderId The parent folder ID.
   * @param {number} seq The sequence number for the subfolder.
   * @returns {Promise<string>} The subfolder ID.
   */
  private async getSubFolder(drive: drive_v3.Drive, parentFolderId: string, seq?: number): Promise<string> {
    if (!seq) return parentFolderId;

    const folderName = String(seq);
    const query = `'${parentFolderId}' in parents and name = '${folderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;

    try {
      const existingFolders = await drive.files.list({ q: query, fields: 'files(id)' });
      const existingFolder = existingFolders.data.files?.[0];
      if (existingFolder?.id) return existingFolder.id;
    } catch (error) {
      console.error(`Error checking existing folder: ${error.message}`);
    }

    const folderMetadata = {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentFolderId],
    };
    const resp = await drive.files.create({ requestBody: folderMetadata });
    return resp.data.id!;
  }

  /**
   * Retrieves existing files in a folder by name.
   * @param {drive_v3.Drive} drive The Google Drive API client.
   * @param {string} folderId The folder ID to search in.
   * @param {string} fileName The name of the file to find.
   * @returns {Promise<drive_v3.Schema$File[]>} Array of matching files.
   */
  private async getExistingFiles(drive: drive_v3.Drive, folderId: string, fileName: string): Promise<drive_v3.Schema$File[]> {
    const res = await drive.files.list({
      pageSize: 10,
      q: `'${folderId}' in parents and name = '${fileName}'`,
      fields: 'files(id, name)',
    });
    return (res.data.files as drive_v3.Schema$File[]) || [];
  }

  /**
   * Inserts files into Google Drive, replacing existing files with the same names.
   * @param {{ fullFileName: string; fileNameWithPrefiex: string }[]} fileNames Files to upload.
   * @param {number} insertId The ID for folder creation.
   * @returns {Promise<{ fullFileName: string, fileNameWithPrefiex: string, fileId: string }[]>} Uploaded files.
   */
  public async insertFiles(
    fileNames: { fullFileName: string; fileNameWithPrefiex: string }[],
    insertId: number,
  ): Promise<{ fullFileName: string; fileNameWithPrefiex: string; fileId: string }[]> {
    const authClient = await this.authorize();
    const drive = google.drive({ version: 'v3', auth: authClient });
    const folderId = await this.getOrCreateDuckDnsFolder(drive, insertId);
    const uploadedFiles: { fullFileName: string; fileNameWithPrefiex: string; fileId: string }[] = [];

    for (const { fullFileName, fileNameWithPrefiex } of fileNames) {
      try {
        const fileExists = await fs.access(fullFileName).then(() => true).catch(() => false);
        if (!fileExists) {
          Logger.error(`File ${fullFileName} does not exist locally. Skipping.`);
          return null;
        }

        const res = await drive.files.list({
          pageSize: 10,
          q: `'${folderId}' in parents and name = '${fileNameWithPrefiex}'`,
          fields: 'files(id, name)',
        });
        const existingFiles = res.data.files as drive_v3.Schema$File[];
        if (existingFiles?.length) {
          for (const file of existingFiles) {
            await drive.files.delete({ fileId: file.id || '' });
            Logger.log(`Deleted existing file: ${file.name} (${file.id})`);
          }
        } else {
          Logger.log(`No existing file named "${fileNameWithPrefiex}" found in folder.`);
        }

        const fileMetadata = { name: fileNameWithPrefiex, parents: [folderId] };
        const media = {
          mimeType: mime.lookup(fileNameWithPrefiex) || 'application/octet-stream',
          body: (await import('fs')).createReadStream(fullFileName),
        };

        Logger.debug(`Starting upload of ${fullFileName}`);
        const uploadRes = await drive.files.create({ requestBody: fileMetadata, media });
        Logger.debug(`Upload successful: ${uploadRes.data.name} (${uploadRes.data.id})`);
        uploadedFiles.push({ fullFileName, fileNameWithPrefiex, fileId: uploadRes.data.id });
      } catch (err) {
        Logger.error(`Upload failed for ${fullFileName}: ${err.message}`);
      }
    }
    return uploadedFiles;
  }

  /**
   * Deletes files from Google Drive by their file IDs.
   * @param {string[]} fileIds The IDs of the files to delete.
   * @param {number} insertId The ID used to fetch the folder.
   * @returns {Promise<void>}
   */
  public async deleteFilesWithFileId(fileIds: string[], insertId: number): Promise<void> {
    const authClient = await this.authorize();
    const drive = google.drive({ version: 'v3', auth: authClient });

    try {
      const filePromises = fileIds.map((fileId) =>
        drive.files
          .get({ fileId, fields: 'id, name, parents' })
          .catch((error) => {
            Logger.error(`[deleteFilesWithFileId] Error fetching fileId: ${fileId}`, error.message);
            return null;
          }),
      );
      const fileResponses = await Promise.all(filePromises);
      const matchedFiles = fileResponses
        .filter((file) => file !== null)
        .map((file) => ({
          id: file.data.id,
          name: file.data.name,
          parents: file.data.parents,
        }));

      const parentFolderIds = [...new Set(matchedFiles.flatMap((el) => el.parents))];
      if (parentFolderIds.length) {
        for (const parentFolderId of parentFolderIds) {
          await drive.files.delete({ fileId: parentFolderId || '' });
        }
        Logger.debug(`[deleteFilesWithFileId] Succeeded to delete files remotely: (${matchedFiles.map((el) => el.name).join(',')})`);
      } else {
        Logger.error(`[deleteFilesWithFileId] Couldn't find any files remotely (${fileIds.join(',')})`);
      }
    } catch (err) {
      Logger.error(`[deleteFilesWithFileId] Error while deleting files remotely (${fileIds.join(',')}) : ${err}`);
    }
  }

  /**
   * Deletes files from Google Drive by their names.
   * @param {{ fullFileName: string; fileNameWithPrefiex: string }[]} fileNames Files to delete.
   * @param {number} insertId The ID used to fetch the folder.
   * @returns {Promise<void>}
   */
  public async deleteFiles(
    fileNames: { fullFileName: string; fileNameWithPrefiex: string }[],
    insertId: number,
  ): Promise<void> {
    const authClient = await this.authorize();
    const drive = google.drive({ version: 'v3', auth: authClient });
    const folderId = await this.getOrCreateDuckDnsFolder(drive, insertId);

    for (const { fullFileName, fileNameWithPrefiex } of fileNames) {
      try {
        const fileExists = await fs.access(fullFileName).then(() => true).catch(() => false);
        if (!fileExists) {
          Logger.error(`File ${fullFileName} does not exist locally. Skipping.`);
          return null;
        }

        const res = await drive.files.list({
          pageSize: 10,
          q: `'${folderId}' in parents and name = '${fileNameWithPrefiex}'`,
          fields: 'files(id, name)',
        });
        const existingFiles = res.data.files as drive_v3.Schema$File[];
        if (existingFiles?.length) {
          for (const file of existingFiles) {
            await drive.files.delete({ fileId: file.id || '' });
            Logger.log(`Deleted existing file: ${file.name} (${file.id})`);
          }
        } else {
          Logger.log(`No existing file named "${fileNameWithPrefiex}" found in folder.`);
        }
      } catch (err) {
        Logger.error(`Upload failed for ${fileNameWithPrefiex}: ${err.message}`);
      }
    }
  }

  /**
   * Checks if a file exists in Google Drive by its fileId.
   * @param {UploadFile} param0 The file object containing googleDriveFileId.
   * @param {number} insertId The ID used to fetch the folder.
   * @returns {Promise<boolean>} True if the file exists, false otherwise.
   */
  public async fileExists({ googleDriveFileId }: UploadFile, insertId: number): Promise<boolean> {
    const authClient = await this.authorize();
    const drive = google.drive({ version: 'v3', auth: authClient });

    try {
      const response = await drive.files.get({ fileId: googleDriveFileId, fields: 'id, name, parents' });
      if (!response.data.id) {
        Logger.error(`[fileExists] File with ID ${googleDriveFileId} exists in Google Drive`);
        return false;
      }
      return true;
    } catch (err) {
      if (err.code === 404) {
        Logger.error(`[fileExists] File with ID ${googleDriveFileId} not found in Google Drive`);
        return false;
      }
      Logger.error(`[fileExists] Failed to check file ${googleDriveFileId}: ${err.message}`);
      return false;
    }
  }

  /**
   * Downloads a file from Google Drive and streams it to the client.
   * @param {string} fileId The ID of the file to download.
   * @param {Response} res The Express response object to stream the file.
   * @param {number} insertId The ID used to fetch or create the duckdns folder.
   * @returns {Promise<void>}
   */
  public async downloadFile(fileId: string, res: Response, insertId: number): Promise<void> {
    const authClient = await this.authorize();
    const drive = google.drive({ version: 'v3', auth: authClient });

    try {
      const fileMeta = await drive.files.get({ fileId, fields: 'id, name, mimeType, parents' });
      const fileName = fileMeta.data.name || 'downloaded_file';
      const mimeType = fileMeta.data.mimeType || 'application/octet-stream';

      const fileStream = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'stream' });
      const encodedFileName = encodeURIComponent(fileName).replace(/'/g, '%27').replace(/"/g, '%22');
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodedFileName}`);
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

  /**
   * Fetches file data from Google Drive.
   * @param {string} googleDriveFileId The ID of the file to fetch.
   * @returns {Promise<{ data: Buffer; mimeType: string }>} File data and MIME type.
   */
  public async getGoogleDriveFile(googleDriveFileId: string): Promise<{ data: Buffer; mimeType: string }> {
    const authClient = await this.authorize();
    const drive = google.drive({ version: 'v3', auth: authClient });

    try {
      const file = await drive.files.get(
        { fileId: googleDriveFileId, alt: 'media', fields: 'mimeType' },
        { responseType: 'stream' },
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