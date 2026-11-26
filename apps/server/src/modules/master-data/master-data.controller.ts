import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, Query, UseGuards } from '@nestjs/common'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { DataScope } from '../../common/decorators/data-scope.decorator'
import { RequirePerm } from '../../common/decorators/require-perm.decorator'
import type { JwtUser } from '../../common/contracts'
import { AuthGuard } from '../../common/guards/auth.guard'
import { DataScopeGuard } from '../../common/guards/data-scope.guard'
import { PermissionsGuard } from '../../common/guards/permissions.guard'
import { CustomerService } from './customer.service'
import {
  ConvertProductUnitDto,
  CreateCustomerAddressDto,
  CreateCustomerContactDto,
  CreateCustomerDto,
  CreateEmployeeDto,
  CreateLocationDto,
  CreateLookupDto,
  CreateProductDto,
  CreateSupplierDto,
  CreateUnitConversionDto,
  CreateVariantRequestDto,
  CreateWarehouseDto,
  QueryCustomerDto,
  QueryEmployeeDto,
  QueryProductDto,
  QuerySupplierDto,
  QueryUnitConversionDto,
  QueryWarehouseDto,
  UpdateCustomerAddressDto,
  UpdateCustomerContactDto,
  UpdateCustomerDto,
  UpdateEmployeeDto,
  UpdateLocationDto,
  UpdateProductDto,
  UpdateSupplierDto,
  UpdateVariantDto,
  UpdateWarehouseDto
} from './dto'
import { EmployeeService } from './employee.service'
import { ProductService } from './product.service'
import { ProductUnitService } from './product-unit.service'
import { SupplierService } from './supplier.service'
import { WarehouseService } from './warehouse.service'

const guards = [AuthGuard, PermissionsGuard, DataScopeGuard]

@Controller('master-data/customers')
@UseGuards(...guards)
@DataScope({ org: 'dept', level: 'ORG' })
export class CustomerController {
  constructor(private readonly service: CustomerService) {}

  @Get() @RequirePerm('sales:customer:view')
  list(@Query() query: QueryCustomerDto, @CurrentUser() user: JwtUser) { return this.service.list(query, user) }

  @Post() @RequirePerm('sales:customer:create')
  create(@Body() dto: CreateCustomerDto, @CurrentUser() user: JwtUser) { return this.service.create(dto, user) }

  @Put(':id') @RequirePerm('sales:customer:update')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCustomerDto, @CurrentUser() user: JwtUser) { return this.service.update(id, dto, user) }

  @Delete(':id') @RequirePerm('sales:customer:delete')
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) { return this.service.remove(id, user) }

  @Get(':id/contacts') @RequirePerm('sales:customer:view')
  contacts(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) { return this.service.listContacts(id, user) }

  @Post(':id/contacts') @RequirePerm('sales:customer:update')
  createContact(@Param('id', ParseIntPipe) id: number, @Body() dto: CreateCustomerContactDto, @CurrentUser() user: JwtUser) { return this.service.createContact(id, dto, user) }

  @Put(':id/contacts/:contactId') @RequirePerm('sales:customer:update')
  updateContact(@Param('id', ParseIntPipe) id: number, @Param('contactId', ParseIntPipe) contactId: number, @Body() dto: UpdateCustomerContactDto, @CurrentUser() user: JwtUser) { return this.service.updateContact(id, contactId, dto, user) }

  @Delete(':id/contacts/:contactId') @RequirePerm('sales:customer:update')
  removeContact(@Param('id', ParseIntPipe) id: number, @Param('contactId', ParseIntPipe) contactId: number, @CurrentUser() user: JwtUser) { return this.service.removeContact(id, contactId, user) }

  @Get(':id/addresses') @RequirePerm('sales:customer:view')
  addresses(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) { return this.service.listAddresses(id, user) }

  @Post(':id/addresses') @RequirePerm('sales:customer:update')
  createAddress(@Param('id', ParseIntPipe) id: number, @Body() dto: CreateCustomerAddressDto, @CurrentUser() user: JwtUser) { return this.service.createAddress(id, dto, user) }

  @Put(':id/addresses/:addressId') @RequirePerm('sales:customer:update')
  updateAddress(@Param('id', ParseIntPipe) id: number, @Param('addressId', ParseIntPipe) addressId: number, @Body() dto: UpdateCustomerAddressDto, @CurrentUser() user: JwtUser) { return this.service.updateAddress(id, addressId, dto, user) }

  @Delete(':id/addresses/:addressId') @RequirePerm('sales:customer:update')
  removeAddress(@Param('id', ParseIntPipe) id: number, @Param('addressId', ParseIntPipe) addressId: number, @CurrentUser() user: JwtUser) { return this.service.removeAddress(id, addressId, user) }
}

