import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Comments } from '@libs/core/databases/entities/comment.entity';
import { CommentLike } from '../../libs/core/databases/entities/comment.like.entity';
import { CreateCommentDTO, CommentRO } from './dto/comment.dto';
import { CommonError, ERROR, PaginationDto } from '@libs/core/types';
import { UsersService } from 'src/users/users.service';
import { AbstractRepository } from '@libs/core/databases';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';

@Injectable()
export class CommentsService extends AbstractRepository<Comments> {
  constructor(
    @InjectRepository(Comments)
    private commentsRepository: Repository<Comments>,
    @InjectRepository(CommentLike)
    private commentLikeRepository: Repository<CommentLike>,
    @Inject(forwardRef(() => UsersService))
    private readonly userService: UsersService,
    @Inject(REQUEST) req: Request,
  ) {
    super(commentsRepository, req);
  }

  async getCommentById(commentId: number): Promise<Comments> {
    const comment = await this.commentsRepository.findOne({
      where: { id: commentId },
    });
    if (!comment) {
      throw new CommonError({
        error: ERROR.NO_EXISTS_DATA,
        message: '해당 댓글을 찾을 수 없습니다.',
      });
    }
    return comment;
  }

  async createComment(
    postId: number,
    userId: number,
    createCommentDto: CreateCommentDTO,
  ): Promise<CommentRO> {
    const { parentId, content } = createCommentDto;

    let parent: Comments;

    const user = await this.userService.getUserById(userId);

    if (parentId) {
      parent = await this.commentsRepository.findOne({
        where: { id: parentId },
      });
      if (!parent) {
        throw new CommonError({
          error: ERROR.NO_EXISTS_DATA,
          message: '존재하지 않는 부모 댓글입니다.',
        });
      }
    }

    const comment = this.commentsRepository.create({
      postId,
      userId,
      content,
      parentId: parentId ?? null,
      parent,
      user,
    });

    await this.commentsRepository.save(comment);

    return comment;
  }

  async getCommentsByPostId(
    postId: number,
    dto: PaginationDto<Comments>,
  ): Promise<CommentRO[]> {
    const sortBy = dto.sortBy;
    const comments = await this.commentsRepository.find({
      where: { postId },
      relations: {
        replies: {
          user: true,
          likes: true, // replies에 존재하는 좋아요도 함께 가져올 수 있도록 한다.
        },
        user: true,
        likes: true,
      },
      take: dto.take,
      skip: dto.skip,
      order: {
        [sortBy]: dto.sortDesc,
      },
    });

    const filterComments = comments.filter(
      (comment) => comment.parentId === null,
    );

    const processComments = (comments: Comments[]): CommentRO[] => {
      return comments.map((comment) => {
        const likesCount = comment.likes?.filter((like) => like.isLike).length;

        let replies: CommentRO[] = [];
        if (comment.replies && comment.replies.length > 0) {
          replies = processComments(comment.replies);
        }

        return {
          ...comment,
          likesCount: likesCount ?? 0,
          replies,
        };
      });
    };

    // console.log('filterComments : ', processComments(filterComments));
    return processComments(filterComments);
  }

  async toggleLikeComment(
    commentId: number,
    userId: number,
  ): Promise<CommentLike> {
    const comment = await this.getCommentById(commentId);

    const like = await this.commentLikeRepository.findOne({
      where: { userId, comment: { id: commentId } },
    });

    const commentLike = this.commentLikeRepository.create({
      id: like?.id,
      userId,
      isLike: !like?.isLike,
      comment,
    });

    return await this.commentLikeRepository.save(commentLike);
  }

  async addLikeOrDislike(
    commentId: number,
    userId: number,
    isLike: boolean,
  ): Promise<void> {
    const comment = await this.commentsRepository.findOne({
      where: { id: commentId },
    });
    if (!comment) {
      throw new CommonError({
        error: ERROR.NO_EXISTS_DATA,
        message: '해당 댓글을 찾을 수 없습니다.',
      });
    }

    let like = await this.commentLikeRepository.findOne({
      where: { comment: { id: commentId }, userId },
    });
    if (like) {
      like.isLike = isLike;
    } else {
      like = this.commentLikeRepository.create({ comment, userId, isLike });
    }
    await this.commentLikeRepository.save(like);
  }

  async removeLikeOrDislike(commentId: number, userId: number): Promise<void> {
    const like = await this.commentLikeRepository.findOne({
      where: { comment: { id: commentId }, userId },
    });
    if (like) {
      await this.commentLikeRepository.remove(like);
    }
  }

  async getLikesCount(
    commentId: number,
  ): Promise<{ likes: number; dislikes: number }> {
    const [likes, dislikes] = await Promise.all([
      this.commentLikeRepository.count({
        where: { comment: { id: commentId }, isLike: true },
      }),
      this.commentLikeRepository.count({
        where: { comment: { id: commentId }, isLike: false },
      }),
    ]);
    return { likes, dislikes };
  }
}
