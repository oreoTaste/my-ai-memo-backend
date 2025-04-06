import { IsNumber } from "class-validator";
import { Column } from "typeorm";

export class CommonEntity {
    @Column({ type: "timestamp", default: () => "CURRENT_TIMESTAMP", name: "CREATED_AT", comment: "데이터 생성일"})
    createdAt: Date;
  
    @Column({type: "number", name: "INSERT_ID", comment: "데이터 입력자"})
    @IsNumber()
    insertId: number;

    @Column({ type: "timestamp", default: () => "CURRENT_TIMESTAMP", name: "MODIFIED_AT", comment: "데이터 수정일"})
    modifiedAt: Date;
  
    @Column({type: "number", name: "UPDATE_ID", comment: "데이터 수정자"})
    @IsNumber()
    updateId: number;

}