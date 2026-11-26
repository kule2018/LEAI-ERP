import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AuditModule } from '../audit/audit.module'
import { CustomerService } from './customer.service'
import { EmployeeService } from './employee.service'
import { CustomerAddressEntity } from './entities/customer-address.entity'
import { CustomerContactEntity } from './entities/customer-contact.entity'
import { CustomerEntity } from './entities/customer.entity'
import { EmployeeEntity } from './entities/employee.entity'
import { LocationEntity } from './entities/location.entity'
import { ProductBrandEntity } from './entities/product-brand.entity'
import { ProductCategoryEntity } from './entities/product-category.entity'
import { ProductUnitConversionEntity } from './entities/product-unit-conversion.entity'
import { ProductUnitEntity } from './entities/product-unit.entity'
import { ProductVariantEntity } from './entities/product-variant.entity'
import { ProductEntity } from './entities/product.entity'
import { SupplierEntity } from './entities/supplier.entity'
import { WarehouseEntity } from './entities/warehouse.entity'
import {
  CustomerController,
  EmployeeController,
  LookupController,
  ProductController,
  ProductUnitController,
  SupplierController,
  WarehouseController
} from './master-data.controller'
import { ProductService } from './product.service'
import { ProductUnitService } from './product-unit.service'
import { SupplierService } from './supplier.service'
import { WarehouseService } from './warehouse.service'

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CustomerEntity,
      CustomerContactEntity,
      CustomerAddressEntity,
      SupplierEntity,
      ProductEntity,
      ProductVariantEntity,
      ProductCategoryEntity,
      ProductBrandEntity,
      ProductUnitEntity,
      ProductUnitConversionEntity,
      WarehouseEntity,
      LocationEntity,
      EmployeeEntity
    ]),
    AuditModule
  ],
  controllers: [
    CustomerController,
    SupplierController,
    ProductController,
    ProductUnitController,
    LookupController,
    WarehouseController,
    EmployeeController
  ],
  providers: [
    CustomerService,
    SupplierService,
    ProductService,
    ProductUnitService,
    WarehouseService,
    EmployeeService
  ],
  exports: [TypeOrmModule]
})
export class MasterDataModule {}
