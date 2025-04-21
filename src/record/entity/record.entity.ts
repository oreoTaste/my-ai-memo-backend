import { IsNumber } from "class-validator";
import { CommonEntity } from "src/common/entity/common.entity";
import { Column, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

@Entity({name: "Y_RECORD"})
@Index("Y_RECORD_IDX1", ['insertId', 'recordAType', 'recordBType', 'createdAt'], {unique: false})
@Index("Y_RECORD_IDX2", ['createdAt'], {unique: false})
export class Record extends CommonEntity{
    @PrimaryGeneratedColumn({primaryKeyConstraintName: "Y_RECORD_PK", name: "SEQ", comment: "기록 ID"})
    @IsNumber()
    seq: number;

    @Column({nullable: false, type: "varchar2", length: 15, name: "RECORD_A_TYPE", comment: "기록 대분류"})
    recordAType: string;

    @Column({nullable: true, type: "varchar2", length: 50, name: "RECORD_B_TYPE", comment: "기록 중분류"})
    recordBType: string;

    @Column({nullable: true, type: "varchar2", length: 50, name: "RECORD_C_TYPE", comment: "기록 소분류"})
    recordCType: string;

    @Column({nullable: true, type: "int", name: "COUNT", comment: "기록(개수)"})
    @IsNumber()
    count: number;

    @Column({nullable: true, type: "varchar2", length: 1000, name: "VALUE", comment: "기록(상세)"})
    value: string;

}