import { ApiProperty } from "@nestjs/swagger";
import { CommonEntity } from "src/common/entity/common.entity";
import { Memo } from "src/memo/entity/memo.entity";
import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from "typeorm";

@Entity({name: "Y_FILE"})
export class UploadFile extends CommonEntity{

    @PrimaryColumn({nullable: false, type: 'varchar2', primaryKeyConstraintName: "Y_FILE_PK", name: "SEQ"})
    @ApiProperty()
    seq: number;

    @PrimaryColumn({nullable: false, type: 'varchar2', length: 500, primaryKeyConstraintName: "Y_FILE_PK", name: "FILE_NAME"})
    @ApiProperty()
    fileName: string;

    @Column({nullable: true, type: "varchar2", length: 50, name: "GOOGLE_DRIVE_FILE_ID"})
    @ApiProperty()
    googleDriveFileId: string;

    @ManyToOne(() => Memo, (memo) => memo.files, { lazy: true })
    @JoinColumn({ name: "SEQ", referencedColumnName: "seq", foreignKeyConstraintName: "Y_FILE_MEMO_FK"})
    @ApiProperty()
    memo: Promise<Memo>; // 관계 필드를 별도로 정의
}