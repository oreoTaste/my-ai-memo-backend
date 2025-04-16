import { OmitType, PartialType, PickType } from "@nestjs/swagger";
import { Memo } from "../entity/memo.entity";
import { CommonResultDto } from "src/common/dto/common.dto";
import { IsOptional } from "class-validator";
import { DeleteResult, UpdateResult } from "typeorm";
import { ListFileDto } from "src/file/dto/file.dto";
import { UserInfoDto } from "src/user/dto/user.dto";

export class SharedInfo {
    id: string;
    shareType: string;
}

export class SearchMemoDto extends PartialType(Memo){}
export class InsertMemoDto extends OmitType(Memo, ['seq', "createdAt", "insertId", "updateId", "modifiedAt"] as const){

    @IsOptional()
    sharedInfos?: SharedInfo[];

    // client -> server때 사용
    @IsOptional()
    sharedInfosJson?: string;
}
export class UpdateMemoDto extends OmitType(Memo, ["createdAt", "insertId", "updateId", "modifiedAt"] as const){

    @IsOptional()
    sharedInfos?: SharedInfo[];

    // client -> server때 사용
    @IsOptional()
    sharedInfosJson?: string;
}
export class GetMemoAdviceDto extends PickType(Memo, ["raws", "title"] as const){}

export class ListMemoDto extends OmitType(Memo, ["files", "insertUser", "sharedMemos"] as const){

    @IsOptional()
    files?: ListFileDto[];

    @IsOptional()
    insertUser?: UserInfoDto;

    @IsOptional()
    sharedUsers?: UserInfoDto[];
}

export class ListMemoResultDto extends CommonResultDto {
    constructor(memos: ListMemoDto[], result?: boolean, message?: string[]) {
        super(result == undefined ? true : result
            , message == undefined ? ['success'] : message);
        this.memos = memos ? memos : null;
    }

    @IsOptional()
    memos?: ListMemoDto[];
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

export class GetMemoAdviceResultDto extends CommonResultDto {
    constructor(advice: string, subject: string, result?: boolean, message?: string[]) {
        super(result == undefined ? true : result
            , message == undefined ? ['success'] : message);
            this.advice = advice ? advice : null;
            this.subject = subject ? subject : null;
        }

    @IsOptional()
    advice?: string;

    @IsOptional()
    subject?: string;
}


