import { Module } from "@nestjs/common";
import { DashboardStatsController } from "../../api/dashboard/stats.controller";
import { DatabaseModule } from "../../infrastructure/database";
import { GetDashboardStatsHandler } from "./get-dashboard-stats/get-dashboard-stats.handler";
import { GetTopPerformersHandler } from "./get-top-performers/get-top-performers.handler";

@Module({
  imports: [DatabaseModule],
  controllers: [DashboardStatsController],
  providers: [GetDashboardStatsHandler, GetTopPerformersHandler],
  exports: [GetDashboardStatsHandler, GetTopPerformersHandler],
})
export class DashboardModule {}
