import { PartialType, PickType } from "@nestjs/swagger";
import { User } from "../entity/user.entity";
import { IsOptional } from "class-validator";
import { CommonResultDto } from "src/common/dto/common.dto";

export class LoginUserDto extends PickType(User, ['loginId', 'password'] as const){}
export class InsertUserDto extends PickType(User, ['loginId', 'password', 'name', 'telegramId'] as const){}
export class SearchUserDto extends PartialType(PickType(User, ['loginId', 'name'] as const)){}
export class AuthUserDto extends PickType(User, ['id', 'loginId', 'name', 'isActive', 'createdAt', 'adminYn']){}
export class ModifyUserDto extends PartialType(PickType(User, ['id', 'loginId', 'name', 'telegramId'])){
    @IsOptional()
    currentPassword?: string;

    @IsOptional()
    newPassword?: string;
}

export class InsertUserResultDto extends CommonResultDto {
    constructor(user: User, result?: boolean, message?: string[]) {
        super(result == undefined ? true : result
            , message == undefined ? ['success'] : message);
        this.user = user ? user : null;
    }

    @IsOptional()
    user?: User;
}

export class LoginUserResultDto extends CommonResultDto {
    constructor(user: User, result?: boolean, message?: string[]) {
        super(result == undefined ? true : result
            , message == undefined ? ['success'] : message);
        this.user = user ? user : null;
    }

    @IsOptional()
    user?: User;

}
export class SearchUserResultDto extends CommonResultDto {
    constructor(users: InsertUserDto[], result?: boolean, message?: string[]) {
        super(result == undefined ? true : result
            , message == undefined ? ['success'] : message);
        this.users = users;
    }

    @IsOptional()
    users?: InsertUserDto[];

}
export class ProfileUserResultDto extends CommonResultDto {
    constructor(user: User, result?: boolean, message?: string[]) {
        super(result == undefined ? true : result
            , message == undefined ? ['success'] : message);
        this.user = user;
    }

    @IsOptional()
    user?: User;

}

export class ModifyUserResultDto extends CommonResultDto {
    constructor(user: User, result?: boolean, message?: string[]) {
        super(result == undefined ? true : result
            , message == undefined ? ['success'] : message);
        this.user = user;
    }

    @IsOptional()
    user?: User;
}

