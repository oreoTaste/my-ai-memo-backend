import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeleteResult, InsertResult, MoreThan, Repository, UpdateResult } from 'typeorm';
import { InsertRecordDto, SearchRecordDto, UpdateRecordDto } from './dto/record.dto';
import { Record } from './entity/record.entity';
import { Code } from '../code/entity/code.entity';

@Injectable()
export class RecordService {
    constructor(
        @InjectRepository(Record)
        private recordRepository: Repository<Record>,
        @InjectRepository(Code)
        private codeRepository: Repository<Code>
    ){}

    async searchRecord(insertId: number, {recordAType, recordBType, recordCType, createdAt}: SearchRecordDto): Promise<Record[]> {
        const searchBody = {insertId};
        if(recordAType) {
            searchBody['recordAType'] = recordAType;
        }
        if(recordBType) {
            searchBody['recordBType'] = recordBType;
        }
        if(recordCType) {
            searchBody['recordCType'] = recordCType;
        }
        if(createdAt) {
            searchBody['createdAt'] = MoreThan(createdAt)
        }
        return await this.recordRepository.find({where: searchBody, order: {recordAType: "ASC", recordBType: "ASC", createdAt: "ASC"}, take: 100});
    }

    async insertRecord(insertId: number, {count, recordAType, recordBType, recordCType, value}: InsertRecordDto): Promise<InsertResult> {
        let recordATypeCode = this.codeRepository.findOne({ where: {codeGroup: "CC001", code: recordAType}}); // 대분류는 필수
        // let recordBTypeCode = this.codeRepository.findOne({ where: {codeGroup: "CC002", code: recordBType}});
        // let recordCTypeCode = this.codeRepository.findOne({ where: {codeGroup: "CC003", code: recordBType}});
        if(recordATypeCode) {
            return await this.recordRepository.insert({
                count,
                recordAType,
                recordBType,
                recordCType,
                value,
                insertId,
                updateId: insertId,
            });
        } else {
            return null;
        }
    }

    async updateRecord(insertId: number, {count, recordAType, recordBType, recordCType, seq, value}: UpdateRecordDto): Promise<UpdateResult> {
        return await this.recordRepository.update(seq, {
            updateId: insertId,
            modifiedAt: new Date(),
            count, recordAType, recordBType, recordCType, value
        });
    }

    async deleteRecord(seq: number): Promise<DeleteResult> {
        return await this.recordRepository.delete({ seq });
    }
    
}
