import { Type } from 'class-transformer'
import {
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateNested
} from 'class-validator'
import { PaginationDto } from '../../common/dto/pagination.dto'

const AMOUNT_PATTERN = /^\d+(\.\d{1,4})?$/

export class QueryCustomerDto extends PaginationDto {}

export class CreateCustomerDto {
  @IsString() @IsNotEmpty() @MaxLength(50) customerCode!: string
  @IsString() @IsNotEmpty() @MaxLength(150) customerName!: string
  @IsOptional() @IsString() @MaxLength(50) customerGroup?: string
  @IsOptional() @IsInt() @Min(1) levelId?: number
  @IsOptional() @IsString() @Matches(AMOUNT_PATTERN) creditLimit?: string
  @IsOptional() @IsInt() @Min(1) priceLevelId?: number
  @IsOptional() @IsInt() @Min(1) ownerUserId?: number
  @IsOptional() @IsString() @MaxLength(500) remark?: string
}

export class UpdateCustomerDto {
  @IsOptional() @IsString() @MaxLength(150) customerName?: string
  @IsOptional() @IsString() @MaxLength(50) customerGroup?: string
  @IsOptional() @IsInt() @Min(1) levelId?: number
  @IsOptional() @IsString() @Matches(AMOUNT_PATTERN) creditLimit?: string
  @IsOptional() @IsInt() @Min(1) priceLevelId?: number
  @IsOptional() @IsInt() @Min(1) ownerUserId?: number
  @IsOptional() @IsIn(['ACTIVE', 'DISABLED']) status?: string
  @IsOptional() @IsString() @MaxLength(500) remark?: string
}

export class CreateCustomerContactDto {
  @IsString() @IsNotEmpty() @MaxLength(50) name!: string
  @IsOptional() @IsString() @MaxLength(30) phone?: string
  @IsOptional() @IsString() @MaxLength(100) email?: string
  @IsOptional() @IsString() @MaxLength(50) position?: string
  @IsOptional() @IsIn(['YES', 'NO']) isPrimary?: string
}

export class UpdateCustomerContactDto {
  @IsOptional() @IsString() @MaxLength(50) name?: string
  @IsOptional() @IsString() @MaxLength(30) phone?: string
  @IsOptional() @IsString() @MaxLength(100) email?: string
  @IsOptional() @IsString() @MaxLength(50) position?: string
  @IsOptional() @IsIn(['YES', 'NO']) isPrimary?: string
}

export class CreateCustomerAddressDto {
  @IsOptional() @IsString() @MaxLength(32) province?: string
  @IsOptional() @IsString() @MaxLength(32) city?: string
  @IsOptional() @IsString() @MaxLength(32) district?: string
  @IsString() @IsNotEmpty() @MaxLength(300) address!: string
  @IsOptional() @IsString() @MaxLength(50) contactName?: string
  @IsOptional() @IsString() @MaxLength(30) contactPhone?: string
  @IsOptional() @IsIn(['YES', 'NO']) isDefault?: string
}

export class UpdateCustomerAddressDto {
  @IsOptional() @IsString() @MaxLength(300) address?: string
  @IsOptional() @IsString() @MaxLength(50) contactName?: string
  @IsOptional() @IsString() @MaxLength(30) contactPhone?: string
  @IsOptional() @IsIn(['YES', 'NO']) isDefault?: string
}

export class QuerySupplierDto extends PaginationDto {}

export class CreateSupplierDto {
  @IsString() @IsNotEmpty() @MaxLength(50) supplierCode!: string
  @IsString() @IsNotEmpty() @MaxLength(150) supplierName!: string
  @IsOptional() @IsString() @MaxLength(50) supplierGroup?: string
  @IsOptional() @IsIn(['PENDING', 'QUALIFIED', 'EXPIRED']) qualificationStatus?: string
  @IsOptional() @IsString() @MaxLength(10) qualificationExpire?: string
  @IsOptional() @IsIn(['YES', 'NO']) blacklist?: string
  @IsOptional() @IsString() @Matches(AMOUNT_PATTERN) ratingScore?: string
  @IsOptional() @IsString() @MaxLength(50) contactName?: string
  @IsOptional() @IsString() @MaxLength(30) contactPhone?: string
  @IsOptional() @IsString() @MaxLength(100) bankAccount?: string
  @IsOptional() @IsString() @MaxLength(100) bankName?: string
  @IsOptional() @IsString() @MaxLength(500) remark?: string
}

