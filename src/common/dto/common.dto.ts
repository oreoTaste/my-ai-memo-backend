import { IsNotEmpty, IsOptional } from "class-validator";

export class CommonResultDto {
    constructor(result: boolean, message: string[]) {
        this.statusCode = result ? 200 : 400;
        this.result = result;
        this.message = message;
    }

    statusCode: number = 200;

    @IsNotEmpty()
    result: boolean = true;

    message: string[] = ['success'];

}

export class getAPIKeyResultDto extends CommonResultDto {
    constructor(apiKey: string, result?: boolean, message?: string[]) {
        super(result == undefined ? true : result
            , message == undefined ? ['success'] : message);
        this.apiKey = apiKey ? apiKey : null;
    }

    @IsOptional()
    apiKey?: string;
}