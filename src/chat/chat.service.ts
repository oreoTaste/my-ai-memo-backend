import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Chat, ChatMember, ChatMessage, ChatSeqTracker } from './entity/chat.entity';
import { InjectRepository } from "@nestjs/typeorm";
import { In, MoreThan, Repository } from "typeorm";
import { ChatListDto, ChatMemberDto, ChatMessageDto, CreateChatDto } from './dto/chat.dto';
import { User } from 'src/user/entity/user.entity';

@Injectable()
export class ChatService {
    constructor(
        @InjectRepository(Chat) private chatRepository: Repository<Chat>,
        @InjectRepository(ChatMember) private chatMemberRepository: Repository<ChatMember>,
        @InjectRepository(ChatMessage) private chatMessageRepository: Repository<ChatMessage>,
        @InjectRepository(User) private userRepository: Repository<User>,
        @InjectRepository(ChatSeqTracker) private chatSeqTrackerRepository: Repository<ChatSeqTracker>,
        
    ){}
 
    public async listChat(userId: number): Promise<ChatListDto[]> {
        const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
        oneYearAgo.setHours(0, 0, 0, 0);
        return await this.chatRepository.find({
            take: 100,
            where: { members: { userId }, createdAt: MoreThan(oneYearAgo) },
            select: {
                chatSeq: true,
                createdAt: true,
                insertId: true,
                modifiedAt: true,
                updateId: true,
                members: {
                    chatSeq: true,
                    userId: true,    
                    createdAt: true,
                    insertId: true,
                    modifiedAt: true,
                    updateId: true,
                    user: {
                        id: true,
                        name: true,
                        loginId: true,
                    },
                },
            },
            relations: ['members', 'members.user'],
            relationLoadStrategy: 'query',
            comment: "ChatService.listChat"
        });
    }
 
    public async getChatDetail(userId: number, chatSeq: number): Promise<ChatMessageDto[]>{
        return await this.chatMessageRepository.find({
            take: 100, 
            where: {chatSeq, chat: {members: {userId}}}, 
            select: {
                chatSeq: true,
                createdAt: true,
                insertId: true,
                message: true,
                modifiedAt: true,
                seq: true,
                updateId: true,
                user: {
                    id: true,
                    loginId: true,
                    name: true
                }
            },
            order: {seq: "DESC", createdAt: "DESC", modifiedAt: "DESC"}, 
            relations: ['user'],
            comment: "ChatService.getChatDetail"
        })
    }

      /**
     * 채팅방 생성 및 멤버 저장을 하나의 트랜잭션으로 처리합니다.
     * 트랜잭션은 모든 작업이 성공적으로 완료되어야만 커밋되며,
     * 중간에 오류 발생 시 전체 롤백 처리하여 데이터 정합성을 보장합니다.
     *
     * @param userId 생성 요청자 ID
     * @param dto    제목 및 사용자 ID 목록(JSON)
     * @returns      생성된 채팅방 정보 및 멤버 리스트
     */
    public async createChat(userId: number,{ title, userIdListJson }: CreateChatDto): Promise<ChatListDto> {
        // 트랜잭션 범위 시작
        return await this.chatRepository.manager.transaction(async (manager) => {
            // 1) JSON 파싱 및 유효성 검사
            let userIds: number[];
            try {
                const parsed = JSON.parse(userIdListJson);
                userIds = Array.isArray(parsed)
                ? parsed.map((id) => Number(id)).filter((id) => !isNaN(id))
                : [];
            } catch {
                throw new BadRequestException('Invalid userIdListJson format');
            }

            // 2) creator 포함 보장
            if (!userIds.includes(userId)) {
                userIds.push(userId);
            }

            // 3) 사용자 조회 및 검증
            const users = await manager.find(User, { where: { id: In(userIds) } });
            if (users.length !== userIds.length) {
                throw new NotFoundException('One or more users not found');
            }

            // 4) 채팅 엔티티 생성 및 저장
            const chat = manager.create(Chat, {
                title: title?.trim() || null,
                insertId: userId,
                updateId: userId,
            });
            await manager.save(chat);

            // 5) 채팅 멤버 엔티티 생성 및 저장
            const members = users.map((user) =>
                manager.create(ChatMember, {
                chatSeq: chat.chatSeq,
                userId: user.id,
                insertId: userId,
                updateId: userId,
                }),
            );
            await manager.save(members);

            // 6) 결과 DTO 빌드 및 반환
            const result: ChatListDto = {
                chatSeq: chat.chatSeq,
                createdAt: chat.createdAt,
                insertId: chat.insertId,
                modifiedAt: chat.modifiedAt,
                updateId: chat.updateId,
                members: users.map(({ id, loginId, name }) => ({ user: {id, loginId, name}}))
            };

            return result;
        });
    }

