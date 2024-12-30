import { IsNumber } from "class-validator";
import { Column } from "typeorm";

export class CommonEntity {
    @Column({ type: "timestamp", default: () => "CURRENT_TIMESTAMP"})
    createdAt: Date;
  
    @Column({name: 'insertId', type: "number"})
    @IsNumber()
    insertId: number;

    @Column({ type: "timestamp", default: () => "CURRENT_TIMESTAMP"})
    modifiedAt: Date;
  
    @Column({name: 'updateId', type: "number"})
    @IsNumber()
    updateId: number;

}