import { ApiProperty } from "@nestjs/swagger";
import { IsNumber } from "class-validator";
import { CommonEntity } from "src/common/entity/common.entity";
import { UploadFile } from "src/file/entity/file.entity";
import { Column, Entity, Index, JoinColumn, JoinTable, OneToMany, PrimaryGeneratedColumn } from "typeorm";

@Entity({name: "Y_MEMO"})
@Index("Y_MEMO_IDX1", ['insertId', 'subject'], {unique: false})
@Index("Y_MEMO_IDX2", ['insertId', 'title'], {unique: false})
@Index("Y_MEMO_IDX3", ['createdAt'], {unique: false})
export class Memo extends CommonEntity{
    @PrimaryGeneratedColumn({zerofill: true, primaryKeyConstraintName: "Y_MEMO_PK"})
    @IsNumber()
    @ApiProperty()
    seq: number;

    @Column({nullable: false, type: "varchar2", length: 4000})
    @ApiProperty()
    raw: string;

    @Column({nullable: true, type: "varchar2", length: 1000})
    @ApiProperty()
    subject: string;

    @Column({nullable: false, type: "varchar2", length: 1000})
    @ApiProperty()
    title: string;

    @Column({nullable: true, type: "varchar2", length: 4000})
    @ApiProperty()
    answer: string;

    @Column({nullable: false, type: "varchar2", length: 1, default: "Y"})
    @ApiProperty()
    ynDisplay: string;

    // @OneToMany(() => UploadFile, uploadFile => uploadFile.seq, { eager: true })
    // @Column()
    // @ApiProperty()
    files: UploadFile[];
}