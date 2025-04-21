import { IsNumber, IsString, Length } from 'class-validator';
import { CommonEntity } from 'src/common/entity/common.entity';
import { Entity, Column, PrimaryGeneratedColumn, Index } from 'typeorm';

@Entity({name: "Y_TODO"})
@Index('Y_TODO_IDX1', ['yyyymmdd', 'insertId'], {unique: false})
@Index('Y_TODO_IDX2', ['insertId', 'yyyymmdd'], {unique: false})
export class Todo extends CommonEntity{
    @PrimaryGeneratedColumn({primaryKeyConstraintName: "Y_TODO_PK", name: "SEQ", comment: "할 일 ID"})
    @IsNumber()
    seq: number;

    @Column({nullable: true, type: "varchar2", length: 8, name: "YYYYMMDD", comment: "할 일 연월일시"})
    @IsString()
    @Length(8)
    yyyymmdd: string;

    @Column({nullable: false, type: "varchar2", length: 50, name: "TITLE", comment: "할 일 제목"})
    @IsString()
    title: string;

    @Column({nullable: true, type: "varchar2", length: 1000, name: "DESCRIPTION", comment: "할 일 상세"})
    @IsString()
    description: string;
}