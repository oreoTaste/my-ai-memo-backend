import { OmitType, PartialType, PickType } from "@nestjs/swagger";
import { CommonResultDto } from "src/common/dto/common.dto";
import { IsOptional } from "class-validator";
import { Code, CodeGroup } from "../entity/code.entity";

export class SearchCodeGroupDto extends PartialType(OmitType(CodeGroup, ["createdAt", "insertId", "updateId", "modifiedAt"] as const)){}
export class InsertCodeGroupDto extends OmitType(CodeGroup, ['useYn', "createdAt", "insertId", "updateId", "modifiedAt"] as const){}
export class UpdateCodeGroupDto extends OmitType(CodeGroup, ["createdAt", "insertId", "updateId", "modifiedAt"] as const){}
export class DeleteCodeGroupDto extends PickType(Code, ["codeGroup"] as const){}

export class SearchCodeGroupResultDto extends CommonResultDto {
    constructor(codegroups: CodeGroup[], result?: boolean, message?: string[]) {
        super(result == undefined ? true : result
            , message == undefined ? ['success'] : message);
        this.codegroups = codegroups ? codegroups : null;
    }

    @IsOptional()
    codegroups?: CodeGroup[];
}
export class InsertCodeGroupResultDto extends CommonResultDto {
    constructor(resultCount: number, result?: boolean, message?: string[]) {
        super(result == undefined ? true : result
            , message == undefined ? ['success'] : message);
        this.resultCount = resultCount ? resultCount : null;
    }

    @IsOptional()
    resultCount?: number;
}
export class DeleteCodeGroupResultDto extends CommonResultDto {
    constructor(resultCount: number, result?: boolean, message?: string[]) {
        super(result == undefined ? true : result
            , message == undefined ? ['success'] : message);
        this.resultCount = resultCount ? resultCount : null;
    }

    @IsOptional()
    resultCount?: number;
}

export class SearchCodeDto extends PartialType(OmitType(Code, ["createdAt", "insertId", "updateId", "modifiedAt"] as const)){}
export class InsertCodeDto extends OmitType(Code, ['useYn', "createdAt", "insertId", "updateId", "modifiedAt"] as const){

    @IsOptional()
    codeGroupDesc: string;
}
export class UpdateCodeDto extends PickType(Code, ["code", "codeGroup", "codeDesc"] as const){}
export class DeleteCodeDto extends PickType(Code, ["code", "codeGroup"] as const){}

export class SearchCodeResultDto extends CommonResultDto {
    constructor(codes: Code[], result?: boolean, message?: string[]) {
        super(result == undefined ? true : result
            , message == undefined ? ['success'] : message);
        this.codes = codes ? codes : null;
    }

    @IsOptional()
    codes?: Code[];
}

export class InsertCodeResultDto extends CommonResultDto {
    constructor(resultCount: number, result?: boolean, message?: string[]) {
        super(result == undefined ? true : result
            , message == undefined ? ['success'] : message);
        this.resultCount = resultCount ? resultCount : null;
    }

    @IsOptional()
    resultCount?: number;
}
export class UpdateCodeResultDto extends CommonResultDto {
    constructor(resultCount: number, result?: boolean, message?: string[]) {
        super(result == undefined ? true : result
            , message == undefined ? ['success'] : message);
        this.resultCount = resultCount ? resultCount : null;
    }

    @IsOptional()
    resultCount?: number;
}
export class DeleteCodeResultDto extends CommonResultDto {
    constructor(resultCount: number, result?: boolean, message?: string[]) {
        super(result == undefined ? true : result
            , message == undefined ? ['success'] : message);
        this.resultCount = resultCount ? resultCount : null;
    }

    @IsOptional()
    resultCount?: number;
}
