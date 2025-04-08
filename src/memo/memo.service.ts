import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Memo, SharedMemo } from './entity/memo.entity';
import { Like, Repository, UpdateResult } from 'typeorm';
import { InsertMemoDto, ListMemoDto, SearchMemoDto, UpdateMemoDto } from './dto/memo.dto';
import { ListFileDto } from 'src/file/dto/file.dto';

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
      relations: ["files", "sharedMemos", "sharedMemos.sharedUser"],
      comment: 'MemoService.listMemoWithFiles - Own Memos' 
    });

    const ownMemosWithSharedUsers = ownMemos.map(({sharedMemos, ...memo}) => ({
      ...memo,
      insertUser: {
        loginId: memo.insertUser.loginId,
        id: memo.insertUser.id,
        name: memo.insertUser.name,
      },
      sharedUsers: sharedMemos.map((shared) => ({
        loginId: shared.sharedUser.loginId,
        id: shared.sharedUser.id,
        name: shared.sharedUser.name,
      })),
    }));

    // Shared Memos
    const sharedMemos = await this.sharedMemoRepository.find({
      where: {
        sharedId: insertId,
        memo: { displayYn: "Y" },
      },
      relations: ["memo", "memo.files", "memo.insertUser"],
      comment: 'MemoService.listMemoWithFiles - Shared Memos'
    });

    // SharedMemo.memo에서 메모 작성자 정보 추출 (insertUser - {loginId, id, name})
    const sharedMemosWithInsertUser = sharedMemos.map((shared: SharedMemo) => ({
      ...shared.memo,
      insertUser: {
        loginId: shared.memo.insertUser.loginId,
        id: shared.memo.insertUser.id,
        name: shared.memo.insertUser.name,
      },
      sharedUsers: [], // 공유받은 메모는 현재 사용자가 수신자이므로 빈 배열
    }));

    // 결합 및 정렬
    const combinedMemos = [...ownMemosWithSharedUsers, ...sharedMemosWithInsertUser];
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

    console.log(insertMemoDto);
    // 2. 공유 메모에 추가
    if(insertMemoDto.sharedIds) {
      const sharedIds = typeof insertMemoDto.sharedIds === "string" 
      ? JSON.parse(insertMemoDto.sharedIds) 
      : insertMemoDto.sharedIds;
            
      if (sharedIds.length) {
        // 비동기 작업을 병렬로 처리
        await Promise.all(
          sharedIds.filter((sharedId: number) => sharedId !== insertId) /* 공유받을 사람에서 메모 등록자는 제외 */
            .map(async (sharedId: number) => {
            await this.sharedMemoRepository.save({
              sharedId, /* 공유받을 사람 */
              seq: insertedMemo.seq,
              insertId,
              updateId: insertId,
            });
          })
        );
      }
    }
    return insertedMemo;
  }

  /* updateMemo */
  async updateMemo(insertId: number, updateMemoDto: UpdateMemoDto): Promise<UpdateResult> {
    // 가. 나의 메모 업데이트
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

    // 나. 공유 메모 업데이트 (기존 공유 삭제 + 신규 공유 생성)
    await this.sharedMemoRepository.delete({
      seq: updateMemoDto.seq
    });

    if(updateMemoDto.sharedIds) {
      const sharedIds = typeof updateMemoDto.sharedIds === "string" 
      ? JSON.parse(updateMemoDto.sharedIds) 
      : updateMemoDto.sharedIds;

      if (sharedIds.length) {
        // 비동기 작업을 병렬로 처리
        await Promise.all(
          sharedIds.filter((sharedId: number) => sharedId !== insertId) /* 공유받을 사람에서 메모 등록자는 제외 */
            .map(async (sharedId: number) => {
            await this.sharedMemoRepository.save({
              sharedId, /* 공유받을 사람 */
              seq: updateMemoDto.seq,
              insertId,
              updateId: insertId,
            });
          })
        );
      }
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
