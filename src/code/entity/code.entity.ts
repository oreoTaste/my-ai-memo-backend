import { CommonEntity } from "src/common/entity/common.entity";
import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany, PrimaryColumn } from "typeorm";

@Entity({name: "Y_CODE_GROUP"})
@Index("Y_CODE_GROUP_IDX1", ['codeGroup', 'codeDesc', 'useYn'], {unique: false})
@Index("Y_CODE_GROUP_IDX2", ['useYn', 'createdAt'], {unique: false})
export class CodeGroup extends CommonEntity{

    @PrimaryColumn({nullable: false, type: 'varchar2', length: 50, primaryKeyConstraintName: "Y_CODE_GROUP_PK"})
    codeGroup: string;

    @Column({nullable: true, type: 'varchar2', length: 300})
    codeDesc: string;

    @Column({nullable: true, type: 'varchar2', length: 1, default: "Y"})
    useYn: string;
}

@Entity({name: "Y_CODE"})
@Index("Y_CODE_IDX1", ['codeGroup', 'code', 'codeDesc'], {unique: false})
@Index("Y_CODE_IDX2", ['useYn', 'createdAt'], {unique: false})
export class Code extends CommonEntity{

    @ManyToOne(() => CodeGroup, { onDelete: "CASCADE" })
    @JoinColumn({ name: "codeGroup" }) // 외래 키로 참조할 필드
    @PrimaryColumn({nullable: false, type: 'varchar2', length: 50, primaryKeyConstraintName: "Y_CODE_PK"}) // 복합 키의 첫 번째 필드
    codeGroup: string;


    @PrimaryColumn({nullable: false, type: 'varchar2', length: 50, primaryKeyConstraintName: "Y_CODE_PK"})
    code: string;

    @Column({nullable: true, type: 'varchar2', length: 300})
    codeDesc: string;

    @Column({nullable: true, type: 'varchar2', length: 300})
    remark: string;

    @Column({nullable: true, type: 'varchar2', length: 1, default: "Y"})
    useYn: string;
}