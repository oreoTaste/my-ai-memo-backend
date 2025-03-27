import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Memo } from './entity/memo.entity';
import { Like, Repository, UpdateResult } from 'typeorm';
import { InsertMemoDto, SearchMemoDto, UpdateMemoDto } from './dto/memo.dto';
import { FileService } from 'src/file/file.service';

@Injectable()
export class MemoService {
  constructor(
      @InjectRepository(Memo) private memoRepository: Repository<Memo>,
      private readonly fileService: FileService
  ){}

  /* searchMemo */
  async listMemoWithFiles(insertId: number): Promise<Memo[]> {
    const rawData = await this.memoRepository
        .createQueryBuilder('memo')
        .leftJoin(
            'UploadFile',
            'files',
            'memo.SEQ = files.SEQ AND files.FILE_FROM = :fileFrom',
            { fileFrom: 'MEMO' }
        )
        .select([
            'memo.SEQ AS MEMO_SEQ',
            'memo.RAWS AS MEMO_RAWS',
            'memo.SUBJECT AS MEMO_SUBJECT',
            'memo.TITLE AS MEMO_TITLE',
            'memo.ANSWER AS MEMO_ANSWER',
            'memo.DISPLAY_YN AS MEMO_DISPLAYYN',
            'memo.INSERT_ID AS MEMO_INSERTID',
            'memo.CREATED_AT AS MEMO_CREATEDAT',
            'memo.MODIFIED_AT AS MEMO_MODIFIEDAT',
            'memo.UPDATE_ID AS MEMO_UPDATEID',
            'files.FILE_FROM AS FILES_FILEFROM',
            'files.SEQ AS FILES_SEQ',
            'files.FILE_NAME AS FILES_FILENAME',
            'files.GOOGLE_DRIVE_FILE_ID AS FILES_GOOGLEDRIVEFILEID',
            'files.CREATED_AT AS FILES_CREATEDAT',
            'files.MODIFIED_AT AS FILES_MODIFIEDAT',
            'files.INSERT_ID AS FILES_INSERTID',
            'files.UPDATE_ID AS FILES_UPDATEID',
        ])
        .where('memo.INSERT_ID = :insertId AND memo.DISPLAY_YN = :displayYn', { insertId, displayYn: 'Y' })
        .getRawMany();

    const memoMap = new Map<number, Memo>();
    rawData.forEach(row => {
        const memoSeq = row.MEMO_SEQ;
        let memo = memoMap.get(memoSeq);

        if (!memo) {
            memo = {
                seq: row.MEMO_SEQ,
                raws: row.MEMO_RAWS,
                subject: row.MEMO_SUBJECT,
                title: row.MEMO_TITLE,
                answer: row.MEMO_ANSWER,
                displayYn: row.MEMO_DISPLAYYN,
                insertId: row.MEMO_INSERTID,
                createdAt: row.MEMO_CREATEDAT,
                modifiedAt: row.MEMO_MODIFIEDAT,
                updateId: row.MEMO_UPDATEID,
                files: [],
            };
            memoMap.set(memoSeq, memo);
        }

        if (row.FILES_SEQ && row.FILES_FILENAME) {
            memo.files.push({
                fileFrom: row.FILES_FILEFROM,
                seq: row.FILES_SEQ,
                fileName: row.FILES_FILENAME,
                googleDriveFileId: row.FILES_GOOGLEDRIVEFILEID || null,
                createdAt: row.FILES_CREATEDAT || null,
                modifiedAt: row.FILES_MODIFIEDAT || null,
                insertId: row.FILES_INSERTID || null,
                updateId: row.FILES_UPDATEID || null,
            });
        }
    });

    const result = Array.from(memoMap.values());
    Logger.debug(`[listMemoWithFiles] Mapped result: ${JSON.stringify(result[0], null, 2)} ...생략`);
    return result;
  }

  /* deleteMemo */
  async searchMemo(insertId: number, searchMemoDto: SearchMemoDto): Promise<Memo[]> {
    const searchBody: any = { insertId };
    if (searchMemoDto.subject) {
      searchBody['subject'] = Like(`%${searchMemoDto.subject}%`);
    }
    if (searchMemoDto.raws) {
      searchBody['raws'] = Like(`%${searchMemoDto.raws}%`);
    }
    if (searchMemoDto.title) {
      searchBody['title'] = Like(`%${searchMemoDto.title}%`);
    }
    if (searchMemoDto.answer) {
      searchBody['answer'] = Like(`%${searchMemoDto.answer}%`);
    }
    if (searchMemoDto.seq) {
      searchBody['seq'] = searchMemoDto.seq;
    }
    searchBody['displayYn'] = "Y";
  
    return await this.memoRepository.find({where: searchBody});
  }

  /* insertMemo */
  async insertMemo(insertId: number, insertMemoDto: InsertMemoDto): Promise<Memo> {
    return await this.memoRepository.save({
        insertId,
        updateId: insertId,
        subject: insertMemoDto.subject,
        answer: insertMemoDto.answer,
        title: insertMemoDto.title,
        raws: insertMemoDto.raws
    });
  }

  /* updateMemo */
  async updateMemo(insertId: number, updateMemoDto: UpdateMemoDto): Promise<UpdateResult> {
      return await this.memoRepository.update(updateMemoDto.seq, {
          updateId: insertId,
          modifiedAt: new Date(),
          subject: updateMemoDto.subject,
          answer: updateMemoDto.answer,
          title: updateMemoDto.title,
          raws: updateMemoDto.raws
      });
  }

  /** @description Updates ynUse to 'N' for a memo with the given seq */
  /* deleteMemo */
  async deactivateMemo(seq: number): Promise<UpdateResult> {
    return await this.memoRepository.update(
        { seq: seq },
        { displayYn: 'N' }
    );
  }

  /** @description remove a memo with the given seq */
  /* deleteMemo */
  async deleteMemo(seq: number): Promise<boolean> {
    try {
      await this.memoRepository.delete({seq});
      return true;  
    } catch(e) {
      return false;
    }
  }
}
