import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, Query, UseGuards } from '@nestjs/common'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { RequirePerm } from '../../common/decorators/require-perm.decorator'
import type { JwtUser } from '../../common/contracts'
import { AuthGuard } from '../../common/guards/auth.guard'
import { PermissionsGuard } from '../../common/guards/permissions.guard'
import { CreateFavoriteDto, QueryFavoriteDto, RecordSearchKeywordDto, SaveDraftDto, SaveViewConfigDto } from './dto'
import { UserPreferenceService } from './user-preference.service'

@Controller('user-preference')
@UseGuards(AuthGuard, PermissionsGuard)
export class UserPreferenceController {
  constructor(private readonly service: UserPreferenceService) {}

  @Get('view-config/:pageKey')
  @RequirePerm('user:view-config:manage')
  viewConfig(@Param('pageKey') pageKey: string, @CurrentUser() user: JwtUser) {
    return this.service.viewConfig(pageKey, user)
  }

  @Put('view-config/:pageKey')
  @RequirePerm('user:view-config:manage')
  saveViewConfig(
    @Param('pageKey') pageKey: string,
    @Body() dto: SaveViewConfigDto,
    @CurrentUser() user: JwtUser
  ) {
    return this.service.saveViewConfig(pageKey, dto, user)
  }

  @Get('favorites')
  @RequirePerm('user:favorite:view')
  listFavorites(@Query() query: QueryFavoriteDto, @CurrentUser() user: JwtUser) {
    return this.service.listFavorites(query, user)
  }

  @Post('favorites')
  @RequirePerm('user:favorite:manage')
  addFavorite(@Body() dto: CreateFavoriteDto, @CurrentUser() user: JwtUser) {
    return this.service.addFavorite(dto, user)
  }

  @Post('favorites/toggle')
  @RequirePerm('user:favorite:manage')
  toggleFavorite(@Body() dto: CreateFavoriteDto, @CurrentUser() user: JwtUser) {
    return this.service.toggleFavorite(dto, user)
  }

  @Delete('favorites/:id')
  @RequirePerm('user:favorite:manage')
  removeFavorite(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) {
    return this.service.removeFavorite(id, user)
  }

  /** 快捷搜索：记录历史关键词 */
  @Post('search-history')
  @RequirePerm('user:view-config:manage')
  recordSearch(@Body() dto: RecordSearchKeywordDto, @CurrentUser() user: JwtUser) {
    return this.service.recordSearchKeyword(dto.keyword, user)
  }

  /** 快捷搜索：读取历史关键词 */
  @Get('search-history')
  @RequirePerm('user:view-config:manage')
  searchHistory(@Query('limit') limit: string, @CurrentUser() user: JwtUser) {
    return this.service.listSearchHistory(Number(limit) || 10, user)
  }

  /** 快捷搜索：清空历史 */
  @Delete('search-history')
  @RequirePerm('user:view-config:manage')
  clearSearchHistory(@CurrentUser() user: JwtUser) {
    return this.service.clearSearchHistory(user)
  }

  /** 草稿：读取 */
  @Get('drafts/:draftKey')
  @RequirePerm('user:view-config:manage')
  getDraft(@Param('draftKey') draftKey: string, @CurrentUser() user: JwtUser) {
    return this.service.getDraft(draftKey, user)
  }

  /** 草稿：保存 */
  @Put('drafts/:draftKey')
  @RequirePerm('user:view-config:manage')
  saveDraft(@Param('draftKey') draftKey: string, @Body() dto: SaveDraftDto, @CurrentUser() user: JwtUser) {
    return this.service.saveDraft(draftKey, dto, user)
  }

  /** 草稿：删除 */
  @Delete('drafts/:draftKey')
  @RequirePerm('user:view-config:manage')
  deleteDraft(@Param('draftKey') draftKey: string, @CurrentUser() user: JwtUser) {
    return this.service.deleteDraft(draftKey, user)
  }
}
