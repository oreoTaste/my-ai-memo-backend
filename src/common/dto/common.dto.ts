import { IsNotEmpty } from "class-validator";

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
