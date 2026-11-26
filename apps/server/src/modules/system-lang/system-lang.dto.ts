import { Type } from 'class-transformer'
import {
  ArrayMaxSize, ArrayMinSize, IsArray, IsInt, IsOptional, IsString, Matches, MaxLength, Min
} from 'class-validator'

export class QueryLangDto {
  @IsOptional() @IsString() @MaxLength(16) langCode?: string
  @IsOptional() @IsString() @MaxLength(200) keyword?: string
  @Type(() => Number) @IsInt() @Min(1) page = 1
  @Type(() => Number) @IsInt() @Min(1) pageSize = 20
}

export class LangEntryDto {
  @IsString() @Matches(/^[a-z]{2}_[A-Z]{2}$/) langCode!: string
  @IsString() @MaxLength(200) resourceKey!: string
  @IsString() @MaxLength(500) resourceValue!: string
  @IsOptional() @IsString() @MaxLength(16) fallbackLang?: string
  @IsOptional() @IsString() @MaxLength(60) localeName?: string
}

export class UpsertLangDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(2000)
  @Type(() => LangEntryDto)
  entries!: LangEntryDto[]
}
