import { Injectable } from '@nestjs/common';
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

  async listMemoWithFiles(insertId: number): Promise<Memo[]> {
    const rawData = await this.memoRepository
        .createQueryBuilder('memo')
        .leftJoin(
            'UploadFile',
            'files',
            'memo.seq = files.seq AND files.fileFrom = :fileFrom',
            { fileFrom: 'MEMO' }
        )
        .select([
            'memo.seq AS MEMO_SEQ',
            'memo.raw AS MEMO_RAW',
            'memo.subject AS MEMO_SUBJECT',
            'memo.title AS MEMO_TITLE',
            'memo.answer AS MEMO_ANSWER',
            'memo.ynDisplay AS MEMO_YNDISPLAY',
            'memo.insertId AS MEMO_INSERTID',
            'memo.createdAt AS MEMO_CREATEDAT',
            'memo.modifiedAt AS MEMO_MODIFIEDAT',
            'memo.updateId AS MEMO_UPDATEID',
            'files.fileFrom AS FILES_FILEFROM',
            'files.seq AS FILES_SEQ',
            'files.fileName AS FILES_FILENAME',
            'files.googleDriveFileId AS FILES_GOOGLEDRIVEFILEID',
            'files.createdAt AS FILES_CREATEDAT',
            'files.modifiedAt AS FILES_MODIFIEDAT',
            'files.insertId AS FILES_INSERTID',
            'files.updateId AS FILES_UPDATEID',
        ])
        .where('memo.insertId = :insertId', { insertId })
        .getRawMany();

    const memoMap = new Map<number, Memo>();
    rawData.forEach(row => {
        const memoSeq = row.MEMO_SEQ;
        let memo = memoMap.get(memoSeq);

        if (!memo) {
            memo = {
                seq: row.MEMO_SEQ,
                raw: row.MEMO_RAW,
                subject: row.MEMO_SUBJECT,
                title: row.MEMO_TITLE,
                answer: row.MEMO_ANSWER,
                ynDisplay: row.MEMO_YNDISPLAY,
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
                fileName: this.fileService.getRealFileName(row.FILES_FILENAME),
                googleDriveFileId: row.FILES_GOOGLEDRIVEFILEID || null,
                createdAt: row.FILES_CREATEDAT || null,
                modifiedAt: row.FILES_MODIFIEDAT || null,
                insertId: row.FILES_INSERTID || null,
                updateId: row.FILES_UPDATEID || null,
            });
        }
    });

    const result = Array.from(memoMap.values());
    console.log("Mapped result:", JSON.stringify(result, null, 2));
    return result;
  }

  async searchMemo(insertId: number, searchMemoDto: SearchMemoDto): Promise<Memo[]> {
    const searchBody: any = { insertId };
    if (searchMemoDto.subject) {
      searchBody['subject'] = Like(`%${searchMemoDto.subject}%`);
    }
    if (searchMemoDto.raw) {
      searchBody['raw'] = Like(`%${searchMemoDto.raw}%`);
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
    searchBody['ynDisplay'] = "Y";
  
    return await this.memoRepository.find({where: searchBody});
  }

  async insertMemo(insertId: number, insertMemoDto: InsertMemoDto): Promise<Memo> {
    return await this.memoRepository.save({
        insertId,
        updateId: insertId,
        subject: insertMemoDto.subject,
        answer: insertMemoDto.answer,
        title: insertMemoDto.title,
        raw: insertMemoDto.raw
    });
  }

  async updateMemo(insertId: number, updateMemoDto: UpdateMemoDto): Promise<UpdateResult> {
      return await this.memoRepository.update(updateMemoDto.seq, {
          updateId: insertId,
          modifiedAt: new Date(),
          subject: updateMemoDto.subject,
          answer: updateMemoDto.answer,
          title: updateMemoDto.title,
          raw: updateMemoDto.raw
      });
  }

  /** @description Updates ynUse to 'N' for a memo with the given seq */
  async deactivateMemo(seq: number): Promise<UpdateResult> {
    return await this.memoRepository.update(
        { seq: seq },
        { ynDisplay: 'N' }
    );
  }

  /** @description remove a memo with the given seq */
  async deleteMemo(seq: number): Promise<boolean> {
    try {
      await this.memoRepository.delete({seq});
      return true;  
    } catch(e) {
      return false;
    }
  }
}
