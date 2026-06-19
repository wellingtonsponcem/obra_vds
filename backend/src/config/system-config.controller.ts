import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Patch,
} from '@nestjs/common';
import { SystemConfigService } from './system-config.service';

@Controller('config')
export class SystemConfigController {
  constructor(private readonly configService: SystemConfigService) {}

  @Get('cards')
  getCards() {
    return this.configService.getCards();
  }

  @Post('cards')
  createCard(@Body() data: { nome: string; finalCartao: string; limite?: number }) {
    return this.configService.createCard(data);
  }

  @Delete('cards/:id')
  deleteCard(@Param('id') id: string) {
    return this.configService.deleteCard(id);
  }

  @Get('keys')
  getKeys() {
    return this.configService.getKeys();
  }

  @Post('keys')
  updateKey(@Body() data: { key: string; value: string }) {
    return this.configService.updateKey(data.key, data.value);
  }

  @Get('suggestions')
  getSuggestions() {
    return this.configService.getSuppliersAndCardsSuggestions();
  }
}