@Controller('master-data/suppliers')
@UseGuards(...guards)
@DataScope({ org: 'dept', level: 'ORG' })
export class SupplierController {
  constructor(private readonly service: SupplierService) {}

  @Get() @RequirePerm('purchase:supplier:view')
  list(@Query() query: QuerySupplierDto, @CurrentUser() user: JwtUser) { return this.service.list(query, user) }

  @Post() @RequirePerm('purchase:supplier:create')
  create(@Body() dto: CreateSupplierDto, @CurrentUser() user: JwtUser) { return this.service.create(dto, user) }

  @Put(':id') @RequirePerm('purchase:supplier:update')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateSupplierDto, @CurrentUser() user: JwtUser) { return this.service.update(id, dto, user) }

  @Delete(':id') @RequirePerm('purchase:supplier:delete')
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) { return this.service.remove(id, user) }
}

@Controller('master-data/products')
@UseGuards(...guards)
@DataScope({ org: 'dept', level: 'ORG' })
export class ProductController {
  constructor(private readonly service: ProductService) {}

  @Get() @RequirePerm('inventory:product:view')
  list(@Query() query: QueryProductDto, @CurrentUser() user: JwtUser) { return this.service.list(query, user) }

  @Post() @RequirePerm('inventory:product:create')
  create(@Body() dto: CreateProductDto, @CurrentUser() user: JwtUser) { return this.service.create(dto, user) }

  @Put(':id') @RequirePerm('inventory:product:update')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateProductDto, @CurrentUser() user: JwtUser) { return this.service.update(id, dto, user) }

  @Delete(':id') @RequirePerm('inventory:product:delete')
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) { return this.service.remove(id, user) }

  @Get(':id/variants') @RequirePerm('inventory:product:view')
  variants(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) { return this.service.listVariants(id, user) }

  @Post(':id/variants') @RequirePerm('inventory:product:update')
  createVariant(@Param('id', ParseIntPipe) id: number, @Body() dto: CreateVariantRequestDto, @CurrentUser() user: JwtUser) { return this.service.createVariant(id, dto, user) }

  @Put(':id/variants/:variantId') @RequirePerm('inventory:product:update')
  updateVariant(@Param('id', ParseIntPipe) id: number, @Param('variantId', ParseIntPipe) variantId: number, @Body() dto: UpdateVariantDto, @CurrentUser() user: JwtUser) { return this.service.updateVariant(id, variantId, dto, user) }

  @Delete(':id/variants/:variantId') @RequirePerm('inventory:product:update')
  removeVariant(@Param('id', ParseIntPipe) id: number, @Param('variantId', ParseIntPipe) variantId: number, @CurrentUser() user: JwtUser) { return this.service.removeVariant(id, variantId, user) }
}

@Controller('master-data/product-unit-conversions')
@UseGuards(...guards)
@DataScope({ org: 'dept', level: 'ORG' })
export class ProductUnitController {
  constructor(private readonly service: ProductUnitService) {}

  @Get() @RequirePerm('inventory:product:view')
  list(@Query() query: QueryUnitConversionDto, @CurrentUser() user: JwtUser) {
    return this.service.list(query.productId, user)
  }

  @Get('options') @RequirePerm('inventory:product:view')
  options(@Query() query: QueryUnitConversionDto, @CurrentUser() user: JwtUser) {
    return this.service.unitOptions(query.productId, user)
  }

  @Post() @RequirePerm('inventory:product:update')
  create(@Body() dto: CreateUnitConversionDto, @CurrentUser() user: JwtUser) {
    return this.service.create(dto, user)
  }

  @Post('convert') @RequirePerm('inventory:product:view')
  convert(@Body() dto: ConvertProductUnitDto, @CurrentUser() user: JwtUser) {
    return this.service.convert(dto, user)
  }

