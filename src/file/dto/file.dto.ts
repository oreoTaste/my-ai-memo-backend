import { OmitType, PartialType, PickType } from "@nestjs/swagger";
import { CommonResultDto } from "src/common/dto/common.dto";
import { IsOptional } from "class-validator";
import { UploadFile } from "../entity/file.entity";

export class DownloadFileDto extends PartialType(OmitType(UploadFile, ["createdAt", "insertId", "updateId", "modifiedAt"] as const)){}
export class SearchFilesDto extends PartialType(OmitType(UploadFile, ["createdAt", "insertId", "updateId", "modifiedAt"] as const)){}
export class InsertFileDto extends OmitType(UploadFile, ["createdAt", "insertId", "updateId", "modifiedAt"] as const){}
export class UpdateFileDto extends PickType(UploadFile, ["seq", "fileName"] as const){}
export class DeleteFileDto extends PickType(UploadFile, ["fileFrom", "seq"] as const){}

export class InsertFileResultDto extends CommonResultDto {
    constructor(resultCount: number, result?: boolean, message?: string[]) {
        super(result == undefined ? true : result
            , message == undefined ? ['success'] : message);
        this.resultCount = resultCount ? resultCount : null;
    }

    @IsOptional()
    resultCount?: number;
}
export class UpdateFileResultDto extends CommonResultDto {
    constructor(resultCount: number, result?: boolean, message?: string[]) {
        super(result == undefined ? true : result
            , message == undefined ? ['success'] : message);
        this.resultCount = resultCount ? resultCount : null;
    }

    @IsOptional()
    resultCount?: number;
}
export class DeleteFileResultDto extends CommonResultDto {
    constructor(resultCount: number, result?: boolean, message?: string[]) {
        super(result == undefined ? true : result
            , message == undefined ? ['success'] : message);
        this.resultCount = resultCount ? resultCount : null;
    }

    @IsOptional()
    resultCount?: number;
}
