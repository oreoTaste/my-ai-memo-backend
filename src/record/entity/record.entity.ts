import { IsNumber } from "class-validator";
import { CommonEntity } from "src/common/entity/common.entity";
import { Column, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

@Entity({name: "Y_RECORD"})
@Index("Y_RECORD_IDX1", ['insertId', 'recordAType', 'recordBType', 'createdAt'], {unique: false})
@Index("Y_RECORD_IDX2", ['createdAt'], {unique: false})
export class Record extends CommonEntity{
    @PrimaryGeneratedColumn({zerofill: true, primaryKeyConstraintName: "Y_RECORD_PK"})
    @IsNumber()
    seq: number;

    @Column({nullable: false, type: "varchar2", length: 15})
    recordAType: string;

    @Column({nullable: true, type: "varchar2", length: 50})
    recordBType: string;

    @Column({nullable: true, type: "varchar2", length: 50})
    recordCType: string;

    @Column({nullable: true, type: "int"})
    @IsNumber()
    count: number;

    @Column({nullable: true, type: "varchar2", length: 1000})
    value: string;

}