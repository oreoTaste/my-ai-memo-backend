import { ApiProperty } from "@nestjs/swagger";
import { IsNumber } from "class-validator";
import { CommonEntity } from "src/common/entity/common.entity";
import { UploadFile } from "src/file/entity/file.entity";
import { User } from "src/user/entity/user.entity";
import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany, PrimaryColumn, PrimaryGeneratedColumn } from "typeorm";

@Entity({name: "Y_MEMO"})
@Index("Y_MEMO_IDX1", ['insertId', 'subject'], {unique: false})
@Index("Y_MEMO_IDX2", ['insertId', 'title'], {unique: false})
@Index("Y_MEMO_IDX3", ['createdAt'], {unique: false})
export class Memo extends CommonEntity{
    @PrimaryGeneratedColumn({type: 'number', primaryKeyConstraintName: "Y_MEMO_PK", name: "SEQ", comment: "메모ID"})
    @IsNumber()
    @ApiProperty()
    seq: number;

    @Column({nullable: false, type: "varchar2", length: 4000, name: "RAWS", comment: "메모 원 내용"})
    @ApiProperty()
    raws: string;

    @Column({nullable: true, type: "varchar2", length: 1000, name: "SUBJECT", comment: "메모 주제"})
    @ApiProperty()
    subject: string;

    @Column({nullable: false, type: "varchar2", length: 1000, name: "TITLE", comment: "메모 제목"})
    @ApiProperty()
    title: string;

    @Column({nullable: true, type: "varchar2", length: 4000, name: "ANSWER", comment: "메모 조언"})
    @ApiProperty()
    answer: string;

    @Column({nullable: false, type: "varchar2", length: 1, default: "Y", name: "DISPLAY_YN", comment: "메모 노출여부"})
    @ApiProperty()
    displayYn: string;

    @OneToMany(() => UploadFile, uploadFile => uploadFile.memo, { eager: true })
    @ApiProperty({ type: () => UploadFile, isArray: true })
    files: UploadFile[];

    // 메모 공유받은 사람 정보
    @OneToMany(() => SharedMemo, (sharedMemo) => sharedMemo.memo, { /*lazy: true */ })
    @ApiProperty({ type: () => SharedMemo, isArray: true })
    sharedMemos: SharedMemo[];

    // 메모 작성자 정보
    @ManyToOne(() => User, (user) => user.memos, { eager: true })
    @JoinColumn({ name: "INSERT_ID" })
    @ApiProperty({ type: () => User })
    insertUser: User;
}

@Entity({ name: "Y_SHARED_MEMO" })
@Index("Y_SHARED_MEMO_IDX1", ["insertId", "sharedId"], { unique: false })
export class SharedMemo extends CommonEntity {
    @PrimaryColumn({ nullable: false, type: "number", primaryKeyConstraintName: "Y_SHARED_MEMO_PK", name: "SHARED_ID", comment: "공유받은 사용자ID(Y_USER.ID)" })
    @IsNumber()
    @ApiProperty()
    sharedId: number;

    @PrimaryColumn({ nullable: false, type: "number", primaryKeyConstraintName: "Y_SHARED_MEMO_PK", name: "SEQ", comment: "메모 SEQ(Y_MEMO.SEQ)"})
    @IsNumber()
    @ApiProperty()
    seq: number;

    @Column({ nullable: false, type: "varchar2", length: 5, default: "view", name: "SHARE_TYPE", comment: "공유타입(view:조회, edit:편집)" })
    shareType: string;

    // 공유받은 메모엔티티 (메모내용)
    @ManyToOne(() => Memo, (memo) => memo.sharedMemos, { eager: true, createForeignKeyConstraints: false })
    @JoinColumn({ name: "SEQ" })
    @ApiProperty({ type: () => Memo })
    memo: Memo;

    // 메모 공유받은 사람 정보
    @ManyToOne(() => User, (user) => user.sharedMemos, { eager: true })
    @JoinColumn({ name: "SHARED_ID" })
    @ApiProperty({ type: () => User })
    sharedUser: User;
}