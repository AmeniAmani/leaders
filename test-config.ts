import { defineConfig } from 'prisma/config';

const configObj = defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: 'postgres://localhost/test',
  },
});

console.log("configObj:", configObj);
console.log("datasource keys:", Object.keys(configObj));
console.log("datasource direct property access:", (configObj as any).datasource);
console.log("JSON:", JSON.stringify(configObj, null, 2));
