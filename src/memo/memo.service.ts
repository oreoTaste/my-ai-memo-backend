import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Memo } from './entity/memo.entity';
import { DeleteResult, InsertResult, Like, Repository, UpdateResult } from 'typeorm';
import { InsertMemoDto, SearchMemoDto, UpdateMemoDto } from './dto/memo.dto';

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
