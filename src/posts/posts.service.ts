import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { CreateAndUpdatePostDTO } from './dto/post.dto';
import { Repository } from 'typeorm';
import { Posts } from '@libs/core/databases/entities/post.entity';
import { AbstractRepository } from '@libs/core/databases';
import { InjectRepository } from '@nestjs/typeorm';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { UsersService } from 'src/users/users.service';
import { Votes } from '@libs/core/databases/entities/vote.entity';
import { CommonError, ERROR, PaginationDto } from '@libs/core/types';

@Injectable()
export class PostsService extends AbstractRepository<Posts> {
  constructor(
    @InjectRepository(Posts)
    private readonly postsRepository: Repository<Posts>,
    @InjectRepository(Votes)
    private readonly votesRepository: Repository<Votes>,
    @Inject(REQUEST) req: Request,
    @Inject(forwardRef(() => UsersService))
    private readonly userService: UsersService,
  ) {
    super(postsRepository, req);
  }

  async getMyPosts(userId: number, dto: PaginationDto<Posts>) {
    const filter = { userId, ...dto };

    return this.findAll({
      filter,
    });
  }

  async createPosts(userId: number, dto: CreateAndUpdatePostDTO) {
    const user = await this.userService.getUserById(userId);

    const { title, content, voteOptions } = dto;

    const post = this.postsRepository.create({
      userId,
      content,
      title,
      user,
    });

    // 투표 옵션 생성
    if (voteOptions && voteOptions.length > 0) {
      post.votes = voteOptions!.map((voteOption) =>
        this.votesRepository.create({
          option: voteOption.option,
          post,
        }),
      );
    }

    await this.postsRepository.save(post);

    return post;
  }

  async updatePosts(
    userId: number,
    postId: number,
    dto: CreateAndUpdatePostDTO,
  ) {
    const post = await this.postsRepository.findOne({
      where: {
        id: postId,
        userId,
      },
      relations: {
        votes: true,
      },
    });

    if (!post) {
      throw new CommonError({
        error: ERROR.NO_EXISTS_DATA,
        message: '게시글을 찾을 수 없습니다.',
      });
    }
    const { content, title, voteOptions } = dto;

    const updatePost = this.postsRepository.create({
      userId,
      content,
      title,
    });

    // 투표 옵션 생성
    if (voteOptions && voteOptions.length > 0) {
      updatePost.votes = voteOptions!.map((voteOption) =>
        this.votesRepository.create({
          id: voteOption.id,
          option: voteOption.option,
          post,
        }),
      );
    }
    await this.postsRepository.save(updatePost);

    console.log(updatePost);

    return updatePost;
  }
}
