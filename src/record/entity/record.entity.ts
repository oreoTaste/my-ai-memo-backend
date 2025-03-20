import { IsNumber } from "class-validator";
import { CommonEntity } from "src/common/entity/common.entity";
import { Column, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

@Entity({name: "Y_RECORD"})
@Index("Y_RECORD_IDX1", ['insertId', 'recordAType', 'recordBType', 'createdAt'], {unique: false})
@Index("Y_RECORD_IDX2", ['createdAt'], {unique: false})
export class Record extends CommonEntity{
    @PrimaryGeneratedColumn({primaryKeyConstraintName: "Y_RECORD_PK", name: "SEQ"})
    @IsNumber()
    seq: number;

    @Column({nullable: false, type: "varchar2", length: 15, name: "RECORD_A_TYPE"})
    recordAType: string;

    @Column({nullable: true, type: "varchar2", length: 50, name: "RECORD_B_TYPE"})
    recordBType: string;

    @Column({nullable: true, type: "varchar2", length: 50, name: "RECORD_C_TYPE"})
    recordCType: string;

    @Column({nullable: true, type: "int", name: "COUNT"})
    @IsNumber()
    count: number;

    @Column({nullable: true, type: "varchar2", length: 1000, name: "VALUE"})
    value: string;

}