export class UpdateSupplierDto {
  @IsOptional() @IsString() @MaxLength(150) supplierName?: string
  @IsOptional() @IsString() @MaxLength(50) supplierGroup?: string
  @IsOptional() @IsIn(['PENDING', 'QUALIFIED', 'EXPIRED']) qualificationStatus?: string
  @IsOptional() @IsString() @MaxLength(10) qualificationExpire?: string
  @IsOptional() @IsIn(['YES', 'NO']) blacklist?: string
  @IsOptional() @IsString() @Matches(AMOUNT_PATTERN) ratingScore?: string
  @IsOptional() @IsString() @MaxLength(50) contactName?: string
  @IsOptional() @IsString() @MaxLength(30) contactPhone?: string
  @IsOptional() @IsString() @MaxLength(100) bankAccount?: string
  @IsOptional() @IsString() @MaxLength(100) bankName?: string
  @IsOptional() @IsIn(['ACTIVE', 'DISABLED']) status?: string
  @IsOptional() @IsString() @MaxLength(500) remark?: string
}

export class CreateVariantDto {
  @IsString() @IsNotEmpty() @MaxLength(80) skuCode!: string
  @IsOptional() @IsString() @MaxLength(100) barcode?: string
  @IsOptional() @IsString() @Matches(AMOUNT_PATTERN) cost?: string
  @IsOptional() @IsString() @Matches(AMOUNT_PATTERN) price?: string
  @IsOptional() @IsString() @MaxLength(500) imageUrl?: string
  @IsOptional() @IsObject() attributes?: Record<string, string>
}

export class CreateProductDto {
  @IsString() @IsNotEmpty() @MaxLength(50) productCode!: string
  @IsString() @IsNotEmpty() @MaxLength(150) productName!: string
  @IsOptional() @IsString() @MaxLength(100) barcode?: string
  @IsOptional() @IsInt() @Min(1) categoryId?: number
  @IsOptional() @IsInt() @Min(1) brandId?: number
  @IsOptional() @IsInt() @Min(1) unitId?: number
  @IsOptional() @IsString() @MaxLength(24) productType?: string
  @IsOptional() @IsString() @MaxLength(24) trackingType?: string
  @IsOptional() @IsString() @Matches(AMOUNT_PATTERN) cost?: string
  @IsOptional() @IsString() @Matches(AMOUNT_PATTERN) price?: string
  @IsOptional() @IsString() @Matches(AMOUNT_PATTERN) floorPrice?: string
  @IsOptional() @IsString() @MaxLength(500) imageUrl?: string
  @IsOptional() @IsObject() attributes?: Record<string, unknown>
  @IsOptional() @IsInt() @Min(1) defaultWarehouseId?: number
  @IsOptional() @IsInt() @Min(1) defaultLocationId?: number
  @IsOptional() @IsString() @MaxLength(500) remark?: string
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => CreateVariantDto) variants?: CreateVariantDto[]
}

export class CreateUnitConversionDto {
  @IsInt() @Min(1) productId!: number
  @IsInt() @Min(1) unitId!: number
  @IsOptional() @IsString() @Matches(/^\d+(\.\d{1,6})?$/) conversionRate?: string
  @IsOptional() @IsIn(['YES', 'NO']) isBase?: string
  @IsOptional() @IsString() @MaxLength(255) remark?: string
}

export class ConvertProductUnitDto {
  @IsInt() @Min(1) productId!: number
  @IsInt() @Min(1) unitId!: number
  @IsOptional() @IsString() @Matches(/^\d+(\.\d{1,6})?$/) qty?: string
}

export class QueryUnitConversionDto {
  @IsInt() @Min(1) productId!: number
}

export class UpdateProductDto {
  @IsOptional() @IsString() @MaxLength(150) productName?: string
  @IsOptional() @IsString() @MaxLength(100) barcode?: string
  @IsOptional() @IsInt() @Min(1) categoryId?: number
  @IsOptional() @IsInt() @Min(1) brandId?: number
  @IsOptional() @IsInt() @Min(1) unitId?: number
  @IsOptional() @IsString() @MaxLength(24) productType?: string
  @IsOptional() @IsString() @MaxLength(24) trackingType?: string
  @IsOptional() @IsString() @Matches(AMOUNT_PATTERN) cost?: string
  @IsOptional() @IsString() @Matches(AMOUNT_PATTERN) price?: string
  @IsOptional() @IsString() @Matches(AMOUNT_PATTERN) floorPrice?: string
  @IsOptional() @IsString() @MaxLength(500) imageUrl?: string
  @IsOptional() @IsObject() attributes?: Record<string, unknown>
  @IsOptional() @IsInt() @Min(1) defaultWarehouseId?: number
  @IsOptional() @IsInt() @Min(1) defaultLocationId?: number
  @IsOptional() @IsIn(['YES', 'NO']) isActive?: string
  @IsOptional() @IsString() @MaxLength(500) remark?: string
}