  @Delete(':id') @RequirePerm('inventory:product:update')
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) {
    return this.service.remove(id, user)
  }
}

@Controller('master-data/lookups')
@UseGuards(...guards)
@DataScope({ org: 'dept', level: 'ORG' })
export class LookupController {
  constructor(private readonly service: ProductService) {}

  @Get('categories') @RequirePerm('inventory:product:view')
  categories(@CurrentUser() user: JwtUser) { return this.service.listCategories(user) }

  @Post('categories') @RequirePerm('inventory:product:update')
  createCategory(@Body() dto: CreateLookupDto, @CurrentUser() user: JwtUser) { return this.service.createCategory(dto, user) }

  @Get('brands') @RequirePerm('inventory:product:view')
  brands(@CurrentUser() user: JwtUser) { return this.service.listBrands(user) }

  @Post('brands') @RequirePerm('inventory:product:update')
  createBrand(@Body() dto: CreateLookupDto, @CurrentUser() user: JwtUser) { return this.service.createBrand(dto, user) }

  @Get('units') @RequirePerm('inventory:product:view')
  units(@CurrentUser() user: JwtUser) { return this.service.listUnits(user) }

  @Post('units') @RequirePerm('inventory:product:update')
  createUnit(@Body() dto: CreateLookupDto, @CurrentUser() user: JwtUser) { return this.service.createUnit(dto, user) }
}

@Controller('master-data/warehouses')
@UseGuards(...guards)
@DataScope({ org: 'dept', level: 'ORG' })
export class WarehouseController {
  constructor(private readonly service: WarehouseService) {}

  @Get() @RequirePerm('inventory:warehouse:view')
  list(@Query() query: QueryWarehouseDto, @CurrentUser() user: JwtUser) { return this.service.list(query, user) }

  @Post() @RequirePerm('inventory:warehouse:create')
  create(@Body() dto: CreateWarehouseDto, @CurrentUser() user: JwtUser) { return this.service.create(dto, user) }

  @Put(':id') @RequirePerm('inventory:warehouse:update')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateWarehouseDto, @CurrentUser() user: JwtUser) { return this.service.update(id, dto, user) }

  @Delete(':id') @RequirePerm('inventory:warehouse:delete')
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) { return this.service.remove(id, user) }

  @Get(':id/locations') @RequirePerm('inventory:warehouse:view')
  locations(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) { return this.service.listLocations(id, user) }

  @Post(':id/locations') @RequirePerm('inventory:warehouse:update')
  createLocation(@Param('id', ParseIntPipe) id: number, @Body() dto: CreateLocationDto, @CurrentUser() user: JwtUser) { return this.service.createLocation(id, dto, user) }

  @Put(':id/locations/:locationId') @RequirePerm('inventory:warehouse:update')
  updateLocation(@Param('id', ParseIntPipe) id: number, @Param('locationId', ParseIntPipe) locationId: number, @Body() dto: UpdateLocationDto, @CurrentUser() user: JwtUser) { return this.service.updateLocation(id, locationId, dto, user) }

  @Delete(':id/locations/:locationId') @RequirePerm('inventory:warehouse:update')
  removeLocation(@Param('id', ParseIntPipe) id: number, @Param('locationId', ParseIntPipe) locationId: number, @CurrentUser() user: JwtUser) { return this.service.removeLocation(id, locationId, user) }
}

@Controller('master-data/employees')
@UseGuards(...guards)
@DataScope({ org: 'dept', level: 'ORG' })
export class EmployeeController {
  constructor(private readonly service: EmployeeService) {}

  @Get() @RequirePerm('hr:employee:view')
  list(@Query() query: QueryEmployeeDto, @CurrentUser() user: JwtUser) { return this.service.list(query, user) }

  @Post() @RequirePerm('hr:employee:create')
  create(@Body() dto: CreateEmployeeDto, @CurrentUser() user: JwtUser) { return this.service.create(dto, user) }

  @Put(':id') @RequirePerm('hr:employee:update')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateEmployeeDto, @CurrentUser() user: JwtUser) { return this.service.update(id, dto, user) }

  @Delete(':id') @RequirePerm('hr:employee:delete')
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) { return this.service.remove(id, user) }
}
