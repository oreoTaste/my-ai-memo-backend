import { ApiProperty } from "@nestjs/swagger";
import { CommonEntity } from "src/common/entity/common.entity";
import { Memo } from "src/memo/entity/memo.entity";
import { Entity, ManyToOne, PrimaryColumn } from "typeorm";

@Entity({name: "Y_FILE"})
export class UploadFile extends CommonEntity{

    @PrimaryColumn({nullable: false, type: 'varchar2', length: 10, primaryKeyConstraintName: "Y_FILE_PK"})
    @ApiProperty()
    fileFrom: string;

    @PrimaryColumn({nullable: false, type: 'varchar2', primaryKeyConstraintName: "Y_FILE_PK"})
    // @ManyToOne(() => Memo, (memo) => memo.files, {createForeignKeyConstraints: false, eager: false})
    @ApiProperty()
    seq: number;

    @PrimaryColumn({nullable: false, type: 'varchar2', length: 500, primaryKeyConstraintName: "Y_FILE_PK"})
    @ApiProperty()
    fileName: string;
}