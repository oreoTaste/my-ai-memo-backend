import { ApiProperty } from "@nestjs/swagger";
import { IsNumber } from "class-validator";
import { CommonEntity } from "src/common/entity/common.entity";
import { UploadFile } from "src/file/entity/file.entity";
import { Column, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

@Entity({name: "Y_MEMO"})
@Index("Y_MEMO_IDX1", ['insertId', 'subject'], {unique: false})
@Index("Y_MEMO_IDX2", ['insertId', 'title'], {unique: false})
@Index("Y_MEMO_IDX3", ['createdAt'], {unique: false})
export class Memo extends CommonEntity{
    @PrimaryGeneratedColumn({zerofill: true, primaryKeyConstraintName: "Y_MEMO_PK", name: "SEQ"})
    @IsNumber()
    @ApiProperty()
    seq: number;

    @Column({nullable: false, type: "varchar2", length: 4000, name: "RAWS"})
    @ApiProperty()
    raws: string;

    @Column({nullable: true, type: "varchar2", length: 1000, name: "SUBJECT"})
    @ApiProperty()
    subject: string;

    @Column({nullable: false, type: "varchar2", length: 1000, name: "TITLE"})
    @ApiProperty()
    title: string;

    @Column({nullable: true, type: "varchar2", length: 4000, name: "ANSWER"})
    @ApiProperty()
    answer: string;

    @Column({nullable: false, type: "varchar2", length: 1, default: "Y", name: "DISPLAY_YN"})
    @ApiProperty()
    displayYn: string;

    // @OneToMany(() => UploadFile, uploadFile => uploadFile.seq, { eager: true })
    // @Column()
    @ApiProperty({ type: () => UploadFile, isArray: true })
    files: UploadFile[];
}