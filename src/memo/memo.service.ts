import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Memo, SharedMemo } from './entity/memo.entity';
import { In, Like, Repository, UpdateResult } from 'typeorm';
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
  async insertMemo(insertId: number, insertMemoDto: InsertMemoDto): Promise<ListMemoDto> {
    // 1. [나의 메모]
    // 1-1. 나의 메모에 추가
    let insertedMemo = await this.memoRepository.save({
        insertId,
        updateId: insertId,
        subject: insertMemoDto.subject,
        answer: insertMemoDto.answer,
        title: insertMemoDto.title,
        raws: insertMemoDto.raws
    });
    // 1-2. 나의 메모에 리턴값에 추가
    let returnedMemo = {...insertedMemo} as ListMemoDto;

    // 2. insertUser 리턴값에 추가
    let insertUser = await this.memoRepository.findOne({where: {seq: insertedMemo.seq}, relations: ["insertUser"], select: ["insertUser"]});
    returnedMemo.insertUser = {
      loginId: insertUser.insertUser.loginId,
      id: insertUser.insertUser.id,
      name: insertUser.insertUser.name
    }

    // 3. [공유 메모]
    // 3-1. 공유 메모에 추가
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
      // 3-2. 공유받은 사람 리턴값에 추가
      let sharedUser = await this.sharedMemoRepository.find({ where: { seq: insertedMemo.seq }, relations: ["sharedUser"], select: ["sharedId", "sharedUser"] });
      returnedMemo.sharedUsers = sharedUser.map((shared) => ({
        loginId: shared.sharedUser.loginId,
        id: shared.sharedUser.id,
        name: shared.sharedUser.name
      }))
    }

    return returnedMemo;
  }

  /* updateMemo */
  async updateMemo(insertId: number, updateMemoDto: UpdateMemoDto): Promise<ListMemoDto> {
    return await this.memoRepository.manager.transaction(async (transactionalEntityManager) => {
      // 1. 메모 존재 여부 확인 및 관계 데이터 조회
      const memo = await transactionalEntityManager.findOne(Memo, {
        where: { seq: updateMemoDto.seq },
        relations: ['insertUser', 'files', 'sharedMemos', 'sharedMemos.sharedUser'],
      });
  
      if (!memo) {
        throw new NotFoundException(`seq ${updateMemoDto.seq}에 해당하는 메모가 없습니다.`);
      }
  
      // 2. 메모 정보 업데이트
      const updateData = {
        updateId: insertId,
        modifiedAt: new Date(),
        subject: updateMemoDto.subject,
        answer: updateMemoDto.answer,
        title: updateMemoDto.title,
        raws: updateMemoDto.raws,
      };
  
      await transactionalEntityManager.update(Memo, updateMemoDto.seq, updateData);
  
      // 3. 공유 메모 처리
      if (updateMemoDto.sharedIds !== undefined) {
        // sharedIds 파싱 (DTO 검증으로 입력값이 올바른지 확인 가정)
        const newSharedIds = typeof updateMemoDto.sharedIds === 'string'
          ? JSON.parse(updateMemoDto.sharedIds)
          : updateMemoDto.sharedIds;
  
        // 메모 등록자 본인을 공유 대상에서 제외
        const validSharedIds = newSharedIds.filter((id: number) => id !== insertId);
  
        // 기존 공유 사용자 ID 목록
        const existingSharedIds = memo.sharedMemos.map((shared) => shared.sharedId);
  
        // 추가 및 삭제할 ID 계산
        const idsToAdd = validSharedIds.filter((id: number) => !existingSharedIds.includes(id));
        const idsToRemove = existingSharedIds.filter((id: number) => !validSharedIds.includes(id));
  
        // 삭제할 공유 메모 제거
        if (idsToRemove.length > 0) {
          await transactionalEntityManager.delete(SharedMemo, {
            seq: updateMemoDto.seq,
            sharedId: In(idsToRemove),
          });
        }
  
        // 새로운 공유 메모 추가
        if (idsToAdd.length > 0) {
          const newShares = idsToAdd.map((sharedId: number) => ({
            sharedId,
            seq: updateMemoDto.seq,
            insertId,
            updateId: insertId,
            createdAt: new Date(), // 새로운 공유자에 대해 생성 시간 명시
            modifiedAt: new Date(),
          }));
  
          await transactionalEntityManager.save(SharedMemo, newShares);
        }
      }
      // sharedIds가 undefined가 아닌 경우만 처리. undefined면 공유자 변경 없음.
  
      // 4. 업데이트된 메모 조회 (관계 포함)
      const updatedMemo = await transactionalEntityManager.findOne(Memo, {
        where: { seq: updateMemoDto.seq },
        relations: ['insertUser', 'files', 'sharedMemos', 'sharedMemos.sharedUser'],
      });
  
      // 5. ListMemoDto로 매핑
      const listMemoDto: ListMemoDto = {
        seq: updatedMemo.seq,
        raws: updatedMemo.raws,
        subject: updatedMemo.subject,
        title: updatedMemo.title,
        answer: updatedMemo.answer,
        displayYn: updatedMemo.displayYn,
        createdAt: updatedMemo.createdAt,
        modifiedAt: updatedMemo.modifiedAt,
        insertId: updatedMemo.insertId,
        updateId: updatedMemo.updateId,
        insertUser: {
          id: updatedMemo.insertUser.id,
          loginId: updatedMemo.insertUser.loginId,
          name: updatedMemo.insertUser.name,
        },
        sharedUsers: updatedMemo.sharedMemos.map((shared) => ({
          id: shared.sharedUser.id,
          loginId: shared.sharedUser.loginId,
          name: shared.sharedUser.name,
        })),
        files: updatedMemo.files.map((file) => ({
          seq: file.seq,
          fileName: file.fileName,
          googleDriveFileId: file.googleDriveFileId,
          // ListFileDto에 필요한 다른 필드 추가
        })),
      };
  
      return listMemoDto;
    });
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

  /**
   * Deletes a shared memo with the given seq and sharedId.
   * @param sharedId The ID of the user who shared the memo.
   * @param seq The seq of the memo to be deleted.
   */
  /* deleteSharedMemo */
  async deleteSharedMemo(sharedId: number, seq: number): Promise<boolean> {
    try {
      let sharedMemo = await this.sharedMemoRepository.findOneOrFail({ where: { sharedId, seq }});
      if (!sharedMemo) {
        Logger.error(`[deleteSharedMemo] Shared memo with seq ${seq} and sharedId ${sharedId} not found.`);
        throw new NotFoundException(`Shared memo with seq ${seq} and sharedId ${sharedId} not found.`);
      }
      await this.sharedMemoRepository.delete({ sharedId, seq });
      return true;
    } catch (e) {
      Logger.error(`[deleteSharedMemo] Failed to delete shared memo with seq ${seq} and sharedId ${sharedId}: ${e.message}`);
      return false;
    }
  }

}
