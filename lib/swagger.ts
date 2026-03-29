import { createSwaggerSpec } from "next-swagger-doc";

export async function getApiDocs() {
  return createSwaggerSpec({
    apiFolder: "app/api",
    definition: {
      openapi: "3.0.0",
      info: {
        title: "Local First App API",
        version: "0.1.0",
        description: "智能菜谱与图片生成相关 HTTP API",
      },
      servers: [{ url: "/", description: "当前站点" }],
    },
  });
}
