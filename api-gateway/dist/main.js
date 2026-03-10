"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
const swagger_1 = require("@nestjs/swagger");
const common_1 = require("@nestjs/common");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    app.useGlobalPipes(new common_1.ValidationPipe({ transform: true, whitelist: true }));
    app.enableCors();
    const config = new swagger_1.DocumentBuilder()
        .setTitle('RetroStore Public API')
        .setDescription('Public API gateway for NakamaRetroStore — games, achievements, leaderboard')
        .setVersion('1.0')
        .build();
    const document = swagger_1.SwaggerModule.createDocument(app, config);
    swagger_1.SwaggerModule.setup('docs', app, document);
    const port = process.env.PORT ?? 3000;
    await app.listen(port);
    console.log(`RetroStore API Gateway running on port ${port}`);
}
bootstrap();
//# sourceMappingURL=main.js.map