import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { Users } from '@libs/core/databases/entities/user.entity';
import { AbstractRepository } from '@libs/core/databases';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { PostsService } from 'src/posts/posts.service';
import { CommonError, ERROR, PaginationDto } from '@libs/core/types';
import { PhoneTokenPayload } from 'src/passport/interfaces/passport.interface';
import { PassportService } from 'src/passport/passport.service';
import { MBTI, MbtiResponse } from './types/mbti.type';
import { Posts } from '@libs/core/databases/entities/post.entity';

@Injectable()
export class UsersService extends AbstractRepository<Users> {
  constructor(
    @Inject(REQUEST) req: Request,
    @InjectRepository(Users) private readonly userRepository: Repository<Users>,
    private readonly postsService: PostsService,
    @Inject(forwardRef(() => PassportService))
    private readonly passportService: PassportService,
  ) {
    super(userRepository, req);
  }

  async getUserById(userId: number) {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new CommonError({
        error: ERROR.NO_EXISTS_USER,
        message: '해당 id를 갖는 user는 존재하지 않습니다. ',
      });
    }

    return user;
  }

  // passportAuthId 생성
  async createUserPassportAuth(entity: { passportAuthId: number }) {
    const user = this.userRepository.create(entity);
    return await this.userRepository.save(user);
  }

  async getUserPosts(userId: number, dto: PaginationDto<Posts>) {
    await this.getUserById(userId);
    const posts = await this.postsService.getMyPosts(userId, dto);

    return posts;
  }

  async updateNickname(userId: number, nickname: string) {
    await this.getUserById(userId);

    const updateToUser = await this.updateById(userId, { nickname });

    return updateToUser;
  }

  async updateMbti(userId: number, mbti: string) {
    await this.getUserById(userId);

    const updateToUser = await this.updateById(userId, { mbti });

    return updateToUser;
  }

  async isNicknameUnique(nickname: string): Promise<boolean> {
    const existingUser = await this.userRepository.findOne({
      where: { nickname },
    });

    return existingUser ? false : true;
  }

  async createNickname(nickname: string, phoneAuth: PhoneTokenPayload) {
    const { passportAuthId, phoneNumber } = phoneAuth;

    const passport =
      await this.passportService.getPassportAuthByPhone(phoneNumber);
    if (!passport) {
      throw new CommonError({
        error: ERROR.NO_EXISTS_DATA,
        message: '입력하신 번호에 해당하는 Auth가 존재하지 않습니다.',
      });
    }
    if (passport.id !== passportAuthId) {
      throw new CommonError({
        error: ERROR.INVALID_TOKEN,
        message: '토큰에 대한 정보가 정확하지 않습니다.',
      });
    }

    // todo 닉네임 중복 검사는 따로 API 요청을 한다.
    // const isUnique = await this.isNicknameUnique(nickname);
    // if (!isUnique) {
    //   throw new CommonError({
    //     error: ERROR.ALREADY_USED_DATA,
    //     message: '이미 사용 중인 닉네임입니다.',
    //   });
    // }

    const user = await this.findOne({
      where: {
        passportAuthId,
      },
    });

    if (!user) {
      throw new CommonError({
        error: ERROR.NO_EXISTS_USER,
        message: '사용자를 찾을 수 없습니다.',
      });
    }

    return await this.upsert({
      ...user,
      nickname,
    });
  }
  async getMbtiInfo(mbti: string) {
    const mbtiResponse = MbtiResponse;
    const mbtiType = mbti.toUpperCase();

    if (Object.values(MBTI).includes(mbtiType as MBTI)) {
      return mbtiResponse[mbtiType as keyof typeof MbtiResponse];
    } else {
      throw new CommonError({
        error: ERROR.INVALID_PARAMS,
        message: '유효하지 않은 MBTI 유형입니다.',
      });
    }
  }

  async postMbti(phoneAuth: PhoneTokenPayload, mbti: string) {
    const { passportAuthId } = phoneAuth;

    const user = await this.findOne({
      where: {
        passportAuthId,
      },
    });

    if (!user) {
      throw new CommonError({
        error: ERROR.NO_EXISTS_USER,
        message: '해당 passportAuthId를 갖는 user는 존재하지 않습니다. ',
      });
    }

    return this.upsert({
      ...user,
      mbti,
    });
  }

  async deleteAccount(userId: number, passportAuthId: number) {
    const user = await this.userRepository.findOne({
      where: { id: userId, passportAuthId },
    });
    if (!user) {
      throw new CommonError({
        error: ERROR.NO_EXISTS_USER,
        message: '해당 유저가 존재하지 않습니다.',
      });
    }

    await this.userRepository.softDelete({ id: userId });
    await this.passportService.softDelete(passportAuthId);

    return {
      message: '회원탈퇴가 완료되었습니다.',
    };
  }
}
