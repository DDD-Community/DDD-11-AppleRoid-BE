import { createParamDecorator } from '@nestjs/common';
import {
  PhoneTokenPayload,
  TokenPayload,
} from 'src/passport/interfaces/passport.interface';

export const UserInfo = createParamDecorator((data, ctx): TokenPayload => {
  const request = ctx.switchToHttp().getRequest();
  return request.user;
});

export const PhoneAuthInfo = createParamDecorator(
  (data, ctx): PhoneTokenPayload => {
    const request = ctx.switchToHttp().getRequest();
    // console.log('request phoneAuth : ', request.phoneAuth);
    return request.phoneAuth as PhoneTokenPayload;
  },
);
