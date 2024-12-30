import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Memo } from './entity/memo.entity';
import { DeleteResult, InsertResult, Like, Repository, UpdateResult } from 'typeorm';
import { InsertMemoDto, SearchMemoDto, UpdateMemoDto } from './dto/memo.dto';
import { groupBy } from 'lodash';

@Injectable()
export class MemoService {
    constructor(
        @InjectRepository(Memo)
        private memoRepository: Repository<Memo>
    ){}

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
      
        return await this.memoRepository.find({where: searchBody});
    }
    // async searchMemo(insertId: number, searchMemoDto: SearchMemoDto): Promise<any[]> {
    //     const query = this.memoRepository.createQueryBuilder('memo')
    //         .leftJoinAndSelect('UploadFile', 'file', 'file.fileFrom = :fileFrom AND file.seq = memo.seq', { fileFrom: 'MEMO' }) // `fileFrom`으로 필터링
    //         .where('memo.insertId = :insertId', { insertId })
    //         .select([
    //             'memo.seq',
    //             'memo.title',
    //             'memo.raw',
    //             'memo.subject',
    //             'memo.answer',
    //             'memo.createdAt',
    //             'memo.modifiedAt',
    //             'memo.insertId',
    //             'file.fileName'
    //           ]);
    //     if (searchMemoDto.subject) {
    //         query.andWhere('memo.subject LIKE :subject', { subject: `%${searchMemoDto.subject}%` });
    //     }
    //     if (searchMemoDto.raw) {
    //         query.andWhere('memo.raw LIKE :raw', { raw: `%${searchMemoDto.raw}%` });
    //     }
    //     if (searchMemoDto.title) {
    //         query.andWhere('memo.title LIKE :title', { title: `%${searchMemoDto.title}%` });
    //     }
    //     if (searchMemoDto.answer) {
    //         query.andWhere('memo.answer LIKE :answer', { answer: `%${searchMemoDto.answer}%` });
    //     }
    //     if (searchMemoDto.seq) {
    //         query.andWhere('memo.seq = :seq', { seq: searchMemoDto.seq });
    //     }
    //     let rslt = await query.getRawMany()

    //     let grouped = groupBy(rslt, 'memo_seq'); // memo.seq 기준으로 그룹화
    //     grouped = Object.keys(grouped).map((key) => {
    //         const items = grouped[key];
    //         const memo = {
    //             seq: items[0].memo_seq,
    //             raw: items[0].memo_raw,
    //             subject: items[0].memo_subject,
    //             title: items[0].memo_title,
    //             answer: items[0].memo_answer,
    //             createdAt: items[0].memo_createdAt,
    //             modifiedAt: items[0].memo_modifiedAt,
    //             insertId: items[0].memo_insertId,
    //             files: items
    //                 .filter(item => item.file_id !== null) // 파일 데이터가 존재하는 경우만 포함
    //                 .map(file => ({fileName: file.file_fileName})),
    //         };
    //         return memo;
    //     });
        
    //     return grouped;
    // }

    async insertMemo(insertId: number, insertMemoDto: InsertMemoDto): Promise<InsertResult> {
        return await this.memoRepository.insert({
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

    async deleteMemo(seq: number): Promise<DeleteResult> {
        return await this.memoRepository.delete({
            seq: seq
        });
    }
    
}
