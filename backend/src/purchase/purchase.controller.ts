import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  Headers,
} from '@nestjs/common';
import { PurchaseService } from './purchase.service';

@Controller('purchase')
export class PurchaseController {
  constructor(private readonly purchaseService: PurchaseService) {}

  @Get()
  findAll(
    @Query('fornecedor') fornecedor?: string,
    @Query('formaPagamento') formaPagamento?: string,
    @Query('statusCompra') statusCompra?: string,
    @Query('cardId') cardId?: string,
  ) {
    return this.purchaseService.findAll({
      fornecedor,
      formaPagamento,
      statusCompra,
      cardId,
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.purchaseService.findOne(id);
  }

  @Post()
  create(
    @Body() data: any,
    @Headers('x-usuario') usuario = 'admin', // Autenticação simples via header
  ) {
    return this.purchaseService.create({
      ...data,
      usuarioResponsavel: usuario,
    });
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body('statusCompra') statusCompra: string,
    @Headers('x-usuario') usuario = 'admin',
  ) {
    return this.purchaseService.updateStatus(id, statusCompra, usuario);
  }

  @Delete(':id')
  remove(
    @Param('id') id: string,
    @Headers('x-usuario') usuario = 'admin',
  ) {
    return this.purchaseService.remove(id, usuario);
  }
}
