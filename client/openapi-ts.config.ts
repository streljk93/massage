import { defineConfig } from "@hey-api/openapi-ts";

export default defineConfig({
  input: "../back/openapi/openapi.json",
  /** Сгенерированные файлы — только из спеки; не править вручную. */
  output: "src/shared/api/generated/sdk",
});
