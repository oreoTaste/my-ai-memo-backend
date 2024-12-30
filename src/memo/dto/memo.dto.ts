import { OmitType, PartialType, PickType } from "@nestjs/swagger";
import { Memo } from "../entity/memo.entity";
import { CommonResultDto } from "src/common/dto/common.dto";
import { IsOptional } from "class-validator";
import { DeleteResult, InsertResult, UpdateResult } from "typeorm";

export class SearchMemoDto extends PartialType(Memo){}
export class InsertMemoDto extends OmitType(Memo, ['seq', "createdAt", "insertId", "updateId", "modifiedAt"] as const){}
export class UpdateMemoDto extends OmitType(Memo, ["createdAt", "insertId", "updateId", "modifiedAt"] as const){}
export class SearchMemoResultDto extends CommonResultDto {
    constructor(memos: Memo[], result?: boolean, message?: string[]) {
        super(result == undefined ? true : result
            , message == undefined ? ['success'] : message);
        this.memos = memos ? memos : null;
    }

    @IsOptional()
    memos?: Memo[];
}
export class InsertMemoResultDto extends CommonResultDto {
    constructor(insertResult: InsertResult, result?: boolean, message?: string[]) {
        super(result == undefined ? true : result
            , message == undefined ? ['success'] : message);
        this.insertResult = insertResult ? insertResult : null;
    }

    @IsOptional()
    insertResult?: InsertResult;
}
export class UpdateMemoResultDto extends CommonResultDto {
    constructor(updateResult: UpdateResult, result?: boolean, message?: string[]) {
        super(result == undefined ? true : result
            , message == undefined ? ['success'] : message);
        this.updateResult = updateResult ? updateResult : null;
    }

    @IsOptional()
    updateResult?: UpdateResult;
}

export class DeleteMemoResultDto extends CommonResultDto {
    constructor(deleteResult: DeleteResult, result?: boolean, message?: string[]) {
        super(result == undefined ? true : result
            , message == undefined ? ['success'] : message);
        this.deleteResult = deleteResult ? deleteResult : null;
    }

    @IsOptional()
    deleteResult?: DeleteResult;
}


