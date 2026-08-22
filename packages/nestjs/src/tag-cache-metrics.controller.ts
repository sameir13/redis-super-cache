import { Controller, Get, Header } from "@nestjs/common";
import { metricsEndpoint } from "redis-super-cache";

@Controller("metrics")
export class TagCacheMetricsController {
  @Get()
  @Header("Content-Type", "text/plain")
  async metrics(): Promise<string> {
    return metricsEndpoint();
  }
}
