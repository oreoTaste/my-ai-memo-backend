import { IsNumber, IsString, Length } from 'class-validator';
import { CommonEntity } from 'src/common/entity/common.entity';
import { Entity, Column, PrimaryGeneratedColumn, Index } from 'typeorm';

@Entity({name: "Y_TODO"})
@Index('Y_TODO_IDX1', ['date', 'insertId'], {unique: false})
@Index('Y_TODO_IDX2', ['insertId', 'date'], {unique: false})
export class Todo extends CommonEntity{
    @PrimaryGeneratedColumn({zerofill: true, primaryKeyConstraintName: "Y_TODO_PK"})
    @IsNumber()
    seq: number;

    @Column({nullable: true, type: "varchar2", length: 8})
    @IsString()
    @Length(8)
    date: string;

    @Column({nullable: false, type: "varchar2", length: 50})
    @IsString()
    title: string;

    @Column({nullable: true, type: "varchar2", length: 1000})
    @IsString()
    desc: string;
}