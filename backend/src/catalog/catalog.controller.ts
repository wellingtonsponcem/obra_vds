import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import { CatalogService } from './catalog.service';

@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get('summary')
  getSummary() {
    return this.catalogService.getSummary();
  }

  @Get()
  findAll(
    @Query('categoria') categoria?: string,
    @Query('statusCatalogo') statusCatalogo?: string,
    @Query('prioridade') prioridade?: string,
    @Query('localCompraPlanejado') localCompraPlanejado?: string,
    @Query('search') search?: string,
  ) {
    return this.catalogService.findAll({
      categoria,
      statusCatalogo,
      prioridade,
      localCompraPlanejado,
      search,
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.catalogService.findOne(id);
  }

  @Post()
  create(@Body() data: any) {
    return this.catalogService.create(data);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() data: any) {
    return this.catalogService.update(id, data);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.catalogService.remove(id);
  }
}
