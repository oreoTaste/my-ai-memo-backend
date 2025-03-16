import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsNumber, IsString, IsStrongPassword, Length } from 'class-validator';
import { CommonEntity } from 'src/common/entity/common.entity';
import { Entity, Column, PrimaryGeneratedColumn, Index } from 'typeorm';

@Entity({name: "Y_USER"})
@Index('Y_USER_IDX1', ['loginId'], {unique: true})
@Index('Y_USER_IDX2', ['name', 'loginId'], {unique: false})
export class User extends CommonEntity{
  @PrimaryGeneratedColumn({primaryKeyConstraintName: "Y_USER_PK", name: "id"})
  @IsNumber()
  @ApiProperty()
  id: number;

  @Column({type: 'varchar2', length: 30, name: "loginId"})
  @Length(5,30)
  @IsString()
  @IsNotEmpty({message: "아이디를 입력해주세요"})
  @ApiProperty()
  loginId: string;

  @Column({name: "name"})
  @Length(2,100)
  @IsString()
  @IsNotEmpty({message: "이름을 입력해주세요"})
  @ApiProperty()
  name: string;

  @Column({ default: true, name: "isActive"})
  @IsBoolean()
  @ApiProperty()
  isActive: boolean;

  @Column({name: "password"})
  @Length(6,30)
  // @IsStrongPassword({minLength:5, minLowercase:1, minUppercase:1, minNumbers:1, minSymbols:1})
  @IsString()
  @IsNotEmpty({message: "비밀번호를 입력해주세요"})
  @ApiProperty()
  password: string;

  @Column({nullable: true, type: 'varchar2', length: 1, default: "N", name: "adminYn"})
  adminYn: 'Y' | 'N';

  @Column({nullable: true, type: 'varchar2', length: 10, name: "telegramId"})
  telegramId: string;
}