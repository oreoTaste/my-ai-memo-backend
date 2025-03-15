import { ApiProperty } from "@nestjs/swagger";
import { CommonEntity } from "src/common/entity/common.entity";
import { Column, Entity, PrimaryColumn } from "typeorm";

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

    @Column({nullable: true, type: "varchar2", length: 50})
    @ApiProperty()
    googleDriveFileId: string;

}