export class CreateVariantRequestDto {
  @IsString() @IsNotEmpty() @MaxLength(80) skuCode!: string
  @IsOptional() @IsString() @MaxLength(100) barcode?: string
  @IsOptional() @IsString() @Matches(AMOUNT_PATTERN) cost?: string
  @IsOptional() @IsString() @Matches(AMOUNT_PATTERN) price?: string
  @IsOptional() @IsObject() attributes?: Record<string, string>
}

export class UpdateVariantDto {
  @IsOptional() @IsString() @MaxLength(100) barcode?: string
  @IsOptional() @IsString() @Matches(AMOUNT_PATTERN) cost?: string
  @IsOptional() @IsString() @Matches(AMOUNT_PATTERN) price?: string
  @IsOptional() @IsObject() attributes?: Record<string, string>
}

export class QueryProductDto extends PaginationDto {
  @IsOptional() @IsInt() @Min(1) categoryId?: number
}

export class CreateLookupDto {
  @IsString() @IsNotEmpty() @MaxLength(50) code!: string
  @IsString() @IsNotEmpty() @MaxLength(100) name!: string
  @IsOptional() @IsInt() @Min(0) sortNo?: number
}

export class QueryWarehouseDto extends PaginationDto {}

export class CreateWarehouseDto {
  @IsString() @IsNotEmpty() @MaxLength(50) warehouseCode!: string
  @IsString() @IsNotEmpty() @MaxLength(100) warehouseName!: string
  @IsOptional() @IsInt() @Min(1) orgId?: number
  @IsOptional() @IsString() @MaxLength(300) address?: string
  @IsOptional() @IsString() @MaxLength(50) manager?: string
  @IsOptional() @IsIn(['YES', 'NO']) isDefault?: string
}

export class UpdateWarehouseDto {
  @IsOptional() @IsString() @MaxLength(100) warehouseName?: string
  @IsOptional() @IsInt() @Min(1) orgId?: number
  @IsOptional() @IsString() @MaxLength(300) address?: string
  @IsOptional() @IsString() @MaxLength(50) manager?: string
  @IsOptional() @IsIn(['YES', 'NO']) isDefault?: string
  @IsOptional() @IsIn(['ACTIVE', 'DISABLED']) status?: string
}

export class CreateLocationDto {
  @IsString() @IsNotEmpty() @MaxLength(50) locationCode!: string
  @IsOptional() @IsString() @MaxLength(100) locationName?: string
  @IsOptional() @IsString() @MaxLength(50) zoneCode?: string
}

export class UpdateLocationDto {
  @IsOptional() @IsString() @MaxLength(100) locationName?: string
  @IsOptional() @IsString() @MaxLength(50) zoneCode?: string
  @IsOptional() @IsIn(['ACTIVE', 'DISABLED']) status?: string
}

export class QueryEmployeeDto extends PaginationDto {
  @IsOptional() @IsInt() @Min(1) deptId?: number
}

export class CreateEmployeeDto {
  @IsString() @IsNotEmpty() @MaxLength(50) employeeNo!: string
  @IsString() @IsNotEmpty() @MaxLength(64) name!: string
  @IsOptional() @IsInt() @Min(1) deptId?: number
  @IsOptional() @IsInt() @Min(1) positionId?: number
  @IsOptional() @IsInt() @Min(1) userId?: number
  @IsOptional() @IsString() @MaxLength(30) mobile?: string
  @IsOptional() @IsString() @MaxLength(100) email?: string
  @IsOptional() @IsString() @MaxLength(10) hireDate?: string
}

export class UpdateEmployeeDto {
  @IsOptional() @IsString() @MaxLength(64) name?: string
  @IsOptional() @IsInt() @Min(1) deptId?: number
  @IsOptional() @IsInt() @Min(1) positionId?: number
  @IsOptional() @IsInt() @Min(1) userId?: number
  @IsOptional() @IsString() @MaxLength(30) mobile?: string
  @IsOptional() @IsString() @MaxLength(100) email?: string
  @IsOptional() @IsString() @MaxLength(10) hireDate?: string
  @IsOptional() @IsIn(['ACTIVE', 'DISABLED']) status?: string
}