    /**
     * 채팅방에 메시지를 삽입합니다.
     * DB 트리거에 의해 메시지별 고유 시퀀스(SEQ)가 자동 할당됩니다.
     * @param userId 메시지 전송자 ID
     * @param chatSeq 메시지를 전송할 채팅방 ID
     * @param message 메시지 내용
     * @returns 저장된 ChatMessage 엔티티 (SEQ가 포함됨)
     */
    public async insertChatMessage(userId: number, chatSeq: number, message: string): Promise<ChatMessageDto> {
        // 1. 채팅방 존재 및 멤버 여부 확인
        // This ensures the user is allowed to post in this chat
        const chatMember = await this.chatMemberRepository.findOne({
            where: { chatSeq, userId },
            relations: ['user'],
        });

        if (!chatMember) {
            // User is not a member of this chat or chat does not exist
            throw new NotFoundException(`Chat room with ID ${chatSeq} not found or user is not a member.`);
        }

        // 2. 메시지 내용 유효성 검사 (기본적인 내용 확인)
        if (!message || message.trim().length === 0) {
            throw new BadRequestException('Message content cannot be empty.');
        }

        // 3. ChatMessage 엔티티 생성
        // SEQ는 DB 트리거가 자동으로 생성하므로 여기서 설정하지 않습니다.
        const chatMessage = this.chatMessageRepository.create({
            chatSeq: chatSeq,
            message: message.trim(), // 메시지 앞뒤 공백 제거
            insertId: userId, // 메시지 전송자 ID
            updateId: userId, // 초기 수정자 ID도 전송자
        });

        // 4. ChatMessage 저장
        // DB 트리거 (trg_assign_seq_per_chat)가 INSERT 전에 실행되어 SEQ 값을 할당합니다.
        const savedMessage = await this.chatMessageRepository.save(chatMessage) as ChatMessageDto;
        savedMessage.user = {id: chatMember.user.id, name: chatMember.user.name, loginId: chatMember.user.loginId};

        // 저장된 savedMessage 객체에는 이제 DB 트리거에 의해 할당된 SEQ 값이 포함됩니다.
        return savedMessage;
    }

    /**
     * 채팅방 및 관련 데이터를 삭제합니다.
     * (채팅방 멤버, 메시지, 시퀀스 트래커 포함)
     * 트랜잭션으로 처리하여 데이터 정합성을 보장합니다.
     * @param userId 삭제 요청자 ID (해당 채팅방의 멤버여야 함)
     * @param chatSeq 삭제할 채팅방 ID
     * @returns Promise<void> (성공 시) 또는 NotFoundException 발생
     */
    public async deleteChat(userId: number, chatSeq: number): Promise<boolean> {
        // 트랜잭션을 사용하여 모든 삭제 작업이 성공하거나 모두 실패하도록 보장
        try {
            await this.chatRepository.manager.transaction(async (manager) => {
                // 1. 삭제 요청자가 해당 채팅방의 멤버인지 확인
                const chatMember = await manager.findOne(ChatMember, {
                    where: { chatSeq, userId },
                });
    
                if (!chatMember) {
                    // 멤버가 아니거나 채팅방이 존재하지 않음
                    throw new NotFoundException(`Chat room with ID ${chatSeq} not found or user is not a member.`);
                }
    
                // 2. 종속된 데이터부터 순서대로 삭제
                // manager.delete를 사용하여 엔티티를 먼저 로드하지 않고 바로 조건으로 삭제
                await manager.delete(ChatMessage, { chatSeq }); // 채팅 메시지 삭제
                await manager.delete(ChatMember, { chatSeq }); // 채팅 멤버 삭제
                await manager.delete(ChatSeqTracker, { chatSeq }); // 채팅방별 시퀀스 트래커 삭제 (메시지가 없었으면 해당 레코드가 없을 수 있음)
    
                // 3. 마지막으로 채팅방 자체 삭제
                const deleteResult = await manager.delete(Chat, { chatSeq });
    
                // 실제로 채팅방이 삭제되었는지 확인 (예방적 확인)
                if (deleteResult.affected === 0) {
                        // 멤버는 있었지만 채팅 엔티티가 이미 삭제되었거나 다른 문제 발생
                        throw new NotFoundException(`Failed to delete chat room with ID ${chatSeq}. It might have been deleted already.`);
                }
            });
            // 트랜잭션은 오류 없이 완료되면 자동으로 커밋됩니다.
            return true;    
        } catch(error) {
            Logger.error(`[ChatService.deleteChat] ${error}`);
            return false;
        }
    }
    
}