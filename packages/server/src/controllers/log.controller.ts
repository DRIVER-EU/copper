import { Get, Controller, Param, Body, Put } from "@nestjs/common";
import { LayerSource } from "@csnext/cs-layer-server";

import {
  ApiUseTags,
  ApiOperation,
  ApiImplicitParam,
  ApiResponse
} from "@nestjs/swagger";
import { LayerService } from '@csnext/cs-layer-server';

@ApiUseTags()
@Controller("tiles")
export class LogController {
  constructor(private readonly layerService: LayerService) {}


 
}
