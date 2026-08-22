import { Controller, Get, Header } from "@nestjs/common";
import { metricsEndpoint } from "tagcache";

@Controller("metrics")
export class TagCacheMetricsController {
  @Get()
  @Header("Content-Type", "text/plain")
  async metrics(): Promise<string> {
    return metricsEndpoint();
  }
}
