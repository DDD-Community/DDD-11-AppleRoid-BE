import { Controller, Body, Param, Query } from '@nestjs/common';
import { PostsService } from './posts.service';
import { CreateAndUpdatePostDTO } from './dto/post.dto';
import { HttpMethodEnum, Route } from '@libs/core/decorators';
import { UserInfo } from '@libs/core/decorators/info.decorator';
import { TokenPayload } from 'src/passport/interfaces/passport.interface';
import { PostOwnerGuard } from '@libs/core/guards/post.owner.guard';
import { CreateCommentDTO } from 'src/comments/dto/comment.dto';
import { CommentsService } from 'src/comments/comments.service';
import { ApiTags } from '@nestjs/swagger';
import { CommentListRO } from 'src/comments/dto/comment.ro';
import { PostRO } from './dto/post.ro';
import { PaginationDto } from '@libs/core/types';
import { Posts } from '@libs/core/databases/entities/post.entity';
import { Comments } from '@libs/core/databases/entities/comment.entity';

@ApiTags('Posts')
@Controller('posts')
export class PostsController {
  constructor(
    private readonly postsService: PostsService,
    private readonly commentsService: CommentsService,
  ) {}

  @Route({
    path: '/:postId/comment',
    method: 'POST',
    guards: [PostOwnerGuard],
    auth: true,
    summary: '게시글에 댓글 달기 ',
  })
  async commentByPostId(
    @UserInfo() user: TokenPayload,
    @Param('postId') postId: number,
    @Body() dto: CreateCommentDTO,
  ) {
    const { id: userId } = user;
    return this.commentsService.createComment(postId, userId, dto);
  }

  @Route({
    path: '/:postId/comments',
    method: 'GET',
    summary: '특정 게시글에 달린 댓글과 대댓글 가져오기',
    transform: CommentListRO,
  })
  async getCommentsByPostId(
    @Param('postId') postId: number,
    @Query() dto: PaginationDto<Comments>,
  ): Promise<CommentListRO> {
    const comments = await this.commentsService.getCommentsByPostId(
      postId,
      dto,
    );
    return { comments };
  }

  @Route({
    path: '/me',
    method: HttpMethodEnum.GET,
    auth: true,
    summary: '내가 쓴 게시물 가져오기',
  })
  async getMyPosts(
    @UserInfo() user: TokenPayload,
    @Query() dto: PaginationDto<Posts>,
  ) {
    const { id: userId } = user;
    return this.postsService.getMyPosts(userId, dto);
  }

  @Route({
    path: '/:postId',
    method: 'PATCH',
    guards: [PostOwnerGuard],
    auth: true,
    summary: '게시글 수정, 게시글의 수정은 작성자만이 가능하다',
  })
  async updatePost(
    @Param('postId') postId: number,
    @Body() dto: CreateAndUpdatePostDTO,
  ) {
    return this.postsService.updateById(+postId, dto);
  }

  @Route({
    path: '/',
    method: 'POST',
    auth: true,
    transactional: true,
    summary: '게시글 생성',
    transform: PostRO,
  })
  async create(
    @UserInfo() user: TokenPayload,
    @Body() dto: CreateAndUpdatePostDTO,
  ) {
    const { id: userId } = user;

    return this.postsService.createPosts(userId, dto);
  }
}
