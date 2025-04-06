import { Body, Controller, Delete, Get, Logger, Post, Query, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { MemoService } from './memo.service';
import { AuthUser } from 'src/common/decorator/custom-decorator';
import { AuthUserDto } from 'src/user/dto/user.dto';
import { DeleteMemoResultDto, GetMemoAdviceDto, GetMemoAdviceResultDto, InsertMemoDto, ListMemoDto, ListMemoResultDto, SearchMemoDto, UpdateMemoDto, UpdateMemoResultDto } from './dto/memo.dto';
import { FilesInterceptor } from '@nestjs/platform-express';
import { FileService } from 'src/file/file.service';
import { AIAnalyzerService } from 'src/common/ai-analyzer.service';
import { CommonResultDto, getAPIKeyResultDto } from 'src/common/dto/common.dto';
import { Memo } from './entity/memo.entity';

@Controller('memo')
export class MemoController {
    constructor(private readonly memoService: MemoService, 
                private readonly fileService: FileService,
                private readonly aiAnalyzer: AIAnalyzerService,
            ){}

    @Get('list')
    async listMemo(@AuthUser() authUser: AuthUserDto,
                   @Query() searchMemoDto: SearchMemoDto) : Promise<ListMemoResultDto>{
        if(!authUser) {
            return new ListMemoResultDto(null, false, ['please login first']);
        }

        let memos = await this.memoService.listMemoWithFiles(authUser.id);
        return new ListMemoResultDto(memos);
    }

    @Post('insert')
    @UseInterceptors(FilesInterceptor('files'))
    async insertMemo(@AuthUser() authUser: AuthUserDto,
                     @Body() insertMemoDto: InsertMemoDto,
                     @UploadedFiles() files: Array<Express.Multer.File>) : Promise<ListMemoResultDto> {
        if(!authUser) {
            return new ListMemoResultDto(null, false, ['please login first']);
        }
        const memo = await this.memoService.insertMemo(authUser.id, insertMemoDto) as ListMemoDto;
        try {
            for(let file of files) {
                if (!file.path) {
                    Logger.error('[insertMemo] File is undefined.');
                    throw new Error('File is undefined.');
                }
            }            
            memo.files = await this.fileService.insertFiles(authUser.id, files, memo.seq);
        } catch (error) {
            Logger.error('[insertMemo] Error saving file:', error);
            return new ListMemoResultDto([memo], false, ['failed to save file']);
        }
        return new ListMemoResultDto([memo]);
    }

    @Post('update')
    async updateMemo(@AuthUser() authUser: AuthUserDto,
                     @Body() updateMemoDto: UpdateMemoDto) : Promise<ListMemoResultDto> {
        if(!authUser) {
            return new ListMemoResultDto(null, false, ['please login first']);
        }

        const updateResult = await this.memoService.updateMemo(authUser.id, updateMemoDto);
        return new ListMemoResultDto([updateResult]);
    }

    @Delete('delete')
    async deleteMemo(@AuthUser() authUser: AuthUserDto,
                     @Query('seq') seq: number) : Promise<DeleteMemoResultDto> {
        if(!authUser) {
            return new DeleteMemoResultDto(null, false, ['please login first']);
        }
        const memoToDelete = await this.memoService.searchMemo(authUser.id, { seq });
        if(memoToDelete.length == 1) {
            // 노출하지 않도록 처리
            const deleteResult = await this.memoService.deactivateMemo(seq);
            Logger.debug(`[deleteMemo] succeed to delete memo in db (${seq})`);

            try {
                this.deleteMemoAndFileFromGoogleDrive(memoToDelete[0]).catch((e) => {
                    Logger.error(`[deleteMemo] 비동기 구글 드라이브 삭제 실패: ${e}`);
                });
            } catch(e) {
                Logger.debug(`[deleteMemo] failed to delete memo in db (${seq})`);
            }

            return new DeleteMemoResultDto(deleteResult);
        } else {
            return new DeleteMemoResultDto(null, false, ["couldn't find the exact memo"]);
        }
    }

    /* deleteMemo */
    async deleteMemoAndFileFromGoogleDrive(memo: Memo): Promise<void> {
        try {
            await this.fileService.deleteFiles(memo.seq, memo.insertId);
            await this.memoService.deleteMemo(memo.seq);
        } catch(e) {
            Logger.error(`[deleteMemoAndFileFromGoogleDrive] failed to delete files of memo#: ${memo.seq}`);
        }
        
    }

    @Delete('shared-delete')
    async deleteSharedMemo(@AuthUser() authUser: AuthUserDto,
                           @Query('seq') seq: number) : Promise<CommonResultDto> {
        if(!authUser) {
            return new CommonResultDto(false, ['please login first']);
        }

        let result = await this.memoService.deleteSharedMemo(authUser.id, seq);
        if(!result) {
            return new CommonResultDto(false, ['failed to delete shared memo']);
        }
        return new CommonResultDto(true, ['succeed']);
    }

    @Post('get-api-key')
    async getAPIkey(@AuthUser() authUser: AuthUserDto): Promise<getAPIKeyResultDto> {
        if(!authUser) {
            return new getAPIKeyResultDto(null, false, ['please login first']);
        }

        let apiKey = (await this.aiAnalyzer.getAPIKeys(1))[0].API_KEY;
        // 추출한 API_KEY는 사용처리
        let usageMap = new Map();
        usageMap.set(apiKey, 1);
        await this.aiAnalyzer.updateStatusOfAPIKeys(usageMap);

        return new getAPIKeyResultDto(apiKey);
    }

    @Post('analyze')
    async analyze(@AuthUser() authUser: AuthUserDto,
                  @Query('seq') seq: number
                  ): Promise<void> {
        if(!authUser) {
            return;
        }

        let files = await this.fileService.searchFiles({seq});
        this.aiAnalyzer.analyzeFiles(files, seq, authUser.id);    
    }

    @Post('get-advice')
    @UseInterceptors(FilesInterceptor('files'))
    async getMemoAdvice(@AuthUser() authUser: AuthUserDto,
                        @Body() getMemoAdviceDto: GetMemoAdviceDto,
                        @UploadedFiles() files: Array<Express.Multer.File>): Promise<GetMemoAdviceResultDto> {
        if(!authUser) {
            return new GetMemoAdviceResultDto(null, null, false, ['please login first']);
        }

        let result = await this.aiAnalyzer.getAdvice(getMemoAdviceDto, files);
        return new GetMemoAdviceResultDto(result.advice, result.subject);
    }

}
