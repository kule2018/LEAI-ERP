import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common'
import { RequirePerm } from '../../common/decorators/require-perm.decorator'
import { AuthGuard } from '../../common/guards/auth.guard'
import { PermissionsGuard } from '../../common/guards/permissions.guard'
import { SchedulerService } from './scheduler.service'

@Controller('system/scheduler')
@UseGuards(AuthGuard, PermissionsGuard)
export class SchedulerController {
  constructor(private readonly service: SchedulerService) {}

  @Get()
  @RequirePerm('system:monitor:view')
  list() {
    return this.service.list()
  }

  @Post('tick')
  @RequirePerm('system:monitor:update')
  tick() {
    return this.service.tick()
  }

  @Post(':code/run')
  @RequirePerm('system:monitor:update')
  run(@Param('code') code: string) {
    return this.service.run(code)
  }
}
