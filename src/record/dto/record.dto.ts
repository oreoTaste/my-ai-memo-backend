import { OmitType, PartialType } from "@nestjs/swagger";
import { Record } from "../entity/record.entity";
import { CommonResultDto } from "src/common/dto/common.dto";
import { IsOptional } from "class-validator";
import { DeleteResult, InsertResult, UpdateResult } from "typeorm";

export class SearchRecordDto extends PartialType(Record){}
export class InsertRecordDto extends OmitType(Record, ['seq', "createdAt", "insertId", "updateId", "modifiedAt"] as const){}
export class UpdateRecordDto extends OmitType(Record, ["createdAt", "insertId", "updateId", "modifiedAt"] as const){}
export class SearchRecordResultDto extends CommonResultDto {
    constructor(records: Record[], result?: boolean, message?: string[]) {
        super(result == undefined ? true : result
            , message == undefined ? ['success'] : message);
        this.records = records ? records : null;
    }

    @IsOptional()
    records?: Record[];
}
export class InsertRecordResultDto extends CommonResultDto {
    constructor(insertResult: InsertResult, result?: boolean, message?: string[]) {
        super(result == undefined ? true : result
            , message == undefined ? ['success'] : message);
        this.insertResult = insertResult ? insertResult : null;
    }

    @IsOptional()
    insertResult?: InsertResult;
}
export class UpdateRecordResultDto extends CommonResultDto {
    constructor(updateResult: UpdateResult, result?: boolean, message?: string[]) {
        super(result == undefined ? true : result
            , message == undefined ? ['success'] : message);
        this.updateResult = updateResult ? updateResult : null;
    }

    @IsOptional()
    updateResult?: UpdateResult;
}

export class DeleteRecordResultDto extends CommonResultDto {
    constructor(deleteResult: DeleteResult, result?: boolean, message?: string[]) {
        super(result == undefined ? true : result
            , message == undefined ? ['success'] : message);
        this.deleteResult = deleteResult ? deleteResult : null;
    }

    @IsOptional()
    deleteResult?: DeleteResult;
}


