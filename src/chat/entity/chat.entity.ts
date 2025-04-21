import { Entity, PrimaryGeneratedColumn, OneToMany, ManyToOne, JoinColumn, Column, PrimaryColumn } from 'typeorm';
import { CommonEntity } from 'src/common/entity/common.entity';
import { User } from 'src/user/entity/user.entity';
import { IsNumber, IsOptional, IsString } from 'class-validator';

@Entity({ name: 'Y_CHAT', comment: "채팅방 정보를 저장하는 테이블" })
export class Chat extends CommonEntity {
    @PrimaryGeneratedColumn({
        name: 'CHAT_SEQ',
        primaryKeyConstraintName: 'Y_CHAT_PK',
        comment: "채팅방 ID",
        type: 'number'
    })
    @IsNumber()
    chatSeq: number;

    @Column({name: "TITLE", comment: "채팅방 제목", type: "varchar2", length: 100})
    @IsString()
    @IsOptional()
    title?: string;

    @OneToMany(() => ChatMember, member => member.chat)
    members: ChatMember[];

    @OneToMany(() => ChatMessage, message => message.chat)
    messages: ChatMessage[];
}

@Entity({ name: 'Y_CHAT_MEMBER', comment: "채팅방 멤버 정보를 저장하는 테이블" })
export class ChatMember extends CommonEntity {
  @PrimaryColumn({comment: "채팅방 ID(Y_CHAT.CHAT_SEQ)", primaryKeyConstraintName: "Y_CHAT_MEMBER_PK", type: 'number', name: 'CHAT_SEQ', foreignKeyConstraintName: "FK_Y_CHAT_MEMBER_CHAT"})
  chatSeq: number;

  @PrimaryColumn({comment: "채팅방 ID(Y_USER.ID)", primaryKeyConstraintName: "Y_CHAT_MEMBER_PK", type: 'number', name: 'USER_ID', foreignKeyConstraintName: "FK_Y_CHAT_MEMBER_USER"})
  userId: number;

  
  @ManyToOne(() => Chat, chat => chat.members)
  @JoinColumn({ name: 'CHAT_SEQ' })
  chat: Chat;

  @ManyToOne(() => User, user => user.chatMembers)
  @JoinColumn({ name: 'USER_ID' })
  user: User;
}

@Entity({name: "Y_CHAT_MESSAGE", comment: "채팅방 메시지 정보를 저장하는 테이블"})
export class ChatMessage extends CommonEntity{
    @PrimaryColumn({comment: "채팅방 ID(Y_CHAT.CHAT_SEQ)", primaryKeyConstraintName: "Y_CHAT_MESSAGE_PK", type: 'number', name: 'CHAT_SEQ', foreignKeyConstraintName: "FK_Y_CHAT_MESSAGE_CHAT"})
    chatSeq: number;

    @PrimaryGeneratedColumn({
        name: 'SEQ',
        primaryKeyConstraintName: 'Y_CHAT_MESSAGE_PK',
        comment: "채팅내용 ID",
        type: 'number'
    })
    @IsNumber()
    seq: number;

    @Column({nullable: false, type: "varchar2", length: 1000, name: "MESSAGE", comment: "채팅 내용"})
    @IsString()
    message: string

    @ManyToOne(() => Chat, chat => chat.messages)
    @JoinColumn({ name: 'CHAT_SEQ' })
    chat: Chat;

    @ManyToOne(() => User, user => user.chatMessages)
    @JoinColumn({ name: "INSERT_ID"})
    user: User;
  
}

/**
 * @description: ChatMessage에 활용된 chatSeq, seq에 대한 시퀀스 테이블
 * @trigger: trg_assign_seq_per_chat
    CREATE OR REPLACE TRIGGER trg_assign_seq_per_chat
    BEFORE INSERT ON Y_CHAT_MESSAGE
    FOR EACH ROW
    DECLARE
        v_next_seq NUMBER;
    BEGIN
        -- MERGE로 시퀀스 값을 갱신하거나 신규 생성
        MERGE INTO Y_CHAT_SEQ_TRACKER t
        USING (SELECT :NEW.CHAT_SEQ AS CHAT_SEQ FROM DUAL) s
        ON (t.CHAT_SEQ = s.CHAT_SEQ)
        WHEN MATCHED THEN
            UPDATE SET t.LAST_SEQ = t.LAST_SEQ + 1
        WHEN NOT MATCHED THEN
            INSERT (CHAT_SEQ, LAST_SEQ) VALUES (s.CHAT_SEQ, 1);

        -- SEQ 값을 가져오는 SELECT문으로 처리
        SELECT t.LAST_SEQ INTO v_next_seq
        FROM Y_CHAT_SEQ_TRACKER t
        WHERE t.CHAT_SEQ = :NEW.CHAT_SEQ;

        -- SEQ 값 설정
        :NEW.SEQ := v_next_seq;
    END;
    /
 */
@Entity({name: "Y_CHAT_SEQ_TRACKER", comment: "채팅방별 시퀀스 값을 추적하는 테이블"})
export class ChatSeqTracker {

    @PrimaryColumn({name: "CHAT_SEQ", comment: "채팅방 ID"})
    @IsNumber()
    chatSeq: number;

    @Column({name: "LAST_SEQ", default: 0, comment: "마지막 사용된 메시지 ID"})
    @IsNumber()
    lastSeq: number;

}
