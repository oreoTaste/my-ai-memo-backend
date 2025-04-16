import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Memo, SharedMemo } from './entity/memo.entity';
import { Like, Repository, UpdateResult } from 'typeorm';
import { InsertMemoDto, ListMemoDto, SearchMemoDto, SharedInfo, UpdateMemoDto } from './dto/memo.dto';

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
        shareType: shared.shareType
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
      sharedUsers: [{
        loginId: shared.sharedUser.loginId,
        id: shared.sharedUser.id,
        name: shared.sharedUser.name,
        shareType: shared.shareType
      }] // 공유받은 메모는 현재 사용자가 수신자
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
    let insertUser = await this.memoRepository.findOne({
      where: {seq: insertedMemo.seq}, 
      relations: ["insertUser"], 
      select: ["insertUser"], 
      comment: "MemoService.insertMemo#findMemo"});

    returnedMemo.insertUser = {
      loginId: insertUser.insertUser.loginId,
      id: insertUser.insertUser.id,
      name: insertUser.insertUser.name
    }

    // 3. [공유 메모]
    // 3-1. 공유 메모에 추가
    if (insertMemoDto.sharedInfosJson) {
      console.log("insertMemoDto.sharedInfosJson" , insertMemoDto.sharedInfosJson);
      try {
        const parsedInfos = JSON.parse(insertMemoDto.sharedInfosJson);
        if (Array.isArray(parsedInfos)) {
          insertMemoDto.sharedInfos = parsedInfos.map((info: SharedInfo) => ({
            id: String(info.id),
            shareType: String(info.shareType),
          }));
        } else {
          throw new Error('Invalid sharedInfosJson format');
        }
        console.log("parsedInfos" , parsedInfos);
        insertMemoDto.sharedInfos = parsedInfos as SharedInfo[];

      } catch (error) {
        throw new BadRequestException('Invalid sharedInfosJson: must be a valid JSON array');
      }
      
      if(insertMemoDto.sharedInfos.length) {
        await Promise.all(insertMemoDto.sharedInfos.map(async (sharedInfo: SharedInfo) => {
          await this.sharedMemoRepository.save({
            sharedId: Number(sharedInfo.id),
            seq: insertedMemo.seq,
            insertId,
            updateId: insertId,
            shareType: sharedInfo.shareType
          });
        }));
      }

      // 3-2. 공유받은 사람 리턴값에 추가
      let sharedUser = await this.sharedMemoRepository.find({ 
        where: { seq: insertedMemo.seq },
        relations: ["sharedUser"], 
        select: ["sharedId", "shareType", "sharedUser"], 
        comment: "MemoService.insertMemo#findSharedMemo"});

      returnedMemo.sharedUsers = sharedUser.map((shared) => ({
        loginId: shared.sharedUser.loginId,
        id: shared.sharedUser.id,
        name: shared.sharedUser.name,
        shareType: shared.shareType
      }))
    }

    return returnedMemo;
  }

  /* updateMemo */
  async updateMemo(insertId: number, updateMemoDto: UpdateMemoDto): Promise<ListMemoDto> {
    return await this.memoRepository.manager.transaction(async (transactionalEntityManager) => {
      let editable = false;

      // 체크로직 1) 메모 존재 여부 확인 및 메모 변경 권한 체크
      // 1-1. 메모 존재 여부 확인
      const memo = await transactionalEntityManager.findOne(Memo, {
        where: { seq: updateMemoDto.seq },
        relations: ['insertUser', 'files', 'sharedMemos', 'sharedMemos.sharedUser'],
      });
  
      if (!memo) {
        throw new NotFoundException(`seq ${updateMemoDto.seq}에 해당하는 메모가 없습니다.`);
      }
 
      // 1-2. 메모변경권한 확인
      // 1-2-1. 본인이 작성한 메모인 경우
      if(memo.insertId === insertId) {
        editable = true;
      }

      if(!editable) {
        // 1-2-2. 공유 받은 권한이 "편집"인 경우
        let sharedUser = await transactionalEntityManager.findOne(SharedMemo, {
          where: { seq: updateMemoDto.seq, sharedId: insertId, shareType: "edit" }
        });
        if(sharedUser.sharedId === insertId) {
          editable = true;
        }
      }

      if(!editable) {
        throw new NotFoundException(`메모를 수정할 권한이 없습니다.`);
      }

      // 1. 메모 정보 업데이트
      const updateData = {
        updateId: insertId,
        modifiedAt: new Date(),
        subject: updateMemoDto.subject,
        answer: updateMemoDto.answer,
        title: updateMemoDto.title,
        raws: updateMemoDto.raws,
      };
  
      await transactionalEntityManager.update(Memo, updateMemoDto.seq, updateData);
  
      // 2. 공유 메모 처리
      if (updateMemoDto.sharedInfosJson) {
        try {
          const parsedInfos = JSON.parse(updateMemoDto.sharedInfosJson);
          if (Array.isArray(parsedInfos)) {
            updateMemoDto.sharedInfos = parsedInfos.map((info: SharedInfo) => ({
              id: String(info.id),
              shareType: String(info.shareType),
            }));
          } else {
            throw new Error('Invalid sharedInfosJson format');
          }
          updateMemoDto.sharedInfos = parsedInfos as SharedInfo[];
  
        } catch (error) {
          throw new BadRequestException('Invalid sharedInfosJson: must be a valid JSON array');
        }
  
        // 클라이언트에서 받은 공유 정보 (본인 제외)
        const newSharedInfos = updateMemoDto.sharedInfos
          .filter(({ id }) => {
            if (id === String(insertId)) {
              return false; // 메모 등록자 제외
            }
            return true;
          })
          .map(({ id, shareType }) => ({
            sharedId: Number(id),
            shareType,
            seq: updateMemoDto.seq,
            insertId,
            updateId: insertId,
            createdAt: new Date(),
            modifiedAt: new Date(),
          }));

        // 기존 공유 메모 모두 삭제
        await transactionalEntityManager.delete(SharedMemo, {
          seq: updateMemoDto.seq,
        });
  
        // 새로운 공유 메모 삽입
        if (newSharedInfos.length > 0) {
          await transactionalEntityManager.save(SharedMemo, newSharedInfos);
        }
      }
  
      // 3. 업데이트된 메모 조회 (관계 포함)
      const updatedMemo = await transactionalEntityManager.findOne(Memo, {
        where: { seq: updateMemoDto.seq },
        relations: ['insertUser', 'files', 'sharedMemos', 'sharedMemos.sharedUser'],
      });
  
      // 4. ListMemoDto로 매핑
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
          shareType: shared.shareType,
        })),
        files: updatedMemo.files.map((file) => ({
          seq: file.seq,
          fileName: file.fileName,
          googleDriveFileId: file.googleDriveFileId,
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
