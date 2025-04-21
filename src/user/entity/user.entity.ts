import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsNumber, IsString, IsStrongPassword, Length } from 'class-validator';
import { ChatMember, ChatMessage } from 'src/chat/entity/chat.entity';
import { CommonEntity } from 'src/common/entity/common.entity';
import { Memo, SharedMemo } from 'src/memo/entity/memo.entity';
import { Entity, Column, PrimaryGeneratedColumn, Index, OneToMany } from 'typeorm';

@Entity({name: "Y_USER"})
@Index('Y_USER_IDX1', ['loginId'], {unique: true})
@Index('Y_USER_IDX2', ['name', 'loginId'], {unique: false})
export class User extends CommonEntity{
  @PrimaryGeneratedColumn({primaryKeyConstraintName: "Y_USER_PK", name: "ID", comment: "고객ID", type: 'number'})
  @IsNumber()
  @ApiProperty()
  id: number;

  @Column({type: 'varchar2', length: 30, name: "LOGIN_ID", comment: "로그인 아이디"})
  @Length(5,30)
  @IsString()
  @IsNotEmpty({message: "아이디를 입력해주세요"})
  @ApiProperty()
  loginId: string;

  @Column({name: "NAME", comment: "고객명"})
  @Length(2,100)
  @IsString()
  @IsNotEmpty({message: "이름을 입력해주세요"})
  @ApiProperty()
  name: string;

  @Column({ default: true, name: "IS_ACTIVE", comment: "활성화 여부"})
  @IsBoolean()
  @ApiProperty()
  isActive: boolean;

  @Column({name: "PASSWORD", comment: "비밀번호"})
  @Length(6,30)
  // @IsStrongPassword({minLength:5, minLowercase:1, minUppercase:1, minNumbers:1, minSymbols:1})
  @IsString()
  @IsNotEmpty({message: "비밀번호를 입력해주세요"})
  @ApiProperty()
  password: string;

  @Column({nullable: true, type: 'varchar2', length: 1, default: "N", name: "ADMIN_YN", comment: "관리자 여부"})
  adminYn: 'Y' | 'N';

  @Column({nullable: true, type: 'varchar2', length: 10, name: "TELEGRAM_ID", comment: "텔레그램 아이디"})
  telegramId: string;

  @OneToMany(() => Memo, (memo) => memo.insertUser, {lazy: true})
  memos: Memo[];


  @OneToMany(() => SharedMemo, (shared) => shared.sharedUser, {lazy: true})
  sharedMemos: SharedMemo[];

  @OneToMany(() => ChatMember, (chatMember) => chatMember.user, {lazy: true})
  chatMembers: ChatMember[];

  @OneToMany(() => ChatMessage, (chatMessage) => chatMessage.user, {lazy: true})
  chatMessages: ChatMessage[];

}