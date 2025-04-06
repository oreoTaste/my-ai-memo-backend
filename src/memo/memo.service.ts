import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Memo, SharedMemo } from './entity/memo.entity';
import { Like, Repository, UpdateResult } from 'typeorm';
import { InsertMemoDto, ListMemoDto, SearchMemoDto, UpdateMemoDto } from './dto/memo.dto';

@Injectable()
export class MemoService {
  constructor(
      @InjectRepository(Memo) private memoRepository: Repository<Memo>,
      @InjectRepository(SharedMemo) private sharedMemoRepository: Repository<SharedMemo>
  ){}

  /* listMemo */
  async listMemoWithFiles(insertId: number): Promise<ListMemoDto[]> {
    const ownMemos = await this.memoRepository.find({
      where: {
        insertId: insertId,
        displayYn: 'Y'
      },
      relations: ['files'],  // files 관계를 포함
      comment: 'MemoService.listMemoWithFiles - Own Memos' 
    });

    // Shared Memos
    const sharedMemos = await this.sharedMemoRepository.find({
      where: {
        sharedId: insertId,
        memo: { displayYn: "Y" },
      },
      relations: ["memo", "memo.files", "insertUser"],
    });

    // SharedMemo에서 Memo와 insertLoginId 추출
    const sharedMemosWithLoginId = sharedMemos.map((shared) => ({
      ...shared.memo,
      insertLoginId: shared.insertUser?.loginId || "",
    }));

    // 결합 및 정렬
    const combinedMemos = [...ownMemos, ...sharedMemosWithLoginId];
    // combinedMemos.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()); // front에서 sort예정

    return combinedMemos;
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
    // 1. 나의 메모에 추가
    let insertedMemo = await this.memoRepository.save({
        insertId,
        updateId: insertId,
        subject: insertMemoDto.subject,
        answer: insertMemoDto.answer,
        title: insertMemoDto.title,
        raws: insertMemoDto.raws
    });

    // 2. 공유 메모에 추가
    if(insertMemoDto.sharedId) {
      await this.sharedMemoRepository.save({
        sharedId: insertMemoDto.sharedId, /* 공유받을 사람 */
        seq: insertedMemo.seq,
        insertId,
        updateId: insertId
      })
    }
    return insertedMemo;
  }

  /* updateMemo */
  async updateMemo(insertId: number, updateMemoDto: UpdateMemoDto): Promise<UpdateResult> {
    // 가. 나의 메모
    let foundMemo = await this.memoRepository.findOne({where: {seq: updateMemoDto.seq}});
    // 체크 1. 변경할 메모가 없는 경우 종료
    if(!foundMemo) {
      return null;
    }

    // 로직 1. 나의 메모에 업데이트
    let updatedMemo = await this.memoRepository.update(updateMemoDto.seq, {
      updateId: insertId,
      modifiedAt: new Date(),
      subject: updateMemoDto.subject,
      answer: updateMemoDto.answer,
      title: updateMemoDto.title,
      raws: updateMemoDto.raws
    });

    // 나. 공유 메모
    let sharedMemo = await this.sharedMemoRepository.findOne({where: {seq: updateMemoDto.seq}});
    if(updateMemoDto.sharedId && !sharedMemo) {
      // 로직 1. 공유한적 없는데 공유하는 경우 (x -> o)
      await this.sharedMemoRepository.save({
        sharedId: updateMemoDto.sharedId, /* 공유받을 사람 */
        seq: updateMemoDto.seq,
        insertId,
        updateId: insertId
      });
      
    } else if(!updateMemoDto.sharedId && sharedMemo) {
      // 로직 2. 공유한적 있고, 공유하지 않는 경우 (o -> x)
      await this.sharedMemoRepository.delete({seq: updateMemoDto.seq, sharedId: sharedMemo.sharedId});

    } else if(updateMemoDto.sharedId && updateMemoDto.sharedId !== sharedMemo.insertId) {
      // 로직 3. 공유한적은 사람와 공유하고 있는 사람이 다른 경우 (o -> o)
      await this.sharedMemoRepository.update({seq: updateMemoDto.seq}, {sharedId: updateMemoDto.sharedId});

    } else {
      // 로직 4. 공유한적은 사람와 공유하고 있는 사람이 같은 경우 (o -> o)
      // 변동사항 없음
    }

    return updatedMemo;
  }

  /** @description Updates ynUse to 'N' for a memo with the given seq */
  /* deleteMemo */
  async deactivateMemo(seq: number): Promise<UpdateResult> {
    // 1. 나의 메모 제거
    let deactivateMemo = await this.memoRepository.update(
        { seq: seq },
        { displayYn: 'N' }
    );

    return deactivateMemo;
  }

  /** @description remove a memo with the given seq */
  /* deleteMemo */
  async deleteMemo(seq: number): Promise<boolean> {
    try {
      // 1. 나의 메모 제거
      await this.memoRepository.delete({seq});
      // 2. 공유 메모 제거
      await this.sharedMemoRepository.delete({ seq });

      return true;  
    } catch(e) {
      return false;
    }
  }
}
