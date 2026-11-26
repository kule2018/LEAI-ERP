import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator'
import { PaginationDto } from '../../common/dto/pagination.dto'

export class QueryRiskDto extends PaginationDto {
  @IsOptional() @IsString() @MaxLength(40) riskType?: string
  @IsOptional() @IsString() @MaxLength(16) severity?: string
  @IsOptional() @IsIn(['OPEN', 'ASSIGNED', 'CLOSED']) status?: string
}

export class AssignRiskDto {
  @IsInt() @Min(1) assigneeId!: number
}

export class CloseRiskDto {
  @IsString() @IsNotEmpty() @MaxLength(500) reason!: string
}
