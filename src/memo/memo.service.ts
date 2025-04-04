import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Memo } from './entity/memo.entity';
import { Like, Repository, UpdateResult } from 'typeorm';
import { InsertMemoDto, SearchMemoDto, UpdateMemoDto } from './dto/memo.dto';

@Injectable()
export class MemoService {
  constructor(
      @InjectRepository(Memo) private memoRepository: Repository<Memo>
  ){}

  /* searchMemo */
  async listMemoWithFiles(insertId: number): Promise<Memo[]> {
    const memos = await this.memoRepository.find({
        where: {
            insertId,
            displayYn: 'Y',
        },
        relations: ['files'],  // 'files'는 @OneToMany 관계에 해당하는 필드명입니다.
        comment: "MemoService.listMemoWithFiles"
    });

    return memos;
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
  
    return await this.memoRepository.find({where: searchBody, comment: "MemoService.searchMemo"});
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
