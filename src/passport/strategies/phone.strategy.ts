import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ExtractJwt } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PhoneTokenPayload } from '../interfaces/passport.interface';
import { PassportService } from '../passport.service';
import { CommonError, ERROR } from '@libs/core/types';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class PhoneAuthGuard implements CanActivate {
  constructor(
    private readonly passportService: PassportService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = ExtractJwt.fromAuthHeaderAsBearerToken()(request);

    if (!token) {
      throw new CommonError({
        error: ERROR.INVALID_TOKEN,
        message: '토큰이 제공되지 않았습니다.',
      });
    }

    try {
      const decoded = this.jwtService.verify(token, {
        secret: this.configService.get<string>('JWT_PHONE_SECRET'),
      }) as PhoneTokenPayload;

      const { phoneNumber, passportAuthId } = decoded;

      const passportAuth = await this.passportService.findOne({
        where: {
          id: passportAuthId,
          phoneNumber,
        },
      });

      if (!passportAuth) {
        throw new CommonError({
          error: ERROR.INVALID_TOKEN,
          message: '토큰 정보에 해당하는 passport 정보가 없습니다.',
        });
      }

      request.phoneAuth = decoded;
      return true;
    } catch (error) {
      console.error(error);
      throw new CommonError({
        error: ERROR.INVALID_TOKEN,
        message: '유효하지 않은 토큰입니다.',
      });
    }
  }
}

// // todo 테스트를 위해서 기본으로 설정
// @Injectable()
// export class PhoneJwtStrategy extends PassportStrategy(Strategy, 'phone') {
//   constructor(private readonly configService: ConfigService) {
//     super({
//       jwtFromRequest: (req: Request) => {
//         const token = ExtractJwt.fromAuthHeaderAsBearerToken()(req);
//         return token; // 기본값 설정
//       },
//       ignoreExpiration: false,
//       secretOrKey:
//         configService.get('JWT_ACCESS_SECRET') || 'your_jwt_secret_key', // 비밀 키 설정
//     });
//   }

//   async validate(payload: any) {
//     // payload는 위의 JWT의 payload를 인자로 받는다.
//     console.log('phone payload : ', payload);
//     return {
//       passportAuthId: payload.passportAuthId,
//       phoneNumber: payload.phoneNumber,
//     };
//   }
// }

// @Injectable()
// export class PhoneAuthGuard extends AuthGuard('phone') {
//   constructor(private readonly passportService: PassportService) {
//     super();
//   }
//   async handleRequest<TUser = any>(
//     err: any,
//     user: PhoneTokenPayload | any,
//     info: any,
//     context: ExecutionContext,
//   ): Promise<TUser> {
//     const request = context.switchToHttp().getRequest();

//     const { phoneNumber, passportAuthId } = user;

//     const passportAuth = await this.passportService.findOne({
//       where: {
//         id: passportAuthId,
//         phoneNumber,
//       },
//     });

//     if (!passportAuth) {
//       throw new CommonError({
//         error: ERROR.INVALID_TOKEN,
//         message: '토큰 정보에 해당하는 passport 정보가 없습니다. ',
//       });
//     }

//     request.phoneAuth = user;

//     return user;
//   }
// }
