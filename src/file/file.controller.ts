import { Body, Controller, Get, Post, Query, Res } from '@nestjs/common';
import { FileService } from './file.service';
import { AuthUser } from 'src/common/decorator/custom-decorator';
import { AuthUserDto } from 'src/user/dto/user.dto';
import { DownloadFileDto } from './dto/file.dto';
import { Response } from 'express';

@Controller('file')
export class FileController {
    constructor(private readonly fileService: FileService
            ){}

    @Get('download')
    async downloadFile(@AuthUser() authUser: AuthUserDto,
                     @Query() downloadFileDto: DownloadFileDto,
                     @Res() res: Response) {
        if(authUser) {
            let savedFileName = await this.fileService.getSavedFileName(authUser.id, downloadFileDto);
            console.log(`controller : fileName : ${savedFileName}`);
            this.fileService.downloadFile(savedFileName, res);
        }
    }


}
