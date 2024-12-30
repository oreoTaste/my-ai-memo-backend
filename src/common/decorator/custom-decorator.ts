import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * @description 쿠키 조회
 * @param data 쿠키 조회할 key값
 */
export const Cookies = createParamDecorator(async (data: string, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest();
  console.log(`${data} : cookie decorator : ${request.cookies?.[data]}`);
  return data ? request.cookies?.[data] : null;
});

/**
 * @description 쿠키를 통한 회원ID 조회
 * @param data 필요없음
 */
export const UserId = createParamDecorator(async (data: string, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest();
  return request.cookies?.userId;
});

/**
 * @description 세션를 통한 회원ID 조회
 * @param data 필요없음
 */
export const AuthUser = createParamDecorator(async (data: string, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest();
  console.log(`---------------------------`);
  console.log(`sessionID : ${request.sessionID}`);
  console.log(request.session);
  console.log(`---------------------------`);
  return request.session?.user;
});