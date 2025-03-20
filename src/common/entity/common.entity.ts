import { IsNumber } from "class-validator";
import { Column } from "typeorm";

export class CommonEntity {
    @Column({ type: "timestamp", default: () => "CURRENT_TIMESTAMP", name: "CREATED_AT"})
    createdAt: Date;
  
    @Column({type: "number", name: "INSERT_ID"})
    @IsNumber()
    insertId: number;

    @Column({ type: "timestamp", default: () => "CURRENT_TIMESTAMP", name: "MODIFIED_AT"})
    modifiedAt: Date;
  
    @Column({type: "number", name: "UPDATE_ID"})
    @IsNumber()
    updateId: number;

}